// Test funcional de v3.6.4 — Parte B: el scan de solo lectura
// (scanCruceRealInvalidado, app-bracket-render.js) que detecta a qué
// participantes se les invalidó un marcador de Cuartos/Semis/Final
// porque su "huella" (_a/_b) quedó congelada contra el cruce SECUENCIAL
// viejo (el bug corregido en computeBracket(), ver
// test_bracket_cruce_real_wizard.js), en vez del cruce real de FIFA
// (ELIM_TREE).
//
// Verifica:
//  1) Detecta el caso real: un participante con qf_2 congelado contra
//     el cruce viejo (r16_3+r16_4) cuando el cruce real de qf_2 es
//     r16_5+r16_6 -- exactamente lo que le pasó al participante que
//     reportó "tengo a Francia e Inglaterra en semifinal".
//  2) NO genera falsos positivos: un slot cuya huella SÍ coincide con
//     el cruce real (qf_1), un slot sin marcador cargado (qf_3, en
//     blanco), y un slot migrado (_migrated:true, con su propio
//     criterio) no aparecen en el reporte.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "partidos-grupos.js", "utils.js", "app-static-data.js", "app-state.js", "scoring.js",
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
window.setInterval = () => 0;
window.__fb = {
  auth: {},
  PARTICIPANTS_COL: {}, REGISTRO_META_DOC: {}, REGISTRO_PAPELERA_DOC: {},
  onAuthStateChanged: () => {},
  signInAnonymously: () => Promise.resolve(),
  onSnapshot: () => () => {},
  signOut: () => Promise.resolve(),
};

let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

for (const f of FILES) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try { window.document.body.appendChild(script); }
  catch (e) { console.error(`❌ Excepción al cargar ${f}:`, e.message); process.exit(1); }
}

const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `
window.__test = {
  getDB: () => DB, getS: () => S,
  scanCruceRealInvalidado: () => scanCruceRealInvalidado(),
};
`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;

/* ════════════════════════════════════════════════════════════════
   SETUP — mismo escenario que test_bracket_cruce_real_wizard.js:
   Constructor de Torneos arrancando en Octavos, 8 partidos reales
   cargados.
   ════════════════════════════════════════════════════════════════ */
T.getDB().configGlobal.fasesActivas = { grupos: false, r16: false, r8: true, qf: true, sf: true, third: true, final: true };

const S = T.getS();
S.elimTeams[89] = { h: "Francia", a: "Paraguay" };
S.elimTeams[90] = { h: "Marruecos", a: "Canadá" };
S.elimTeams[91] = { h: "Brasil", a: "Noruega" };
S.elimTeams[92] = { h: "Inglaterra", a: "México" };
S.elimTeams[93] = { h: "Portugal", a: "España" };
S.elimTeams[94] = { h: "Bélgica", a: "Estados Unidos" };
S.elimTeams[95] = { h: "Argentina", a: "Egipto" };
S.elimTeams[96] = { h: "Suiza", a: "Colombia" };

T.getDB().participants = [{ id: "p1", name: "Juan Pérez" }];
T.getDB().predictions = {
  p1: {
    r16_1: { h: 2, a: 0 }, // Francia
    r16_2: { h: 1, a: 0 }, // Marruecos
    r16_3: { h: 2, a: 1 }, // Brasil
    r16_4: { h: 3, a: 0 }, // Inglaterra
    r16_5: { h: 1, a: 0 }, // Portugal
    r16_6: { h: 2, a: 1 }, // Bélgica
    r16_7: { h: 1, a: 0 }, // Argentina
    r16_8: { h: 2, a: 0 }, // Suiza
    // qf_1: huella correcta (Francia vs Marruecos, el cruce real de
    // qf_1 -- coincide en ambos sistemas, viejo y nuevo) -- NO debe
    // aparecer en el reporte.
    qf_1: { h: 1, a: 0, _a: "Francia", _b: "Marruecos" },
    // qf_2: huella congelada contra el cruce VIEJO (r16_3+r16_4 =
    // Brasil/Inglaterra), pero el cruce REAL de qf_2 (ELIM_TREE) es
    // r16_5+r16_6 = Portugal/Bélgica -- exactamente el bug reportado.
    qf_2: { h: 1, a: 0, _a: "Brasil", _b: "Inglaterra" },
    // qf_3: sin marcador cargado -- no debe aparecer (nada que invalidar).
    // sf_1: migrada -- tiene su propio criterio, no debe aparecer aunque
    // su huella no coincida con nada del cruce actual.
    sf_1: { h: 2, a: 1, _a: "Equipo viejo A", _b: "Equipo viejo B", _migrated: true },
  },
};

const { rows } = T.scanCruceRealInvalidado();
console.log("Filas detectadas:", JSON.stringify(rows, null, 2));

check("Detecta exactamente 1 predicción invalidada", rows.length === 1);
check("La predicción invalidada es la de qf_2 de p1", rows[0]?.participantId === "p1" && rows[0]?.slot === "qf_2");
check("Reporta la huella vieja (Brasil vs Inglaterra)", rows[0]?.oldA === "Brasil" && rows[0]?.oldB === "Inglaterra");
check("Reporta el cruce real nuevo (Portugal vs Bélgica)",
  new Set([rows[0]?.newA, rows[0]?.newB]).size === 2 &&
  ["Portugal", "Bélgica"].every(x => [rows[0]?.newA, rows[0]?.newB].includes(x)));
check("NO se reporta qf_1 (huella ya coincide con el cruce real)", !rows.some(r => r.slot === "qf_1"));
check("NO se reporta qf_3 (sin marcador cargado)", !rows.some(r => r.slot === "qf_3"));
check("NO se reporta sf_1 (es una predicción migrada, criterio aparte)", !rows.some(r => r.slot === "sf_1"));

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
