// Test funcional del Sprint 4b (hoja de ruta comercial, 2026-07-23):
// generarLlavesDirecto() (app-bracket-compute.js) es el camino nuevo para
// torneos "sin mejores terceros" (Copa América/Euro -- los 2 primeros de
// cada grupo cruzan directo). Hasta ahora generarLlavesDieciseisavos()
// solo sabía calcular cruces en formato "best-thirds" (Mundial 2026, 12
// grupos + Annex C); el Mundial real sigue intacto (ver
// test_bracket_annexc.js / test_bracket_cruce_real_wizard.js, sin tocar).
//
// Este test no arma un segundo torneo completo (eso es el Sprint 4c,
// torneo-copaamerica.js) -- ejercita generarLlavesDirecto() en aislado,
// mutando TORNEO_ACTUAL.directCrosses/bracketFormat después del boot real
// (son propiedades de un objeto, no el binding const en sí, así que se
// pueden pisar sin recargar nada) y con equipos reales del Mundial 2026
// como datos de prueba, para probar la RESOLUCIÓN de cruces ("1A"/"2B" →
// nombre de equipo), no el fixture en sí.
//
// Carga completa en jsdom de los archivos JS de producción, mismo patrón
// que test_bracket_annexc.js.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "torneo-mundial2026.js", "partidos-grupos.js", "utils.js", "paises.js", "app-static-data.js", "app-state.js", "scoring.js",
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

// TORNEO_ACTUAL/S/generarLlavesDirecto son `const`/`function` de nivel
// superior en scripts clásicos -- visibles entre <script> del mismo
// documento (igual que en el navegador real), pero NO como propiedades
// de `window`. Mismo bridge que usan los demás tests para exponerlos.
const bridge = window.document.createElement("script");
bridge.textContent = "window.__test = { TORNEO_ACTUAL, S, generarLlavesDirecto };";
window.document.body.appendChild(bridge);
const T = window.__test;

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

// Sanity: arrancó en formato Mundial real (best-thirds), sin tocar nada
check("boot real: TORNEO_ACTUAL.bracketFormat arranca en best-thirds", T.TORNEO_ACTUAL.bracketFormat === "best-thirds");

// Fabricar un cruce "direct" con equipos reales de los grupos A y B
// (México/Sudáfrica/Corea del Sur/Chequia en A; Canadá/Bosnia-Herz./Qatar/Suiza en B).
T.TORNEO_ACTUAL.directCrosses = {
  9001: { h: "1A", a: "2B" },
  9002: { h: "1B", a: "2A" },
};

const firsts = { A: "México", B: "Canadá" };
const seconds = { A: "Sudáfrica", B: "Bosnia y Herzegovina" };
const groups = ["A", "B"];

T.S.elimTeams = T.S.elimTeams || {};
T.generarLlavesDirecto(groups, firsts, seconds);

const e9001 = T.S.elimTeams[9001];
const e9002 = T.S.elimTeams[9002];
check("P9001 (1A vs 2B) resuelve México vs Bosnia y Herzegovina",
  !!e9001 && e9001.h === "México" && e9001.a === "Bosnia y Herzegovina");
check("P9002 (1B vs 2A) resuelve Canadá vs Sudáfrica",
  !!e9002 && e9002.h === "Canadá" && e9002.a === "Sudáfrica");

// Código sin dato ("3A", cuando no existe tercer clasificado) debe caer
// en "?" en vez de explotar -- mismo criterio que el camino best-thirds
// usa "?" como placeholder de datos incompletos.
T.TORNEO_ACTUAL.directCrosses = { 9003: { h: "1A", a: "2C" } };
T.generarLlavesDirecto(["A"], { A: "México" }, {});
const e9003 = T.S.elimTeams[9003];
check("cruce con grupo sin datos (2C) cae en \"?\" en vez de explotar",
  !!e9003 && e9003.h === "México" && e9003.a === "?");

console.log(allOk ? "TODO OK ✅" : "HAY FALLAS ❌");
process.exit(allOk ? 0 : 1);
