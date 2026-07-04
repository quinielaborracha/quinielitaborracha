// Test funcional de v3.1.3 — BUG REPORTADO ("desde los inicios"): un
// participante MIGRADO del sistema anterior (sus 32 predicciones de
// eliminatoria traen _migrated:true, ver KO_TREE/computeBracket en
// registro.js) se importaba al 100%, pero apenas el admin entraba a
// "Editar" y el wizard hacía SU PRIMER autoguardado (con solo cambiar
// de paso alcanzaba, sin tocar nada), el % de avance de esa persona
// bajaba (ej. 100% -> 69%) y las fases de eliminatoria se veían vacías.
//
// CAUSA RAÍZ: flushAutosave() reconstruye cada predicción de
// eliminatoria a mano (whitelist de campos: h/a/pick/_a/_b) pero NUNCA
// conservaba "_migrated" -- la marca que le dice a computeBracket() que
// confíe en la huella _a/_b tal cual se migró, en vez de exigir que
// coincida con el sembrado "oficial" recalculado de los grupos (que
// para un migrado casi nunca coincide, porque se cargó a mano en el
// sistema viejo). Al perderse _migrated, TODOS los ganadores de
// eliminatoria de esa persona (r32→r16→qf→sf→third→final, en cascada)
// dejaban de resolverse -- aunque el marcador y los equipos seguían
// intactos en el documento.
//
// Reproduce el flujo real completo: importar → entrar a editar como
// admin (enterWizardAs) → autoguardado (flushAutosave, el disparador
// real) → recalcular el estado desde cero -- y verifica que el % de
// avance y los ganadores de cada ronda NO cambian.
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
  computeBracket, flushAutosave, enterWizardAs, getCompletionStatus,
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
   SETUP — un participante migrado real: 72 grupos + 32 llaves de
   eliminatoria, todas con _migrated:true y una huella (_a/_b) que NO
   coincide con lo que el sembrado "oficial" calcularía de sus propios
   grupos (igual que un migrado real del sistema anterior).
   ════════════════════════════════════════════════════════════════ */
const participant = {
  id:"p1", codigo:"QB-2026-0001", name:"Alejandro Migrado", city:"", country:"", countryIso:"",
  email:"alejandro@example.com", clave:"111111", ownerUid:null,
  estadoQuiniela:"enviada", lastStep:9,
  fechaCreacion:1, fechaActualizacion:Date.now(), fechaEnvio:2,
};
T.DB.participants = [participant];
const preds = {};
for(let mid=1; mid<=72; mid++) preds[mid] = { h:1, a:0 };
// Huella migrada deliberadamente "libre" (Corea del Sur vs Bosnia y
// Herzegovina en r32_1) -- no depende de que coincida con el sembrado
// real de este harness, solo de que _migrated:true sobreviva.
preds.r32_1 = { h:1, a:1, pick:"Corea del Sur", _a:"Corea del Sur", _b:"Bosnia y Herzegovina", _migrated:true };
for(let i=2;i<=16;i++) preds[`r32_${i}`] = { h:1, a:0, _a:`EquipoA${i}`, _b:`EquipoB${i}`, _migrated:true };
for(let i=1;i<=8;i++) preds[`r16_${i}`] = { h:1, a:0, _a:`EquipoA${i}`, _b:`EquipoB${i}`, _migrated:true };
for(let i=1;i<=4;i++) preds[`qf_${i}`] = { h:1, a:0, _a:`EquipoA${i}`, _b:`EquipoB${i}`, _migrated:true };
preds.sf_1 = { h:1, a:0, _a:"EquipoA1", _b:"EquipoB1", _migrated:true };
preds.sf_2 = { h:1, a:0, _a:"EquipoA2", _b:"EquipoB2", _migrated:true };
preds.third = { h:1, a:0, _a:"EquipoA1", _b:"EquipoA2", _migrated:true };
preds.final = { h:1, a:0, _a:"EquipoA1", _b:"EquipoA2", _migrated:true };
preds.special = { campeon:"EquipoA1", subcampeon:"EquipoA2", tercer:"EquipoA1" };
T.DB.predictions = { p1: preds };
W.rebuildDynamicData();

console.log("── Inmediatamente después de importar ──");
let bracket = T.computeBracket(T.DB.predictions.p1);
let st = T.getCompletionStatus("p1");
const pctAntes = Math.round((st.totalDone/st.totalAll)*100);
check("bracket.ready", bracket.ready===true);
check("Los 16 cruces de r32 tienen ganador resuelto", bracket.r32.every(m=>!!m.winner));
console.log(`   % de avance justo después de importar: ${pctAntes}%`);

console.log("\n── El admin entra a 'Editar' (enterWizardAs) y el wizard autoguarda ──");
T.enterWizardAs(participant);
check("DRAFT_PREDS.r32_1 trae _migrated ANTES del flush", T.DRAFT_PREDS.r32_1._migrated===true);
T.flushAutosave(); // esto es lo único que hacía falta para romperlo antes del fix
check("DB.predictions.p1.r32_1 CONSERVA _migrated después del autoguardado", T.DB.predictions.p1.r32_1._migrated===true);
check("El marcador y la huella (_a/_b) también se conservan intactos",
  T.DB.predictions.p1.r32_1.h===1 && T.DB.predictions.p1.r32_1.a===1 && T.DB.predictions.p1.r32_1._a==="Corea del Sur");

console.log("\n── Cerrar y volver a revisar (recalculando todo desde cero) ──");
bracket = T.computeBracket(T.DB.predictions.p1);
st = T.getCompletionStatus("p1");
const pctDespues = Math.round((st.totalDone/st.totalAll)*100);
check("Los 16 cruces de r32 SIGUEN con ganador resuelto (antes del fix: 0/16)", bracket.r32.every(m=>!!m.winner));
check(`% de avance NO cambió al editar y guardar (${pctAntes}% -> ${pctDespues}%; antes del fix bajaba, ej. 100->69)`, pctDespues===pctAntes);
check("El ganador de la Final sigue resolviéndose", bracket.final.winner === "EquipoA1");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
