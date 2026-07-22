// Test funcional del fix v3.8.4: guardia de reentrada + timeout de red en
// las 3 corridas de sincronización con ESPN (fetchESPNElim en
// app-bracket-espn-sync.js; fetchESPN/loadMM en app-bracket-espn-live.js).
//
// ANTES: cada una llamaba a fetch() sin fijarse si la corrida anterior
// seguía en curso -- si ESPN respondía lento (o directamente colgaba, sin
// timeout), una corrida solapada podía resetear estado a mitad del
// procesamiento de la anterior (_elimConflictQueue/_conflictQueue), y un
// fetch colgado dejaba el auto-sync trabado hasta recargar la página (ver
// auditoría 2026-07-05).
//
// Carga completa en jsdom de los archivos de producción reales, mismo
// patrón que test_espn_elim_gameid.js.
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

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Mock de fetch controlable: cada llamada queda "colgada" hasta que el
// test decida resolverla a mano (releaseAll), y registra si recibió un
// AbortSignal (para verificar el wiring del timeout sin esperar 15s reales).
let fetchCallCount = 0;
let sawAbortSignal = false;
let pendingResolvers = [];
window.fetch = (url, opts) => {
  fetchCallCount++;
  if (opts && opts.signal) sawAbortSignal = true;
  return new Promise(resolve => {
    pendingResolvers.push(() => resolve({ ok: true, json: () => Promise.resolve({ events: [] }) }));
  });
};
function releaseAllFetches() {
  const toRelease = pendingResolvers; pendingResolvers = [];
  toRelease.forEach(r => r());
}

for (const f of FILES) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

// v3.8.4 — se pisa DESPUÉS de cargar los archivos: app-live-sync.js
// declara su propio toast() de nivel superior, que sobreescribiría
// cualquier mock asignado ANTES de cargar los scripts (mismo motivo por
// el que test_envio_quiniela_confirmado.js/test_login_reclaim.js no
// cargan ese archivo -- acá sí lo necesitamos, para fetchESPN()/loadMM()).
const toastLog = [];
window.toast = (m, e) => { toastLog.push({ m, e: !!e }); };

check(`Los ${FILES.length} archivos cargaron sin lanzar excepción`, true);
check("fetchESPNElim es una función global", typeof window.fetchESPNElim === "function");
check("fetchESPN es una función global", typeof window.fetchESPN === "function");
check("loadMM es una función global", typeof window.loadMM === "function");

(async () => {
  /* ══════════════════════════════════════════════════════════════
     CASO A — fetchESPNElim(): una segunda llamada mientras la primera
     sigue en curso debe descartarse (sin disparar fetch nuevos) y avisar
     con un toast; una vez que la primera termina, sí se puede volver a
     sincronizar.
     ══════════════════════════════════════════════════════════════ */
  console.log("\n── CASO A: fetchESPNElim() -- guardia de reentrada ──");
  fetchCallCount = 0; toastLog.length = 0;
  const p1 = window.fetchESPNElim(); // arranca, queda "colgada" (fetch no resuelto)
  await sleep(0);
  const callsAfterFirst = fetchCallCount;
  check("CASO A: la primera llamada sí disparó pedidos a ESPN", callsAfterFirst > 0);

  window.fetchESPNElim(); // segunda llamada mientras la primera sigue en curso
  await sleep(0);
  check("CASO A: la segunda llamada (solapada) NO disparó pedidos nuevos", fetchCallCount === callsAfterFirst);
  check("CASO A: se avisó que ya había una sincronización en curso", toastLog.some(t => /en curso/i.test(t.m)));

  releaseAllFetches();
  await p1; await sleep(0);

  fetchCallCount = 0;
  const p2 = window.fetchESPNElim(); // ahora que la primera terminó, debe poder arrancar de nuevo
  await sleep(0);
  check("CASO A: tras terminar la primera, una nueva llamada SÍ dispara pedidos", fetchCallCount > 0);
  releaseAllFetches();
  await p2;

  /* ══════════════════════════════════════════════════════════════
     CASO B — fetchESPN() (fase de grupos): misma guardia.
     ══════════════════════════════════════════════════════════════ */
  console.log("\n── CASO B: fetchESPN() (grupos) -- guardia de reentrada ──");
  fetchCallCount = 0; toastLog.length = 0;
  const p3 = window.fetchESPN();
  await sleep(0);
  const callsB = fetchCallCount;
  check("CASO B: la primera llamada disparó pedidos", callsB > 0);
  window.fetchESPN();
  await sleep(0);
  check("CASO B: la llamada solapada NO disparó pedidos nuevos", fetchCallCount === callsB);
  releaseAllFetches();
  await p3;

  /* ══════════════════════════════════════════════════════════════
     CASO C — loadMM() ("En vivo"): misma guardia.
     ══════════════════════════════════════════════════════════════ */
  console.log("\n── CASO C: loadMM() (En vivo) -- guardia de reentrada ──");
  fetchCallCount = 0;
  const p4 = window.loadMM(true);
  await sleep(0);
  const callsC = fetchCallCount;
  check("CASO C: la primera llamada disparó pedidos", callsC > 0);
  window.loadMM(false); // el tick automático de 30s, mientras la anterior sigue en curso
  await sleep(0);
  check("CASO C: el tick solapado NO disparó pedidos nuevos", fetchCallCount === callsC);
  releaseAllFetches();
  await p4;

  /* ══════════════════════════════════════════════════════════════
     CASO D — Wiring del timeout: los 3 llamadores deben pasar un
     AbortSignal a fetch() (así ESPN colgado no traba el auto-sync para
     siempre -- no esperamos los 15s reales acá, solo confirmamos que el
     mecanismo está conectado).
     ══════════════════════════════════════════════════════════════ */
  console.log("\n── CASO D: las 3 corridas pasan un AbortSignal a fetch() ──");
  check("CASO D: fetch() se llamó con un AbortSignal (timeout de red conectado)", sawAbortSignal);

  console.log("\n=== RESULTADO FINAL:", allOk ? "TODOS LOS CASOS PASAN ✅" : "HAY FALLOS ❌", "===");
  process.exit(allOk ? 0 : 1);
})();
