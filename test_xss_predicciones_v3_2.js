// Test de regresión — v3.2: XSS almacenado vía la HUELLA de una
// predicción de eliminatoria (_a/_b) y vía la respuesta a una "Regla
// avanzada" (predictions.special.*, ej. "Goleador del torneo" — texto
// libre).
//
// CONTEXTO (diagnóstico de seguridad pedido por el usuario): las reglas
// de Firestore dejan que el DUEÑO de una quiniela escriba cualquier
// contenido en cualquier campo de sus propias predicciones (solo
// validan dueño/estado/plazo, nunca el texto en sí) — la UI normal solo
// deja elegir un país real o tipear un nombre de jugador, pero nada
// impide, vía el SDK de Firebase directo (bypasseando la UI), guardar
// un payload de HTML/script en _a/_b o en special.goleador. Tres
// vistas -- TODAS visitadas por el ADMIN con su sesión ya autenticada --
// insertaban ese texto sin escapar:
//   - renderBracket() (app-bracket-view.js) — 📝 Predicciones → 🎯 Eliminatoria
//   - buildDashElimHtml() (registro.js) — Dashboard del participante, que
//     el admin ve igual vía ✏️ Editar / 👁️ Ver como participante
//   - renderAdv() (app-predicciones.js) — 📝 Predicciones → ⭐ Avanzado
// El test viejo (test_xss_escape_v1_5_3.js) ya prueba nombre/ciudad/país
// en OTRAS vistas, pero nunca puso un payload en _a/_b ni en
// special.goleador -- por eso esto pasaba en blanco hasta ahora. Este
// test llena ese hueco.
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
  <div id="ab"></div><div id="t-adv" style="display:none"></div>
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
  DB, S, get DRAFT_PID(){return DRAFT_PID;}, set DRAFT_PID(v){DRAFT_PID=v;},
  set DASH_TAB(v){DASH_TAB=v;}, set DASH_PRED_SUBTAB(v){DASH_PRED_SUBTAB=v;},
  render,
};
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

const T = window.__test;
const W = window;

// Mismo criterio estructural que test_xss_escape_v1_5_3.js: revisa el
// DOM REAL (no el string de HTML) por elementos inyectados de verdad.
function noInjectedElements(container, label){
  if(!container){ check(`${label}: el contenedor existe`, false); return; }
  const badImg = container.querySelectorAll("img[onerror]").length;
  const badScript = container.querySelectorAll("script").length;
  check(`${label}: sin <img onerror> inyectado`, badImg === 0);
  check(`${label}: sin <script> inyectado`, badScript === 0);
}

/* ════════════════════════════════════════════════════════════════
   SETUP — un participante cuya predicción de eliminatoria (qf_1, un
   slot de Cuartos -- torneo con Grupos+Dieciseisavos desactivados, para
   no tener que completar 72 grupos) trae un payload de XSS en la
   huella _a/_b (simulando una escritura directa a Firestore, no vía la
   UI/dropdown), y cuya respuesta a "Goleador del torneo" (texto libre)
   trae otro payload distinto.
   //
   // v3.2.4 — se usa un pid de una ronda POSTERIOR a la fase manual
   // (qf_1/P97, no r16_1/P89) a propósito: desde v3.2.4, getElimTeams()
   // ya NO confía en la huella _a/_b para el pid de la fase manual (P89,
   // Octavos con este torneo) -- siempre usa el equipo real vigente
   // (S.elimTeams), así que un payload ahí ya ni siquiera llega a
   // insertarse en el DOM (más seguro, pero deja de ejercitar el camino
   // de escapado que este test necesita probar). Las rondas posteriores
   // siguen leyendo _a/_b tal cual se guardó (se resuelven del bracket
   // PROPIO del participante), así que siguen siendo el lugar correcto
   // para esta prueba de escapado.
   ════════════════════════════════════════════════════════════════ */
const XSS_TEAM = `<img src=x onerror=alert(1)>"'`;
const XSS_SCORER = `<script>alert(2)</script>Messi"'`;

const participant = {
  id:"p1", codigo:"QB-2026-0001", name:"Juan Pérez", city:"", country:"", countryIso:"",
  email:"juan@example.com", clave:"111111", ownerUid:null,
  estadoQuiniela:"enviada", lastStep:9,
  fechaCreacion:1, fechaActualizacion:Date.now(), fechaEnvio:2,
};
T.DB.configGlobal.fasesActivas = { grupos:false, r16:false }; // arranca en Octavos -- no hace falta llenar 72 grupos
T.DB.participants = [participant];
T.DB.predictions = {
  p1: {
    qf_1: { h:2, a:1, _a: XSS_TEAM, _b:"Egipto" },
    special: { goleador: XSS_SCORER, campeon:"Argentina" },
  }
};
// buildDashElimHtml() (registro.js) solo pinta una fila si el partido
// YA tiene marcador real cargado ("graded") -- sin esto, la fila ni se
// renderiza y el payload nunca llega a insertarse en el DOM (falso
// negativo, no una confirmación real de que escapa bien).
T.S.elimScores = { 97: { h:1, a:0 } };
W.rebuildDynamicData();

/* ── 1) app-bracket-view.js / renderBracket() — 📝 Predicciones → 🎯 Eliminatoria ── */
let bracketEx = null;
try{ W.renderBracket(); }catch(e){ bracketEx = e; }
check("renderBracket() no lanza excepción con el payload en _a", !bracketEx);
noInjectedElements(W.document.getElementById("bracket-body"), "Predicciones → Eliminatoria (renderBracket)");
check("El texto del equipo malicioso aparece ESCAPADO (como texto, no como HTML)",
  W.document.getElementById("bracket-body").textContent.includes(XSS_TEAM));

/* ── 2) app-predicciones.js / renderAdv() — 📝 Predicciones → ⭐ Avanzado ── */
let advEx = null;
try{ W.renderAdv(); }catch(e){ advEx = e; }
check("renderAdv() no lanza excepción con el payload en special.goleador", !advEx);
noInjectedElements(W.document.getElementById("ab"), "Predicciones → Avanzado (renderAdv)");
check("El texto del goleador malicioso aparece ESCAPADO (como texto, no como HTML)",
  W.document.getElementById("ab").textContent.includes(XSS_SCORER));

/* ── 3) registro.js / Dashboard del participante (buildDashElimHtml) —
   lo que ve el admin vía ✏️ Editar / 👁️ Ver como participante para una
   quiniela ya enviada. ── */
T.DRAFT_PID = "p1";
T.DASH_TAB = "predicciones";
T.DASH_PRED_SUBTAB = "elim";
let dashboardEx = null;
try{ T.render(); }catch(e){ dashboardEx = e; }
check("render() del Dashboard no lanza excepción", !dashboardEx);
noInjectedElements(W.document.getElementById("rg-content"), "Dashboard del participante (Mi Quiniela)");
check("El texto del equipo malicioso aparece ESCAPADO en el Dashboard (como texto, no como HTML)",
  W.document.getElementById("rg-content").textContent.includes(XSS_TEAM));

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
