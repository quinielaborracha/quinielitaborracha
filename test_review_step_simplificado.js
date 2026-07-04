// Test funcional de v3.1: el paso "Revisión final" del wizard ya NO
// muestra la tabla "📋 Estado de tu quiniela" (fase por fase, con
// badges ✅/▫️ y el % en el título) — pedido explícito para simplificar
// esa pantalla. Se conserva SOLO el aviso final (100% completa, o qué
// falta + el botón "Ir al pendiente").
//
// Mismo patrón de harness que test_ko_equipos_reales_persistencia.js.
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

let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = {
  DB, S, get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  get DRAFT_PREDS(){ return DRAFT_PREDS; }, set DRAFT_PREDS(v){ DRAFT_PREDS = v; },
  get WIZ_STEP(){ return WIZ_STEP; }, set WIZ_STEP(v){ WIZ_STEP = v; },
  renderQuinielaForm, WIZARD_STEPS,
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
   SETUP — torneo mínimo (Grupos+Dieciseisavos activos) con UN
   participante incompleto, para poder ver ambos casos (falta / 100%).
   ════════════════════════════════════════════════════════════════ */
const p = {id:"p1", codigo:"QLB-2026-0001", name:"Juan Pérez", city:"C", country:"P",
  email:"juan@example.com", clave:"111111", ownerUid:"anon-juan",
  estadoQuiniela:"borrador", fechaCreacion:Date.now(), fechaActualizacion:Date.now(), lastStep:9};
T.DB.participants = [p];
T.DB.predictions = {p1:{}}; // nada cargado -- incompleto
W.rebuildDynamicData();

T.DRAFT_PID = "p1";
T.DRAFT_PREDS = {};
const reviewIdx = T.WIZARD_STEPS.findIndex(s=>s.key==='review');
T.WIZ_STEP = reviewIdx;

console.log("── Caso incompleto ──");
T.renderQuinielaForm("p1", "inicio");
let bodyHtml = W.document.getElementById("rg-content").innerHTML;
check("YA NO aparece el título 'Estado de tu quiniela'", !bodyHtml.includes("Estado de tu quiniela"));
// La fila vieja de "Fase de grupos" rendeaba "<span class=\"badge ...\">0/72</span>"
// (formato N/M) -- la nota nueva dice "faltan N", sin barra. Si ">0/72<"
// ya no aparece, confirma que la fila-tabla se fue (el nombre de la fase
// SÍ puede seguir apareciendo dentro de la frase "Falta completar: ...").
check("YA NO aparece la fila-tabla de Grupos con formato N/M (ej. '0/72')", !bodyHtml.includes("0/72<"));
check("SÍ aparece el aviso de qué falta completar", bodyHtml.includes("Falta completar"));
check("SÍ aparece el botón 'Ir al pendiente'", bodyHtml.includes("status_goto_pending"));

/* ════════════════════════════════════════════════════════════════
   Caso completo — cargamos las 72 predicciones de grupos (mínimo para
   que isFaseActiva('grupos') cuente como completa) + el resto de KO
   se resuelve solo porque en este setup mínimo no hay fases de
   eliminatoria activas configuradas explícitamente... para simplificar,
   en vez de armar las 72+32+8 predicciones reales, desactivamos todas
   las fases de eliminatoria/especiales salvo grupos, así "completa"
   depende solo de esas 72.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Caso 100% completo ──");
T.DB.configGlobal.fasesActivas = { r16:false, r8:false, qf:false, sf:false, final:false, third:false };
T.DB.configGlobal.reglas = T.DB.configGlobal.reglas || {};
T.DB.configGlobal.reglas.avanzado = { campeon:false, subcampeon:false, tercer:false, goleador:false, goles_goleador:false, pais_goleador:false, goles_pais:false, pais_goleado:false };
const preds = {};
for (let mid=1; mid<=72; mid++) preds[mid] = { h:1, a:0 };
T.DB.predictions.p1 = preds;
T.renderQuinielaForm("p1", "inicio");
bodyHtml = W.document.getElementById("rg-content").innerHTML;
check("YA NO aparece el título 'Estado de tu quiniela' (caso completo)", !bodyHtml.includes("Estado de tu quiniela"));
check("SÍ aparece el aviso de 100% completa", bodyHtml.includes("100% completa"));
check("NO aparece 'Falta completar' cuando ya está completa", !bodyHtml.includes("Falta completar"));

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
