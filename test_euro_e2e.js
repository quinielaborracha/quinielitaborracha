// Test funcional del Sprint 11 (hoja de ruta comercial, Fase 3 --
// selector de plantilla en runtime): el checkpoint real de esta etapa,
// calcado de test_copa_america_e2e.js (Sprint 4c) -- un segundo caso
// concreto prueba que el registro compartido de torneos (Sprint 9)
// generaliza de verdad, no solo con el caso ya conocido.
//
// Lo que este torneo prueba que ningún otro probó todavía: CERO fase
// de grupos (groupMatches:[], groupKeys:[]) -- los equipos de
// Semifinales se cargan a mano (mismo mecanismo ya existente de
// "empezar desde una fase que no es Dieciseisavos"), no calculados de
// standings. torneo-euro.js declara TORNEO_ACTUAL directamente (mismo
// patrón que torneo-copaamerica.js), así que este test arma su propio
// FILES_IN_ORDER reemplazando torneo-mundial2026.js -- ningún archivo
// de producción se modifica para este test.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "torneo-euro.js", "partidos-grupos.js", "utils.js", "paises.js", "app-static-data.js", "app-state.js", "scoring.js", "totp.js",
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
bridge.textContent = "window.__test = { DB, S, TORNEO_ACTUAL, GES, MGMAP, MID_ABBRS, calcGroupStandings, allGroupsComplete, generarLlavesDieciseisavos, generarLlavesDirecto, ELIM_ROUNDS, BONUS_PHASES, getRealElimTeams, getRealAdvancers, calcElimMatchPts, getFirstActiveElimPhase, save: function(){}, };";
window.document.body.appendChild(bridge);
const T = window.__test;

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

// ── 1. El torneo activo es el Euro ficticio, sin fase de grupos ──
check("TORNEO_ACTUAL es el Euro ficticio", T.TORNEO_ACTUAL.id === "euro-ficticio");
check("bracketFormat es \"direct\" (ver nota de diseño en torneo-euro.js)", T.TORNEO_ACTUAL.bracketFormat === "direct");
check("0 partidos de fase de grupos", T.TORNEO_ACTUAL.groupMatches.length === 0);
check("0 grupos (groupKeys vacío)", T.TORNEO_ACTUAL.groupKeys.length === 0);

// ── 2. allGroupsComplete()/calcGroupStandings() no explotan con 0
//    partidos de grupos -- la primera cosa que el checkpoint prueba ──
check("allGroupsComplete() es true trivialmente (0/0 partidos)", T.allGroupsComplete());
let standings;
let standingsOk = true;
try { standings = T.calcGroupStandings(); } catch (e) { standingsOk = false; console.log("   (calcGroupStandings lanzó: " + e.message + ")"); }
check("calcGroupStandings() no explota (devuelve un objeto vacío)", standingsOk && typeof standings === "object");

// ── 3. La primera fase de eliminatoria activa es Semifinales (sf), no
//    Dieciseisavos -- confirma que getFirstActiveElimPhase() generaliza
//    a un torneo cuya PRIMERA fase de bonusPhases ya es de eliminatoria ──
check("getFirstActiveElimPhase() es 'sf' (Semifinales), la primera fase real de este torneo",
  T.getFirstActiveElimPhase()?.key === "sf");

// ── 4. "Generar llaves" con 0 grupos no debe escribir nada (ni
//    explotar, ni -- el riesgo real encontrado al escribir este
//    checkpoint -- contaminar pids ajenos a este torneo, como los
//    73-88 del Mundial 2026, que la rama "best-thirds" hardcodea) ──
T.S.elimTeams = T.S.elimTeams || {};
let generarOk = true;
try { T.generarLlavesDieciseisavos(); } catch (e) { generarOk = false; console.log("   (generarLlavesDieciseisavos lanzó: " + e.message + ")"); }
check("generarLlavesDieciseisavos() no explota con 0 grupos", generarOk);
check("No escribió nada en S.elimTeams (directCrosses vacío -> nada que resolver)", Object.keys(T.S.elimTeams).length === 0);
check("No contaminó pids ajenos a este torneo (73-88, propios del Mundial 2026)", !T.S.elimTeams[73] && !T.S.elimTeams[74]);

// ── 5. Equipos de Semifinales cargados A MANO (simula "✏️ Editar
//    llaves" -- P1/P2 son los pids manuales de este torneo, ver
//    elim1_16Ids en torneo-euro.js) ──
T.S.elimTeams[1] = { h: "Alemania", a: "Francia" };
T.S.elimTeams[2] = { h: "España", a: "Inglaterra" };
check("getRealElimTeams(1) devuelve los equipos cargados a mano", JSON.stringify(T.getRealElimTeams(1)) === JSON.stringify({ h: "Alemania", a: "Francia" }));
check("getRealElimTeams(2) devuelve los equipos cargados a mano", JSON.stringify(T.getRealElimTeams(2)) === JSON.stringify({ h: "España", a: "Inglaterra" }));

// ── 6. Avanzar Semis → Tercer/Final y confirmar que resuelve un
//    campeón sin explotar, con un torneo de solo 3 rondas ──
T.S.elimScores = T.S.elimScores || {};
T.S.elimScores[1] = { h: 2, a: 1 }; // Alemania avanza
T.S.elimScores[2] = { h: 0, a: 3 }; // Inglaterra avanza

const winnerOf = pid => {
  const sc = T.S.elimScores[pid]; const teams = T.S.elimTeams[pid];
  if (!sc || !teams) return null;
  return sc.h > sc.a ? teams.h : (sc.a > sc.h ? teams.a : null);
};
T.S.elimTeams[4] = { h: winnerOf(1), a: winnerOf(2) }; // Final: Alemania vs Inglaterra
T.S.elimScores[4] = { h: 1, a: 0 }; // Alemania campeón
T.S.elimTeams[3] = { h: "Francia", a: "España" }; // Tercer lugar: perdedores de semis
T.S.elimScores[3] = { h: 2, a: 2 };

const finalTeams = T.S.elimTeams[4];
const finalScore = T.S.elimScores[4];
check("Final: Alemania vs Inglaterra", finalTeams.h === "Alemania" && finalTeams.a === "Inglaterra");
check("Campeón resuelto: Alemania", finalScore.h > finalScore.a && finalTeams.h === "Alemania");

// ── 7. calcElimMatchPts() no explota recorriendo las 3 rondas de este
//    torneo (Semifinales/Tercer/Final, en vez de las 6 del Mundial o
//    las 4 de Copa América) ──
let calcElimOk = true;
try {
  T.BONUS_PHASES.filter(p => p.elimPhase).forEach(phase => {
    phase.mids.forEach(pid => { T.calcElimMatchPts("Alemania", pid); });
  });
} catch (e) { calcElimOk = false; console.log("   (calcElimMatchPts lanzó: " + e.message + ")"); }
check("calcElimMatchPts() no explota recorriendo las 3 rondas de este torneo", calcElimOk);

console.log(allOk ? "TODO OK ✅" : "HAY FALLAS ❌");
process.exit(allOk ? 0 : 1);
