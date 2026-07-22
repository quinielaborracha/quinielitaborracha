// Test funcional de v3.15.2 — BUG REAL REPORTADO por el usuario: en un
// cruce de eliminatoria que terminó EMPATADO (se define por penales), el
// wizard (registro.js/koWinner) muestra correctamente "pasa <el equipo
// que el participante marcó con el botón de penales>" -- pero el motor de
// puntos (scoring.js) ignoraba ese pick en 3 lugares (getPredWinner,
// calcClassifiedPtsForPid, getClassifiedBadgeForPid) y asumía SIEMPRE que
// avanzaba el LOCAL (teams.h, el de la izquierda). Si el participante
// eligió al VISITANTE (teams.a, el de la derecha -- ej. "Brasil vs
// Inglaterra" marcando que pasa Inglaterra, o "Colombia vs España"
// marcando que pasa España), el bono de "Clasificado" quedaba en 0pts
// aunque el pick fuera correcto.
//
// Reusa el mismo truco que test_octavos_equipo_corregido_no_pierde_pts.js
// (arrancar el torneo en Octavos, único round donde todos comparten el
// mismo cruce "a mano" del admin) para no tener que simular el sembrado
// completo de Dieciseisavos desde grupos.
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
T.DB.participants = [
  { id:"p1", name:"Sergio Test", estadoQuiniela:"enviada" },
  { id:"p2", name:"Otro Participante", estadoQuiniela:"enviada" },
];
T.DB.predictions = { p1:{}, p2:{} };
W.rebuildDynamicData();

check("Octavos (r8) es la fase manual con este torneo", W.getFirstActiveElimPhase()?.key === "r8");
const pid = W.getManualTeamPids()[0]; // 89
const slot = T.PID_TO_SLOT[pid];

/* ════════════════════════════════════════════════════════════════
   Brasil (local) vs Inglaterra (visitante, el de la derecha). Sergio
   predice 1-1 y, en el pick de penales del wizard, marca que avanza
   Inglaterra (el equipo de la derecha) -- exactamente el escenario que
   reportó el usuario.
   ════════════════════════════════════════════════════════════════ */
T.S.elimTeams[pid] = { h:"Brasil", a:"Inglaterra" };
T.DB.predictions.p1[slot] = { _a:"Brasil", _b:"Inglaterra", h:1, a:1, pick:"Inglaterra" };
// Control: otro participante predice el mismo empate pero elige que
// avanza el LOCAL (Brasil) -- para confirmar que el fix no rompe ese caso.
T.DB.predictions.p2[slot] = { _a:"Brasil", _b:"Inglaterra", h:1, a:1, pick:"Brasil" };

// Resultado real: empate 1-1, Inglaterra avanza por penales.
T.S.elimScores[pid] = { h:1, a:1, live:false };
T.S.tieBreakers[pid] = "a"; // "a" = visitante (Inglaterra) avanza

console.log("\n--- Verificación ---");
check("getPredWinner() respeta el pick de penales del participante (Inglaterra, el de la derecha)",
  W.getPredWinner("Sergio Test", pid) === "Inglaterra");
check("getPredWinner() sigue funcionando cuando el pick es el LOCAL (Brasil)",
  W.getPredWinner("Otro Participante", pid) === "Brasil");

const classifiedPts = W.getFaseValor(W.getPhaseByKey("r8"), "classifiedPts");
check("calcClassifiedPtsForPid() SUMA el bono de Clasificado para quien acertó a Inglaterra",
  W.calcClassifiedPtsForPid("Sergio Test", pid) === classifiedPts);

const badge = W.getClassifiedBadgeForPid("Sergio Test", pid);
console.log("getClassifiedBadgeForPid:", JSON.stringify(badge));
check("getClassifiedBadgeForPid() marca el pick de Sergio (Inglaterra) como clasificado",
  badge && badge.team === "Inglaterra" && badge.advanced === true);

check("getRank() de Sergio incluye esos puntos de Clasificado (no 0 silencioso)",
  W.getRank().find(r=>r.name==="Sergio Test")?.elim >= classifiedPts);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
