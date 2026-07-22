// Test funcional de v2.7.2: botón "Unirte al grupo de WhatsApp"
// (Configuración del torneo → enlace editable, Mi Quiniela + último paso
// del registro) + recordatorio (snack) al llegar al último paso.
//
// Carga los 24 archivos de producción reales en el mismo orden que
// index.html, mismo patrón de bridge-dentro-de-la-IIFE que ya usan
// test_postulacion_batallas.js / test_v1_6_ajustes.js -- ejercita el
// panel de Admin y el wizard REALES (clicks/eventos reales sobre el
// DOM), no llamadas directas a funciones internas.
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
  <div id="root"></div><div id="toast"></div><div id="integ-banner"></div>
  <img id="logo-img"><span id="admin-indicator"></span>
  <span id="hstat"></span><span id="hdr-master-badge"></span><span id="hdr-today"></span>
  <table><tbody id="rb"></tbody></table>
  <div id="rbasic"></div><div id="radv"></div><div id="relim"></div><div id="rlast"></div>
  <div id="rg-tabs"></div><div id="rg-content"></div><div id="admin-content"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
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
window.__test = {
  DB, S, get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  get WIZ_STEP(){ return WIZ_STEP; }, set WIZ_STEP(v){ WIZ_STEP = v; },
  get ADMIN_OVERRIDE(){ return ADMIN_OVERRIDE; }, set ADMIN_OVERRIDE(v){ ADMIN_OVERRIDE = v; },
  render, renderParticipantDashboard, renderAdminTab, WIZARD_STEPS,
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
W.isAdmin = () => true;

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — Default vacío: el botón no aparece en ningún lado
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Sin enlace configurado (default) ──");

check("DB.configGlobal.whatsappGroupLink arranca vacío", T.DB.configGlobal.whatsappGroupLink === "");

// "Quiero pelear"/el botón de WhatsApp viven en renderParticipantDashboard()
// ("Mi Perfil"), que solo se pinta cuando la quiniela está LOCKED (enviada
// o cierre global) -- una quiniela en borrador muestra el wizard
// (renderQuinielaForm) en su lugar. Por eso este participante arranca
// "enviada" desde el principio.
T.DB.participants = [{id:"p1", name:"Juan Perez", city:"C", country:"P", estadoQuiniela:"enviada", fechaEnvio:Date.now()}];
T.DB.predictions = {p1:{}};
W.rebuildDynamicData();
T.DRAFT_PID = "p1";
T.render();

check("Sin enlace configurado, el botón de WhatsApp NO aparece en 'Mi Perfil' (Dashboard)",
  !W.document.getElementById("rg-content").innerHTML.includes("Unirte al grupo"));

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — Configurarlo desde el panel de Admin REAL (input + botón
   reales, mismo evento click que en el navegador)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Configurar el enlace desde el panel de Admin (UI real) ──");

T.renderAdminTab();
const adminContent = W.document.getElementById("admin-content");
check("El panel de Admin renderizó el campo del enlace de WhatsApp",
  adminContent.innerHTML.includes("Grupo de WhatsApp"));

const linkInput = W.document.getElementById("a_whatsapp_link");
check("El <input> del enlace existe en el DOM real", !!linkInput);
linkInput.value = "https://chat.whatsapp.com/ABCDEF123456";
const saveBtn = W.document.getElementById("a_guardar_whatsapp");
saveBtn.dispatchEvent(new W.Event("click", {bubbles:true}));
check("Un click real en 'Guardar enlace' actualizó DB.configGlobal.whatsappGroupLink",
  T.DB.configGlobal.whatsappGroupLink === "https://chat.whatsapp.com/ABCDEF123456");

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — Con el enlace configurado, el botón aparece en 'Mi Perfil'
   (Dashboard, quiniela ya enviada)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Con enlace configurado: aparece en 'Mi Perfil' ──");

T.render();
const dashHtml = W.document.getElementById("rg-content").innerHTML;
check("El botón de WhatsApp aparece en 'Mi Perfil', junto al de 'Quiero pelear'",
  dashHtml.includes("Unirte al grupo") && dashHtml.includes("Quiero pelear"));
check("El href del botón apunta exactamente al enlace configurado",
  dashHtml.includes('href="https://chat.whatsapp.com/ABCDEF123456"'));
check("El botón abre en una pestaña nueva (target=_blank) y sin dejar referrer/opener",
  /target="_blank"/.test(dashHtml) && /rel="noopener noreferrer"/.test(dashHtml));

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — Último paso del REGISTRO (wizard, quiniela todavía en
   borrador -- "Mi Perfil"/Dashboard es solo para una ya enviada): botón
   de WhatsApp + recordatorio (snack) al ENTRAR al paso de revisión
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Último paso del wizard: botón de WhatsApp + recordatorio ──");

T.DB.participants.push({id:"p2", name:"Pedro Gomez", city:"C", country:"P", estadoQuiniela:"borrador"});
T.DB.predictions.p2 = {};
W.rebuildDynamicData();
T.DRAFT_PID = "p2"; // quiniela en borrador -> render() muestra el WIZARD, no el Dashboard
T.WIZ_STEP = 0;
T.render();
check("Con una quiniela en borrador, render() muestra el wizard real (existe el botón 'Siguiente')",
  !!W.document.getElementById("wiz_next"));

let ultimoToast = null;
W.toast = (m)=>{ ultimoToast = m; };
const reviewIdx = T.WIZARD_STEPS.findIndex(s=>s.key==="review");
check("Existe el paso 'review' en WIZARD_STEPS", reviewIdx >= 0);
// Avanza paso a paso con el botón real "Siguiente" (mismo click que en
// producción, dispara goToStep() de verdad -- ahí vive el snack). Pedro
// no llenó ninguna predicción, así que sin ADMIN_OVERRIDE los blockers
// de completitud (getStepBlockers) legítimamente le impedirían avanzar
// -- se activa ADMIN_OVERRIDE=true (como si un admin estuviera
// completando la quiniela en su nombre) solo para poder llegar rápido
// al último paso sin rellenar los 72+ campos; el snack en sí no depende
// de ADMIN_OVERRIDE (ver goToStep(), registro.js).
T.ADMIN_OVERRIDE = true;
let intentos = 0;
while(T.WIZ_STEP !== reviewIdx && intentos < 20){
  W.document.getElementById("wiz_next")?.dispatchEvent(new W.Event("click", {bubbles:true}));
  intentos++;
}
check(`Se pudo llegar al paso 'review' avanzando con 'Siguiente' (${intentos} clicks)`, T.WIZ_STEP === reviewIdx);
check('Al ENTRAR al último paso, se disparó el recordatorio (snack) de confirmar y enviar',
  !!ultimoToast && /[Ee]nviar/.test(ultimoToast));

const reviewHtml = W.document.getElementById("rg-content").innerHTML;
check("El botón de WhatsApp también aparece en el último paso del registro",
  reviewHtml.includes("Unirte al grupo"));

// 🔍 Probe: un re-render del MISMO paso (ej. el eco de un autoguardado)
// no debe repetir el snack -- solo se dispara al ENTRAR, no en cada
// repintado del mismo paso.
ultimoToast = null;
T.render();
check("🔍 Re-renderizar el mismo paso (sin cambiar WIZ_STEP) NO repite el snack",
  ultimoToast === null);

/* ════════════════════════════════════════════════════════════════
   PARTE 5 — Con la quiniela ya enviada, el snack de "confirmar y
   enviar" ya no tiene sentido y no debe dispararse
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Quiniela ya enviada: no repite el recordatorio de enviar ──");
T.DB.participants.find(p=>p.id==="p2").estadoQuiniela = "enviada";
T.DB.participants.find(p=>p.id==="p2").fechaEnvio = Date.now();
T.ADMIN_OVERRIDE = false; // sesión real de participante, no admin editando -- si no se resetea, isLocked() no manda al Dashboard (ver renderInicioInner)
T.WIZ_STEP = reviewIdx>0?reviewIdx-1:0;
T.render();
ultimoToast = null;
// Ahora que está "enviada", render() muestra 'Mi Perfil' (Dashboard), no
// el wizard -- confirma que YA NO aparece 'wiz_next' (coherente con que
// el snack de "confirmar y enviar" tampoco tendría sentido acá).
check("Con la quiniela ya enviada, el wizard ya no está disponible (pasa a 'Mi Perfil')",
  !W.document.getElementById("wiz_next"));
check("Con la quiniela ya enviada, NO se disparó el recordatorio de 'confirmar y enviar'",
  ultimoToast === null || !/[Ee]nviar/.test(ultimoToast||""));

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
