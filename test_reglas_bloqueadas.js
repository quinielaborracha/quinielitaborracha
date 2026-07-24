// Test funcional del Sprint 7 (hoja de ruta comercial, Fase 2
// "constructor de torneo" -- bloqueo de reglas, 2026-07-23): las Reglas
// de puntaje se podían cambiar en vivo en cualquier momento, incluso a
// mitad de torneo. Ahora, en cuanto existe al menos un resultado real
// (grupos o eliminatoria), isReglasBloqueadas() (scoring.js) devuelve
// true y el panel completo (puntos base, por fase, multiplicador,
// racha, preguntas avanzadas, batallas) queda de solo lectura --
// reglaNumInput()/reglaSwitchRow()/reglaSwitchMini() (app-admin-tools.js)
// son el único lugar donde se arma ese markup, así que bloquearlas ahí
// alcanza para todo el panel sin tocar sus muchos call sites.
//
// Carga completa en jsdom de los archivos JS de producción, mismo patrón
// que test_reglas_avanzadas_switch.js -- ejercita el panel REAL (input
// real, mismo onchange/onclick que en el navegador).
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
bridge.textContent = `window.__test = { DB, S, isReglasBloqueadas, renderTorneoConfig, updateReglaValor, toggleReglaSwitch };`;
window.document.body.appendChild(bridge);
const T = window.__test;
const W = window;
W.isAdmin = () => true;

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — Sin resultados: reglas editables, como siempre
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Sin resultados cargados: reglas editables ──");
check("isReglasBloqueadas() = false con S.scores/S.elimScores vacíos", T.isReglasBloqueadas() === false);
W.renderTorneoConfig();
let tc = W.document.getElementById("torneo-content");
check("Sin banner de bloqueo", !tc.innerHTML.includes("Reglas bloqueadas"));
let ganadorInput = tc.querySelector('[data-reglas-path="grupos.ganador"]');
check("El input 'grupos.ganador' NO está disabled", ganadorInput && !ganadorInput.disabled);
let switchAvanzado = tc.querySelector(`[onclick="toggleReglaSwitch('avanzado.campeon')"]`);
check("El switch de 'Acertar campeón' tiene onclick (editable)", !!switchAvanzado);

const valorAntes = T.DB.configGlobal.reglas.grupos.ganador;
ganadorInput.value = String(valorAntes+1);
ganadorInput.dispatchEvent(new W.Event("change", {bubbles:true}));
check("Un change real todavía guarda el nuevo valor (sin bloqueo)", T.DB.configGlobal.reglas.grupos.ganador === valorAntes+1);

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — Primer resultado real de GRUPOS: reglas pasan a solo
   lectura automáticamente
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Primer resultado real de grupos: reglas se bloquean ──");
T.S.scores = { 1: {h:2,a:0} };
check("isReglasBloqueadas() = true con un resultado de grupos cargado", T.isReglasBloqueadas() === true);
W.renderTorneoConfig();
tc = W.document.getElementById("torneo-content");
check("Aparece el banner '🔒 Reglas bloqueadas'", tc.innerHTML.includes("Reglas bloqueadas"));
ganadorInput = tc.querySelector('[data-reglas-path="grupos.ganador"]');
check("El input 'grupos.ganador' queda disabled", ganadorInput && ganadorInput.disabled);
switchAvanzado = tc.querySelector(`[onclick="toggleReglaSwitch('avanzado.campeon')"]`);
check("El switch de 'Acertar campeón' YA NO tiene onclick (bloqueado)", !switchAvanzado);
const switchAvanzadoDisabled = [...tc.querySelectorAll(".switch.switch-disabled")];
check("Al menos un switch quedó con la clase visual switch-disabled", switchAvanzadoDisabled.length > 0);

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — Defensa extra: llamar updateReglaValor()/toggleReglaSwitch()
   directo (como si el DOM estuviera desactualizado) NO escribe nada
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Defensa extra: escribir directo no rompe el bloqueo ──");
const valorBloqueado = T.DB.configGlobal.reglas.grupos.ganador;
const fakeEl = W.document.createElement("input");
fakeEl.dataset.reglasPath = "grupos.ganador";
fakeEl.value = String(valorBloqueado + 5);
T.updateReglaValor(fakeEl);
check("updateReglaValor() no cambia el valor estando bloqueado", T.DB.configGlobal.reglas.grupos.ganador === valorBloqueado);

const arulesAntes = T.DB.configGlobal.reglas.avanzado.campeon;
T.toggleReglaSwitch("avanzado.campeon");
check("toggleReglaSwitch() no cambia el switch estando bloqueado", T.DB.configGlobal.reglas.avanzado.campeon === arulesAntes);

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — También se bloquea con un resultado de ELIMINATORIA
   (no solo de grupos)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── También se bloquea con un resultado de eliminatoria ──");
T.S.scores = {};
T.S.elimScores = { 25: {h:1,a:0} };
check("isReglasBloqueadas() = true con un resultado de eliminatoria cargado", T.isReglasBloqueadas() === true);

console.log(ok ? "TODO OK ✅" : "HAY FALLAS ❌");
process.exit(ok ? 0 : 1);
