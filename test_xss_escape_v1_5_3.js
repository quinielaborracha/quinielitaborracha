// Test de regresión — Fase 0 de seguridad (v1.5.3): XSS almacenado vía
// nombre/ciudad/país de participante.
//
// CONTEXTO: la auditoría encontró que esc() (función de escape de HTML)
// existía pero solo se usaba dentro de registro.js — los 20 módulos
// app-*.js restantes insertaban p.name/cityCountry(p)/etc. directo en
// innerHTML. Un nombre de participante como el de abajo se ejecutaba
// para cualquiera que viera el Ranking, Estadísticas, Batallas o
// Predicciones (admin incluido). Este test registra un participante con
// ese payload y verifica, en el DOM real (no en el string de HTML), que
// ninguna de las vistas públicas afectadas terminó ejecutándolo.
//
// Carga los 22 archivos de producción en el mismo orden que index.html
// (mismo patrón que test_evolucion_v1_5.js / test_full_page_load.js).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","partidos-grupos.js","utils.js","scoring.js","totp.js",
  "app-core-data.js","app-admin-auth.js","app-live-sync.js","app-tabs.js",
  "app-eliminatoria-data.js","app-batallas.js","app-bracket-render.js",
  "app-bracket-compute.js","app-bracket-espn-sync.js","app-bracket-view.js",
  "app-bracket-espn-live.js","app-integridad.js","app-predicciones.js",
  "app-estadisticas.js","app-admin-tools.js","app-bootstrap.js","registro.js"
];

const html = `<!doctype html><html><body>
  <span id="hstat"></span><span id="hdr-master-badge"></span>
  <table><tbody id="rb"></tbody></table>
  <div id="stat-cards"></div><div id="stat-popular"></div>
  <div id="battles-body"></div><div id="battles-banner"></div>
  <div id="battles-active-wrap"></div><div id="battles-history-wrap"></div>
  <button id="btab-active"></button><button id="btab-history"></button>
  <div id="psel"></div><div id="pb2"></div>
  <div id="ab"></div><div id="t-adv" style="display:none"></div>
  <div id="gb"></div>
  <div id="exp-preview-wrap"></div>
  <div id="rbasic"></div><div id="radv"></div><div id="relim"></div><div id="rlast"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="root"></div><img id="logo-img">
  <div id="rg-tabs"></div><div id="rg-content"></div>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
window.__fb = null;

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

for (const file of FILES_IN_ORDER){
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try{
    window.document.body.appendChild(script);
  }catch(e){
    console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`);
    ok = false;
  }
}

// DB/S/PL/PM/MD son "let" a nivel de módulo (participantes.js / app-core-data.js
// / app-admin-auth.js) — a diferencia de las funciones (function declaration),
// NO quedan como propiedad de window automáticamente. Como todos los <script>
// classic comparten el mismo scope léxico de nivel superior entre sí (igual
// que en la página real), un script puente al final SÍ puede leerlas — mismo
// patrón que usa test_evolucion_v1_5.js para bridgear registro.js.
const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `
window.__test = {
  get DB(){ return DB; },
  get S(){ return S; },
  set _isAdmin(v){ _isAdmin = v; }, // isAdmin() real (app-admin-auth.js) pisa cualquier stub de window.isAdmin puesto antes de cargar los scripts
};
`;
window.document.body.appendChild(bridgeScript);
if (!window.__test){ console.error("❌ El bridge no se ejecutó."); process.exit(1); }
window.__test._isAdmin = true; // forzar admin real para ejercitar también los botones ✏️/👁 (data-pname)

const W = window;

// ── Payload: junta los 4 caracteres que pide el roadmap (<, >, ", ')
// en un solo nombre, simulando el caso real que encontró la auditoría.
// Si algo NO escapa esto, jsdom lo va a parsear como un <img> real con
// un atributo onerror real — eso es justo lo que este test detecta. ──
const XSS_NAME = `XSS<img src=x onerror=alert(1)>"'`;
const XSS_CITY = `Ciudad"><script>alert(2)</script>`;
const XSS_COUNTRY = `País<b>bold</b>`;

W.__test.DB.participants = [
  { id:"p0", name: XSS_NAME, city: XSS_CITY, country: XSS_COUNTRY },
  { id:"p1", name: "Ana Normal", city: "Maracaibo", country: "Venezuela" },
];
W.__test.DB.predictions = { p0:{}, p1:{} };
W.rebuildDynamicData();

// Ninguna vista debería tener nunca un <img>/<script>/<b> REAL inyectado
// por un nombre de participante. Chequeo estructural (querySelectorAll),
// no solo de texto — así se detecta también un escape parcial/roto.
function noInjectedElements(container, label){
  const badImg = container.querySelectorAll("img[onerror]").length;
  const badScript = container.querySelectorAll("script").length; // los <script> de la app ya están cargados antes de esto; cualquiera nuevo acá es del payload
  const badBold = container.querySelectorAll("b").length; // "<b>" del payload de country — la app no genera <b> reales en estas vistas
  check(`${label}: sin <img onerror> inyectado`, badImg === 0);
  check(`${label}: sin <script> inyectado`, badScript === 0);
  check(`${label}: sin <b> inyectado (viene del país)`, badBold === 0);
}

// ── 1) RANKING (renderRank) — la vista más visitada, con botones admin ──
let rankEx = null;
try{ W.renderRank(); }catch(e){ rankEx = e; }
check("renderRank() no lanza excepción con el nombre malicioso", !rankEx);
const rb = W.document.getElementById("rb");
noInjectedElements(rb, "Ranking");
check("Ranking: el nombre aparece escapado como texto (no como HTML)", rb.textContent.includes(XSS_NAME));
check("Ranking: data-pname del botón editar quedó con el nombre real (round-trip íntegro)",
  Array.from(rb.querySelectorAll(".js-edit-participant")).some(b => b.dataset.pname === XSS_NAME));
check("Ranking: data-rkey de la fila quedó con el nombre real (round-trip íntegro)",
  Array.from(rb.querySelectorAll("tr[data-rkey]")).some(tr => tr.dataset.rkey === XSS_NAME));

// ── 2) EXPORTAR IMAGEN (buildExp) — se inserta vía innerHTML antes de html2canvas ──
let expHtml = "";
try{ expHtml = W.buildExp(); }catch(e){ check("buildExp() no lanza excepción", false); }
const expDiv = W.document.createElement("div");
expDiv.innerHTML = expHtml;
noInjectedElements(expDiv, "Exportar imagen");

// ── 3) ESTADÍSTICAS — tarjetas de jugador (renderStatCards) ──
let statEx = null;
try{ W.renderStatCards(); }catch(e){ statEx = e; }
check("renderStatCards() no lanza excepción", !statEx);
noInjectedElements(W.document.getElementById("stat-cards"), "Estadísticas (tarjetas)");

// ── 4) BATALLAS — batalla activa + historial + banner, con el nombre
// malicioso como uno de los dos combatientes ──
W.__test.S.battles = { 1: { p1: XSS_NAME, p2: "Ana Normal", name: `Batalla "<b>especial</b>`, groupMids: [1], elimMids: [], startedAt: Date.now(), closed: false } };
W.__test.S.battleHistory = [{ name: XSS_NAME, p1: XSS_NAME, p2: "Ana Normal", pts1: 5, pts2: 3, winner: XSS_NAME, date: "01 jul 2026" }];
W.__test.S.bonos = W.__test.S.bonos || {};
W.__test.S.bonos.lastPlace = { grupos: { name: XSS_NAME, pts: 2, total: 10, phase: "Grupos" } };

let battleEx = null;
try{
  W.renderBattlesPanel();
  W.renderBattleHistory();
  W.renderBattlesBanner();
}catch(e){ battleEx = e; }
check("Render de Batallas (activa+historial+banner) no lanza excepción", !battleEx);
noInjectedElements(W.document.getElementById("battles-body"), "Batallas (activa)");
noInjectedElements(W.document.getElementById("battles-history-wrap"), "Batallas (historial)");
noInjectedElements(W.document.getElementById("battles-banner"), "Batallas (banner)");

// ── 5) PREDICCIONES / AVANZADO (renderPred, renderAdv) ──
let predEx = null;
try{ W.renderPred(); W.renderAdv(); }catch(e){ predEx = e; }
check("renderPred()/renderAdv() no lanzan excepción", !predEx);
noInjectedElements(W.document.getElementById("pb2"), "Predicciones");
noInjectedElements(W.document.getElementById("ab"), "Avanzado");

// ── 6) GOLEADORES (renderScorers) — nombre/país cargados por el admin ──
W.__test.S.scorers = [{ name: XSS_NAME, country: XSS_COUNTRY, goals: 4 }];
let scorerEx = null;
try{ W.renderScorers(); }catch(e){ scorerEx = e; }
check("renderScorers() no lanza excepción", !scorerEx);
const gb = W.document.getElementById("gb");
noInjectedElements(gb, "Goleadores");
check("Goleadores: data-sname del botón ✕ quedó con el nombre real (round-trip íntegro)",
  Array.from(gb.querySelectorAll(".js-rm-scorer")).some(b => b.dataset.sname === XSS_NAME));

console.log(`\n=== RESULTADO: ${ok ? "TODO OK ✅" : "HAY ERRORES ❌"} ===`);
process.exit(ok?0:1);
