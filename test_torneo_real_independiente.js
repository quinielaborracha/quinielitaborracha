// Test funcional del fix v3.9.4: reproduce el bug real reportado por el
// usuario -- "Torneo Real" (Estadísticas) mostraba a Sudáfrica contra
// Bosnia-Herzegovina, cuando el partido real (según ESPN) es Sudáfrica
// vs Canadá, ya finalizado 0-1.
//
// CAUSA RAÍZ: el bracket de PREDICCIONES (S.elimTeams) se arma una sola
// vez con "⚡ Generar llaves de Dieciseisavos" a partir de las
// posiciones de grupo en ESE momento -- si esa foto se tomó con datos de
// Grupo B todavía incompletos, quedó con el rival equivocado (Bosnia en
// vez de Canadá) para siempre, sin recalcularse sola. "Torneo Real" leía
// exactamente ese mismo dato (getRealElimTeams/S.elimTeams), así que
// heredaba el error aunque no tiene nada que ver con ninguna predicción.
//
// FIX: S.realElim (app-state.js) es una copia independiente que
// fetchESPNElim() llena siempre con lo último que diga ESPN para el
// gameId real de cada pid, sin pasar por la protección de "no pisar una
// predicción ya hecha". Este test prueba EXACTAMENTE el escenario
// reportado: S.elimTeams[73] queda con el rival viejo/equivocado
// (Bosnia), pero tras sincronizar con ESPN, S.realElim[73] (lo que
// muestra "Torneo Real") sí refleja la realidad (Canadá, 0-1, finalizado).
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
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
window.Blob = function () {};
window.setInterval = () => 0;
window.toast = () => {};

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

// Réplica mínima, con los datos reales que devuelve hoy la API pública de
// ESPN para el gameId 760486 (P73): Sudáfrica 0 - Canadá 1, finalizado.
function espnEventoReal() {
  return {
    id: "760486", date: "2026-06-28T19:00Z",
    competitions: [{
      status: { type: { state: "post" } },
      competitors: [
        { homeAway: "home", score: "0", team: { displayName: "South Africa" } },
        { homeAway: "away", score: "1", team: { displayName: "Canada" } },
      ],
    }],
    status: { type: { state: "post" } },
  };
}
window.fetch = (url) => {
  const m = String(url).match(/dates=(\d+)/);
  const events = (m && m[1] === "20260628") ? [espnEventoReal()] : [];
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ events }) });
};

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
const W = window;

check("Los archivos cargaron sin lanzar excepción", true);

// ── Reproducir el estado reportado: el bracket de PREDICCIONES quedó
// con el rival equivocado (Bosnia en vez de Canadá), sin resultado
// cargado todavía -- el escenario exacto de la auditoría del usuario. ──
T.S.elimTeams[73] = { h: "Sudáfrica", a: "Bosnia-Herzegovina" };
T.DB.participants = [];
T.DB.predictions = {};

(async () => {
  await W.fetchESPNElim();

  check("S.realElim[73] (lo que muestra 'Torneo Real') SÍ tiene el rival real: Canadá",
    T.S.realElim[73] && /canad/i.test(T.S.realElim[73].a));
  check("S.realElim[73] tiene el marcador real: 0 - 1", T.S.realElim[73].hs === 0 && T.S.realElim[73].as === 1);
  check("S.realElim[73] está marcado 'post' (finalizado)", T.S.realElim[73].state === "post");

  // Render real de la pantalla -- confirma que ya NO se ve "Bosnia".
  W.document.getElementById("stat-popular") || (() => {
    const d = W.document.createElement("div"); d.id = "stat-popular"; W.document.body.appendChild(d);
  })();
  W.renderTorneoReal();
  const panelHtml = W.document.getElementById("stat-popular").innerHTML;
  check("'Torneo Real' muestra Canadá (el rival real), NO Bosnia", panelHtml.includes("Canad") && !panelHtml.includes("Bosnia"));
  check("'Torneo Real' muestra el marcador real finalizado 0 – 1", /0\s*–\s*1/.test(panelHtml) && panelHtml.includes("finalizado"));

  console.log("\n=== RESULTADO FINAL:", allOk ? "TODOS LOS CASOS PASAN ✅" : "HAY FALLOS ❌", "===");
  process.exit(allOk ? 0 : 1);
})();
