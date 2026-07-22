// Test funcional del fix v3.9: 📝 Predicciones → 🎯 Eliminatoria (la
// única pestaña de predicciones que ve el admin) mostraba TODAS las
// rondas de eliminatoria (Dieciseisavos..Final) sin fijarse en
// isFaseActiva() -- si el admin desactivaba una fase desde
// "Configuración del torneo", esa ronda igual aparecía entera mostrando
// "⏳ Por resolver" en cada partido, en vez de desaparecer.
//
// buildDashElimHtml() (registro.js), el Dashboard que ve cada
// participante, ya filtraba esto correctamente con getActiveElimRounds()
// -- renderBracket() (app-bracket-view.js) quedó sin el mismo filtro por
// accidente. Este test carga los archivos de producción reales y
// verifica que, con una fase desactivada, ni su ronda ni sus partidos
// aparezcan en el DOM real de #bracket-body.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "torneo-mundial2026.js", "partidos-grupos.js", "utils.js", "paises.js", "app-static-data.js", "app-state.js", "scoring.js",
  "app-core-data.js", "app-admin-auth.js", "app-live-sync.js", "app-tabs.js",
  "app-eliminatoria-data.js", "app-batallas.js", "app-bracket-render.js",
  "app-bracket-annexc.js", "app-bracket-compute.js", "app-bracket-espn-sync.js", "app-bracket-view.js",
  "app-bracket-espn-live.js", "app-integridad.js", "app-predicciones.js",
  "app-estadisticas.js", "app-admin-tools.js", "app-bootstrap.js"];

const html = `<!doctype html><html><body>
  <div id="toast"></div>
  <div id="bsel"></div><div id="bracket-body"></div>
  <div id="root"></div><img id="logo-img"><span id="admin-indicator"></span>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};
window.isAdmin = () => true;
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
window.__fb = { PARTICIPANTS_COL: {}, PRIVADO_COL: {}, auth: { currentUser: null }, onSnapshot: () => () => {} };

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

for (const f of FILES) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `window.__test = { DB, S };`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;

check(`Los ${FILES.length} archivos cargaron sin lanzar excepción`, true);
check("renderBracket es una función global", typeof window.renderBracket === "function");

// ── Fixture: un participante con predicciones/resultados en las 4
// primeras rondas de eliminatoria (r16, r8, qf, sf), torneo con TODAS las
// fases activas por defecto ──
const participant = { id: "p1", codigo: "QB-2026-0001", name: "Juan Pérez", city: "", country: "", countryIso: "", email: "j@x.com", clave: "111111", ownerUid: null, estadoQuiniela: "enviada", lastStep: 9, fechaCreacion: 1, fechaActualizacion: Date.now(), fechaEnvio: 2 };
T.DB.participants = [participant];
T.DB.predictions = {
  p1: {
    r16_1: { h: 2, a: 1, _a: "México", _b: "Alemania" },
    r8_1: { h: 1, a: 0, _a: "México", _b: "Brasil" },
    qf_1: { h: 2, a: 1, _a: "México", _b: "Egipto" },
    sf_1: { h: 1, a: 1, _a: "México", _b: "Francia" },
  },
};
T.S.elimScores = { 73: { h: 2, a: 1 }, 89: { h: 1, a: 0 }, 97: { h: 2, a: 1 }, 101: { h: 1, a: 1 } };
window.rebuildDynamicData();

/* ══════════════════════════════════════════════════════════════
   CASO A — todas las fases activas: las 4 rondas con datos deben
   aparecer en el DOM.
   ══════════════════════════════════════════════════════════════ */
console.log("\n── CASO A: todas las fases activas ──");
T.DB.configGlobal.fasesActivas = {};
window.renderBracket();
let bodyHtml = window.document.getElementById("bracket-body").innerHTML;
check("CASO A: aparece la ronda 'Dieciseisavos de final'", bodyHtml.includes("Dieciseisavos de final"));
check("CASO A: aparece la ronda 'Octavos de final'", bodyHtml.includes("Octavos de final"));
check("CASO A: aparece la ronda 'Cuartos de final'", bodyHtml.includes("Cuartos de final"));
check("CASO A: aparece la ronda 'Semifinales'", bodyHtml.includes("Semifinales"));
check("CASO A: el denominador de 'jugados' es sobre 32 (todas las fases activas)", bodyHtml.includes("/32"));

/* ══════════════════════════════════════════════════════════════
   CASO B — REPRODUCCIÓN DEL BUG: se desactiva Cuartos (qf) -- esa
   ronda entera NO debe aparecer más, aunque tenga datos cargados. Las
   demás rondas activas siguen viéndose normal.
   ══════════════════════════════════════════════════════════════ */
console.log("\n── CASO B: se desactiva Cuartos (qf:false) ──");
T.DB.configGlobal.fasesActivas = { qf: false };
window.renderBracket();
bodyHtml = window.document.getElementById("bracket-body").innerHTML;
check("CASO B: la ronda 'Cuartos de final' YA NO aparece (antes del fix: sí, con '⏳ Por resolver')", !bodyHtml.includes("Cuartos de final"));
check("CASO B: 'Dieciseisavos de final' sigue apareciendo (fase activa, sin regresión)", bodyHtml.includes("Dieciseisavos de final"));
check("CASO B: 'Octavos de final' sigue apareciendo (fase activa, sin regresión)", bodyHtml.includes("Octavos de final"));
check("CASO B: 'Semifinales' sigue apareciendo (fase activa, sin regresión)", bodyHtml.includes("Semifinales"));
check("CASO B: el resumen ya NO cuenta sobre 32 (el denominador bajó al desactivar una fase)", !bodyHtml.includes("/32"));

/* ══════════════════════════════════════════════════════════════
   CASO C — se desactivan Grupos Y Dieciseisavos también (torneo que
   arranca en Octavos, como test_xss_predicciones_v3_2.js) -- ni
   Dieciseisavos ni Cuartos deben aparecer, Octavos y Semis sí.
   ══════════════════════════════════════════════════════════════ */
console.log("\n── CASO C: Grupos + Dieciseisavos + Cuartos desactivados ──");
T.DB.configGlobal.fasesActivas = { grupos: false, r16: false, qf: false };
window.renderBracket();
bodyHtml = window.document.getElementById("bracket-body").innerHTML;
check("CASO C: 'Dieciseisavos de final' no aparece", !bodyHtml.includes("Dieciseisavos de final"));
check("CASO C: 'Cuartos de final' no aparece", !bodyHtml.includes("Cuartos de final"));
check("CASO C: 'Octavos de final' sigue apareciendo", bodyHtml.includes("Octavos de final"));
check("CASO C: 'Semifinales' sigue apareciendo", bodyHtml.includes("Semifinales"));

console.log("\n=== RESULTADO FINAL:", allOk ? "TODOS LOS CASOS PASAN ✅" : "HAY FALLOS ❌", "===");
process.exit(allOk ? 0 : 1);
