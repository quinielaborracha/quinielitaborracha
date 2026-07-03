// Test funcional de v2.7.6: switch individual por "Pregunta avanzada"
// (ARULES/SPECIAL_QUESTIONS: campeón, subcampeón, 3er lugar, goleador,
// goles del goleador, país más goleador, goles de ese país, país más
// goleado) en Configuración del torneo → Reglas → 🎯 Preguntas
// avanzadas. Apagar una NO oculta la pregunta ni bloquea la predicción
// -- solo deja de sumar sus puntos (calcAdv, scoring.js) y la saca de la
// pestaña pública "Reglas" (renderRules, app-predicciones.js).
//
// Carga los 24 archivos de producción reales en el mismo orden que
// index.html, mismo patrón de bridge que el resto de los tests de
// Reglas -- ejercita el panel REAL (switch real, mismo onclick que en
// el navegador), no llamadas directas a funciones internas.
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

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
