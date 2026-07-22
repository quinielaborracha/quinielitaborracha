// Test funcional de v3.1.4 — BUG REPORTADO: al editar como admin la
// quiniela de un participante MIGRADO del sistema anterior, cambiar el
// resultado de una ronda (ej. Semifinal) para que gane un equipo
// DISTINTO al que ganaba antes NO se reflejaba en la ronda siguiente
// (ej. Final seguía mostrando al equipo viejo) -- porque una predicción
// migrada confía en SU PROPIA huella _a/_b, sin mirar nunca el
// resultado de la ronda anterior (a propósito, ver v6.2 en
// computeBracket -- evita mezclar equipos que en el bracket original de
// esa persona nunca se enfrentaron). Pero eso también bloqueaba una
// corrección legítima del admin.
//
// FIX: propagateMigratedKoChange() (registro.js), llamada desde los
// handlers de input/click del wizard, reemplaza -- SOLO en la ronda
// migrada siguiente, y SOLO el lado que tenía al equipo viejo -- el
// ganador/perdedor anterior por el nuevo. El marcador de la ronda
// siguiente no se toca.
//
// Ejercita el flujo REAL: renderiza el paso de Semifinales del wizard,
// dispara el evento 'input' real sobre las casillas de marcador (mismo
// mecanismo que usa el admin en el navegador), y verifica que el paso
// de Final -- una vez renderizado -- ya muestra al ganador correcto.
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
  <div id="rg-content"></div>
  <div id="torneo-content"></div>
  <div id="toast"></div>
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
window.__fb = { PARTICIPANTS_COL:{}, PRIVADO_COL:{}, auth:{currentUser:null}, onSnapshot:()=>()=>{} };
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
const bridge = `
window.__test = {
  DB, get DRAFT_PID(){return DRAFT_PID;}, set DRAFT_PID(v){DRAFT_PID=v;},
  get DRAFT_PREDS(){return DRAFT_PREDS;}, set DRAFT_PREDS(v){DRAFT_PREDS=v;},
  get WIZ_STEP(){return WIZ_STEP;}, set WIZ_STEP(v){WIZ_STEP=v;},
  get ADMIN_OVERRIDE(){return ADMIN_OVERRIDE;}, set ADMIN_OVERRIDE(v){ADMIN_OVERRIDE=v;},
  computeBracket, enterWizardAs, renderQuinielaForm, WIZARD_STEPS,
  propagateMigratedKoChange,
};
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

const T = window.__test;
const W = window;

/* ════════════════════════════════════════════════════════════════
   SETUP — participante migrado con SF y Final, ambas migradas. En la
   Semifinal 1, Francia le gana a España (h:2, a:1). En la Final
   (migrada, con la huella ya cargada tal cual venía del sistema
   viejo), Francia (el ganador ORIGINAL de esa Semifinal) enfrenta a
   Portugal.
   ════════════════════════════════════════════════════════════════ */
const participant = {
  id:"p1", codigo:"QB-2026-0001", name:"Alejandro Migrado", city:"", country:"", countryIso:"",
  email:"alejandro@example.com", clave:"111111", ownerUid:null,
  estadoQuiniela:"enviada", lastStep:9,
  fechaCreacion:1, fechaActualizacion:Date.now(), fechaEnvio:2,
};
const preds = {};
// Fase de grupos completa -- necesaria para que computeBracket() llegue
// a "ready" (r32SembradoDeGrupos exige allGroupsComplete). Los r32/r16/qf
// no se cargan a propósito (no hace falta para este test, que solo mira
// la cadena sf → final/third), quedan sin resolver (null), sin afectar
// nada de lo que se verifica acá.
for(let mid=1; mid<=72; mid++) preds[mid] = { h:1, a:0 };
preds.sf_1 = { h:2, a:1, _a:"Francia", _b:"España", _migrated:true };
preds.sf_2 = { h:1, a:0, _a:"Portugal", _b:"Brasil", _migrated:true };
preds.third = { h:1, a:0, _a:"España", _b:"Brasil", _migrated:true };
preds.final = { h:2, a:1, _a:"Francia", _b:"Portugal", _migrated:true }; // Francia (ganador viejo de sf_1) vs Portugal
T.DB.participants = [participant];
T.DB.predictions = { p1: preds };
W.rebuildDynamicData();

console.log("── Antes de la corrección ──");
let bracket = T.computeBracket(T.DB.predictions.p1);
check("sf_1 resuelve a Francia como ganador", bracket.sf[0].winner === "Francia");
check("La Final muestra Francia vs Portugal", bracket.final.a==="Francia" && bracket.final.b==="Portugal");
check("La Final resuelve un ganador (Francia)", bracket.final.winner === "Francia");

console.log("\n── El admin entra a editar y cambia sf_1: ahora gana España (2-3) ──");
T.DRAFT_PID = "p1";
T.ADMIN_OVERRIDE = true; // la quiniela está "enviada" -- el admin la edita igual, vía el lápiz ✏️
T.DRAFT_PREDS = JSON.parse(JSON.stringify(T.DB.predictions.p1));
const sfIdx = T.WIZARD_STEPS.findIndex(s=>s.key==='sf');
T.WIZ_STEP = sfIdx;
T.renderQuinielaForm("p1", "inicio");

const inpH = W.document.querySelector('.score-input[data-slot="sf_1"][data-side="h"]');
const inpA = W.document.querySelector('.score-input[data-slot="sf_1"][data-side="a"]');
check("Existen las casillas de marcador de sf_1", !!inpH && !!inpA);
inpH.value = "2"; inpH.dispatchEvent(new W.Event("input", { bubbles:true }));
inpA.value = "3"; inpA.dispatchEvent(new W.Event("input", { bubbles:true }));

check("sf_1 ahora resuelve a España como ganador", T.computeBracket(T.DRAFT_PREDS).sf[0].winner === "España");

console.log("\n── Verificando que la Final se actualizó SOLA (propagación) ──");
check("La huella de 'final' reemplazó a Francia por España (el nuevo ganador de sf_1)",
  T.DRAFT_PREDS.final._a === "España" || T.DRAFT_PREDS.final._b === "España");
check("Portugal (el otro lado, que no cambió) sigue intacto en 'final'",
  T.DRAFT_PREDS.final._a === "Portugal" || T.DRAFT_PREDS.final._b === "Portugal");
check("El marcador de 'final' NO se tocó (2-1, sin cambios)", T.DRAFT_PREDS.final.h===2 && T.DRAFT_PREDS.final.a===1);
check("'final' sigue siendo _migrated (no se perdió la marca)", T.DRAFT_PREDS.final._migrated === true);

bracket = T.computeBracket(T.DRAFT_PREDS);
check("La Final ahora muestra España vs Portugal (ya NO Francia)",
  new Set([bracket.final.a, bracket.final.b]).has("España") && !new Set([bracket.final.a, bracket.final.b]).has("Francia"));
check("La Final resuelve un ganador (España, 2-1 se mantiene a favor del lado que tenía Francia)", bracket.final.winner === "España");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
