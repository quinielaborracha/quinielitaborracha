// Test funcional de v3.5.1 — BUG REPORTADO: "Torneo real" (Estadísticas)
// se veía en blanco para Dieciseisavos (y en cascada, TODAS las rondas
// posteriores) apenas el admin desactivaba esa fase en el Constructor de
// Torneos (Configuración del torneo → Fases activas) — aunque los
// equipos/resultado real de Dieciseisavos YA estaban cargados de antes.
//
// CAUSA RAÍZ: getRealElimTeams() (scoring.js) decide de dónde saca los
// equipos reales de un pid según getManualTeamPids(), que devuelve los
// pids de la PRIMERA FASE ACTIVA (pensado para "Constructor de Torneos":
// arrancar el torneo directo en Octavos+ si Grupos/Dieciseisavos no
// existieron). Al desactivar Dieciseisavos DESPUÉS de que ya tenía datos
// reales, deja de ser "la fase manual" (ahora lo es Octavos) — pero
// tampoco tiene entrada en ELIM_TREE para derivarse de una ronda
// anterior (ELIM_TREE arranca en Octavos/pid 89: Dieciseisavos SIEMPRE es
// la raíz). Sin ningún camino válido, getRealElimTeams() devolvía null
// para esos pids, y como las rondas posteriores dependen de resolver la
// anterior (getRealWinner→getRealElimTeams en cadena), TODO el bracket
// real quedaba en blanco a partir de ahí.
//
// FIX: getRealElimTeams() ahora cae de vuelta a S.elimTeams[pid] cuando
// el pid no es la fase manual actual NI tiene entrada en ELIM_TREE —
// exactamente el caso de un pid que YA tenía datos reales antes de que
// se desactivara su fase. Desactivar una fase solo debe afectar sus
// PUNTOS (isFaseActiva), nunca ocultar lo que de verdad pasó.
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
  getManualTeamPids: () => getManualTeamPids(),
  getRealElimTeams: (pid) => getRealElimTeams(pid),
  getRealWinner: (pid, wantLoser) => getRealWinner(pid, wantLoser),
};
`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;

/* ════════════════════════════════════════════════════════════════
   SETUP — Dieciseisavos (P73) ya tiene equipos + resultado real
   cargados, con TODAS las fases activas (caso normal de siempre).
   ════════════════════════════════════════════════════════════════ */
T.getS().elimTeams[73] = { h: "México", a: "Alemania" };
T.getS().elimScores[73] = { h: 2, a: 1, live: false };
// P90 (Octavos) depende de P73 en ELIM_TREE (parentH:73) -- sirve para
// probar que el arreglo también repara la cascada hacia rondas siguientes.
T.getS().elimTeams[75] = { h: "Brasil", a: "Argentina" };
T.getS().elimScores[75] = { h: 1, a: 0, live: false };

console.log("── Con TODAS las fases activas (caso normal) ──");
check("P73 es parte de la fase manual", T.getManualTeamPids().includes(73));
check("getRealElimTeams(73) devuelve México/Alemania", JSON.stringify(T.getRealElimTeams(73)) === JSON.stringify({ h: "México", a: "Alemania" }));
check("getRealWinner(73) devuelve México (ganó 2-1 de local)", T.getRealWinner(73) === "México");
check("P90 (Octavos, depende de P73+P75 en ELIM_TREE) resuelve México vs Brasil",
  JSON.stringify(T.getRealElimTeams(90)) === JSON.stringify({ h: "México", a: "Brasil" }));

/* ════════════════════════════════════════════════════════════════
   BUG — El admin desactiva Dieciseisavos (fasesActivas.r16=false) DESPUÉS
   de que ya tenía datos reales. Antes del fix, P73 y todo lo que depende
   de él (P90 en adelante) quedaba en blanco.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Se desactiva Dieciseisavos (r16:false) — los datos reales YA cargados deben seguir viéndose ──");
T.getDB().configGlobal.fasesActivas = { grupos: true, r16: false, r8: true, qf: true, sf: true, third: true, final: true };
check("P73 YA NO es la fase manual (ahora lo es Octavos)", !T.getManualTeamPids().includes(73));
check("getRealElimTeams(73) SIGUE devolviendo México/Alemania (antes del fix: null)",
  JSON.stringify(T.getRealElimTeams(73)) === JSON.stringify({ h: "México", a: "Alemania" }));
check("getRealWinner(73) sigue resolviendo México", T.getRealWinner(73) === "México");
check("P90 (Octavos, en cascada) sigue resolviendo México vs Brasil (antes del fix también quedaba en blanco)",
  JSON.stringify(T.getRealElimTeams(90)) === JSON.stringify({ h: "México", a: "Brasil" }));

/* ════════════════════════════════════════════════════════════════
   SIN REGRESIÓN — un pid sin datos reales cargados (nunca se jugó/cargó)
   sigue devolviendo null como corresponde, no inventa nada.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Sin regresión: un pid sin datos reales sigue en null ──");
check("P74 (Dieciseisavos, sin datos cargados) sigue devolviendo null", T.getRealElimTeams(74) === null);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
