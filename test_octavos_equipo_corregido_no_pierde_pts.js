// Test funcional de v3.2.4 — BUG REAL REPORTADO: "configuré el torneo
// para arrancar en Octavos (Grupos y Dieciseisavos desactivados) y ya
// pasó un partido, pero el ranking no suma esos puntos". El usuario
// mismo sospechó que el conflicto era justo la diferencia entre el
// torneo completo (funcionaba) y arrancar en Octavos (falla) -- y así
// era.
//
// CAUSA RAÍZ: cuando el torneo arranca en Octavos, ese es el ÚNICO round
// donde TODOS los participantes comparten los mismos equipos "reales"
// (los carga el admin, ver getManualTeamPids()/S.elimTeams) -- en el
// torneo completo de siempre, Dieciseisavos en cambio se siembra de LOS
// PROPIOS resultados de grupo de cada participante, nunca de datos
// compartidos del admin. El wizard (registro.js) SIEMPRE muestra el
// equipo real VIGENTE (S.elimTeams) para ese slot, pero al tipear un
// marcador congelaba ese nombre en _a/_b de la predicción tal cual
// estaba en ese momento. Si el admin corrige después el nombre del
// equipo (typo, acento, ESPN reordena local/visitante) — algo rutinario
// mientras se carga el bracket real — la copia congelada del
// participante queda desincronizada de S.elimTeams: isLlaveCorrecta()
// (scoring.js) empieza a dar false para ese participante aunque haya
// acertado el ganador real, y su puntaje queda pegado en 0 para ese
// partido para siempre, sin ningún error visible.
//
// FIX: getElimTeams() (scoring.js) ahora, para el pid de la fase MANUAL,
// confía siempre en el equipo real VIGENTE (S.elimTeams) en vez de la
// copia congelada — mismo criterio que ya usa la UI (trustSlot,
// registro.js). No hay "llave" que adivinar en ese slot: todos comparten
// el mismo cruce real, solo se adivina el resultado.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","partidos-grupos.js","utils.js", "paises.js","app-static-data.js","app-state.js","scoring.js","totp.js",
  "app-core-data.js","app-admin-auth.js","app-live-sync.js","app-tabs.js",
  "app-eliminatoria-data.js","app-batallas.js","app-bracket-render.js",
  "app-bracket-annexc.js","app-bracket-compute.js","app-bracket-espn-sync.js","app-bracket-view.js",
  "app-bracket-espn-live.js","app-integridad.js","app-predicciones.js",
  "app-estadisticas.js","app-admin-tools.js","app-bootstrap.js"
];

const html = `<!doctype html><html><body>
  <div id="rg-tabs"><button class="rg-tab on" data-tab="inicio">Inicio</button></div>
  <div id="rg-content"></div><div id="torneo-content"></div><div id="toast"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};
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

let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `window.__test = { DB, S, PID_TO_SLOT };`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

const T = window.__test;
const W = window;

// Torneo sin Grupos ni Dieciseisavos -- Octavos (r8) es la primera fase
// activa y la que recibe equipos "a mano" del admin.
T.DB.configGlobal.fasesActivas = { grupos:false, r16:false };
T.DB.participants = [{id:"p1", name:"Juan Test", estadoQuiniela:"enviada"}];
T.DB.predictions = { p1: {} };
W.rebuildDynamicData();

const manualPids = W.getManualTeamPids();
check("Octavos (r8) es la fase manual con este torneo", W.getFirstActiveElimPhase()?.key === "r8");
const pid = manualPids[0]; // 89
const slot = T.PID_TO_SLOT[pid];

/* ════════════════════════════════════════════════════════════════
   PASO 1 — El admin carga los equipos reales con un typo real (no algo
   que un simple toLowerCase() ya arregle -- ver n() en utils.js, solo
   normaliza mayúsculas/espacios, no esto).
   ════════════════════════════════════════════════════════════════ */
T.S.elimTeams[pid] = { h:"Korea del Sur", a:"Brasil" }; // typo real

/* ════════════════════════════════════════════════════════════════
   PASO 2 — El participante llena el wizard: ve esos equipos (los
   reales vigentes en ese momento) y predice que gana Corea del Sur 2-1.
   Esto es EXACTAMENTE lo que hace el listener real de registro.js
   (línea "DRAFT_PREDS[slot]._a = ta; DRAFT_PREDS[slot]._b = tb;") --
   se simula guardando directo en DB.predictions con esos mismos
   nombres, tal como quedaron congelados en ese momento.
   ════════════════════════════════════════════════════════════════ */
T.DB.predictions.p1[slot] = { _a:"Korea del Sur", _b:"Brasil", h:2, a:1 };

/* ════════════════════════════════════════════════════════════════
   PASO 3 — El admin corrige el typo DESPUÉS de que el participante ya
   predijo. La predicción del participante sigue apuntando al nombre
   VIEJO (con el typo).
   ════════════════════════════════════════════════════════════════ */
T.S.elimTeams[pid] = { h:"Corea del Sur", a:"Brasil" }; // corregido

/* ════════════════════════════════════════════════════════════════
   PASO 4 — El partido termina: Corea del Sur 2 - Brasil 1 (coincide
   EXACTO con lo que predijo el participante).
   ════════════════════════════════════════════════════════════════ */
T.S.elimScores[pid] = { h:2, a:1, live:false };

console.log("\n--- Verificación ---");
check("getElimTeams() usa el nombre REAL vigente (corregido), no la copia congelada",
  W.getElimTeams("Juan Test", pid)?.h === "Corea del Sur");
check("isLlaveCorrecta() sigue dando true a pesar de la corrección posterior del nombre",
  W.isLlaveCorrecta("Juan Test", pid) === true);

const breakdown = W.calcElimMatchBreakdown("Juan Test", pid);
console.log("calcElimMatchBreakdown:", JSON.stringify(breakdown));
check("calcElimMatchPts() sigue sumando los puntos completos (llave+ganador+exacto), NO 0pts silencioso",
  W.calcElimMatchPts("Juan Test", pid) > 0);

check("getRank() refleja el puntaje real, no 0",
  W.getRank().find(r=>r.name==="Juan Test")?.total > 0);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
