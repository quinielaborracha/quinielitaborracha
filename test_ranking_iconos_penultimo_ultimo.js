// Test funcional del fix v3.9.3: BUG REPORTADO — los íconos de penúltimo
// (🚑) y último lugar (👸, "Cenicienta") del Ranking desaparecieron.
//
// CAUSA RAÍZ: renderRank() (app-bracket-view.js), buildExp() (imagen de
// exportar, app-estadisticas.js) y el badge "Aguante" de las estadísticas
// personales (también app-estadisticas.js) tenían el índice hardcodeado
// a exactamente 27 participantes (i===25/i===26/pos===27) -- un supuesto
// de cuando el grupo SIEMPRE tenía 27 personas. Apenas el grupo tuvo
// menos (23 hoy), esos índices nunca existían en la lista y los 2 íconos
// desaparecieron sin ningún error visible.
//
// FIX: los 3 lugares ahora calculan penúltimo/último sobre el largo REAL
// de `ranked` (getRank()), no un número fijo. Este test cubre los 2 que
// tienen salida HTML verificable sin abrir sesión de participante
// (renderRank/buildExp) con una cantidad de participantes DISTINTA de 27.
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
  <div id="rg-tabs"></div><div id="rg-content"></div><div id="admin-content"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};
window.isAdmin = () => false;
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
window.__fb = null;

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

for (const f of FILES_IN_ORDER) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

const W = window;
// `DB`/`S` son `let` de nivel superior en participantes.js/app-state.js
// (no wrapeados en IIFE), pero eso no los expone como window.DB/window.S
// -- solo son visibles para OTROS <script> clásicos del mismo documento.
// Este bridge, en su propio <script>, los deja alcanzables desde el test.
const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `window.__test = { DB, S };`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;

// ── 23 participantes (el número real de hoy, NO 27) con puntajes todos
// distintos, para que el orden del ranking sea determinista. ──
const N = 23;
T.DB.participants = Array.from({ length: N }, (_, i) => ({
  id: "p" + i, name: "Participante" + i, city: "", country: "",
}));
T.DB.predictions = {};
T.DB.participants.forEach(p => { T.DB.predictions[p.id] = {}; });
// 1 solo partido de grupos, jugado; cada participante predice un
// resultado distinto para que calcPts(name) los distinga -- en vez de
// eso, más simple: sin resultado real (0 puntos para todos) y usamos el
// orden alfabético estable de getRank() (empate) para saber el orden.
W.rebuildDynamicData();

W.renderRank();
const rowsHtml = W.document.getElementById("rb").innerHTML;
const rows = rowsHtml.split("</tr>").filter(r => r.includes("<tr"));
check(`Se renderizaron ${N} filas (una por participante)`, rows.length === N);

const penultimoRow = rows[N - 2];
const ultimoRow = rows[N - 1];
check("Con 23 participantes, la fila PENÚLTIMA (índice 21) lleva 🚑", penultimoRow && penultimoRow.includes("🚑"));
check("Con 23 participantes, la fila ÚLTIMA (índice 22) lleva 👸", ultimoRow && ultimoRow.includes("👸"));
check("Ninguna otra fila (ej. la del medio) lleva 🚑 o 👸", rows.slice(3, N - 2).every(r => !r.includes("🚑") && !r.includes("👸")));

// buildExp() (exportar imagen) usa la MISMA lista/orden -- mismo criterio.
const expHtml = W.buildExp();
check("buildExp() (exportar imagen) TAMBIÉN muestra 🚑 en algún lugar (penúltimo)", expHtml.includes("🚑"));
check("buildExp() (exportar imagen) TAMBIÉN muestra 👸 en algún lugar (último)", expHtml.includes("👸"));

// ── Con 27 participantes exactos (el caso viejo), sigue funcionando --
// no es una regresión del número mágico anterior, solo dejó de ser el
// ÚNICO caso soportado. ──
console.log("\n── Con 27 participantes (el número viejo) ──");
const N27 = 27;
T.DB.participants = Array.from({ length: N27 }, (_, i) => ({ id: "q" + i, name: "Persona" + i, city: "", country: "" }));
T.DB.predictions = {};
T.DB.participants.forEach(p => { T.DB.predictions[p.id] = {}; });
W.rebuildDynamicData();
W.renderRank();
const rows27 = W.document.getElementById("rb").innerHTML.split("</tr>").filter(r => r.includes("<tr"));
check("Con 27 participantes, la fila 26 (índice 25) sigue llevando 🚑", rows27[25] && rows27[25].includes("🚑"));
check("Con 27 participantes, la fila 27 (índice 26) sigue llevando 👸", rows27[26] && rows27[26].includes("👸"));

console.log("\n=== RESULTADO FINAL:", allOk ? "TODOS LOS CASOS PASAN ✅" : "HAY FALLOS ❌", "===");
process.exit(allOk ? 0 : 1);
