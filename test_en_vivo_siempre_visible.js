// Test funcional de v2.9: el botón "⚡ En vivo" (navtab-mm) debe verse
// SIEMPRE, sin importar qué fase del torneo esté activa/desactivada.
//
// BUG REPORTADO: apagar cualquier fase (Configuración del torneo →
// Fases activas) hacía desaparecer el botón "En vivo" del menú
// principal. Causa: syncTabsWithFasesActivas() (app-tabs.js) lo ocultaba
// cada vez que "grupos" estaba desactivada, bajo el supuesto de que "En
// vivo" solo mostraba partidos de fase de grupos en tiempo real
// (parseESPNEvent, P1-P72). Ese supuesto quedó desactualizado: loadMM()
// (app-bracket-espn-live.js) también sigue partidos de ELIMINATORIA en
// vivo (fallback parseESPNEventElim) -- con la regla vieja, esos
// partidos quedaban sin ningún botón de navegación que los mostrara.
//
// Carga los 24 archivos de producción reales en el mismo orden que
// index.html, mismo patrón que el resto de los tests de Reglas/Tabs.
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
  <div id="navtab-mm" class="tab">⚡ En vivo</div>
  <div id="ftab-grupos"></div><div id="ptab-grupos"></div>
  <div id="t-mm" class="tab-panel" style="display:none"></div>
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
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
bridge.textContent = `window.__test = { DB, rebuildDynamicData };`;
window.document.body.appendChild(bridge);
const T = window.__test;
const W = window;
W.isAdmin = () => true;

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — Torneo con todas las fases activas (default)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Todas las fases activas (default) ──");
W.syncTabsWithFasesActivas();
check("'En vivo' está visible con todo activo",
  W.document.getElementById("navtab-mm").style.display !== "none");

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — Desactivar 'grupos': antes ocultaba 'En vivo', ahora no
   ════════════════════════════════════════════════════════════════ */
console.log("\n── 'grupos' desactivada ──");
T.DB.configGlobal.fasesActivas = { grupos:false };
W.syncTabsWithFasesActivas();
check("'En vivo' SIGUE visible con 'grupos' desactivada (antes desaparecía)",
  W.document.getElementById("navtab-mm").style.display !== "none");
check("El sub-tab de Fixture 'grupos' (ftab-grupos) sí se oculta (no hay fixture de grupos que mostrar)",
  W.document.getElementById("ftab-grupos").style.display === "none");
check("El sub-tab de Predicciones 'grupos' (ptab-grupos) sí se oculta",
  W.document.getElementById("ptab-grupos").style.display === "none");

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — Desactivar OTRA fase de eliminatoria (no 'grupos'): 'En
   vivo' debe seguir visible igual, ya no depende de ninguna fase
   ════════════════════════════════════════════════════════════════ */
console.log("\n── 'grupos' activa de nuevo, pero 'r16' (Dieciseisavos) desactivada ──");
T.DB.configGlobal.fasesActivas = { grupos:true, r16:false };
W.syncTabsWithFasesActivas();
check("'En vivo' sigue visible (no depende de ninguna fase de eliminatoria)",
  W.document.getElementById("navtab-mm").style.display !== "none");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
