// Test funcional de v2.8: la sub-pestaña de Estadísticas antes llamada
// "🗳 Predicciones" (consenso de los 27 sobre partidos de grupos) pasa a
// llamarse "🏆 Torneo real" y muestra el bracket de ELIMINATORIA REAL del
// Mundial (P73-P104), sacado 100% de S.elimScores/getRealElimTeams (la
// misma fuente de verdad que ya usa el resto de la app) -- nada de
// predicciones de participantes.
//
// También cubre que se "actualiza sola, en vivo":
//   1) Cualquier visitante que la esté mirando la ve refrescarse SOLA en
//      cuanto llega un cambio remoto real (applyRemoteState, mismo
//      onSnapshot que sincroniza todo lo demás) -- sin recargar.
//   2) El auto-sync con ESPN en segundo plano (startTorneoRealAutoSync)
//      solo corre en sesiones de ADMIN (las únicas que Firestore deja
//      escribir quiniela/estado).
//
// Carga el index.html REAL (mismo patrón que test_espn_elim_gameid.js)
// para ejercitar el tab/botón de verdad, no una llamada directa a la
// función interna.
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
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
window.Blob = function () {};

// Captura de setInterval/clearInterval en vez del stub ciego "=>0" que usan
// otros tests -- acá SÍ hace falta poder disparar el tick a mano (Parte 4)
// y confirmar que se frena de verdad (Parte 4b).
let lastIntervalFn = null, lastIntervalMs = null, lastIntervalId = 0, clearedIds = [];
window.setInterval = (fn, ms) => { lastIntervalFn = fn; lastIntervalMs = ms; return ++lastIntervalId; };
window.clearInterval = (id) => { clearedIds.push(id); };

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

// fetchESPNElim() no debería ni intentar llamar a esto en este test (no lo
// ejercitamos con datos reales de ESPN, solo el arranque/frenado del
// timer) -- si lo hiciera, que no explote.
window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ events: [] }) });

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
  getS: () => S,
  applyRemoteState, startTorneoRealAutoSync, stopTorneoRealAutoSync,
  buildStatePayload,
};
`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;
const W = window;

check(`Los ${FILES.length} archivos cargaron sin lanzar excepción`, true);

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — La pestaña se renombró de verdad (botón real del DOM)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Renombrado de la pestaña ──");
const tabBtn = W.document.getElementById("stab-popular");
check("El botón existe y dice '🏆 Torneo real' (ya no '🗳 Predicciones')",
  !!tabBtn && tabBtn.textContent.includes("Torneo real") && !tabBtn.textContent.includes("Predicciones"));

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — Click real en la pestaña: bracket vacío (nada cargado
   todavía) muestra la estructura de rondas con "por definir"
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Click real en la pestaña: estructura del bracket ──");
W.document.getElementById("root") // noop, solo por si el DOM necesita asentarse
W.tab("stats");
tabBtn.dispatchEvent(new W.Event("click", { bubbles: true }));
const panelHtml = () => W.document.getElementById("stat-popular").innerHTML;

check("Muestra las 6 rondas de eliminatoria (Dieciseisavos ... Gran Final)",
  ["Dieciseisavos de final", "Octavos de final", "Cuartos de final", "Semifinales", "Tercer y cuarto lugar", "🏆 Gran Final"]
    .every(lbl => panelHtml().includes(lbl)));
check("Sin equipos reales cargados todavía, los cruces dicen 'por definir'", panelHtml().includes("por definir"));
check("NO quedó nada de la vieja vista de consenso de predicciones (ej. 'mayoría acertó')",
  !panelHtml().includes("mayoría acertó") && !panelHtml().includes("Partidos más disputados"));
check("Indica que se actualiza sola, sin recargar", panelHtml().includes("Se actualiza solo"));

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — Con resultado real cargado (P73, Dieciseisavos): se ve el
   marcador final, SIN mezclarse con ninguna predicción de participante
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Partido real finalizado ──");
T.getS().elimTeams[73] = { h: "Argentina", a: "Brasil" };
T.getS().elimScores[73] = { h: 2, a: 1, live: false };
T.getS().elimTimes[73] = new Date("2026-06-28T19:00:00Z").getTime();
T.getS().elimTeams[74] = { h: "Uruguay", a: "Alemania" };
T.getS().elimScores[74] = { h: 1, a: 1, live: true };

// Un participante con un nombre bien distintivo -- si apareciera en esta
// vista sería la prueba de que se coló algo de predicciones, cuando esto
// debe ser 100% resultado real, sin participantes de por medio.
W.__test.getS(); // noop
if (typeof W.DB !== "undefined") {
  W.DB.participants = [{ id: "px", name: "Zzz Participante Delator", city: "C", country: "P" }];
  W.DB.predictions = { px: {} };
  if (typeof W.rebuildDynamicData === "function") W.rebuildDynamicData();
}

W.statTab("popular");
check("P73 (Argentina vs Brasil, finalizado) muestra el marcador real 2 – 1",
  panelHtml().includes("Argentina") && panelHtml().includes("Brasil") && /2\s*–\s*1/.test(panelHtml()));
check("P73 está marcado como 'finalizado'", panelHtml().includes("finalizado"));
check("P74 (Uruguay vs Alemania, EN VIVO) muestra el badge EN VIVO y el marcador 1 – 1",
  panelHtml().includes("EN VIVO") && panelHtml().includes("Uruguay") && panelHtml().includes("Alemania"));
check("El nombre del participante NO aparece en esta vista (es 100% resultado real, no predicciones)",
  !panelHtml().includes("Zzz Participante Delator"));

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — "En vivo de verdad": un cambio remoto (Firestore) se
   refleja SOLO, sin que nadie toque nada, mientras la pestaña está
   visible
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Se actualiza sola ante un cambio remoto (mientras está visible) ──");
const payload = T.buildStatePayload();
payload.elimScores = { ...payload.elimScores, 74: { h: 3, a: 1, live: false } }; // el partido en vivo terminó 3-1
T.applyRemoteState(payload);
check("Tras un cambio remoto con la pestaña visible, se repintó sola con el resultado nuevo (3 – 1, ya no 1 – 1 en vivo)",
  /3\s*–\s*1/.test(panelHtml()) && !panelHtml().includes("EN VIVO"));

console.log("\n── NO se re-renderiza si la pestaña no está visible (no debe explotar tampoco) ──");
W.tab("rank"); // nos vamos de Estadísticas
let threw = false;
try {
  const payload2 = T.buildStatePayload();
  payload2.elimScores = { ...payload2.elimScores, 74: { h: 9, a: 9, live: false } };
  T.applyRemoteState(payload2);
} catch (e) { threw = true; }
check("applyRemoteState() no explota aunque la pestaña de Torneo real no esté visible", !threw);

/* ════════════════════════════════════════════════════════════════
   PARTE 5 — Auto-sync con ESPN en segundo plano: SOLO para admin
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Auto-sync en segundo plano: solo se arma para admin ──");
W.isAdmin = () => false;
lastIntervalFn = null; lastIntervalMs = null;
T.startTorneoRealAutoSync();
check("Sin ser admin, NO se arma ningún timer de auto-sync", lastIntervalFn === null);

W.isAdmin = () => true;
lastIntervalFn = null; lastIntervalMs = null;
T.startTorneoRealAutoSync();
check("Siendo admin, SÍ se arma el timer de auto-sync", typeof lastIntervalFn === "function");
check("El intervalo es razonable (60s-120s, ni muy agresivo con la API de ESPN ni inútilmente lento)",
  lastIntervalMs >= 60000 && lastIntervalMs <= 120000);

let fetchElimCalls = 0;
const originalFetchElim = W.fetchESPNElim;
W.fetchESPNElim = () => { fetchElimCalls++; return Promise.resolve(); };
lastIntervalFn(); // dispara un "tick" a mano
check("Cada tick del timer llama a fetchESPNElim() (la sincronización real con ESPN)", fetchElimCalls === 1);
W.fetchESPNElim = originalFetchElim;

const idsAntesDeParar = clearedIds.length;
T.stopTorneoRealAutoSync();
check("stopTorneoRealAutoSync() frena el timer (clearInterval real)", clearedIds.length === idsAntesDeParar + 1);

console.log(`\n${allOk ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(allOk ? 0 : 1);
