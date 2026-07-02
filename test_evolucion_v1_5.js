// Test funcional del fix v1.5:
//  1) Panel "Mi Evolución" (getChronoMatchEvents/buildHistoricalSnapshots/
//     groupSnapshotsByJornada/getTendenciaStats/getLogrosStats, nuevas en
//     scoring.js) — con partidos de GRUPOS y de ELIMINATORIA mezclados,
//     para confirmar que no se corta en la transición de fase.
//  2) Recuperación automática del Dashboard si algo dentro de una
//     sub-pestaña explota (ya no debe quedar "pegado" hasta refrescar).
//
// Carga los 22 archivos de producción en el mismo orden que index.html,
// con el mismo patrón de bridge-dentro-del-IIFE que ya usa
// test_registro_creacion_confirmada.js.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","partidos-grupos.js","utils.js","app-state.js","scoring.js","totp.js",
  "app-core-data.js","app-admin-auth.js","app-live-sync.js","app-tabs.js",
  "app-eliminatoria-data.js","app-batallas.js","app-bracket-render.js",
  "app-bracket-compute.js","app-bracket-espn-sync.js","app-bracket-view.js",
  "app-bracket-espn-live.js","app-integridad.js","app-predicciones.js",
  "app-estadisticas.js","app-admin-tools.js","app-bootstrap.js"
];

const html = `<!doctype html><html><body>
  <div id="rg-tabs"><button class="rg-tab on" data-tab="inicio">Inicio</button></div>
  <div id="rg-content"></div>
  <div id="toast"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
window.isAdmin = () => false;
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
window.__fb = null;

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

for (const file of FILES_IN_ORDER){
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try{
    window.document.body.appendChild(script);
  }catch(e){
    console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`);
    ok = false;
  }
}

let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = {
  DB, S, get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  get DASH_TAB(){ return DASH_TAB; }, set DASH_TAB(v){ DASH_TAB = v; },
  render, renderParticipantDashboard, buildDashEvolucionHtml,
};
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{
  window.document.body.appendChild(regScript);
}catch(e){
  console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`);
  ok = false;
}

if (!window.__test){ console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;
const W = window;

// ── Armar datos sintéticos: 5 participantes, partidos de GRUPOS ya
// jugados + partidos de ELIMINATORIA ya jugados (fase de grupos cerrada,
// torneo avanzado a eliminatoria) — exactamente el escenario "Grupos →
// Eliminatorias" que reportó el bug. ──
const NAMES = ["Ana","Beto","Carla","Diego","Elena"];
T.DB.participants = NAMES.map((n,i)=>({id:"p"+i, name:n, city:"Ciudad"+i, country:"País"+i}));
T.DB.predictions = {};
NAMES.forEach((n,i)=>{ T.DB.predictions["p"+i] = {}; });

W.rebuildDynamicData();

// 6 partidos de grupos jugados, en 2 días distintos (jornadas)
const baseTs = Date.parse("2026-06-11T12:00:00Z");
const DAY = 24*3600*1000;
for(let mid=1; mid<=6; mid++){
  const dayOffset = mid<=3 ? 0 : 1; // primeros 3 el día 1, siguientes 3 el día 2
  T.S.matchTimes[mid] = baseTs + dayOffset*DAY + mid*60000;
  T.S.scores[mid] = {h:2, a:1}; // "H" gana siempre
  NAMES.forEach((n,i)=>{
    T.DB.predictions["p"+i][mid] = (i%2===0) ? {h:2,a:1} : {h:0,a:0}; // pares aciertan, impares no
  });
}
W.rebuildDynamicData(); // repoblar MD.preds con las nuevas predicciones

// Fase de grupos cerrada + activar eliminatoria (mismo patrón que usa el
// motor real: DB.configGlobal.fasesActivas / S.bonos.closed)
T.DB.configGlobal.fasesActivas = T.DB.configGlobal.fasesActivas || {};
T.S.bonos.closed = T.S.bonos.closed || {};
T.S.bonos.closed["grupos"] = true;

// 2 partidos de eliminatoria (dieciseisavos, pids 73-74) jugados en un
// tercer día, con resultado + predicción de llave correcta para todos.
for(const pid of [73,74]){
  T.S.elimTimes[pid] = baseTs + 2*DAY + pid*60000;
  T.S.elimScores[pid] = {h:1,a:0};
}

let evtEx=null, evtCount=0;
try{
  evtCount = W.getChronoMatchEvents().length;
}catch(e){ evtEx=e; }
check("getChronoMatchEvents() no lanza excepción con Grupos+Eliminatoria mezclados", !evtEx);
check("getChronoMatchEvents() incluye los 6 partidos de grupos (aunque no cuenten llave en elim)", evtCount>=6);

// ── Render real del Dashboard de un participante, pestaña Evolución,
// justo después de la transición de fase — este es el repro exacto del
// bug reportado. ──
T.DRAFT_PID = "p0";
T.DASH_TAB = "evolucion";
let renderEx = null;
try{
  T.renderParticipantDashboard("p0");
}catch(e){ renderEx = e; }
check("renderParticipantDashboard() con pestaña Evolución NO lanza excepción tras pasar a Eliminatoria", !renderEx);

const contentHtml = W.document.getElementById("rg-content").innerHTML;
check("El panel de Evolución se pintó (contiene 'Evolución en el Ranking')", contentHtml.includes("Evolución en el Ranking"));
check("NO cayó en el cartel de error", !contentHtml.includes("Hubo un problema al cargar esta sección"));
check("DASH_TAB se mantuvo en 'evolucion' (no hubo error que lo reseteara)", T.DASH_TAB === "evolucion");

// ── Prueba de recuperación: forzar un error real dentro del cálculo
// (rompiendo getChronoMatchEvents temporalmente) y confirmar que el
// nuevo try/catch lo atrapa, resetea a 'perfil' y NO deja la vista
// corrupta ni requiere refrescar la página. ──
const realGetChronoMatchEvents = W.getChronoMatchEvents;
W.getChronoMatchEvents = () => { throw new Error("error forzado de prueba"); };
T.DASH_TAB = "evolucion";
let recoverEx = null;
try{
  T.renderParticipantDashboard("p0");
}catch(e){ recoverEx = e; }
W.getChronoMatchEvents = realGetChronoMatchEvents; // restaurar antes de seguir

check("Con un error forzado, renderParticipantDashboard() NO lanza excepción sin atrapar (antes sí lo hacía)", !recoverEx);
const recoverHtml = W.document.getElementById("rg-content").innerHTML;
check("Con un error forzado, se muestra el cartel de 'Reintentar' en vez de pantalla corrupta", recoverHtml.includes("Hubo un problema al cargar esta sección"));
check("Con un error forzado, DASH_TAB se resetea solo a 'perfil' (ya no queda pegado)", T.DASH_TAB === "perfil");

// ── Confirmar que, tras el auto-reset, un render posterior (ej. volver a
// entrar a Mi Quiniela desde el menú principal) YA FUNCIONA SIN refrescar
// la página — este es el corazón del bug original. ──
let secondRenderEx = null;
try{
  T.renderParticipantDashboard("p0");
}catch(e){ secondRenderEx = e; }
const secondHtml = W.document.getElementById("rg-content").innerHTML;
check("Después del auto-reset, volver a renderizar YA NO explota (recuperado sin refrescar la página)", !secondRenderEx && !secondHtml.includes("Hubo un problema"));

console.log(`\n=== RESULTADO: ${ok ? "TODO OK ✅" : "HAY ERRORES ❌"} ===`);
process.exit(ok?0:1);
