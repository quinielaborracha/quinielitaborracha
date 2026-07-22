// Test funcional de v3.2.2 — BUG URGENTE REPORTADO: alguien llenando el
// formulario de "Crear nueva quiniela" (o el de "Ver mi quiniela")
// perdía lo que tecleaba apenas llegaba un cambio remoto de Firestore
// de CUALQUIER OTRO participante (otra persona registrándose,
// autoguardando su propia quiniela, etc.) -- sin relación alguna con lo
// que esta persona estaba escribiendo. Con el torneo en curso y mucha
// gente registrándose al mismo tiempo, estos cambios remotos llegan
// seguido, así que el formulario "se refrescaba solo" constantemente.
//
// CAUSA RAÍZ: onParticipantesChange() (registro.js) llama a render()
// sin ningún freno cuando DRAFT_PID es null -- que es EXACTAMENTE el
// caso de alguien en las pantallas de Crear/Login (todavía no es
// participante). El freno que ya existía (WIZ_DIRTY) solo aplica
// "si(DRAFT_PID)", así que nunca protegía a estas dos pantallas.
//
// FIX: INICIO_DIRTY, mismo patrón que WIZ_DIRTY -- se prende apenas se
// escribe algo en Crear/Login, y el listener de cambios remotos se
// salta el render() mientras esté prendido.
//
// Reproduce el flujo real: escribe en el campo (evento 'input' real,
// como en el navegador), dispara un cambio remoto simulado
// (notifyParticipantesChange(), lo mismo que un onSnapshot de
// Firestore por otro participante), y verifica que el valor tecleado
// SIGUE ahí.
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
  DB, set INICIO_VIEW(v){INICIO_VIEW=v;}, get INICIO_VIEW(){return INICIO_VIEW;},
  get INICIO_DIRTY(){return INICIO_DIRTY;},
  render,
};
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

const T = window.__test;
const W = window;

T.DB.configGlobal.registroAbierto = true;
T.DB.configGlobal.modoConsultaHabilitado = true;
T.DB.participants = [];
T.DB.predictions = {};

/* ════════════════════════════════════════════════════════════════
   CASO 1 — "Crear nueva quiniela": escribo el nombre, llega un cambio
   remoto de OTRO participante (notifyParticipantesChange, lo mismo que
   dispara un onSnapshot real) -- el valor NO debe borrarse.
   ════════════════════════════════════════════════════════════════ */
console.log("── Crear nueva quiniela ──");
T.INICIO_VIEW = 'crear';
T.render();
check("INICIO_DIRTY arranca en false (formulario recién construido)", T.INICIO_DIRTY === false);

let inpNombre = W.document.getElementById('r_nombre');
check("Existe el campo de nombre", !!inpNombre);
inpNombre.value = "Juan";
inpNombre.dispatchEvent(new W.Event("input", { bubbles:true }));
check("INICIO_DIRTY se prende al escribir", T.INICIO_DIRTY === true);

// Simula el cambio remoto: OTRA persona (no relacionada) se registra o
// autoguarda su quiniela -- esto es EXACTAMENTE lo que dispara un
// onSnapshot real de Firestore sobre registro_participants.
W.notifyParticipantesChange();

inpNombre = W.document.getElementById('r_nombre'); // re-obtener por si el DOM se reconstruyó
check("El nombre tecleado SIGUE ahí después del cambio remoto (antes del fix, se borraba)", inpNombre && inpNombre.value === "Juan");

/* ════════════════════════════════════════════════════════════════
   CASO 2 — "Ver mi quiniela" (login): mismo escenario con el campo de
   usuario/correo.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Ver mi quiniela (login) ──");
T.INICIO_VIEW = 'login';
T.render();
check("INICIO_DIRTY vuelve a false al entrar a Login", T.INICIO_DIRTY === false);

let inpUser = W.document.getElementById('e_user');
check("Existe el campo de usuario/correo", !!inpUser);
inpUser.value = "juan@correo.com";
inpUser.dispatchEvent(new W.Event("input", { bubbles:true }));
check("INICIO_DIRTY se prende al escribir en Login", T.INICIO_DIRTY === true);

W.notifyParticipantesChange();

inpUser = W.document.getElementById('e_user');
check("El correo tecleado SIGUE ahí después del cambio remoto (antes del fix, se borraba)", inpUser && inpUser.value === "juan@correo.com");

/* ════════════════════════════════════════════════════════════════
   CASO 3 — sin nada tecleado (INICIO_DIRTY sigue false), un cambio
   remoto SÍ debe seguir refrescando la pantalla con normalidad (no
   queremos que el fix bloquee actualizaciones legítimas para siempre).
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Sin tecleo pendiente, el refresco normal sigue funcionando ──");
T.INICIO_VIEW = 'crear';
T.render();
check("INICIO_DIRTY en false apenas se entra sin tocar nada", T.INICIO_DIRTY === false);
let renderEx = null;
try{ W.notifyParticipantesChange(); }catch(e){ renderEx = e; }
check("notifyParticipantesChange() no lanza excepción sin tecleo pendiente", !renderEx);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
