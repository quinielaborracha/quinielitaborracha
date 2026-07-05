// Test funcional de v3.7 — "Aviso a Participantes": popup cerrable
// (#qb-aviso) que el admin activa/escribe desde el panel (📢 Aviso a
// Participantes), y que se muestra una sola vez por navegador a cada
// participante (nunca al admin, y nunca bloquea nada -- a diferencia de
// Modo Mantenimiento).
//
// Verifica:
//  1) Con el aviso apagado, o sin ningún texto guardado todavía
//     (avisoActualizadoEn=0), el popup nunca aparece.
//  2) Activo + admin logueado -> NO se muestra (el admin no se
//     autobombardea con sus propios avisos).
//  3) Activo + no-admin + nunca lo vio -> SÍ se muestra, con el
//     título/mensaje correctos.
//  4) Al cerrarlo (cerrarAviso()), graba en localStorage la versión
//     actual -- una segunda llamada a applyAvisoGuard() ya NO lo
//     vuelve a mostrar.
//  5) El admin publica un texto NUEVO (bumpea avisoActualizadoEn) ->
//     aunque ese navegador ya había cerrado el aviso anterior, se le
//     vuelve a mostrar (con el texto nuevo).
//  6) mostrarAvisoPreview() (botón "Vista previa" del panel Admin)
//     muestra el popup SIN tocar localStorage ni depender del switch.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "partidos-grupos.js", "utils.js", "app-static-data.js", "app-state.js", "scoring.js",
  "app-core-data.js", "app-admin-auth.js", "app-live-sync.js", "app-tabs.js",
  "app-eliminatoria-data.js", "app-batallas.js", "app-bracket-render.js",
  "app-bracket-annexc.js", "app-bracket-compute.js", "app-bracket-espn-sync.js", "app-bracket-view.js",
  "app-bracket-espn-live.js", "app-integridad.js", "app-predicciones.js",
  "app-estadisticas.js", "app-admin-tools.js", "app-bootstrap.js", "registro.js"];

let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
html = html.replace(/<script[^>]*src=[^>]*><\/script>/g, "");
html = html.replace(/<script type="module">[\s\S]*?<\/script>/g, "");

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously", pretendToBeVisual: true });
const { window } = dom;
window.confirm = () => true;
window.alert = () => {};
window.setInterval = () => 0;
window.toast = () => {};

// localStorage en memoria simple, propio de esta corrida.
const _store = {};
window.localStorage = {
  getItem: (k) => (k in _store ? _store[k] : null),
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; },
};

window.__fb = {
  auth: {},
  PARTICIPANTS_COL: {}, REGISTRO_META_DOC: {}, REGISTRO_PAPELERA_DOC: {},
  onAuthStateChanged: () => {},
  signInAnonymously: () => Promise.resolve(),
  onSnapshot: () => () => {},
  signOut: () => Promise.resolve(),
};

let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

for (const f of FILES) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try { window.document.body.appendChild(script); }
  catch (e) { console.error(`❌ Excepción al cargar ${f}:`, e.message); process.exit(1); }
}

// DB es "let DB" a nivel de módulo (participantes.js) -- no queda
// expuesta en window sola, hace falta un puente explícito (mismo patrón
// que ya usan otros tests de este proyecto). applyAvisoGuard/
// cerrarAviso/mostrarAvisoPreview/isAdmin sí quedan en window solas
// (son "function" de nivel superior en un <script> clásico, fuera de
// cualquier IIFE).
const bridge = window.document.createElement("script");
bridge.textContent = "window.DB = DB;";
window.document.body.appendChild(bridge);

const overlay = window.document.getElementById("qb-aviso");
check("#qb-aviso existe en index.html", !!overlay);
check("Arranca oculto", overlay.style.display === "none" || overlay.style.display === "");

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — apagado / sin texto todavía -> nunca se muestra
   ════════════════════════════════════════════════════════════════ */
console.log("── Aviso apagado / sin texto guardado ──");
window.DB.configGlobal.avisoActivo = false;
window.applyAvisoGuard();
check("Apagado: no se muestra", overlay.style.display !== "flex");

window.DB.configGlobal.avisoActivo = true; // activo pero avisoActualizadoEn sigue en 0 (nunca se guardó texto)
window.applyAvisoGuard();
check("Activo pero sin avisoActualizadoEn (nunca se guardó un texto): no se muestra", overlay.style.display !== "flex");

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — admin no se ve su propio aviso
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Admin logueado ──");
window.DB.configGlobal.avisoTitulo = "Corregimos las llaves";
window.DB.configGlobal.avisoMensaje = "Ya se puede volver a jugar tranquilo.";
window.DB.configGlobal.avisoActualizadoEn = 1000;
window.isAdmin = () => true;
window.applyAvisoGuard();
check("Admin: NO se muestra aunque esté activo y con texto", overlay.style.display !== "flex");

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — participante (no admin), nunca lo vio -> se muestra
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Participante (no admin), primera vez ──");
window.isAdmin = () => false;
window.applyAvisoGuard();
check("No-admin, activo, con texto, nunca lo vio: SÍ se muestra", overlay.style.display === "flex");
check("Título correcto", window.document.getElementById("qb-aviso-title").textContent === "Corregimos las llaves");
check("Mensaje correcto", window.document.getElementById("qb-aviso-msg").textContent === "Ya se puede volver a jugar tranquilo.");

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — cerrarlo lo recuerda -- no vuelve a aparecer
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Cerrar el aviso ──");
window.cerrarAviso();
check("Al cerrar, se oculta", overlay.style.display === "none");
window.applyAvisoGuard();
check("Re-evaluado de nuevo (mismo texto): ya NO se vuelve a mostrar", overlay.style.display !== "flex");

/* ════════════════════════════════════════════════════════════════
   PARTE 5 — el admin publica un texto NUEVO -> vuelve a aparecer
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Admin publica un aviso nuevo ──");
window.DB.configGlobal.avisoTitulo = "Semifinales";
window.DB.configGlobal.avisoMensaje = "Ya podés cargar tus semifinales.";
window.DB.configGlobal.avisoActualizadoEn = 2000; // bump -- simula el botón "Guardar" de registro.js
window.applyAvisoGuard();
check("Texto nuevo (avisoActualizadoEn bumpeado): se vuelve a mostrar aunque ya lo hubiera cerrado antes", overlay.style.display === "flex");
check("Con el título/mensaje NUEVOS", window.document.getElementById("qb-aviso-title").textContent === "Semifinales");
window.cerrarAviso();
window.applyAvisoGuard();
check("Cerrado de nuevo: no reaparece hasta el próximo cambio de texto", overlay.style.display !== "flex");

/* ════════════════════════════════════════════════════════════════
   PARTE 6 — vista previa del admin: ignora "ya lo vi" y el switch
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Vista previa (admin) ──");
window.DB.configGlobal.avisoActivo = false; // switch apagado a propósito
window.mostrarAvisoPreview("Probando", "Este es un texto de prueba.");
check("Vista previa se muestra aunque el switch esté apagado", overlay.style.display === "flex");
check("Vista previa usa el título/mensaje pasados, no los guardados", window.document.getElementById("qb-aviso-title").textContent === "Probando");
window.cerrarAviso();
window.applyAvisoGuard();
check("Después de la vista previa, el guard normal sigue respetando el switch apagado", overlay.style.display !== "flex");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
