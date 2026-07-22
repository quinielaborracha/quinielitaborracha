// Test funcional de v2.9.2: cuando un torneo arranca directo en una fase
// de eliminatoria posterior a Dieciseisavos (Constructor de Torneos, ver
// registro.js — ej. Grupos y Dieciseisavos desactivados, el torneo
// arranca en Octavos), el botón "⚡ ESPN Live" debe cargar los equipos
// reales de ESA fase (Octavos, pids 89-96), no de Dieciseisavos.
//
// BUG REPORTADO: equiposConocidosElim()/fetchESPNElim() en
// app-bracket-espn-sync.js tenían hardcodeado "ELIM_1_16_IDS" (pids
// 73-88) para decidir qué pids reciben equipos "a mano" desde ESPN —
// ELIM_1_16_IDS es SIEMPRE Dieciseisavos, sin importar qué fase esté
// realmente activa. app-bracket-render.js (el editor MANUAL de llaves)
// ya se había corregido para esto en v1.2 (getManualTeamPids(), dinámico
// según qué fase de eliminatoria es la primera activa) — pero el sync de
// ESPN se quedó con el criterio viejo, así que para un torneo que
// arranca en Octavos, ESPN nunca escribía nada en S.elimTeams para esos
// pids (89-96): el botón "no actualizaba los datos".
//
// Fix: equiposConocidosElim() y fetchESPNElim() ahora usan
// getManualTeamPids() (scoring.js, ya dinámico) en vez del ID fijo.
//
// Mismo patrón de harness que test_espn_elim_gameid.js.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "partidos-grupos.js", "utils.js", "paises.js", "app-static-data.js", "app-state.js", "scoring.js",
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

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

let fetchResponses = {};
window.fetch = (url) => {
  const m = String(url).match(/dates=(\d+)/);
  const d = m ? m[1] : null;
  const events = fetchResponses[d] || [];
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ events }) });
};

for (const f of FILES) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try {
    window.document.body.appendChild(script);
  } catch (e) {
    console.error(`❌ Excepción al cargar ${f}:`, e.message);
    process.exit(1);
  }
}

const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `
window.__test = {
  getDB: () => DB,
  getS: () => S,
  getManualTeamPids: () => getManualTeamPids(),
};
`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;

function espnEvent(id, homeName, awayName, homeScore, awayAbbr, awayScore, state, date) {
  return {
    id: String(id), date: date || "2026-06-28T19:00Z",
    competitions: [{
      status: { type: { state: state || "pre" } },
      competitors: [
        { homeAway: "home", score: String(homeScore || 0), team: { displayName: homeName, abbreviation: "X" } },
        { homeAway: "away", score: String(awayScore || 0), team: { displayName: awayName, abbreviation: awayAbbr || "Y" } },
      ],
    }],
    status: { type: { state: state || "pre" } },
  };
}

(async () => {
  // ── SETUP: torneo que arranca en Octavos (Grupos y Dieciseisavos
  // desactivados) — mismo mecanismo que test_ko_equipos_reales_persistencia.js ──
  T.getDB().configGlobal.fasesActivas = { grupos: false, r16: false };
  check("getManualTeamPids() ahora devuelve los pids de Octavos (89-96), no Dieciseisavos",
    JSON.stringify(T.getManualTeamPids()) === JSON.stringify([89,90,91,92,93,94,95,96]));

  // ── Caso 1: ESPN carga un cruce nuevo de OCTAVOS (P89) ──
  T.getS().elimTeams = {}; T.getS().elimScores = {};
  // gameId 760503 -> pid 89 (ver ESPN_GAMEID_TO_PID, app-live-sync.js)
  fetchResponses = { "20260703": [espnEvent(760503, "Argentina", "France", 0, "FRA", 0, "pre", "2026-07-03T19:00Z")] };
  await window.fetchESPNElim();
  check("P89 (Octavos) cargó equipos nuevos desde ESPN — ANTES de este fix quedaba vacío",
    T.getS().elimTeams[89] && T.getS().elimTeams[89].h === "Argentina" && T.getS().elimTeams[89].a === "Francia");
  check("P73 (Dieciseisavos, fase desactivada) NO se tocó", T.getS().elimTeams[73] === undefined);

  // ── Caso 2: con los equipos ya confirmados, un resultado en juego debe orientarse y guardarse ──
  fetchResponses = { "20260703": [espnEvent(760503, "Argentina", "France", 2, "FRA", 1, "in", "2026-07-03T19:00Z")] };
  await window.fetchESPNElim();
  check("P89 tomó el marcador en vivo 2-1 (Argentina local)",
    T.getS().elimScores[89] && T.getS().elimScores[89].h === 2 && T.getS().elimScores[89].a === 1 && T.getS().elimScores[89].live === true);

  // ── Caso 3: torneo NORMAL (sin fasesActivas configuradas) — debe seguir
  //    siendo Dieciseisavos como siempre (sin regresión) ──
  T.getDB().configGlobal.fasesActivas = null;
  check("Sin config especial, getManualTeamPids() vuelve a ser Dieciseisavos (73-88)",
    JSON.stringify(T.getManualTeamPids()) === JSON.stringify([73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88]));
  T.getS().elimTeams = {}; T.getS().elimScores = {};
  fetchResponses = { "20260628": [espnEvent(760486, "South Africa", "Canada", 0, "CAN", 0, "pre")] };
  await window.fetchESPNElim();
  check("Caso normal: P73 sigue cargando desde ESPN igual que siempre", T.getS().elimTeams[73] && T.getS().elimTeams[73].h === "Sudáfrica");

  // ── Caso 4 (v3.0) — ESPN todavía no resolvió al rival real de un
  //    cruce de la fase manual: devuelve su propio placeholder de
  //    bracket ("Round of 32 14 Winner") en vez de un país. Esto YA NO
  //    debe cargarse en S.elimTeams como si fuera un equipo real. ──
  console.log("\n── v3.0: ESPN todavía no resolvió un rival (placeholder) ──");
  T.getDB().configGlobal.fasesActivas = { grupos: false, r16: false };
  T.getS().elimTeams = {}; T.getS().elimScores = {};
  fetchResponses = { "20260703": [espnEvent(760503, "Round of 32 14 Winner", "Egypt", 0, "EGY", 0, "pre", "2026-07-03T19:00Z")] };
  await window.fetchESPNElim();
  check("P89 NO se cargó -- un lado sigue siendo el placeholder de ESPN", T.getS().elimTeams[89] === undefined);

  // Si el partido YA se está jugando/terminó (estado in/post) con un
  // lado todavía sin resolver -- caso extremo, no debería pasar en la
  // vida real, pero tampoco debe colarse un marcador sin equipos reales.
  fetchResponses = { "20260703": [espnEvent(760503, "Round of 32 14 Winner", "Egypt", 2, "EGY", 1, "in", "2026-07-03T19:00Z")] };
  await window.fetchESPNElim();
  check("P89 tampoco tomó un marcador mientras un lado siga siendo placeholder", T.getS().elimScores[89] === undefined);

  // Cuando ESPN por fin confirma a los 2 rivales reales, ahí sí se carga normal.
  fetchResponses = { "20260703": [espnEvent(760503, "Argentina", "Egypt", 0, "EGY", 0, "pre", "2026-07-03T19:00Z")] };
  await window.fetchESPNElim();
  check("P89 SÍ se carga en cuanto ESPN confirma a los 2 rivales reales",
    T.getS().elimTeams[89] && T.getS().elimTeams[89].h === "Argentina" && T.getS().elimTeams[89].a === "Egipto");

  console.log(allOk ? "\n✅✅✅ TODO OK" : "\n❌❌❌ HAY FALLOS");
  process.exit(allOk ? 0 : 1);
})();
