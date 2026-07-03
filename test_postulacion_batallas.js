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
    <div id="battle-builder-body"></div><div id="battles-body"></div>
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

// v2.7 — Puente aparte (nombre distinto de window.__test, que más abajo
// lo pisa por completo con el bridge de registro.js) para llegar a
// _battleBuilderPending (let de nivel superior en app-batallas.js, no
// wrapeado en IIFE -- mismo scope global compartido que ya documenta
// CLAUDE.md para todos los app-*.js entre sí).
const battlesBridge = window.document.createElement("script");
battlesBridge.textContent = `window.__testBattles = { _battleBuilderPending, ensureBattleBuilderState };`;
window.document.body.appendChild(battlesBridge);

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
const TB = window.__testBattles;
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
   PARTE 3 — Selector compartido de "Armar batalla" (v2.7 -- reemplazó
   al viejo panel de Postulados + 2 <select> por ranura por un único
   selector de click, con 4 duelos simultáneos en vez de 2)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Selector compartido de Armar batalla ──");

T.DB.participants.push({id:"pC", name:"Carla", city:"C", country:"P", quierePelear:true});
W.rebuildDynamicData();
W.renderBattlesPanel();

let builderWrap = W.document.getElementById("battle-builder-body").innerHTML;
check("Ana aparece en el selector (postulada, no está en ningún duelo)",
  !!W.document.querySelector('.js-battle-pick[data-pname="Ana"]'));
check("Carla aparece en el selector (postulada)",
  !!W.document.querySelector('.js-battle-pick[data-pname="Carla"]'));
check("Beto TAMBIÉN aparece (el selector nuevo muestra a TODOS, no solo a quien se postuló)",
  !!W.document.querySelector('.js-battle-pick[data-pname="Beto"]'));
check("Ana (postulada) se muestra con el emoji 🥊 en el texto del botón",
  W.document.querySelector('.js-battle-pick[data-pname="Ana"]').textContent.includes("🥊"));
check("Beto (no postulado) NO tiene el emoji 🥊 en su botón",
  !W.document.querySelector('.js-battle-pick[data-pname="Beto"]').textContent.includes("🥊"));

// Click en Ana: debe cargarla en el próximo hueco libre (duelo1.p1) y
// desaparecer del selector de inmediato.
const pickAna = W.document.querySelector('.js-battle-pick[data-pname="Ana"]');
check("El botón de Ana existe con el data-pname correcto (round-trip íntegro, mismo patrón que data-pname del Ranking)",
  !!pickAna);
W.asignarAlProximoHueco("Ana");
check("Tras asignar a Ana, duelo1.p1 quedó con su nombre",
  TB._battleBuilderPending[1].p1 === "Ana");
check("Ana ya NO aparece en el selector (quedó cargada en un duelo, aunque todavía no se inició)",
  !W.document.querySelector('.js-battle-pick[data-pname="Ana"]'));
check("Carla sigue apareciendo en el selector (no se tocó su hueco)",
  !!W.document.querySelector('.js-battle-pick[data-pname="Carla"]'));

// Asignar a Carla: debe ir al próximo hueco libre (duelo1.p2, ya que
// duelo1.p1 está ocupado por Ana), no pisar nada.
W.asignarAlProximoHueco("Carla");
check("Carla quedó en duelo1.p2 (duelo1.p1 ya estaba ocupado por Ana)",
  TB._battleBuilderPending[1].p2 === "Carla");

// Iniciar el duelo 1 de verdad: Ana y Carla ya deben quedar excluidas del
// selector por estar en una batalla ACTIVA (S.battles), no solo por tener
// el hueco cargado.
T.S.matchTimes[1] = Date.now(); T.S.scores[1] = {h:1,a:0};
W.startBattle(1);
check("startBattle(1) efectivamente armó S.battles[1] con Ana/Carla",
  T.S.battles[1] && T.S.battles[1].p1==="Ana" && T.S.battles[1].p2==="Carla");
check("startBattle() limpió el hueco de construcción del duelo 1 (queda libre para el próximo)",
  TB._battleBuilderPending[1].p1===null && TB._battleBuilderPending[1].p2===null);
check("Con la batalla 1 ya activa (Ana vs Carla), ninguna de las 2 aparece en el selector",
  !W.document.querySelector('.js-battle-pick[data-pname="Ana"]') && !W.document.querySelector('.js-battle-pick[data-pname="Carla"]'));

// Cuarto postulado, para probar el mensaje de "los 4 duelos están llenos".
T.DB.participants.push({id:"pD", name:"Diego", city:"C", country:"P", quierePelear:true});
W.rebuildDynamicData();
W.renderBattlesPanel();
W.asignarAlProximoHueco("Diego"); // duelo1 está ACTIVO (se saltea) -> debería ir a duelo2.p1
check("Diego se cargó en duelo2.p1 (duelo1 está ocupado por la batalla activa, se saltea)",
  TB._battleBuilderPending[2].p1 === "Diego");

// Se llenan a mano los huecos restantes (duelo2.p2, duelo3 y duelo4
// completos) -- no repite la mecánica de click ya probada arriba, solo
// necesita llegar al estado "sin ningún hueco libre" para probar el aviso.
// Nombres inventados a propósito (Wilson/Xiomara/Yolanda/Zacarías, no
// existen en DB.participants) -- solo hace falta llegar al estado "sin
// huecos libres" en _battleBuilderPending, no repetir la mecánica de
// click ya probada arriba. Evita a propósito reusar nombres que la
// Parte 3b usa más abajo (Gonzalo), para no dejar un hueco "ocupado" por
// un resto de este bloque que enmascare esa prueba.
TB._battleBuilderPending[2].p2 = "Beto";
TB._battleBuilderPending[3] = {p1:"Wilson",p2:"Xiomara",name:"",dias:1,partidos:""};
TB._battleBuilderPending[4] = {p1:"Yolanda",p2:"Zacarias",name:"",dias:1,partidos:""};

let avisoLlenoMostrado = false;
W.toast = (m, isErr)=>{ if(isErr) avisoLlenoMostrado = true; };
W.asignarAlProximoHueco("Irene");
check("Con los 4 duelos completos, asignarAlProximoHueco() avisa en vez de pisar algo",
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
W.renderBattlesPanel(); // deja el panel pintado; Gonzalo YA aparece en el selector (no postulado no lo excluye más), pero SIN el 🥊
check("Antes de postularse, Gonzalo aparece en el selector pero SIN el emoji 🥊",
  !!W.document.querySelector('.js-battle-pick[data-pname="Gonzalo"]') &&
  !W.document.querySelector('.js-battle-pick[data-pname="Gonzalo"]').textContent.includes("🥊"));

// Simula exactamente lo que pasa en producción: Gonzalo se postula desde
// SU sesión, eso llega por Firestore a la sesión del admin, se mezcla en
// DB.participants (_rgMergeKnownPrivadoFields, ya probado en la Parte 2) y
// dispara notifyParticipantesChange() -- CON la pestaña Batallas ya
// abierta (id="t-battles" en display:block en el fixture de este test) Y
// SIN que nada llame a renderBattlesPanel()/renderBattleBuilder() a mano.
T.DB.participants.find(p=>p.name==="Gonzalo").quierePelear = true;
T.notifyParticipantesChange();

check("Tras postularse (notifyParticipantesChange, sin re-render manual), Gonzalo YA se muestra con el 🥊",
  W.document.querySelector('.js-battle-pick[data-pname="Gonzalo"]')?.textContent.includes("🥊"));

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
