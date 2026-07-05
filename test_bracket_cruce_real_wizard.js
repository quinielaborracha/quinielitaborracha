// Test funcional — BUG REPORTADO por un participante ("tengo a Francia e
// Inglaterra en semifinal"): el wizard de registro (registro.js,
// computeBracket()) armaba Cuartos/Semifinales emparejando los slots de
// la ronda anterior SECUENCIALMENTE (posición 2i/2i+1), en vez de seguir
// el cruce real de FIFA (ELIM_TREE, app-eliminatoria-data.js — la MISMA
// fuente que ya usa el motor de puntaje real, getRealElimTeams() en
// scoring.js). Como ese cruce real NO es secuencial (cruza posiciones a
// propósito para separar semillas fuertes), el wizard podía mostrarle a
// un participante una Semifinal imposible según el cuadro real del
// Mundial 2026 -- ej. Francia (Octavos, slot r16_1/pid 89) e Inglaterra
// (Octavos, slot r16_4/pid 92) terminaban juntos en su Semifinal 1,
// aunque en la realidad esos 2 cruces quedan en semifinales DISTINTAS
// (pid 89 alimenta el Cuartos 97 → Semifinal 101; pid 92 alimenta el
// Cuartos 99 → Semifinal 102).
//
// Este test arma el "Constructor de Torneos" arrancando en Octavos
// (Grupos y Dieciseisavos desactivados, igual que el torneo real en
// producción — ver CLAUDE.md), carga los 8 partidos reales de Octavos
// (P89-P96) y hace que un participante prediga quién gana cada uno.
// Verifica que el bracket que computeBracket() arma para ESE
// participante separa a Francia e Inglaterra en semifinales distintas,
// igual que el cruce real (getRealElimTeams()).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "partidos-grupos.js", "utils.js", "app-static-data.js", "app-state.js", "scoring.js",
  "app-core-data.js", "app-admin-auth.js", "app-live-sync.js", "app-tabs.js",
  "app-eliminatoria-data.js", "app-batallas.js", "app-bracket-render.js",
  "app-bracket-annexc.js", "app-bracket-compute.js", "app-bracket-espn-sync.js", "app-bracket-view.js",
  "app-bracket-espn-live.js", "app-integridad.js", "app-predicciones.js",
  "app-estadisticas.js", "app-admin-tools.js", "app-bootstrap.js"];

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

// registro.js está envuelto en una única IIFE -- el bridge para acceder
// a computeBracket() se inserta DENTRO de esa IIFE, justo antes de su
// cierre "})();", mismo patrón que test_envio_quiniela_confirmado.js /
// test_login_reclaim.js.
let registroCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = registroCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = {
  getDB: () => DB, getS: () => S,
  computeBracket: (preds) => computeBracket(preds),
  getRealElimTeams: (pid) => getRealElimTeams(pid),
};
`;
registroCode = registroCode.slice(0, closeIdx) + bridge + registroCode.slice(closeIdx);
const registroScript = window.document.createElement("script");
registroScript.textContent = registroCode;
window.document.body.appendChild(registroScript);

if (!window.__test) { console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;

/* ════════════════════════════════════════════════════════════════
   SETUP — "Constructor de Torneos": Grupos y Dieciseisavos apagados,
   Octavos (r8) es la primera fase activa (igual que el torneo real en
   producción, ver memoria "project-torneo-constructor-activo").
   ════════════════════════════════════════════════════════════════ */
T.getDB().configGlobal.fasesActivas = { grupos: false, r16: false, r8: true, qf: true, sf: true, third: true, final: true };

// Los 8 partidos reales de Octavos (P89-P96), cargados por el admin (o
// ESPN Live) -- mismo dato para TODOS los participantes.
const S = T.getS();
S.elimTeams[89] = { h: "Francia", a: "Paraguay" };
S.elimTeams[90] = { h: "Marruecos", a: "Canadá" };
S.elimTeams[91] = { h: "Brasil", a: "Noruega" };
S.elimTeams[92] = { h: "Inglaterra", a: "México" };
S.elimTeams[93] = { h: "Portugal", a: "España" };
S.elimTeams[94] = { h: "Bélgica", a: "Estados Unidos" };
S.elimTeams[95] = { h: "Argentina", a: "Egipto" };
S.elimTeams[96] = { h: "Suiza", a: "Colombia" };

// Predicción del participante para Octavos (r16_1..r16_8 en el wizard =
// P89..P96) -- cada quien elige un ganador, el marcador es lo de menos.
const preds = {
  r16_1: { h: 2, a: 0 }, // Francia le gana a Paraguay
  r16_2: { h: 1, a: 0 }, // Marruecos le gana a Canadá
  r16_3: { h: 2, a: 1 }, // Brasil le gana a Noruega
  r16_4: { h: 3, a: 0 }, // Inglaterra le gana a México
  r16_5: { h: 1, a: 0 }, // Portugal le gana a España
  r16_6: { h: 2, a: 1 }, // Bélgica le gana a Estados Unidos
  r16_7: { h: 1, a: 0 }, // Argentina le gana a Egipto
  r16_8: { h: 2, a: 0 }, // Suiza le gana a Colombia
  // Cuartos: solo predice los 2 que hacen falta para que Francia e
  // Inglaterra lleguen con nombre propio hasta su Semifinal. _a/_b es la
  // "huella" que el wizard real congela al guardar (ver koWinner) --
  // acá se arma a mano con los mismos nombres que va a resolver
  // computeBracket() para qf_1 (Francia vs Marruecos, ganadores de
  // r16_1/r16_2) y qf_3 (Brasil vs Inglaterra, ganadores de r16_3/r16_4).
  qf_1: { h: 1, a: 0, _a: "Francia", _b: "Marruecos" }, // Francia le gana a Marruecos (Cuartos 1)
  qf_3: { h: 0, a: 2, _a: "Brasil", _b: "Inglaterra" }, // Inglaterra (visitante) le gana a Brasil (Cuartos 3)
};

const bracket = T.computeBracket(preds);
check("El bracket está listo (ready)", bracket.ready);

/* ════════════════════════════════════════════════════════════════
   CRUCE REAL DE FIFA (ELIM_TREE): P89 (Francia) alimenta el Cuartos 97
   → Semifinal 101. P92 (Inglaterra) alimenta el Cuartos 99 → Semifinal
   102. Son semifinales DISTINTAS -- Francia e Inglaterra NUNCA pueden
   estar juntas en la misma Semifinal de este cuadro.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Verificando que Cuartos/Semifinales sigan el cruce real de FIFA (ELIM_TREE) ──");

check("Cuartos 1 (qf_1) viene de r16_1+r16_2 (P89+P90)",
  JSON.stringify(bracket.qf[0].from) === JSON.stringify(["r16_1", "r16_2"]));
check("Cuartos 1 (qf_1) tiene a Francia adentro", [bracket.qf[0].a, bracket.qf[0].b].includes("Francia"));

check("Cuartos 3 (qf_3) viene de r16_3+r16_4 (P91+P92) -- NO de r16_5+r16_6",
  JSON.stringify(bracket.qf[2].from) === JSON.stringify(["r16_3", "r16_4"]));
check("Cuartos 3 (qf_3) tiene a Inglaterra adentro", [bracket.qf[2].a, bracket.qf[2].b].includes("Inglaterra"));

check("Semifinal 1 (sf_1) viene de qf_1+qf_2 (Cuartos 97+98)",
  JSON.stringify(bracket.sf[0].from) === JSON.stringify(["qf_1", "qf_2"]));
check("Semifinal 2 (sf_2) viene de qf_3+qf_4 (Cuartos 99+100)",
  JSON.stringify(bracket.sf[1].from) === JSON.stringify(["qf_3", "qf_4"]));

check("Francia (ganadora de Octavos) queda del lado de la Semifinal 1",
  [bracket.sf[0].a, bracket.sf[0].b].includes("Francia"));
check("Inglaterra (ganadora de Octavos) queda del lado de la Semifinal 2 -- NUNCA junto a Francia",
  [bracket.sf[1].a, bracket.sf[1].b].includes("Inglaterra"));
check("Francia NO aparece en la Semifinal 2",
  ![bracket.sf[1].a, bracket.sf[1].b].includes("Francia"));
check("Inglaterra NO aparece en la Semifinal 1",
  ![bracket.sf[0].a, bracket.sf[0].b].includes("Inglaterra"));

/* ════════════════════════════════════════════════════════════════
   CONSISTENCIA CON EL MOTOR DE PUNTAJE REAL — lo que el wizard le
   muestra al participante en Cuartos/Semis debe coincidir con lo que
   getRealElimTeams() (scoring.js, usado para puntuar "llave correcta")
   considera el cruce real, para el mismo resultado de Octavos.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Verificando consistencia contra el motor de puntaje real (getRealElimTeams) ──");
Object.keys(S.elimTeams).forEach(pid => {
  const t = S.elimTeams[pid];
  const h = parseInt(preds[`r16_${pid - 88}`]?.h);
  const a = parseInt(preds[`r16_${pid - 88}`]?.a);
  S.elimScores[pid] = { h, a, live: false };
});
check("getRealElimTeams(97) (Cuartos 1 real) coincide con el Cuartos 1 del wizard",
  JSON.stringify(T.getRealElimTeams(97)) === JSON.stringify({ h: bracket.qf[0].a, a: bracket.qf[0].b }));
check("getRealElimTeams(99) (Cuartos 3 real) coincide con el Cuartos 3 del wizard",
  JSON.stringify(T.getRealElimTeams(99)) === JSON.stringify({ h: bracket.qf[2].a, a: bracket.qf[2].b }));

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
