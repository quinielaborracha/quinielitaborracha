// Test funcional de v3.0 — Parte B: corrección de predicciones YA
// GUARDADAS que quedaron con un placeholder de ESPN congelado (ej.
// "Round of 32 14 Winner") en vez de un país real, ahora que ese país
// ya se conoce (ver test_placeholder_espn_congelado.js para el
// diagnóstico original del problema, y la nota de isRealEspnTeamName()
// en utils.js / rgApplyEspnPlaceholderFixes() en participantes.js para
// el porqué de este mecanismo).
//
// Verifica:
//  1) scanEspnPlaceholderFixes() detecta el/los slot(s) afectados y NO
//     genera falsos positivos (predicciones sin problema, o slots cuyo
//     equipo real todavía no se conoce).
//  2) rgApplyEspnPlaceholderFixes() manda una escritura ACOTADA por
//     campo (rutas con punto, ej. "predictions.r16_7._a") -- no
//     reescribe el documento completo del participante (a diferencia
//     del mecanismo de v2.10, revertido por el riesgo de pisar una
//     edición concurrente).
//  3) Después de aplicar, la copia local se actualiza (optimista) y
//     getElimTeams()/isLlaveCorrecta() ya ven el país real.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","partidos-grupos.js","utils.js","app-static-data.js","app-state.js","scoring.js","totp.js",
  "app-core-data.js","app-admin-auth.js","app-live-sync.js","app-tabs.js",
  "app-eliminatoria-data.js","app-batallas.js","app-bracket-render.js",
  "app-bracket-annexc.js","app-bracket-compute.js","app-bracket-espn-sync.js","app-bracket-view.js",
  "app-bracket-espn-live.js","app-integridad.js","app-predicciones.js",
  "app-estadisticas.js","app-admin-tools.js","app-bootstrap.js"
];

const html = `<!doctype html><html><body>
  <div id="rg-tabs"><button class="rg-tab on" data-tab="inicio">Inicio</button></div>
  <div id="rg-content"></div>
  <div id="torneo-content"></div>
  <div id="toast"></div>
  <div id="bsel"></div><div id="bracket-body"></div>
  <div id="espn-placeholder-panel"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="teams-editor-body"></div><div id="teams-modal" style="display:none"></div>
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
window.isAdmin = () => true;
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
window.requestAnimationFrame = () => 0;

// Mock mínimo de Firebase: captura cada batch.update() para verificar
// EXACTAMENTE qué rutas/valores se mandan, sin depender de un backend real.
let capturedUpdates = [];
let commitCount = 0;
function makeMockBatch(){
  const ops = [];
  return {
    update: (ref, data) => { ops.push({ id: ref.__id, data }); },
    commit: () => { commitCount++; capturedUpdates.push(...ops); return Promise.resolve(); },
  };
}
window.__fb = {
  auth: { currentUser: { uid: "admin-uid" } },
  PARTICIPANTS_COL: {},
  doc: (col, id) => ({ __id: id }),
  writeBatch: () => makeMockBatch(),
  serverTimestamp: () => "SERVER_TS",
  onSnapshot: () => () => {},
};

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

for (const file of FILES_IN_ORDER){
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try{ window.document.body.appendChild(script); }
  catch(e){ console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`); ok = false; }
}

const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `
window.__test = {
  DB, S, PID_TO_SLOT, SLOT_TO_PID,
  rebuildDynamicData, renderBracket, getElimTeams, getRealElimTeams, isLlaveCorrecta,
  scanEspnPlaceholderFixes, runEspnPlaceholderScan, applyEspnPlaceholderFixesChecked,
};
`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;

/* ════════════════════════════════════════════════════════════════
   SETUP — torneo que arranca en Octavos (Grupos + Dieciseisavos
   desactivados). 3 participantes:
     p1: predijo CONTRA el placeholder de ESPN en P95 (_a) -- el caso a corregir.
     p2: predijo bien desde el principio (sin placeholder) -- no debe tocarse.
     p3: P96 con un EMPATE resuelto por penales (pick) contra el placeholder
         -- también debe corregirse, y el pick debe seguir apuntando al
         mismo LADO ganador (ahora con el nombre real).
   ════════════════════════════════════════════════════════════════ */
T.DB.configGlobal.fasesActivas = { grupos:false, r16:false };
const PLACEHOLDER = "Round of 32 14 Winner";
T.DB.participants = [
  {id:"p1", codigo:"QLB-2026-0001", name:"Juan Pérez", city:"C", country:"P", email:"j@x.com", clave:"111111", ownerUid:"anon-1", estadoQuiniela:"borrador", fechaCreacion:1, fechaActualizacion:1, lastStep:2},
  {id:"p2", codigo:"QLB-2026-0002", name:"Ana Gómez",  city:"C", country:"P", email:"a@x.com", clave:"222222", ownerUid:"anon-2", estadoQuiniela:"enviada",  fechaCreacion:1, fechaActualizacion:1, lastStep:9},
  {id:"p3", codigo:"QLB-2026-0003", name:"Luis Mora",  city:"C", country:"P", email:"l@x.com", clave:"333333", ownerUid:"anon-3", estadoQuiniela:"borrador", fechaCreacion:1, fechaActualizacion:1, lastStep:2},
];
const slot95 = T.PID_TO_SLOT[95]; // Octavos
const slot96 = T.PID_TO_SLOT[96]; // Octavos
const slot89 = T.PID_TO_SLOT[89]; // Octavos -- todavía sin resolver (nadie lo toca)
T.DB.predictions = {
  p1: { [slot95]: { h:1, a:2, _a:PLACEHOLDER, _b:"Egipto" } },
  p2: { [slot95]: { h:0, a:0, _a:"Argentina", _b:"Egipto" } }, // ya estaba bien -- no debe aparecer
  p3: { [slot96]: { h:1, a:1, pick:PLACEHOLDER, _a:PLACEHOLDER, _b:"Suiza" } }, // empate, penales al placeholder
};
// P89 queda sin resolver a propósito (getRealElimTeams(89) debe devolver
// null) para verificar que un slot sin equipo real conocido NO se toca.
T.S.elimTeams = {
  95: { h:"Argentina", a:"Egipto" }, // ya confirmado -- el real
  96: { h:"Brasil", a:"Suiza" },     // ya confirmado -- el real
};
T.rebuildDynamicData();

/* ── PARTE 1 — el scan detecta exactamente lo esperado, sin falsos positivos ── */
console.log("── scanEspnPlaceholderFixes() ──");
const scan = T.scanEspnPlaceholderFixes();
check("Detecta exactamente 3 correcciones (p1._a, p3._a y p3.pick)", scan.rows.length === 3);
check("p2 (ya estaba bien) NO aparece en el reporte", !scan.rows.some(r=>r.participantId==="p2"));
check("P89 (equipo real todavía no conocido) no generó ninguna fila", !scan.rows.some(r=>r.pid===89));
const p1Fix = scan.rows.find(r=>r.participantId==="p1");
check("p1: detecta el _a viejo (placeholder) y el nuevo (Argentina)", p1Fix && p1Fix.oldValue===PLACEHOLDER && p1Fix.newValue==="Argentina");
const p3PickFix = scan.rows.find(r=>r.participantId==="p3"&&r.field==="pick");
check("p3: el pick se corrige a 'Brasil' (mismo lado que tenía el placeholder)", p3PickFix && p3PickFix.newValue==="Brasil");
check("byParticipant trae la ruta con punto correcta para p1", scan.byParticipant.p1[`predictions.${slot95}._a`]==="Argentina");

(async () => {
  /* ── PARTE 2 — flujo real de UI: runEspnPlaceholderScan() (popula el
     caché interno) + applyEspnPlaceholderFixesChecked() (confirm() +
     escritura + actualización optimista de la copia local) ── */
  console.log("\n── runEspnPlaceholderScan() + applyEspnPlaceholderFixesChecked() ──");
  T.runEspnPlaceholderScan();
  capturedUpdates = []; commitCount = 0;
  await T.applyEspnPlaceholderFixesChecked().then(n=>{
    check("Resuelve con la cantidad correcta de participantes corregidos (2)", n===2);
  });
  check("Se hizo UN solo commit (todo en un batch atómico)", commitCount===1);
  check("Se mandaron exactamente 2 escrituras (una por participante), no una por cada uno de los 27", capturedUpdates.length===2);
  const p1Update = capturedUpdates.find(u=>u.id==="p1");
  check("La escritura de p1 SOLO toca predictions._a de ese slot (ruta puntual), no el documento completo",
    Object.keys(p1Update.data).filter(k=>k.startsWith("predictions.")).length===1
    && p1Update.data[`predictions.${slot95}._a`]==="Argentina");
  check("La escritura de p1 NO incluye el resto de sus campos públicos (name/codigo/etc)",
    p1Update.data.name===undefined && p1Update.data.codigo===undefined);

  /* ── PARTE 3 — la copia local ya refleja el país real, sin esperar el
     round-trip del snapshot (optimista) ── */
  console.log("\n── Efecto en la copia local tras aplicar ──");
  check("p1: getElimTeams ya devuelve 'Argentina' (antes: el placeholder)",
    T.getElimTeams("Juan Pérez", 95) && T.getElimTeams("Juan Pérez", 95).h === "Argentina");
  check("p1: isLlaveCorrecta ahora es TRUE (antes de la corrección era imposible que coincidiera)",
    T.isLlaveCorrecta("Juan Pérez", 95) === true);
  check("p3: el pick corregido a 'Brasil' quedó reflejado en DB.predictions",
    T.DB.predictions.p3[slot96].pick === "Brasil");

  console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
  process.exit(ok ? 0 : 1);
})();
