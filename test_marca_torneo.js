// Test funcional del Sprint 6 (hoja de ruta comercial, Fase 2
// "constructor de torneo" -- marca propia, 2026-07-23): logo y color de
// acento configurables desde Admin → Configuración del torneo → 🎨
// Marca (DB.configGlobal.logoUrl/colorAcento), aplicados por
// applyBrandingConfig() (app-bootstrap.js) tanto al arrancar como en
// vivo (onParticipantesChange).
//
// Carga completa en jsdom de los archivos JS de producción, mismo patrón
// que test_reglas_avanzadas_switch.js -- ejercita el panel REAL (input
// real, mismo onchange que en el navegador), no llamadas directas a
// funciones internas.
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
  <div id="torneo-content"></div>
  <div id="t-battles" style="display:none"><div id="battle-builder-body"></div><div id="battles-body"></div></div>
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
const bridge = window.document.createElement("script");
bridge.textContent = `window.__test = { DB, applyBrandingConfig, renderTorneoConfig, BORRACHI_SRC };`;
window.document.body.appendChild(bridge);
const T = window.__test;
const W = window;
W.isAdmin = () => true;

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — Default: sin branding configurado, el look es el de
   siempre (logo BORRACHI_SRC, sin override de --qb-red)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Default: sin marca propia configurada ──");
check("mergeConfigGlobal() trae logoUrl/colorAcento vacíos por defecto",
  T.DB.configGlobal.logoUrl === "" && T.DB.configGlobal.colorAcento === "");
const logoEl = W.document.getElementById("logo-img");
check("Logo por defecto: BORRACHI_SRC", logoEl.src === T.BORRACHI_SRC || logoEl.getAttribute("src") === T.BORRACHI_SRC);
check("Sin override de --qb-red por defecto", W.document.documentElement.style.getPropertyValue("--qb-red") === "");

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — Configurar marca propia desde el panel REAL (input real,
   mismo onchange que en el navegador)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Configurar marca propia desde la UI real ──");
W.renderTorneoConfig();
const torneoContent = W.document.getElementById("torneo-content");
check("El panel renderizó la tarjeta '🎨 Marca del torneo'", torneoContent.innerHTML.includes("Marca del torneo"));

const logoInput = torneoContent.querySelector('[data-branding-field="logoUrl"]');
const colorInput = torneoContent.querySelector('[data-branding-field="colorAcento"]');
check("El input de URL del logo existe en el DOM real", !!logoInput);
check("El input de color de acento existe en el DOM real", !!colorInput);

logoInput.value = "https://cdn.example.com/mi-logo.png";
logoInput.dispatchEvent(new W.Event("change", {bubbles:true}));
check("Un change real en el input guardó logoUrl", T.DB.configGlobal.logoUrl === "https://cdn.example.com/mi-logo.png");
check("applyBrandingConfig() actualizó el <img> real",
  logoEl.src === "https://cdn.example.com/mi-logo.png" || logoEl.getAttribute("src") === "https://cdn.example.com/mi-logo.png");

colorInput.value = "#00aa55";
colorInput.dispatchEvent(new W.Event("change", {bubbles:true}));
check("Un change real en el input guardó colorAcento", T.DB.configGlobal.colorAcento === "#00aa55");
check("applyBrandingConfig() aplicó --qb-red = #00aa55",
  W.document.documentElement.style.getPropertyValue("--qb-red") === "#00aa55");

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — XSS: una URL de logo maliciosa no puede escapar el
   atributo value="" del input (mismo criterio que el resto del panel)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── El valor del logo no rompe el HTML del panel (XSS) ──");
T.DB.configGlobal.logoUrl = `"><img src=x onerror=alert(1)>`;
W.renderTorneoConfig();
const torneoContent2 = W.document.getElementById("torneo-content");
check("El valor malicioso queda escapado dentro del atributo value, no como HTML nuevo",
  !torneoContent2.querySelector('img[onerror]'));

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — Restablecer vuelve al diseño por defecto
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Restablecer vuelve al diseño por defecto ──");
T.DB.configGlobal.logoUrl = "https://cdn.example.com/mi-logo.png";
T.DB.configGlobal.colorAcento = "#00aa55";
W.resetBrandingConfig();
check("resetBrandingConfig() vacía logoUrl/colorAcento", T.DB.configGlobal.logoUrl === "" && T.DB.configGlobal.colorAcento === "");
check("El logo real vuelve a BORRACHI_SRC", logoEl.src === T.BORRACHI_SRC || logoEl.getAttribute("src") === T.BORRACHI_SRC);
check("El override de --qb-red se limpia", W.document.documentElement.style.getPropertyValue("--qb-red") === "");

console.log(ok ? "TODO OK ✅" : "HAY FALLAS ❌");
process.exit(ok ? 0 : 1);
