// Test funcional de la tabla Annex C (asignación de los 8 mejores
// terceros de grupo a sus cruces de Dieciseisavos, "Generar llaves").
//
// Contexto del bug: ANNEX_C (app-bracket-compute.js) traía solo 278 de
// las 495 combinaciones posibles de 8 grupos entre 12 -- para el 44% de
// los torneos reales, annexCLookup() devolvía null y
// generarLlavesDieciseisavos() caía en un fallback que asigna los
// terceros "en orden", ignorando el cruce real de FIFA (violando incluso
// la regla básica de que un tercero nunca puede caer contra un equipo de
// su propio grupo). Se reemplazó la tabla completa por las 495 filas
// reales del Annexe C de las Regulations oficiales del FIFA World Cup 26
// (PDF descargado de digitalhub.fifa.com), verificadas 1 a 1 contra las
// 269 filas no-"SKIP" que ya traía la tabla vieja (100% de coincidencia).
//
// Carga completa en jsdom de los archivos JS de producción, mismo patrón
// que test_espn_elim_gameid.js.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "partidos-grupos.js", "utils.js", "app-state.js", "scoring.js",
  "app-core-data.js", "app-admin-auth.js", "app-live-sync.js", "app-tabs.js",
  "app-eliminatoria-data.js", "app-batallas.js", "app-bracket-render.js",
  "app-bracket-annexc.js", "app-bracket-compute.js", "app-bracket-espn-sync.js", "app-bracket-view.js",
  "app-bracket-espn-live.js", "app-integridad.js", "app-predicciones.js",
  "app-estadisticas.js", "app-admin-tools.js", "app-bootstrap.js", "registro.js"];

let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
html = html.replace(/<script[^>]*src=[^>]*><\/script>/g, "");
html = html.replace(/<script type="module">[\s\S]*?<\/script>/g, "");

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.confirm = () => true;
window.alert = () => {};
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
window.Blob = function () {};
window.setInterval = () => 0;
window.__fb = {
  auth: {},
  PARTICIPANTS_COL: {}, REGISTRO_META_DOC: {}, REGISTRO_PAPELERA_DOC: {},
  onAuthStateChanged: () => {},
  signInAnonymously: () => Promise.resolve(),
  onSnapshot: () => () => {},
  signOut: () => Promise.resolve(),
};

for (const file of FILES) {
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

const annexCLookup = window.annexCLookup;
const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];
// Los 8 pids que enfrentan a un tercero, y a qué grupo "1X" enfrenta cada uno.
const P_TO_FIRST = { P79:"A", P85:"B", P81:"D", P74:"E", P82:"G", P77:"I", P87:"K", P80:"L" };

// ANNEX_C es "const" de nivel superior dentro del <script> -- eso la deja
// en el scope léxico global del realm, pero NO como propiedad de
// `window` (a diferencia de las declaraciones "function", que sí se
// cuelgan de window). window.eval() corre en ese mismo realm, así que
// puede verla igual.
const annexCSize = window.eval("Object.keys(ANNEX_C).length");
const annexCHasSkip = window.eval("Object.values(ANNEX_C).some(v => v === 'SKIP')");

console.log("\n── Cobertura de la tabla ──");
check("ANNEX_C tiene exactamente 495 entradas", annexCSize === 495);
check("Ninguna entrada quedó marcada 'SKIP'", !annexCHasSkip);

// Genera las C(12,8) = 495 combinaciones posibles de 8 grupos entre los 12.
function combinations(arr, k) {
  const out = [];
  (function rec(start, chosen) {
    if (chosen.length === k) { out.push(chosen.slice()); return; }
    for (let i = start; i < arr.length; i++) {
      chosen.push(arr[i]);
      rec(i + 1, chosen);
      chosen.pop();
    }
  })(0, []);
  return out;
}
const allCombos = combinations(GROUPS, 8);
check(`Se generaron las 495 combinaciones posibles de 8 grupos (C(12,8))`, allCombos.length === 495);

console.log("\n── annexCLookup() resuelve las 495 combinaciones sin excepción ──");
let resolved = 0, selfMatchViolations = 0, ownGroupViolations = 0;
allCombos.forEach(combo => {
  const allocation = annexCLookup(combo);
  if (!allocation) return;
  resolved++;
  const comboSet = new Set(combo);
  Object.entries(allocation).forEach(([pKey, thirdGroup]) => {
    // El tercero asignado siempre tiene que ser uno de los 8 grupos de ESTA combinación.
    if (!comboSet.has(thirdGroup)) selfMatchViolations++;
    // Un tercero nunca puede caer contra el 1ero de SU PROPIO grupo (ya se
    // enfrentaron en la fase de grupos).
    if (thirdGroup === P_TO_FIRST[pKey]) ownGroupViolations++;
  });
});
check("annexCLookup() devuelve una asignación (no null) para las 495 combinaciones", resolved === 495);
check("Ningún tercero asignado queda fuera de los 8 grupos de su combinación", selfMatchViolations === 0);
check("Ningún tercero enfrenta al 1ero de su propio grupo", ownGroupViolations === 0);

console.log("\n── Combinación real del torneo en curso (grupos B,D,E,F,I,J,K,L) ──");
// Verificado contra los resultados reales de Dieciseisavos ya jugados
// (búsqueda web, 02/07/2026): 1A-Ecuador(3E), 1B-Argelia(3J), 1D-Bosnia(3B),
// 1E-Paraguay(3D), 1G-Senegal(3I), 1I-Suecia(3F), 1K-Ghana(3L), 1L-RDCongo(3K).
const real = annexCLookup(["B","D","E","F","I","J","K","L"]);
check("P79 (vs 1A) → grupo E", real.P79 === "E");
check("P85 (vs 1B) → grupo J", real.P85 === "J");
check("P81 (vs 1D) → grupo B", real.P81 === "B");
check("P74 (vs 1E) → grupo D", real.P74 === "D");
check("P82 (vs 1G) → grupo I", real.P82 === "I");
check("P77 (vs 1I) → grupo F", real.P77 === "F");
check("P87 (vs 1K) → grupo L", real.P87 === "L");
check("P80 (vs 1L) → grupo K", real.P80 === "K");

console.log(`\n${allOk ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(allOk ? 0 : 1);
