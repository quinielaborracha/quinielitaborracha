// Test funcional de v2.7.6: switch individual por "Pregunta avanzada"
// (ARULES/SPECIAL_QUESTIONS: campeón, subcampeón, 3er lugar, goleador,
// goles del goleador, país más goleador, goles de ese país, país más
// goleado) en Configuración del torneo → Reglas → 🎯 Preguntas
// avanzadas. Apagar una deja de sumar sus puntos (calcAdv, scoring.js),
// la saca de la pestaña pública "Reglas" (renderRules, app-predicciones.js)
// y -- desde v2.8.2 -- también la oculta del wizard de registro
// (activeSpecialQuestions(), registro.js), que antes la seguía pidiendo
// aunque el admin ya la hubiera apagado.
//
// Carga los 24 archivos de producción reales en el mismo orden que
// index.html, mismo patrón de bridge que el resto de los tests de
// Reglas -- ejercita el panel REAL (switch real, mismo onclick que en
// el navegador), no llamadas directas a funciones internas.
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
  <div id="root"></div><div id="toast"></div><div id="integ-banner"></div>
  <img id="logo-img"><span id="admin-indicator"></span>
  <span id="hstat"></span><span id="hdr-master-badge"></span><span id="hdr-today"></span>
  <table><tbody id="rb"></tbody></table>
  <div id="rbasic"></div><div id="radv"></div><div id="relim"></div><div id="rlast"></div>
  <div id="torneo-content"></div>
  <div id="t-battles" style="display:none"><div id="battle-builder-body"></div><div id="battles-body"></div></div>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
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
const bridge = window.document.createElement("script");
bridge.textContent = `window.__test = { DB, S, rebuildDynamicData, calcAdv, isPreguntaAvanzadaActiva, renderRules };`;
window.document.body.appendChild(bridge);
const T = window.__test;
const W = window;
W.isAdmin = () => true;

/* ════════════════════════════════════════════════════════════════
   SETUP — un participante que acertó las 8 preguntas avanzadas
   exactamente (79 pts con todo prendido: 15+10+8+12+8+8+10+8).
   ════════════════════════════════════════════════════════════════ */
T.DB.participants = [{id:"p1", name:"Juan", city:"C", country:"P"}];
T.DB.predictions = {p1:{special:{
  campeon:"Argentina", subcampeon:"Francia", tercer:"Brasil",
  goleador:"Messi", goles_goleador:8,
  pais_goleador:"Argentina", goles_pais:12,
  pais_goleado:"Alemania",
}}};
T.S.reality = {
  champ:"Argentina", runner:"Francia", third:"Brasil",
  topScorer:"Messi", topScorerGoals:8,
  topCountry:"Argentina", topCountryGoals:12,
  mostConceded:"Alemania",
};
T.rebuildDynamicData();

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — Default: las 8 preguntas están activas (torneo nuevo o
   viejo sin este campo), calcAdv() da el total completo
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Default: las 8 preguntas avanzadas activas ──");
check("mergeReglas() trae reglas.avanzado con las 8 en true por defecto",
  ["campeon","subcampeon","tercer","goleador","goles_goleador","pais_goleador","goles_pais","pais_goleado"]
    .every(id => T.DB.configGlobal.reglas.avanzado[id] === true));
check("calcAdv(Juan) = 79 (15+10+8+12+8+8+10+8) con todo activo", T.calcAdv("Juan") === 79);

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — Apagar "Acertar campeón" desde el panel REAL de Reglas
   (switch real, mismo onclick que en el navegador)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Apagar 'Acertar campeón' desde la UI real ──");
W.renderTorneoConfig();
const torneoContent = W.document.getElementById("torneo-content");
check("El panel de Reglas renderizó la tarjeta '🎯 Preguntas avanzadas'",
  torneoContent.innerHTML.includes("Preguntas avanzadas"));
check("Las 8 preguntas (con sus puntos) aparecen listadas",
  ["Acertar campeón (15 pts)","Acertar subcampeón (10 pts)","Acertar 3er lugar (8 pts)",
   "Acertar goleador del torneo (12 pts)","Goles del goleador (exactos) (8 pts)",
   "País más goleador (8 pts)","Goles de ese país (exactos) (10 pts)","País más goleado en 1 partido (8 pts)"]
    .every(txt => torneoContent.innerHTML.includes(txt)));

const switchCampeon = torneoContent.querySelector(`[onclick="toggleReglaSwitch('avanzado.campeon')"]`);
check("El switch de 'Acertar campeón' existe en el DOM real", !!switchCampeon);
switchCampeon.dispatchEvent(new W.Event("click", {bubbles:true}));
check("Un click real en el switch apagó reglas.avanzado.campeon", T.DB.configGlobal.reglas.avanzado.campeon === false);
check("calcAdv(Juan) bajó de 79 a 64 (perdió SOLO los 15 de campeón)", T.calcAdv("Juan") === 64);

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — El par goleador/goles_goleador: apagar el bono de goles
   exactos NO afecta el acierto del nombre; apagar el nombre sí se
   lleva el bono de goles con él (ya no hay "goleador acertado" del
   cual depender)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Par goleador / goles_goleador ──");
const switchGolesGoleador = W.document.querySelector(`[onclick="toggleReglaSwitch('avanzado.goles_goleador')"]`);
switchGolesGoleador.dispatchEvent(new W.Event("click", {bubbles:true}));
check("Apagar SOLO 'goles_goleador' resta 8 (64 -> 56), conserva los 12 del nombre acertado",
  T.calcAdv("Juan") === 56);

const switchGoleador = W.document.querySelector(`[onclick="toggleReglaSwitch('avanzado.goleador')"]`);
switchGoleador.dispatchEvent(new W.Event("click", {bubbles:true}));
check("Apagar 'goleador' (nombre) resta los 12 restantes (56 -> 44) -- goles_goleador ya estaba en 0",
  T.calcAdv("Juan") === 44);

// Reactivar 'goleador' con 'goles_goleador' TODAVÍA apagada: deben volver
// los 12 del nombre, pero NO los 8 del bono de goles (siguen apagados).
switchGoleador.dispatchEvent(new W.Event("click", {bubbles:true}));
check("Reactivar 'goleador' con 'goles_goleador' apagada devuelve los 12, no los 8 (44 -> 56)",
  T.calcAdv("Juan") === 56);
// deja todo como estaba para las partes siguientes
switchGolesGoleador.dispatchEvent(new W.Event("click", {bubbles:true}));
check("Reactivar 'goles_goleador' también devuelve sus 8 (56 -> 64)", T.calcAdv("Juan") === 64);

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — renderRules() (pestaña pública "Reglas"): la fila
   desactivada desaparece, las demás siguen listadas
   ════════════════════════════════════════════════════════════════ */
console.log("\n── renderRules(): la pregunta apagada desaparece de la pestaña pública ──");
T.renderRules();
const radvHtml = W.document.getElementById("radv").innerHTML;
check("'Acertar campeón' (apagada) YA NO aparece en la pestaña pública 'Reglas'",
  !radvHtml.includes("Acertar campeón"));
check("'Acertar subcampeón' (sigue activa) SÍ aparece", radvHtml.includes("Acertar subcampeón"));

/* ════════════════════════════════════════════════════════════════
   PARTE 5 — Reactivar 'campeón' deja todo como al principio
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Reactivar 'campeón' restaura el total original ──");
switchCampeon.dispatchEvent(new W.Event("click", {bubbles:true}));
check("Tras reactivar, reglas.avanzado.campeon volvió a true", T.DB.configGlobal.reglas.avanzado.campeon === true);
check("calcAdv(Juan) volvió a 79 (el total original completo)", T.calcAdv("Juan") === 79);

/* ════════════════════════════════════════════════════════════════
   PARTE 6 (v2.8.2) — El wizard de registro (registro.js) oculta la
   pregunta apagada en vez de seguir pidiéndola. registro.js está
   envuelto en una IIFE -- mismo patrón de bridge-antes-del-cierre que
   test_v1_6_ajustes.js.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── registro.js: la pregunta apagada desaparece del wizard ──");

const html2 = `<!doctype html><html><body>
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
const dom2 = new JSDOM(html2, { url: "https://example.org/", runScripts: "dangerously" });
const W2 = dom2.window;
W2.toast = (m,e) => {};
W2.setInterval = () => 0;
W2.confirm = () => true;
W2.alert = () => {};
W2.__fb = null;
W2.requestAnimationFrame = () => 0;

for (const file of FILES_IN_ORDER){
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = W2.document.createElement("script");
  script.textContent = code;
  try{ W2.document.body.appendChild(script); }
  catch(e){ console.log(`❌ (parte 6) ${file} lanzó un error al cargar: ${e.message}`); ok = false; }
}
let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const regBridge = `
window.__testReg = {
  DB, S, get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  get DRAFT_PREDS(){ return DRAFT_PREDS; }, set DRAFT_PREDS(v){ DRAFT_PREDS = v; },
  get WIZ_STEP(){ return WIZ_STEP; }, set WIZ_STEP(v){ WIZ_STEP = v; },
  get WIZ_DIRTY(){ return WIZ_DIRTY; }, set WIZ_DIRTY(v){ WIZ_DIRTY = v; },
  render, renderQuinielaForm, activeSpecialQuestions, computeCompletionFromPreds, WIZARD_STEPS,
};
`;
regCode = regCode.slice(0, closeIdx) + regBridge + regCode.slice(closeIdx);
const regScript = W2.document.createElement("script");
regScript.textContent = regCode;
try{ W2.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge, parte 6) lanzó un error al cargar: ${e.message}`); ok = false; }

const T2 = W2.__testReg;
W2.isAdmin = () => true;

const p2 = {id:"p1", codigo:"QLB-2026-0001", name:"Juan Pérez", city:"C", country:"P",
  email:"juan@example.com", clave:"111111", ownerUid:"anon-juan",
  estadoQuiniela:"borrador", fechaCreacion:Date.now(), fechaActualizacion:Date.now(), lastStep:8};
T2.DB.participants = [p2];
T2.DB.predictions = {p1:{special:{}}};
T2.DB.configGlobal.registroAbierto = true;
W2.rebuildDynamicData();

const specialIdx = T2.WIZARD_STEPS.findIndex(s=>s.key==='special');
check("WIZARD_STEPS tiene un paso 'special' (Preguntas especiales)", specialIdx !== -1);

T2.DRAFT_PID = "p1";
T2.DRAFT_PREDS = {special:{}};
T2.WIZ_STEP = specialIdx;
T2.WIZ_DIRTY = false;

// Con las 8 preguntas activas (default)
check("Con todo activo, activeSpecialQuestions() devuelve las 8", T2.activeSpecialQuestions().length === 8);
let compAllOn = T2.computeCompletionFromPreds(T2.DRAFT_PREDS);
check("Con todo activo, el paso 'special' pide 8 respuestas", compAllOn.phases.find(ph=>ph.key==='special').total === 8);

let renderEx = null;
try{ T2.render(); }catch(e){ renderEx = e; }
check("El wizard renderiza el paso 'special' sin excepción", !renderEx);
let contentHtml2 = W2.document.getElementById("rg-content").innerHTML;
check("Con 'goleador' activo, 'Goleador del torneo' SÍ aparece en el wizard", contentHtml2.includes("Goleador del torneo"));

// Apagar 'goleador' desde Configuración del torneo (mismo estado que
// leería isPreguntaAvanzadaActiva en cualquier otra pantalla)
T2.DB.configGlobal.reglas.avanzado.goleador = false;

check("Apagado 'goleador', activeSpecialQuestions() devuelve 7 (ya no lo incluye)",
  T2.activeSpecialQuestions().length === 7 && !T2.activeSpecialQuestions().some(q=>q.id==='goleador'));
let compGoleadorOff = T2.computeCompletionFromPreds(T2.DRAFT_PREDS);
check("Apagado 'goleador', el paso 'special' ahora pide solo 7 respuestas (no 8)",
  compGoleadorOff.phases.find(ph=>ph.key==='special').total === 7);

renderEx = null;
try{ T2.render(); }catch(e){ renderEx = e; }
check("El wizard vuelve a renderizar sin excepción tras apagar 'goleador'", !renderEx);
contentHtml2 = W2.document.getElementById("rg-content").innerHTML;
check("Apagado 'goleador', 'Goleador del torneo' YA NO aparece en el wizard", !contentHtml2.includes("Goleador del torneo"));
check("Las demás preguntas avanzadas ('País más goleador') siguen apareciendo", contentHtml2.includes("País más goleador"));

// Reactivar deja todo como al principio
T2.DB.configGlobal.reglas.avanzado.goleador = true;
check("Reactivado 'goleador', activeSpecialQuestions() vuelve a devolver las 8",
  T2.activeSpecialQuestions().length === 8);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
