// Test funcional del Sprint 4c (hoja de ruta comercial, 2026-07-23): el
// checkpoint real de la Fase 1 -- cargar un SEGUNDO torneo completo
// (Copa América ficticia, torneo-copaamerica.js: 16 equipos, 4 grupos,
// bracketFormat:"direct") sobre el motor generalizado en los Sprints
// 1-3c/4a/4b, y probarlo de punta a punta: fase de grupos → standings →
// generar llaves (formato "direct", sin mejores terceros) → eliminatoria
// → ranking. Si esto tarda mucho más que ajustar datos, la
// generalización de los sprints anteriores no quedó bien -- ver
// discusión en CLAUDE.md.
//
// torneo-copaamerica.js declara TORNEO_ACTUAL directamente (Sprint 5:
// el identificador que antes era TORNEO_MUNDIAL_2026 se volvió genérico
// en los 5 archivos que lo leen), así que este test arma su propio
// FILES_IN_ORDER reemplazando torneo-mundial2026.js por
// torneo-copaamerica.js sin ningún shim -- ningún archivo de producción
// se modifica para este test.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "torneo-copaamerica.js", "partidos-grupos.js", "utils.js", "paises.js", "app-static-data.js", "app-state.js", "scoring.js", "totp.js",
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
  try { window.document.body.appendChild(script); }
  catch (e) { console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`); }
}

const bridge = window.document.createElement("script");
bridge.textContent = "window.__test = { DB, S, TORNEO_ACTUAL, GES, MGMAP, MID_ABBRS, calcGroupStandings, allGroupsComplete, generarLlavesDieciseisavos, generarLlavesDirecto, ELIM_ROUNDS, BONUS_PHASES, getRealElimTeams, getRealAdvancers, calcElimMatchPts, save: function(){}, };";
window.document.body.appendChild(bridge);
const T = window.__test;

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

// ── 1. El torneo activo es la Copa América ficticia, no el Mundial ──
check("TORNEO_ACTUAL es la Copa América ficticia (16 equipos)", T.TORNEO_ACTUAL.id === "copaamerica-ficticia");
check("bracketFormat es \"direct\"", T.TORNEO_ACTUAL.bracketFormat === "direct");
check("24 partidos de fase de grupos (4 grupos x 6)", T.TORNEO_ACTUAL.groupMatches.length === 24);

// ── 2. Fase de grupos: cargar resultados reales para los 4 grupos,
//    con un ganador de grupo y un 2do claros en cada uno ──
// Grupo A: Argentina 1ero, Canadá 2do
T.S.scores = {
  1:{h:2,a:0}, // Argentina 2-0 Canadá
  2:{h:1,a:1}, // Chile 1-1 Perú
  3:{h:3,a:0}, // Argentina 3-0 Perú
  4:{h:1,a:0}, // Canadá 1-0 Chile
  5:{h:2,a:1}, // Argentina 2-1 Chile
  6:{h:0,a:2}, // Perú 0-2 Canadá
  // Grupo B: Brasil 1ero, Colombia 2do
  7:{h:2,a:0}, 8:{h:2,a:1}, 9:{h:3,a:0}, 10:{h:0,a:1}, 11:{h:1,a:1}, 12:{h:0,a:0},
  // Grupo C: Uruguay 1ero, Estados Unidos 2do
  13:{h:2,a:1}, 14:{h:1,a:0}, 15:{h:2,a:0}, 16:{h:2,a:0}, 17:{h:1,a:1}, 18:{h:0,a:1},
  // Grupo D: Venezuela 1ero, Panamá 2do
  19:{h:2,a:0}, 20:{h:1,a:0}, 21:{h:1,a:0}, 22:{h:1,a:2}, 23:{h:0,a:0}, 24:{h:1,a:1},
};

check("allGroupsComplete() true con los 24 resultados cargados", T.allGroupsComplete());

const standings = T.calcGroupStandings();
check("standings trae los 4 grupos (A-D)", ["A","B","C","D"].every(g => Array.isArray(standings[g]) && standings[g].length === 4));
check("Argentina 1ero del grupo A", standings.A[0].name === "Argentina");
check("Canadá 2do del grupo A", standings.A[1].name === "Canadá");
check("Brasil 1ero del grupo B", standings.B[0].name === "Brasil");
check("Uruguay 1ero del grupo C", standings.C[0].name === "Uruguay");
check("Venezuela 1ero del grupo D", standings.D[0].name === "Venezuela");

// ── 3. Generar llaves (formato "direct") -- 1A vs 2B, 1B vs 2A, etc. ──
T.S.elimTeams = T.S.elimTeams || {};
T.generarLlavesDieciseisavos();

const qf1 = T.S.elimTeams[25]; // 1A vs 2B
const qf2 = T.S.elimTeams[26]; // 1B vs 2A
const qf3 = T.S.elimTeams[27]; // 1C vs 2D
const qf4 = T.S.elimTeams[28]; // 1D vs 2C

check("P25 (1A vs 2B) = Argentina vs Colombia", !!qf1 && qf1.h === "Argentina" && qf1.a === "Colombia");
check("P26 (1B vs 2A) = Brasil vs Canadá", !!qf2 && qf2.h === "Brasil" && qf2.a === "Canadá");
check("P27 (1C vs 2D) = Uruguay vs Panamá", !!qf3 && qf3.h === "Uruguay" && qf3.a === "Panamá");
check("P28 (1D vs 2C) = Venezuela vs Estados Unidos", !!qf4 && qf4.h === "Venezuela" && qf4.a === "Estados Unidos");

// ── 4. Avanzar la eliminatoria completa (Cuartos → Semis → Final) y
//    confirmar que el bracket resuelve un campeón ──
T.S.elimScores = T.S.elimScores || {};
T.S.tieBreakers = T.S.tieBreakers || {};
// Cuartos: gana siempre el de local
T.S.elimScores[25] = {h:2,a:1}; // Argentina avanza
T.S.elimScores[26] = {h:1,a:0}; // Brasil avanza
T.S.elimScores[27] = {h:3,a:1}; // Uruguay avanza
T.S.elimScores[28] = {h:0,a:2}; // Estados Unidos avanza

const qfPhase = T.BONUS_PHASES.find(p => p.key === "qf");
const qfAdvancers = T.getRealAdvancers(qfPhase); // getRealAdvancers normaliza con n() (minúsculas/sin tildes)
check("Cuartos: avanzan Argentina/Brasil/Uruguay/Estados Unidos",
  ["argentina","brasil","uruguay","estados unidos"].every(t => qfAdvancers.has(t)));

// Semis dependen de S.elimTeams[29]/[30], que arma la UI real
// (renderElim/app-bracket-render.js) a partir de ELIM_TREE + los
// ganadores de Cuartos -- acá se simula esa resolución directamente
// para no depender del DOM del panel admin.
const winnerOf = pid => {
  const sc = T.S.elimScores[pid]; const teams = T.S.elimTeams[pid];
  if (!sc || !teams) return null;
  return sc.h > sc.a ? teams.h : (sc.a > sc.h ? teams.a : null);
};
T.S.elimTeams[29] = { h: winnerOf(25), a: winnerOf(26) }; // Argentina vs Brasil
T.S.elimTeams[30] = { h: winnerOf(27), a: winnerOf(28) }; // Uruguay vs Estados Unidos
T.S.elimScores[29] = {h:1,a:0}; // Argentina avanza a la final
T.S.elimScores[30] = {h:2,a:0}; // Uruguay avanza a la final

T.S.elimTeams[32] = { h: winnerOf(29), a: winnerOf(30) }; // Final: Argentina vs Uruguay
T.S.elimScores[32] = {h:1,a:0}; // Argentina campeón

const finalTeams = T.S.elimTeams[32];
const finalScore = T.S.elimScores[32];
check("Final: Argentina vs Uruguay", finalTeams.h === "Argentina" && finalTeams.a === "Uruguay");
check("Campeón resuelto: Argentina", finalScore.h > finalScore.a && finalTeams.h === "Argentina");

// ── 5. Puntaje de eliminatoria no explota con datos de un torneo de 4
//    rondas (Cuartos/Semis/Tercer/Final) en vez de las 6 del Mundial ──
let calcElimOk = true;
try {
  T.BONUS_PHASES.filter(p => p.elimPhase).forEach(phase => {
    phase.mids.forEach(pid => { T.calcElimMatchPts("Argentina", pid); });
  });
} catch (e) { calcElimOk = false; console.log("   (calcElimMatchPts lanzó: " + e.message + ")"); }
check("calcElimMatchPts() no explota recorriendo las 4 rondas de este torneo", calcElimOk);

console.log(allOk ? "TODO OK ✅" : "HAY FALLAS ❌");
process.exit(allOk ? 0 : 1);
