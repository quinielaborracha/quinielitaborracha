// Test de carga completa (gate final): carga los 6 archivos de producción
// como <script> reales (createElement + appendChild), en el MISMO orden
// que index.html y compartiendo el scope global del navegador simulado.
// Esto es lo único que detecta errores de declaración duplicada o de
// orden entre archivos -- node --check por sí solo no los ve, porque
// valida cada archivo por separado, sin scope compartido.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js",
  "partidos-grupos.js",
  "utils.js",
  "app-static-data.js",
  "app-state.js",
  "scoring.js",
  "totp.js",
  // v8.0 — app.js (3906 líneas) se dividió en 16 módulos (Sprint 1,
  // arquitectura). Cada uno es un slice contiguo y literal del app.js
  // anterior (ver split.js), cargados acá en el MISMO orden relativo
  // exacto en que estaban dentro de app.js. app-bootstrap.js DEBE ser
  // el último: hace el primer render llamando funciones definidas en
  // todos los módulos anteriores.
  "app-core-data.js",
  "app-admin-auth.js",
  "app-live-sync.js",
  "app-tabs.js",
  "app-eliminatoria-data.js",
  "app-batallas.js",
  "app-bracket-render.js",
  "app-bracket-annexc.js",
  "app-bracket-compute.js",
  "app-bracket-espn-sync.js",
  "app-bracket-view.js",
  "app-bracket-espn-live.js",
  "app-integridad.js",
  "app-predicciones.js",
  "app-estadisticas.js",
  "app-admin-tools.js",
  "app-bootstrap.js",
  "registro.js"
];

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="root"></div>
  <div id="toast"></div>
  <div id="integ-banner"></div>
  <img id="logo-img">
  <span id="admin-indicator"></span>
  <span id="hstat"></span><span id="hdr-master-badge"></span>
  <table><tbody id="rb"></tbody></table>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="rg-tabs"></div><div id="rg-content"></div>
  <div id="rbasic"></div><div id="radv"></div><div id="relim"></div><div id="rlast"></div>
</body></html>`, { runScripts: "dangerously", url: "https://example.org/" });

const { window } = dom;
window.__fb = null; // sin Firebase real -- igual que un primer load offline/sin red

let ok = true;
for (const file of FILES_IN_ORDER) {
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try {
    window.document.body.appendChild(script);
    console.log(`✅ ${file} cargó sin errores (orden de producción)`);
  } catch (e) {
    console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`);
    ok = false;
  }
}

// Bridge final: expone al scope de Node lo que hace falta verificar
// (let/const de nivel superior NO se vuelven window.X solos, ni siquiera
// compartiendo scope entre <script> tags -- por eso el bridge explícito,
// mismo patrón que ya usan test_participantes_security.js/test_login_reclaim.js).
const bridge = window.document.createElement("script");
bridge.textContent = `
  window.__t = {
    isAdminFn: typeof isAdmin,
    isAdminNow: (typeof isAdmin === "function") ? isAdmin() : undefined,
    hasDB: typeof DB !== "undefined" && !!DB,
    calcPtsFn: typeof calcPts,
    validateScoreFn: typeof validateScore,
    matchLabelsType: typeof MATCH_LABELS,
    matchLabel1: (typeof MATCH_LABELS !== "undefined") ? MATCH_LABELS[1] : undefined,
    pushStateFn: typeof pushStateToFirestore,
    hasOldEchoFlag: typeof _suppressNextFirestoreEcho !== "undefined",
    hasNewEchoVar: typeof _lastPushedStateJSON !== "undefined",
    isPending2FAFn: typeof isPending2FA,
    isPending2FANow: (typeof isPending2FA === "function") ? isPending2FA() : undefined,
    verifyTOTPCodeFn: typeof verifyTOTPCode,
    generateTOTPSecretFn: typeof generateTOTPSecret,
    generateBackupCodeFn: typeof generateBackupCode,
    sha256HexFn: typeof sha256Hex,
    checkTrustedDeviceFn: typeof checkTrustedDevice2FA,
    establishTrustedDeviceFn: typeof establishTrustedDevice2FA,
    resolveAdmin2FAFn: typeof resolveAdmin2FA,
    submit2FACodeFn: typeof submit2FACode,
    afterAdminStatusResolvedFn: typeof _afterAdminStatusResolved
  };
`;
window.document.body.appendChild(bridge);

function check(label, cond) {
  console.log((cond ? "✅ " : "❌ ") + label);
  if (!cond) ok = false;
}

const t = window.__t || {};
check("isAdmin() existe (app.js)", t.isAdminFn === "function");
check("isAdmin() devuelve false sin sesión (nadie logueado)", t.isAdminNow === false);
check("DB existe (participantes.js)", t.hasDB === true);
check("calcPts() existe (scoring.js)", t.calcPtsFn === "function");
check("validateScore() existe (utils.js)", t.validateScoreFn === "function");
check("MATCH_LABELS existe (partidos-grupos.js)", t.matchLabelsType === "object");
check("MATCH_LABELS[1] tiene el nombre del partido", t.matchLabel1 === "México vs Sudáfrica");
check("pushStateToFirestore() existe (app.js)", t.pushStateFn === "function");
check("La bandera vieja _suppressNextFirestoreEcho YA NO existe", t.hasOldEchoFlag === false);
check("La nueva variable _lastPushedStateJSON existe (mecanismo de eco por contenido)", t.hasNewEchoVar === true);
check("isPending2FA() existe (app.js, v7.1)", t.isPending2FAFn === "function");
check("isPending2FA() devuelve false sin sesión (nadie logueado)", t.isPending2FANow === false);
check("verifyTOTPCode() existe (totp.js)", t.verifyTOTPCodeFn === "function");
check("generateTOTPSecret() existe (totp.js)", t.generateTOTPSecretFn === "function");
check("generateBackupCode() existe (totp.js)", t.generateBackupCodeFn === "function");
check("sha256Hex() existe (totp.js)", t.sha256HexFn === "function");
check("checkTrustedDevice2FA() existe (app.js, v7.1)", t.checkTrustedDeviceFn === "function");
check("establishTrustedDevice2FA() existe (app.js, v7.1)", t.establishTrustedDeviceFn === "function");
check("resolveAdmin2FA() existe (app.js, v7.1)", t.resolveAdmin2FAFn === "function");
check("submit2FACode() existe (app.js, v7.1)", t.submit2FACodeFn === "function");
check("_afterAdminStatusResolved() existe (app.js, v7.1)", t.afterAdminStatusResolvedFn === "function");

console.log(`\n=== RESULTADO: ${ok ? "CARGA COMPLETA OK ✅" : "HAY ERRORES ❌"} ===`);
process.exit(ok ? 0 : 1);
