// Test funcional de v2.10: cuando el torneo arranca directo en una fase
// de eliminatoria con equipos REALES (Constructor de Torneos, ver
// bracket.realSeedKey en registro.js), el admin suele cargar la llave con
// un texto provisional ("Ganador de Argentina vs Cabo Verde") para que la
// gente pueda ir prediciendo el marcador antes de que la ronda previa
// real termine. La predicción de cada participante guarda la "huella"
// _a/_b con el nombre vigente al momento de teclear — y esa huella es lo
// que isLlaveCorrecta()/el bracket de Predicciones comparan después.
//
// Antes de v2.10, al renombrar el texto provisional por el país real
// (✏️ Editar llaves o ⚡ ESPN), TODAS las quinielas ya guardadas quedaban
// apuntando al texto viejo: llave ✗ para todo el mundo, cruces
// encadenados invalidados, campeón "quemado" con el texto provisional.
// Ahora propagateElimTeamRenames() (app-core-data.js) reescribe el
// renombre en las predicciones guardadas de todos los participantes —
// SOLO mientras el registro siga abierto (isGloballyClosed, pedido
// explícito del admin: tras el cierre las predicciones quedan
// congeladas), nunca en Modo Prueba, y nunca cuando el bracket se
// siembra de los grupos predichos por cada quien (ahí esos nombres SÍ
// son la predicción del participante).
//
// Mismo patrón de harness que test_ko_equipos_reales_persistencia.js:
// carga los archivos de producción reales en el orden de index.html +
// bridge dentro de la IIFE de registro.js.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","partidos-grupos.js","utils.js","app-static-data.js","app-state.js","scoring.js","totp.js",
  "app-core-data.js","app-admin-auth.js","app-live-sync.js","app-tabs.js",
  "app-eliminatoria-data.js","app-batallas.js","app-bracket-render.js",
  "app-bracket-annexc.js","app-bracket-compute.js","app-bracket-espn-sync.js","app-bracket-view.js",
  "app-bracket-espn-live.js","app-integridad.js","app-predicciones.js",
  "app-estadisticas.js","app-admin-tools.js","app-bootstrap.js"
];

const html = `<!doctype html><html><body>
  <div id="rg-tabs"><button class="rg-tab on" data-tab="inicio">Inicio</button></div>
  <div id="rg-content"></div>
  <div id="torneo-content"></div>
  <div id="toast"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="teams-editor-body"></div><div id="teams-modal" style="display:none"></div>
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
window.__fb = null;
window.requestAnimationFrame = () => 0;

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

for (const file of FILES_IN_ORDER){
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try{ window.document.body.appendChild(script); }
  catch(e){ console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`); ok = false; }
}

let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = { DB, S };
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

// La sesión del harness "es" el admin (la propagación exige isAdmin() —
// en producción las reglas de Firestore solo le permiten a él escribir
// documentos ajenos de registro_participants), y las repintadas de UI
// que dispara saveTeamsEditor() quedan en no-op: acá se verifica la
// PROPAGACIÓN DE DATOS, no el HTML de esas 3 vistas (que ya tienen sus
// propios tests/manejo). save() también en no-op: persistir S no es lo
// que se prueba y el mock de Firebase es null.
const setup = window.document.createElement("script");
setup.textContent = `
  _isAdmin = true;
  renderElim = () => {};
  renderBracket = () => {};
  renderRank = () => {};
  save = () => {};
`;
window.document.body.appendChild(setup);

const T = window.__test;
const W = window;

const PROV = "Ganador de Argentina vs Cabo Verde"; // texto provisional del admin

/* ════════════════════════════════════════════════════════════════
   SETUP — Grupos desactivada: el torneo arranca directo en
   Dieciseisavos con equipos reales/provisionales cargados por el admin.
   3 participantes: p1 borrador con toda la cadena apuntando al texto
   provisional, p2 YA ENVIADA (también se propaga), p3 sin predicciones.
   ════════════════════════════════════════════════════════════════ */
T.DB.configGlobal.fasesActivas = { grupos:false };
T.DB.configGlobal.registroAbierto = true;
T.DB.configGlobal.fechaCierre = "2099-12-31"; // registro ABIERTO
T.DB.participants = [
  {id:"p1", codigo:"QLB-2026-0001", name:"Juan Pérez",  city:"C", country:"P", email:"j@x.com", clave:"111111", ownerUid:"anon-1", estadoQuiniela:"borrador", fechaCreacion:1, fechaActualizacion:1, lastStep:2},
  {id:"p2", codigo:"QLB-2026-0002", name:"Ana Gómez",   city:"C", country:"P", email:"a@x.com", clave:"222222", ownerUid:"anon-2", estadoQuiniela:"enviada",  fechaCreacion:1, fechaActualizacion:1, lastStep:9},
  {id:"p3", codigo:"QLB-2026-0003", name:"Luis Mora",   city:"C", country:"P", email:"l@x.com", clave:"333333", ownerUid:"anon-3", estadoQuiniela:"borrador", fechaCreacion:1, fechaActualizacion:1, lastStep:2},
];
T.DB.predictions = {
  p1: {
    r32_1: { h:3, a:0, _a:PROV, _b:"Senegal" },              // marcador sobre la llave provisional
    r16_1: { h:2, a:1, _a:PROV, _b:"Francia" },              // ronda siguiente, encadenada del provisional
    special: { campeon:PROV, subcampeon:"Francia" },          // campeón "quemado" con el provisional
  },
  p2: {
    r32_1: { h:1, a:1, pick:PROV, _a:PROV, _b:"Senegal" },   // empate con pick del provisional
  },
  p3: {},
};
// pid 73 == slot 'r32_1' (SLOT_TO_PID, app-core-data.js)
T.S.elimTeams[73] = { h:PROV, a:"Senegal" };
W.rebuildDynamicData();

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — El admin renombra el texto provisional por el país real
   desde ✏️ Editar llaves (flujo REAL: openTeamsEditor → inputs →
   saveTeamsEditor). Debe propagarse a p1 (borrador) y p2 (enviada).
   ════════════════════════════════════════════════════════════════ */
console.log("── ✏️ Editar llaves: provisional → país real, con registro abierto ──");
W.openTeamsEditor();
let inH = W.document.getElementById("th73");
let inA = W.document.getElementById("ta73");
check("El editor de llaves muestra el texto provisional cargado", !!inH && inH.value === PROV && inA.value === "Senegal");
inH.value = "Argentina";
W.saveTeamsEditor();

check("La llave real quedó como Argentina vs Senegal", T.S.elimTeams[73].h === "Argentina" && T.S.elimTeams[73].a === "Senegal");
check("p1: la huella _a de r32_1 ahora dice 'Argentina'", T.DB.predictions.p1.r32_1._a === "Argentina");
check("p1: el marcador 3:0 NO se tocó", T.DB.predictions.p1.r32_1.h === 3 && T.DB.predictions.p1.r32_1.a === 0);
check("p1: la ronda encadenada (r16_1) también se renombró", T.DB.predictions.p1.r16_1._a === "Argentina" && T.DB.predictions.p1.r16_1._b === "Francia");
check("p1: el campeón quemado también se renombró", T.DB.predictions.p1.special.campeon === "Argentina");
check("p1: el subcampeón (otro equipo) NO se tocó", T.DB.predictions.p1.special.subcampeon === "Francia");
check("p2 (ENVIADA): huella y pick renombrados también", T.DB.predictions.p2.r32_1._a === "Argentina" && T.DB.predictions.p2.r32_1.pick === "Argentina");
check("p3 (sin predicciones): quedó intacto", Object.keys(T.DB.predictions.p3).length === 0);
check("El motor de puntaje ya ve la llave de p1 como correcta (isLlaveCorrecta)", W.isLlaveCorrecta("Juan Pérez", 73) === true);

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — Un simple intercambio local/visitante de los MISMOS dos
   equipos NO es un renombre: nada debe cambiar en las predicciones.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Swap local/visitante: no es renombre ──");
let before = W.snapshotManualElimTeams();
T.S.elimTeams[73] = { h:"Senegal", a:"Argentina" };
let renames = W.elimRenamesFromTeamsDiff(before, W.snapshotManualElimTeams());
check("El diff no reporta renombres en un swap h/a", renames.length === 0);
T.S.elimTeams[73] = { h:"Argentina", a:"Senegal" }; // restaurar

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — REGISTRO CERRADO: después del cierre las predicciones
   quedan congeladas — un renombre ya NO las toca (pedido explícito).
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Registro cerrado: las predicciones quedan congeladas ──");
T.DB.configGlobal.fechaCierre = "2020-01-01"; // cierre en el pasado
check("isGloballyClosed() reporta el registro como cerrado", W.isGloballyClosed() === true);
before = W.snapshotManualElimTeams();
T.S.elimTeams[73] = { h:"España", a:"Senegal" };
let touched = W.propagateElimTeamRenames(W.elimRenamesFromTeamsDiff(before, W.snapshotManualElimTeams()));
check("propagateElimTeamRenames no toca ninguna quiniela tras el cierre", touched === 0);
check("p1 conserva 'Argentina' (congelado, aunque la llave real diga España)", T.DB.predictions.p1.r32_1._a === "Argentina");
T.S.elimTeams[73] = { h:"Argentina", a:"Senegal" }; // restaurar
T.DB.configGlobal.fechaCierre = "2099-12-31";       // reabrir

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — Torneo NORMAL (Grupos + Dieciseisavos activos): el bracket
   de cada participante se siembra de SUS resultados de grupo — esos
   nombres son SU predicción y un renombre real no debe tocarlos.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Torneo sembrado de grupos: nunca se propaga ──");
T.DB.configGlobal.fasesActivas = {}; // todas las fases activas
before = W.snapshotManualElimTeams();
T.S.elimTeams[73] = { h:"México", a:"Senegal" };
touched = W.propagateElimTeamRenames(W.elimRenamesFromTeamsDiff(before, W.snapshotManualElimTeams()));
check("Con Grupos+Dieciseisavos activos no se propaga nada", touched === 0);
check("p1 conserva su predicción intacta", T.DB.predictions.p1.r32_1._a === "Argentina");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
