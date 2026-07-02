// Test funcional de la Fase 1 del roadmap de Batallas: autopostulación
// ("Quiero pelear 🥊" en Mi Quiniela) + panel de Postulados (admin).
//
// El riesgo más grande de esta feature es de PRIVACIDAD, no de UI: el
// brief pide que quierePelear sea "visible solo para el admin", y el
// documento público (registro_participants) es de lectura pública sin
// sesión (firestore.rules: allow read: if true). Este test verifica
// primero, explícitamente, que el campo NUNCA viaja a ese documento --
// solo al privado (registro_privado, lectura restringida a dueño+admin).
//
// Carga los 22 archivos de producción en el mismo orden que index.html,
// mismo patrón de bridge que ya usan los demás tests (test_v1_6_ajustes.js).
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
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
  <span id="hstat"></span><span id="hdr-master-badge"></span><span id="hdr-today"></span>
  <table><tbody id="rb"></tbody></table>
  <div id="rbasic"></div><div id="radv"></div><div id="relim"></div><div id="rlast"></div>
  <div id="t-battles" style="display:block">
    <select id="battle-slot1-p1"></select><select id="battle-slot1-p2"></select>
    <select id="battle-slot2-p1"></select><select id="battle-slot2-p2"></select>
    <div id="battles-postulados"></div><div id="battles-body"></div>
  </div>
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
  try{ window.document.body.appendChild(script); }
  catch(e){ console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`); ok = false; }
}

let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = {
  DB, S, get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  render, renderParticipantDashboard, notifyParticipantesChange,
  _rgPublicFieldsOf, _rgPrivadoFieldsOf, _rgMergeKnownPrivadoFields,
  _rgLatestPrivadoByOwner: null, // se completa a mano abajo (variable interna de participantes.js)
};
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

if (!window.__test){ console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;
const W = window;

// isAdmin() es una function-declaration real de app-admin-auth.js (lee
// _isAdmin, false por defecto) -- asignarle window.isAdmin ANTES de cargar
// los archivos no sirve de nada, porque esa declaración la pisa apenas se
// evalúa el <script> de app-admin-auth.js. Recién ACÁ, con todo ya cargado
// y sin más <script> de producción por venir, este override sí pega.
W.isAdmin = () => true;

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — Privacidad: quierePelear NUNCA viaja al documento público
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Privacidad: público vs privado ──");

const pFake = {id:"p0", name:"Postulado Test", city:"C", country:"P", clave:"123456", email:"x@x.com", quierePelear:true};
const pub = T._rgPublicFieldsOf(pFake);
const priv = T._rgPrivadoFieldsOf(pFake);

check("_rgPublicFieldsOf() NO incluye quierePelear (registro_participants es de lectura pública)",
  !Object.prototype.hasOwnProperty.call(pub, "quierePelear"));
check("_rgPublicFieldsOf() tampoco incluye clave/email (ya lo garantizaba v6.9)",
  !("clave" in pub) && !("email" in pub));
check("_rgPrivadoFieldsOf() SÍ incluye quierePelear:true",
  priv.quierePelear === true);
check("_rgPrivadoFieldsOf() con quierePelear ausente/undefined da false (nunca undefined)",
  T._rgPrivadoFieldsOf({id:"p1"}).quierePelear === false);

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — El merge desde Firestore trae quierePelear de vuelta a
   DB.participants (mismo camino que ya usan clave/email).
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Merge del privado hacia DB.participants ──");

T.DB.participants = [
  {id:"pA", name:"Ana", city:"C", country:"P"},
  {id:"pB", name:"Beto", city:"C", country:"P"},
];
T.DB.predictions = {pA:{}, pB:{}};
W.rebuildDynamicData();

// Simula lo que rgWirePrivadoSyncIfAdmin() dejaría en _rgLatestPrivadoByOwner
// tras un onSnapshot real -- no reimplementamos Firestore, solo el punto de
// entrada que _rgMergeKnownPrivadoFields() ya lee.
window.eval(`_rgLatestPrivadoByOwner = { pA: {ownerUid:"uidA", clave:"1", email:"a@a.com", quierePelear:true}, pB: {ownerUid:"uidB", clave:"2", email:"b@b.com", quierePelear:false} };`);
T._rgMergeKnownPrivadoFields();

check("Tras el merge, Ana (postulada) tiene quierePelear:true en DB.participants",
  T.DB.participants.find(p=>p.name==="Ana").quierePelear === true);
check("Tras el merge, Beto (no postulado) tiene quierePelear:false",
  T.DB.participants.find(p=>p.name==="Beto").quierePelear === false);

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — Panel de Postulados (admin): filtra correctamente
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Panel de Postulados ──");

T.DB.participants.push({id:"pC", name:"Carla", city:"C", country:"P", quierePelear:true});
W.rebuildDynamicData();
W.renderBattlesPanel();

let postuladosWrap = W.document.getElementById("battles-postulados").innerHTML;
check("Ana aparece en Postulados (quierePelear:true, no está en ninguna batalla)",
  postuladosWrap.includes("Ana"));
check("Carla aparece en Postulados",
  postuladosWrap.includes("Carla"));
check("Beto NO aparece en Postulados (no se postuló)",
  !postuladosWrap.includes("Beto"));

// Click en el chip de Ana: debe cargarla en la primera ranura libre
// (ranura1-p1) y desaparecer de la lista de inmediato.
const chipAna = W.document.querySelector('.js-postulado-chip[data-pname="Ana"]');
check("El chip de Ana existe con el data-pname correcto (round-trip íntegro, mismo patrón que data-pname del Ranking)",
  !!chipAna);
W.asignarPostulado("Ana");
check("Tras asignar a Ana, la ranura1-p1 quedó con su nombre",
  W.document.getElementById("battle-slot1-p1").value === "Ana");
postuladosWrap = W.document.getElementById("battles-postulados").innerHTML;
check("Ana ya NO aparece en Postulados (quedó cargada en una ranura, aunque el duelo todavía no se inició)",
  !postuladosWrap.includes(">🥊 Ana<"));
check("Carla sigue apareciendo (no se tocó su ranura)",
  postuladosWrap.includes("Carla"));

// Asignar a Carla: debe ir a la próxima ranura libre (ranura1-p2, ya que
// ranura1-p1 está ocupada por Ana), no pisar nada.
W.asignarPostulado("Carla");
check("Carla quedó en ranura1-p2 (ranura1-p1 ya estaba ocupada por Ana)",
  W.document.getElementById("battle-slot1-p2").value === "Carla");

// Iniciar el duelo 1 de verdad: Ana vs Carla ya deben quedar excluidas de
// Postulados por estar en una batalla ACTIVA (S.battles), no solo por
// tener la ranura cargada.
T.S.matchTimes[1] = Date.now(); T.S.scores[1] = {h:1,a:0};
W.startBattle(1);
check("startBattle(1) efectivamente armó S.battles[1] con Ana/Carla",
  T.S.battles[1] && T.S.battles[1].p1==="Ana" && T.S.battles[1].p2==="Carla");
postuladosWrap = W.document.getElementById("battles-postulados").innerHTML;
check("Con la batalla 1 ya activa (Ana vs Carla), ninguna de las 2 aparece en Postulados",
  !postuladosWrap.includes("Ana") && !postuladosWrap.includes("Carla"));

// Tercer postulado, para probar el mensaje de "las 2 ranuras están llenas"
// (ranura1 llena por la batalla activa; ranura2 sigue libre).
T.DB.participants.push({id:"pD", name:"Diego", city:"C", country:"P", quierePelear:true});
W.rebuildDynamicData();
W.renderBattlesPanel();
W.asignarPostulado("Diego"); // debería ir a ranura2-p1 (única libre)
check("Diego se cargó en ranura2-p1 (ranura1 está ocupada por la batalla activa)",
  W.document.getElementById("battle-slot2-p1").value === "Diego");

let avisoLlenoMostrado = false;
W.toast = (m, isErr)=>{ if(isErr) avisoLlenoMostrado = true; };
// "Beto" ya existe en DB.participants (no postulado, pero eso no importa
// para el <select>: lista a TODOS los participantes) -- un nombre inventado
// como "Elena" no tendría <option> y el navegador ignora el .value en
// silencio, dejando la ranura vacía sin que esto se entere.
W.document.getElementById("battle-slot2-p2").value = "Beto"; // simula la última ranura ocupada a mano
W.asignarPostulado("Fede");
check("Con las 4 ranuras ocupadas, asignarPostulado() avisa en vez de pisar algo",
  avisoLlenoMostrado === true);

/* ════════════════════════════════════════════════════════════════
   PARTE 3b — BUG REPORTADO EN PRODUCCIÓN: alguien se postuló y nunca
   apareció en el panel del admin. Causa: el panel de Batallas solo se
   repintaba al CAMBIAR a esa pestaña, o al llegar un cambio de
   quiniela/estado con la pestaña ya abierta -- pero quierePelear vive en
   registro_privado, un documento DISTINTO, así que si el admin ya tenía
   la pestaña abierta, la postulación de otro participante nunca se veía
   sin salir y volver a entrar a Batallas. Fix: app-bootstrap.js ahora
   repinta el panel de Batallas dentro de onParticipantesChange() (mismo
   patrón que ya usa para #t-pred), si esa pestaña ya está abierta.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Repintado en vivo con la pestaña Batallas ya abierta (fix del bug reportado) ──");

T.DB.participants.push({id:"pG", name:"Gonzalo", city:"C", country:"P", quierePelear:false});
W.rebuildDynamicData();
W.renderBattlesPanel(); // deja el panel pintado SIN Gonzalo (todavía no se postuló)
check("Antes de postularse, Gonzalo NO aparece en Postulados",
  !W.document.getElementById("battles-postulados").innerHTML.includes("Gonzalo"));

// Simula exactamente lo que pasa en producción: Gonzalo se postula desde
// SU sesión, eso llega por Firestore a la sesión del admin, se mezcla en
// DB.participants (_rgMergeKnownPrivadoFields, ya probado en la Parte 2) y
// dispara notifyParticipantesChange() -- CON la pestaña Batallas ya
// abierta (id="t-battles" en display:block en el fixture de este test) Y
// SIN que nada llame a renderBattlesPanel()/renderPostuladosPanel() a mano.
T.DB.participants.find(p=>p.name==="Gonzalo").quierePelear = true;
T.notifyParticipantesChange();

check("Tras postularse (notifyParticipantesChange, sin re-render manual), Gonzalo YA aparece en Postulados",
  W.document.getElementById("battles-postulados").innerHTML.includes("Gonzalo"));

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — Botón "Quiero pelear 🥊" en el Dashboard del participante
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Botón en el Dashboard del participante ──");
window.isAdmin = () => false; // sesión real de participante, no admin

T.DB.participants = [{id:"pE", name:"Elena Wizard", city:"C", country:"P", quierePelear:false, estadoQuiniela:"enviada"}];
T.DB.predictions = {pE:{}};
W.rebuildDynamicData();
T.DRAFT_PID = "pE";

let renderEx=null;
try{ T.renderParticipantDashboard("pE"); }catch(e){ renderEx=e; }
check("El Dashboard renderiza sin excepción con quierePelear:false", !renderEx);
check("El botón aparece con el texto 'Quiero pelear' cuando todavía no se postuló",
  W.document.getElementById("dash_postular_btn")?.textContent.includes("Quiero pelear"));

W.document.getElementById("dash_postular_btn").click();
const elena = T.DB.participants.find(p=>p.name==="Elena Wizard");
check("Un click marca quierePelear:true", elena.quierePelear === true);
check("Tras el click, el botón cambia a 'Postulado · Bajarme' (re-render inmediato)",
  W.document.getElementById("dash_postular_btn")?.textContent.includes("Postulado"));

W.document.getElementById("dash_postular_btn").click();
check("Un segundo click despostula (quierePelear vuelve a false)",
  T.DB.participants.find(p=>p.name==="Elena Wizard").quierePelear === false);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
