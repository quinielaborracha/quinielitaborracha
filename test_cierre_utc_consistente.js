// Test funcional de v3.2.1 — BUG URGENTE REPORTADO: varios participantes
// veían el formulario de Mi Quiniela completamente abierto/editable
// (sin ningún aviso de "cerrado"), pero cada autoguardado fallaba con
// "No se pudo guardar en el servidor (permiso denegado)".
//
// CAUSA RAÍZ: getCierreTimestamp() (registro.js) parseaba
// fechaCierre+horaCierre con `new Date(\`${fc}T${hc}\`)` -- SIN sufijo de
// zona horaria, lo que el motor de JS interpreta como hora LOCAL del
// navegador de quien mira la pantalla. firestore.rules
// (_isPastDeadlineInner(), la única prohibición real del servidor)
// SIEMPRE interpretó lo mismo como UTC (le agrega ":00Z" a propósito).
// Para cualquiera en una zona horaria detrás de UTC (todo
// Latinoamérica), el servidor cerraba HORAS antes de que el cliente
// mostrara el cierre -- el participante veía el formulario abierto,
// pero el servidor ya rechazaba el guardado.
//
// Este test reproduce la MISMA fórmula que firestore.rules usa
// (fc + "T" + hc + ":00Z", interpretado como UTC) y verifica que
// getCierreTimestamp() ahora calcula EXACTAMENTE el mismo instante --
// no una aproximación, el mismo valor en milisegundos.
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
  <div id="rg-content"></div><div id="torneo-content"></div><div id="toast"></div>
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
window.__test = { DB, getCierreTimestamp, isGloballyClosed };
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

const T = window.__test;

// Misma fórmula EXACTA que firestore.rules::_isPastDeadlineInner() --
// la única fuente real de verdad del lado del servidor.
function serverDeadlineInstant(fc, hc){
  return new Date(`${fc}T${(hc || "23:59")}:00Z`).getTime();
}

/* ── Caso 1: hora de cierre típica (mediodía) ── */
T.DB.configGlobal.fechaCierre = "2026-07-15";
T.DB.configGlobal.horaCierre = "12:00";
check("getCierreTimestamp() coincide EXACTO con el instante que usa firestore.rules (mismo ms)",
  T.getCierreTimestamp() === serverDeadlineInstant("2026-07-15", "12:00"));

/* ── Caso 2: horaCierre vacía -> default 23:59, mismo default en ambos lados ── */
T.DB.configGlobal.fechaCierre = "2026-07-20";
T.DB.configGlobal.horaCierre = "";
check("Con horaCierre vacía, el default (23:59) también coincide con el servidor",
  T.getCierreTimestamp() === serverDeadlineInstant("2026-07-20", ""));

/* ── Caso 3: DIAGNÓSTICO DEL BUG REPORTADO -- reproduce el escenario
   exacto: alguien en una zona horaria detrás de UTC (ej. Panamá,
   UTC-5) mirando el formulario ANTES de que llegue su mediodía local,
   pero el servidor (interpretación UTC) ya pasó el cierre hace rato. ── */
console.log("\n── Escenario del bug reportado (zona horaria detrás de UTC) ──");
// isGloballyClosed()/Date.now() corren DENTRO del realm de la ventana
// jsdom (window.Date), no el de Node -- hay que pisar window.Date, no
// el global.Date de este proceso, para que la función bajo prueba vea
// el "ahora" simulado.
const RealDate = window.Date;
function withFakeNow(fakeNowMs, fn){
  window.Date = class extends RealDate {
    constructor(...args){ if(args.length===0) super(fakeNowMs); else super(...args); }
    static now(){ return fakeNowMs; }
  };
  try{ fn(); } finally { window.Date = RealDate; }
}
// Cierre configurado para el mediodía (12:00) de un día -- interpretado
// como UTC por getCierreTimestamp() (ya arreglado) y por el servidor.
T.DB.configGlobal.fechaCierre = "2026-07-15";
T.DB.configGlobal.horaCierre = "12:00";
const deadlineUTC = serverDeadlineInstant("2026-07-15", "12:00"); // 12:00 UTC
// "Ahora" = 11:00 UTC ese mismo día -- para alguien en Panamá (UTC-5)
// son las 06:00 hora local: bien lejos de "su" mediodía, pero YA a solo
// 1 hora del cierre real (UTC). Con el bug viejo (interpretación local),
// el cliente hubiera dicho "cerrado" recién a las 12:00 hora LOCAL de
// Panamá (17:00 UTC) -- 5 horas DESPUÉS de que el servidor ya cerró.
withFakeNow(deadlineUTC - 60*60*1000, () => {
  check("1 hora ANTES del cierre real (UTC), el cliente todavía lo ve ABIERTO", T.isGloballyClosed() === false);
});
withFakeNow(deadlineUTC + 60*1000, () => {
  check("1 minuto DESPUÉS del cierre real (UTC), el cliente YA lo ve CERRADO -- mismo instante que el servidor, sin ventana de desfasaje", T.isGloballyClosed() === true);
});

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
