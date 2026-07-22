// Test funcional de v2.8.2: cuando el torneo arranca directo en una fase
// de eliminatoria con equipos REALES (Fase de grupos desactivada —
// Constructor de Torneos, ver bracket.realSeedKey en registro.js), el
// admin puede cargar el cruce de un slot ANTES de que se sepa con
// certeza el rival (ej. "Por confirmar" en un lado) para que la gente ya
// pueda ir cargando el marcador que predice, y completar/corregir ese
// equipo más tarde según vaya conociéndose el resultado real. Antes de
// este fix, el marcador ya cargado por el participante DESAPARECÍA de la
// casilla (aunque seguía guardado en Firestore, invisible/inservible)
// apenas ese nombre de equipo cambiaba — porque renderKoRow()/koWinner()
// exigían una "huella" (_a/_b) idéntica al nombre EXACTO de equipo que
// tenía el slot en el momento de escribir el marcador. Ahora, para el
// cruce que usa equipos reales (bracket.realSeedKey===key), el marcador
// se conserva por el slot en sí (mismo partido real, mismo pid) sin
// importar que el nombre del equipo se actualice mientras tanto.
//
// Carga los 24 archivos de producción reales en el mismo orden que
// index.html + el bridge-dentro-de-la-IIFE de registro.js, mismo patrón
// que test_v1_6_ajustes.js — ejercita el wizard REAL (inputs reales,
// mismo evento 'input' que en el navegador).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","torneo-mundial2026.js", "partidos-grupos.js","utils.js", "paises.js","app-static-data.js","app-state.js","scoring.js","totp.js",
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
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
window.isAdmin = () => true;
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
window.__test = {
  DB, S, get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  get DRAFT_PREDS(){ return DRAFT_PREDS; }, set DRAFT_PREDS(v){ DRAFT_PREDS = v; },
  get WIZ_STEP(){ return WIZ_STEP; }, set WIZ_STEP(v){ WIZ_STEP = v; },
  get WIZ_DIRTY(){ return WIZ_DIRTY; }, set WIZ_DIRTY(v){ WIZ_DIRTY = v; },
  render, renderQuinielaForm, computeBracket, WIZARD_STEPS,
};
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

const T = window.__test;
const W = window;

/* ════════════════════════════════════════════════════════════════
   SETUP — Fase de grupos desactivada: el torneo arranca directo en
   Dieciseisavos ('r16' en BONUS_PHASES/scoring.js = 'r32' en
   KO_PHASES/registro.js) con equipos REALES cargados por el admin
   (S.elimTeams), como en un torneo que ya está en curso.
   ════════════════════════════════════════════════════════════════ */
T.DB.configGlobal.fasesActivas = { grupos:false };
const p = {id:"p1", codigo:"QLB-2026-0001", name:"Juan Pérez", city:"C", country:"P",
  email:"juan@example.com", clave:"111111", ownerUid:"anon-juan",
  estadoQuiniela:"borrador", fechaCreacion:Date.now(), fechaActualizacion:Date.now(), lastStep:2};
T.DB.participants = [p];
T.DB.predictions = {p1:{}};
T.DB.configGlobal.registroAbierto = true;
// pid 73 == slot 'r32_1' (SLOT_TO_PID, app-core-data.js: KO_SLOT_IDS_V62[0] -> 73)
T.S.elimTeams[73] = { h:"Por confirmar", a:"Cabo Verde" };
W.rebuildDynamicData();

T.DRAFT_PID = "p1";
T.DRAFT_PREDS = {};
const r32Idx = T.WIZARD_STEPS.findIndex(s=>s.key==='r32');
check("WIZARD_STEPS tiene el paso 'r32' (Dieciseisavos)", r32Idx !== -1);
T.WIZ_STEP = r32Idx;
T.WIZ_DIRTY = false;

let bracket = T.computeBracket(T.DRAFT_PREDS);
check("El bracket usa equipos reales para 'r32' (grupos desactivada)", bracket.realSeedKey === 'r32');
check("El slot r32_1 muestra 'Por confirmar' vs 'Cabo Verde'",
  bracket.r32[0].a === "Por confirmar" && bracket.r32[0].b === "Cabo Verde");

let renderEx = null;
try{ T.renderQuinielaForm("p1", "inicio"); }catch(e){ renderEx = e; }
check("El wizard renderiza el paso 'r32' sin excepción", !renderEx);

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — El participante carga su marcador ANTES de que se sepa
   el rival con certeza ("Por confirmar")
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Cargar el marcador antes de conocer el rival con certeza ──");
let inpH = W.document.querySelector('.score-input[data-slot="r32_1"][data-side="h"]');
let inpA = W.document.querySelector('.score-input[data-slot="r32_1"][data-side="a"]');
check("Existen las 2 casillas de marcador para r32_1", !!inpH && !!inpA);
inpH.value = "3"; inpH.dispatchEvent(new W.Event("input", { bubbles:true }));
inpA.value = "0"; inpA.dispatchEvent(new W.Event("input", { bubbles:true }));
check("DRAFT_PREDS guardó 3:0 para r32_1", T.DRAFT_PREDS.r32_1.h===3 && T.DRAFT_PREDS.r32_1.a===0);

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — El admin confirma el rival real (el nombre del equipo
   cambia de 'Por confirmar' a 'Argentina'). Antes de v2.8.2 esto
   invalidaba la "huella" y borraba el marcador de la casilla.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── El admin confirma el equipo real: el marcador debe seguir ahí ──");
T.S.elimTeams[73] = { h:"Argentina", a:"Cabo Verde" };
bracket = T.computeBracket(T.DRAFT_PREDS);
check("El slot r32_1 ahora muestra 'Argentina' (ya no 'Por confirmar')",
  bracket.r32[0].a === "Argentina" && bracket.r32[0].b === "Cabo Verde");

renderEx = null;
try{ T.renderQuinielaForm("p1", "inicio"); }catch(e){ renderEx = e; }
check("El wizard vuelve a renderizar sin excepción tras confirmarse el equipo", !renderEx);

inpH = W.document.querySelector('.score-input[data-slot="r32_1"][data-side="h"]');
inpA = W.document.querySelector('.score-input[data-slot="r32_1"][data-side="a"]');
check("La casilla de 'Argentina' (antes) sigue mostrando 3 (NO se borró)", inpH.value === "3");
check("La casilla de 'Cabo Verde' sigue mostrando 0 (NO se borró)", inpA.value === "0");
check("DRAFT_PREDS conserva el marcador 3:0 (no se perdió nada al fondo)",
  T.DRAFT_PREDS.r32_1.h===3 && T.DRAFT_PREDS.r32_1.a===0);

// La ronda siguiente (r16 en KO_PHASES, encadenada del ganador de r32)
// debe poder progresar con este resultado ya confirmado: Argentina 3-0
// Cabo Verde => Argentina avanza al slot r16_1.
bracket = T.computeBracket(T.DRAFT_PREDS);
check("El bracket calcula a 'Argentina' como ganador del cruce (avanza a la próxima ronda)",
  bracket.r32[0].winner === "Argentina");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
