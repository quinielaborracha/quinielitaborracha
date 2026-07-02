// Test funcional de los 4 ajustes pedidos para v1.6:
//  1) Racha de Desaciertos (scoring.js) — espejo de la racha de aciertos,
//     hitos propios e independientes, activo:false por defecto.
//  2) Botón "✕ Salir" arriba a la derecha del wizard de registro.
//  3) Saludo + cuenta regresiva en vivo arriba a la izquierda del wizard,
//     solo mientras el registro sigue abierto y editable.
//  4) El cierre automático (fechaCierre/horaCierre) bloquea a CUALQUIERA
//     que ya haya empezado su registro, sin importar cuándo empezó —
//     esto ya existía (isLocked/isGloballyClosed + regla de Firestore),
//     este test solo lo confirma explícitamente para v1.6.
//
// Carga los 22 archivos de producción en el mismo orden que index.html,
// con el mismo patrón de bridge-dentro-del-IIFE que ya usan
// test_registro_creacion_confirmada.js / test_evolucion_v1_5.js.
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
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
window.isAdmin = () => true; // para poder pintar el panel de Reglas (renderTorneoConfig)
window.setInterval = () => 0; // evita que los ticks reales de 1s/30s corran durante el test
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
  get DRAFT_PREDS(){ return DRAFT_PREDS; }, set DRAFT_PREDS(v){ DRAFT_PREDS = v; },
  get WIZ_STEP(){ return WIZ_STEP; }, set WIZ_STEP(v){ WIZ_STEP = v; },
  get WIZ_DIRTY(){ return WIZ_DIRTY; }, set WIZ_DIRTY(v){ WIZ_DIRTY = v; },
  get ADMIN_OVERRIDE(){ return ADMIN_OVERRIDE; }, set ADMIN_OVERRIDE(v){ ADMIN_OVERRIDE = v; },
  render, renderQuinielaForm, clearDraft, formatCountdown, getCierreTimestamp, isGloballyClosed, isLocked,
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

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — Racha de Desaciertos (motor de puntaje)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Racha de Desaciertos ──");

check("Config nueva: reglas.rachaDesaciertos existe y arranca desactivada",
  !!T.DB.configGlobal.reglas.rachaDesaciertos && T.DB.configGlobal.reglas.rachaDesaciertos.activo===false);
check("Hitos por defecto son independientes de los de aciertos (no son el mismo array)",
  T.DB.configGlobal.reglas.rachaDesaciertos.hitos !== T.DB.configGlobal.reglas.racha.hitos);

T.DB.participants = [{id:"p0", name:"Fede Falla", city:"C", country:"P"}];
T.DB.predictions = {p0:{}};
W.rebuildDynamicData();

// 8 partidos de grupos jugados en orden cronológico: p0 falla los
// primeros 8 seguidos (streak de desaciertos llega a 3,5,8), luego
// acierta uno (corta la racha), luego falla 3 más (vuelve a llegar a 3).
const baseTs = Date.parse("2026-06-11T12:00:00Z");
for(let mid=1; mid<=8; mid++){
  T.S.matchTimes[mid] = baseTs + mid*60000;
  T.S.scores[mid] = {h:2, a:1}; // real: gana H
  T.DB.predictions.p0[mid] = {h:0, a:0}; // predicción: empate -> SIEMPRE falla
}
// partido 9: acierta (corta la racha de fallos)
T.S.matchTimes[9] = baseTs + 9*60000;
T.S.scores[9] = {h:2, a:1};
T.DB.predictions.p0[9] = {h:2, a:1};
// partidos 10-12: vuelve a fallar 3 seguidos
for(let mid=10; mid<=12; mid++){
  T.S.matchTimes[mid] = baseTs + mid*60000;
  T.S.scores[mid] = {h:2, a:1};
  T.DB.predictions.p0[mid] = {h:0, a:0};
}
W.rebuildDynamicData();

// Con la regla DESACTIVADA (default), no debe sumar nada.
check("calcRachaDesaciertosBonos() da 0 si la regla está desactivada",
  W.calcRachaDesaciertosBonos("Fede Falla") === 0);

// Activamos con los hitos por defecto: {n:3,pts:1},{n:5,pts:2},{n:8,pts:4}
T.DB.configGlobal.reglas.rachaDesaciertos.activo = true;
const bonoEsperado = 1 + 2 + 4 /* racha de 8 fallos seguidos */ + 1 /* segunda racha de 3 */;
check(`calcRachaDesaciertosBonos() suma ${bonoEsperado}pts con una racha de 8 fallos + otra de 3 (hitos default)`,
  W.calcRachaDesaciertosBonos("Fede Falla") === bonoEsperado);

check("La racha de ACIERTOS (calcRachaBonos) da 0 para este mismo participante (un solo acierto suelto no llega a ningún hito)",
  W.calcRachaBonos("Fede Falla") === 0);

check("calcBonos() total incluye el bono de la racha de desaciertos",
  W.calcBonos("Fede Falla") === bonoEsperado);

// Hitos propios y configurables: cambiamos SOLO los de desaciertos y
// confirmamos que los de aciertos (mismo torneo) no se movieron.
T.DB.configGlobal.reglas.rachaDesaciertos.hitos = [{n:8, pts:99}];
check("Hitos de desaciertos son editables independientemente (solo n=8 ahora: la racha de 8 paga 99, la segunda racha de 3 ya no llega a n=8 y no paga nada)",
  W.calcRachaDesaciertosBonos("Fede Falla") === 99);

console.log("\n── Panel de Reglas (Admin) — nueva tarjeta ──");
T.DB.configGlobal.reglas.rachaDesaciertos.hitos = [{n:3,pts:1},{n:5,pts:2},{n:8,pts:4}];
T.DB.configGlobal.reglas.rachaDesaciertos.activo = false;
let torneoHtml = W.buildReglasHtml(T.DB.configGlobal.reglas);
check("El panel de Reglas incluye la tarjeta 'Racha de desaciertos'", torneoHtml.includes("Racha de desaciertos"));
check("Con la regla apagada, NO se muestran los inputs de hitos de desaciertos", !torneoHtml.includes('data-reglas-path="rachaDesaciertos.hitos.0.n"'));
T.DB.configGlobal.reglas.rachaDesaciertos.activo = true;
torneoHtml = W.buildReglasHtml(T.DB.configGlobal.reglas);
check("Con la regla prendida, sí aparecen los inputs editables de sus hitos", torneoHtml.includes('data-reglas-path="rachaDesaciertos.hitos.0.n"') && torneoHtml.includes('data-reglas-path="rachaDesaciertos.hitos.0.pts"'));
T.DB.configGlobal.reglas.racha.activo = true;
torneoHtml = W.buildReglasHtml(T.DB.configGlobal.reglas);
check("La tarjeta de racha de ACIERTOS sigue intacta y por separado", torneoHtml.includes("Racha de aciertos") && torneoHtml.includes('data-reglas-path="racha.hitos.0.n"'));
T.DB.configGlobal.reglas.racha.activo = false;
T.DB.configGlobal.reglas.rachaDesaciertos.activo = false;

/* ════════════════════════════════════════════════════════════════
   PARTE 2 y 3 — Botón Salir + Saludo/Cuenta regresiva en el wizard
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Botón Salir + saludo/cuenta regresiva ──");

check("formatCountdown() formatea correctamente (1d 1h 1min 1s)",
  T.formatCountdown(((1*86400)+(1*3600)+(1*60)+1)*1000) === "1d 1h 1min 1s");
check("formatCountdown() omite unidades vacías de más alto orden (solo 5min 3s)",
  T.formatCountdown((5*60+3)*1000) === "5min 3s");
check("formatCountdown() nunca queda negativo (0s si ya pasó)",
  T.formatCountdown(-5000) === "0s");

const p = {id:"p1", codigo:"QLB-2026-0001", name:"Sofía Martínez", city:"Panamá", country:"Panamá",
  email:"sofia@example.com", clave:"111111", ownerUid:"anon-sofia",
  estadoQuiniela:"borrador", fechaCreacion:Date.now(), fechaActualizacion:Date.now(), lastStep:1};
T.DB.participants = [p];
T.DB.predictions = {p1:{}};
T.DB.configGlobal.registroAbierto = true;
W.rebuildDynamicData();

// Escenario A: cierre configurado en el FUTURO -> debe verse el saludo +
// contador, y el botón Salir siempre debe estar.
T.DB.configGlobal.fechaCierre = "2099-01-01";
T.DB.configGlobal.horaCierre = "23:59";
T.DRAFT_PID = "p1";
T.DRAFT_PREDS = {};
T.WIZ_STEP = 1; // 'groups' — un paso normal, no readOnly, no 'review'
T.WIZ_DIRTY = false;
let renderExA = null;
try{ T.render(); }catch(e){ renderExA = e; }
check("El wizard renderiza sin excepción con cierre futuro configurado", !renderExA);
let contentHtml = W.document.getElementById("rg-content").innerHTML;
check("El botón '✕ Salir' está presente arriba del wizard", contentHtml.includes('id="wiz_exit_btn"') && contentHtml.includes("Salir"));
check("El saludo incluye el nombre de pila del participante ('Sofía')", contentHtml.includes(">Sofía<") || /Sof.{1,3}a/.test(contentHtml));
check("Aparece el contador regresivo en vivo (id=wiz_countdown_text)", contentHtml.includes('id="wiz_countdown_text"'));

// Escenario B: SIN fecha de cierre configurada -> no tiene sentido ningún
// countdown (nunca se cierra), pero el botón Salir debe seguir ahí.
T.DB.configGlobal.fechaCierre = "";
let renderExB = null;
try{ T.render(); }catch(e){ renderExB = e; }
check("El wizard renderiza sin excepción sin fecha de cierre configurada", !renderExB);
contentHtml = W.document.getElementById("rg-content").innerHTML;
check("Sin fecha de cierre configurada, NO se muestra contador (no aplica)", !contentHtml.includes('id="wiz_countdown_text"'));
check("El botón Salir sigue presente aunque no haya countdown", contentHtml.includes('id="wiz_exit_btn"'));

// Escenario C: quiniela YA ENVIADA (bloqueada por estado, no por fecha)
// -- este SÍ es un caso real donde renderQuinielaForm() se pinta en
// modo solo-lectura con su banner (a diferencia del cierre por fecha,
// que directamente saca al participante al Dashboard -- ver Parte 4).
// El countdown no debe aparecer (ya no hace falta, la banner ya avisa),
// y el botón Salir debe seguir disponible para volver atrás.
T.DB.configGlobal.fechaCierre = "2099-01-01"; // plazo global todavía NO pasado
p.estadoQuiniela = "enviada";
p.fechaEnvio = Date.now();
T.DRAFT_PID = "p1";
T.WIZ_STEP = 1;
// v1.6 — Nota: renderInicioInner() manda directo al Dashboard de
// solo-lectura cuando isLocked(p)&&!ADMIN_OVERRIDE (comportamiento de
// siempre, correcto). Para probar puntualmente la rama readOnly DENTRO
// del wizard (renderQuinielaForm) -- que es donde vive el banner y el
// botón Salir nuevo -- se la llama directo, saltando ese router (el
// router en sí ya está cubierto por la Parte 4 de este test).
let renderExC = null;
try{ T.renderQuinielaForm("p1", "inicio"); }catch(e){ renderExC = e; }
check("El wizard (en modo solo-lectura por 'enviada') renderiza sin excepción", !renderExC);
contentHtml = W.document.getElementById("rg-content").innerHTML;
check("Con la quiniela ya enviada, aparece el banner de solo-lectura", contentHtml.includes("solo lectura"));
check("Con la quiniela ya enviada, ya NO se muestra el contador (no aplica, no hay riesgo de perder el plazo)", !contentHtml.includes('id="wiz_countdown_text"'));
check("El botón Salir sigue presente para poder volver atrás", contentHtml.includes('id="wiz_exit_btn"'));
p.estadoQuiniela = "borrador"; // restaurar para lo que sigue
p.fechaEnvio = undefined;

// Click en "Salir" sin cambios sin guardar -> debe limpiar el draft y
// volver a la pantalla de inicio (mismo patrón que dash_logout_btn).
T.DB.configGlobal.fechaCierre = "2099-01-01";
T.WIZ_DIRTY = false;
T.render();
W.document.getElementById("wiz_exit_btn").dispatchEvent(new W.Event("click", {bubbles:true}));
check("Click en 'Salir' (sin cambios pendientes) limpia DRAFT_PID y vuelve al inicio", T.DRAFT_PID === null);

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — Confirmación: el cierre automático bloquea a TODOS
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Cierre automático aplica a quien ya empezó su registro ──");

const p2 = {id:"p2", codigo:"QLB-2026-0002", name:"Luis Andrade", city:"C", country:"P",
  email:"luis@example.com", clave:"222222", ownerUid:"anon-luis",
  estadoQuiniela:"borrador", fechaCreacion:Date.now()-9999999, fechaActualizacion:Date.now()-9999999, lastStep:3};
T.DB.participants.push(p2);
T.DB.predictions.p2 = {1:{h:1,a:1}}; // ya había empezado a llenar su quiniela

T.DB.configGlobal.fechaCierre = "";
check("ANTES de configurar cierre: alguien que ya empezó su registro NO está bloqueado", !T.isLocked(p2));

T.DB.configGlobal.fechaCierre = "2020-01-01"; // fecha ya pasada
T.DB.configGlobal.horaCierre = "23:59";
check("DESPUÉS de que el cierre automático se cumple: SÍ queda bloqueado, aunque ya había empezado antes", T.isLocked(p2));

T.DRAFT_PID = "p2";
T.WIZ_STEP = 1;
T.ADMIN_OVERRIDE = false;
T.render();
check("Al entrar como ese participante tras el cierre, cae en el Dashboard de solo-lectura (no en el wizard editable)",
  !W.document.getElementById("rg-content").innerHTML.includes('id="wiz_exit_btn"'));

console.log(`\n=== RESULTADO: ${ok ? "TODO OK ✅" : "HAY ERRORES ❌"} ===`);
process.exit(ok?0:1);
