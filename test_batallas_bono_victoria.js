// Test funcional del bono de victoria de Batallas/Royal Rumble (v2.7.1):
// switch + puntos editables en Configuración del torneo → Reglas, que
// otorgan un bono (Bonos, no Eliminatoria/Avanzado) a quien gane un
// duelo 1v1 (S.battleHistory) o el Royal Rumble (S.rumbleHistory).
//
// Carga los 24 archivos de producción reales en el mismo orden que
// index.html, mismo patrón de bridge que el resto de los tests de
// Batallas -- ejercita el panel de Reglas REAL (switch + <input>
// reales, mismo onclick/onchange que en el navegador), no llamadas
// directas a funciones internas.
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
window.requestAnimationFrame = () => 0; // jsdom no lo implementa; renderRank() lo usa solo para animar el contador de puntos (animateCountUp), sin efecto sobre los datos que este test verifica

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
bridge.textContent = `window.__test = { DB, S, rebuildDynamicData, calcBonos, getRank };`;
window.document.body.appendChild(bridge);
const T = window.__test;
const W = window;
W.isAdmin = () => true;

T.DB.participants = [
  {id:"p1", name:"Juan", city:"C", country:"P"},
  {id:"p2", name:"Pedro", city:"C", country:"P"},
];
T.DB.predictions = {p1:{}, p2:{}};
T.rebuildDynamicData();

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — Default: apagado, cero impacto en el puntaje de nadie
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Default: bono de victoria desactivado ──");

check("mergeReglas() trae reglas.batallas con activo:false por defecto (torneo nuevo o viejo sin este campo)",
  T.DB.configGlobal.reglas.batallas && T.DB.configGlobal.reglas.batallas.activo === false);
check("Valores por defecto: 5pts por duelo, 10pts por Rumble",
  T.DB.configGlobal.reglas.batallas.ganadorDuelo === 5 && T.DB.configGlobal.reglas.batallas.ganadorRumble === 10);

T.S.battleHistory = [{name:"Duelo 1", p1:"Juan", p2:"Pedro", pts1:10, pts2:3, winner:"Juan", date:"1 ene"}];
T.S.rumbleHistory = [{name:"Rumble 1", participantes:["Juan","Pedro"], puntos:{Juan:5,Pedro:2}, winner:"Juan", date:"1 ene"}];

check("Con el switch apagado, calcBonos(Juan) da 0 aunque ganó el duelo Y el Rumble",
  T.calcBonos("Juan") === 0);

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — Activar desde el panel REAL de Reglas (switch + <input>
   reales, mismo onclick/onchange que en el navegador -- no se llaman
   las funciones internas directo)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Activar y editar puntos desde el panel de Reglas (UI real) ──");

W.renderTorneoConfig();
const torneoContent = W.document.getElementById("torneo-content");
check("El panel de Reglas renderizó la tarjeta 'Batallas y Royal Rumble'",
  torneoContent.innerHTML.includes("Batallas y Royal Rumble"));

const switchEl = torneoContent.querySelector('[onclick="toggleReglaSwitch(\'batallas.activo\')"]');
check("El switch de 'Activar bono de victoria' existe en el DOM real", !!switchEl);
switchEl.dispatchEvent(new W.Event("click", {bubbles:true}));
check("Un click real en el switch activó reglas.batallas.activo", T.DB.configGlobal.reglas.batallas.activo === true);

// Tras el click, renderTorneoConfig() se repintó solo (toggleReglaSwitch
// lo hace internamente) -- hay que volver a buscar los <input>, ya no
// son los mismos nodos del DOM.
const ganadorDueloInput = W.document.querySelector('input[data-reglas-path="batallas.ganadorDuelo"]');
const ganadorRumbleInput = W.document.querySelector('input[data-reglas-path="batallas.ganadorRumble"]');
check("Tras activar, aparecen los 2 <input> de puntos (duelo y Rumble)",
  !!ganadorDueloInput && !!ganadorRumbleInput);

ganadorDueloInput.value = "7";
ganadorDueloInput.dispatchEvent(new W.Event("change", {bubbles:true}));
ganadorRumbleInput.value = "20";
ganadorRumbleInput.dispatchEvent(new W.Event("change", {bubbles:true}));
check("El cambio real en los <input> (evento 'change') actualizó reglas.batallas.ganadorDuelo a 7",
  T.DB.configGlobal.reglas.batallas.ganadorDuelo === 7);
check("Ídem reglas.batallas.ganadorRumble a 20",
  T.DB.configGlobal.reglas.batallas.ganadorRumble === 20);

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — Con el switch activo, calcBonos()/getRank() reflejan el bono
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Bono aplicado correctamente (ganador de duelo Y Rumble, no el perdedor) ──");

check("calcBonos(Juan) = 7 (duelo) + 20 (Rumble) = 27", T.calcBonos("Juan") === 27);
check("calcBonos(Pedro) = 0 (perdió el duelo, perdió el Rumble)", T.calcBonos("Pedro") === 0);

// Un empate no le da el bono a nadie.
T.S.battleHistory.push({name:"Duelo 2", p1:"Juan", p2:"Pedro", pts1:5, pts2:5, winner:"Empate", date:"2 ene"});
check("Un duelo empatado no le suma el bono a Juan (sigue en 27, no 34)", T.calcBonos("Juan") === 27);
check("Ganar 2 duelos suma 2 veces (Juan gana otro más: 7+7+20=34)",
  (()=>{ T.S.battleHistory.push({name:"Duelo 3", p1:"Juan", p2:"Pedro", pts1:9, pts2:1, winner:"Juan", date:"3 ene"}); return T.calcBonos("Juan")===34; })());

const rank = T.getRank();
const juanRank = rank.find(r=>r.name==="Juan");
check("getRank() (usado por el Ranking real) incluye el bono de victoria dentro de la columna Bonos",
  juanRank && juanRank.bon === 34);
check("El bono de victoria NO se cuenta en Eliminatoria ni Avanzado (solo en 'bon')",
  juanRank && juanRank.total === juanRank.b + juanRank.av + juanRank.elim + juanRank.bon);

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — Desactivar de nuevo: vuelve a dar 0 sin romper nada
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Desactivar desde la UI real vuelve el bono a 0 ──");
const switchEl2 = W.document.querySelector('[onclick="toggleReglaSwitch(\'batallas.activo\')"]');
switchEl2.dispatchEvent(new W.Event("click", {bubbles:true}));
check("Tras desactivar, reglas.batallas.activo volvió a false", T.DB.configGlobal.reglas.batallas.activo === false);
check("calcBonos(Juan) volvió a 0 (los puntos configurados -7/20- se conservan, solo no se aplican)",
  T.calcBonos("Juan") === 0);
check("Los valores editados (7pts/20pts) NO se perdieron al desactivar (quedan guardados para cuando se reactive)",
  T.DB.configGlobal.reglas.batallas.ganadorDuelo === 7 && T.DB.configGlobal.reglas.batallas.ganadorRumble === 20);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
