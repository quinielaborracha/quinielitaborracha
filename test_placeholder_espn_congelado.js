// Test funcional de v3.2.4 — este archivo empezó como un DIAGNÓSTICO
// (sin fix) que confirmaba un bug real: cuando ESPN todavía no resolvía
// el rival de un cruce de la fase manual (devuelve un placeholder tipo
// "Round of 32 14 Winner" en vez de un país) y el participante predecía
// un marcador en ese momento, su predicción guardaba ese texto como
// "huella" congelada (_a/_b) -- y esa huella NUNCA se actualizaba
// después, aunque el equipo real ya se hubiera confirmado (Argentina).
// Este mismo mecanismo es la causa raíz del bug real reportado por el
// usuario en producción: "configuré el torneo para arrancar en Octavos y
// el ranking no suma los puntos de un partido ya jugado" -- cualquier
// corrección/actualización posterior del nombre del equipo real (typo,
// ESPN resolviendo el rival, etc.) dejaba a quien ya había predicho con
// una huella desincronizada, e isLlaveCorrecta() (scoring.js) empezaba a
// dar false aunque el participante hubiera acertado el resultado real.
//
// FIX (getElimTeams(), scoring.js): para el pid de la fase MANUAL
// (getManualTeamPids()), ya no se confía en la huella congelada -- se
// usa siempre el equipo real VIGENTE (S.elimTeams), igual que ya hacía
// la UI del wizard (trustSlot, registro.js). Este test ahora verifica
// que la vista de Predicciones (panel Admin) y getElimTeams() SÍ se
// actualizan al equipo real, en vez de quedarse con el placeholder viejo.
//
// Carga los archivos de producción reales, mismo patrón que los demás
// test_*.js del repo.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","torneo-mundial2026.js", "partidos-grupos.js","utils.js", "paises.js","app-static-data.js","app-state.js","scoring.js","totp.js",
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
window.__fb = null;
window.requestAnimationFrame = () => 0;

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

for (const file of FILES_IN_ORDER){
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try{ window.document.body.appendChild(script); }
  catch(e){ console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`); ok = false; }
}

// Bridge: `let`/`const` de script clásico no quedan como propiedades de
// `window` (solo `var`/`function` sí) — exponemos lo que el test
// necesita, mismo patrón que ya usa test_espn_elim_gameid.js.
const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `
window.__test = {
  DB, S, PID_TO_SLOT,
  rebuildDynamicData, renderBracket, getElimTeams, getRealElimTeams,
};
`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;

/* ════════════════════════════════════════════════════════════════
   SETUP — torneo que arranca en Octavos (Grupos + Dieciseisavos
   desactivados), igual que el torneo real de este proyecto (ver
   memoria de proyecto). P95 (Octavos) es un pid MANUAL: sus equipos
   los carga el admin/ESPN directo en S.elimTeams, no se derivan de
   ELIM_TREE.
   ════════════════════════════════════════════════════════════════ */
T.DB.configGlobal.fasesActivas = { grupos:false, r16:false };
const p = {id:"p1", codigo:"QLB-2026-0001", name:"Juan Pérez", city:"C", country:"P",
  email:"juan@example.com", clave:"111111", ownerUid:"anon-juan",
  estadoQuiniela:"borrador", fechaCreacion:Date.now(), fechaActualizacion:Date.now(), lastStep:2};
T.DB.participants = [p];
// slot 'r16_7' -> pid 95 (SLOT_TO_PID: KO_SLOT_IDS_V62[16+8+4+2+1+ ... ] --
// más simple: usamos PID_TO_SLOT, ya construido por app-core-data.js).
const slot95 = T.PID_TO_SLOT[95];
check("PID_TO_SLOT[95] existe (slot del wizard para P95)", !!slot95);

// ESPN todavía no resolvió el rival real de P95: el placeholder que
// devuelve su API para un cruce de ronda anterior sin resolver.
T.S.elimTeams[95] = { h:"Round of 32 14 Winner", a:"Egipto" };
T.DB.predictions = { p1: {
  [slot95]: { h:1, a:2, _a:"Round of 32 14 Winner", _b:"Egipto" }, // el participante predijo CONTRA el placeholder
} };
T.rebuildDynamicData();

/* ── PARTE 1 — mientras el equipo real sigue sin confirmar, la vista de
   Predicciones (admin) muestra el placeholder tal cual está guardado ── */
console.log("── Antes de confirmarse el rival real ──");
T.renderBracket();
let bodyHtml = window.document.getElementById("bracket-body").innerHTML;
check("Predicciones (admin) muestra el placeholder 'Round of 32 14 Winner' (aún sin confirmar)",
  bodyHtml.includes("Round of 32 14 Winner"));

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — ESPN/el admin confirma el rival real (Argentina, en vez del
   placeholder). Esto es EXACTAMENTE lo que hace fetchESPNElim() tras el
   fix de v2.9.2: escribe el país real en S.elimTeams[95].
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Después de confirmarse el rival real (Argentina) ──");
T.S.elimTeams[95] = { h:"Argentina", a:"Egipto" };
T.renderBracket();
bodyHtml = window.document.getElementById("bracket-body").innerHTML;

const real = T.getRealElimTeams(95);
check("getRealElimTeams(95) YA devuelve 'Argentina' (el motor de puntaje SÍ está al día)",
  real && real.h === "Argentina");

const stillShowsPlaceholder = bodyHtml.includes("Round of 32 14 Winner");
const nowShowsRealName = bodyHtml.includes(">Argentina<");
check("FIX: la vista de Predicciones (admin) ahora muestra el país real (Argentina), no el placeholder viejo",
  nowShowsRealName && !stillShowsPlaceholder);

// getElimTeams() (lo que alimenta pH/pA en renderBracket, y lo que usa
// isLlaveCorrecta() para puntuar) ahora se re-resuelve contra el equipo
// real VIGENTE en vez de la huella _a/_b congelada -- ya no se queda
// pegado al placeholder ni a un nombre viejo/con typo.
const equipoActual = T.getElimTeams("Juan Pérez", 95);
check("FIX: getElimTeams() ahora devuelve el equipo real vigente (Argentina), no la huella congelada",
  equipoActual && equipoActual.h === "Argentina");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
