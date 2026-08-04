// Test funcional del Sprint 10 (hoja de ruta comercial, Fase 3 --
// selector de plantilla en runtime, segundo paso): TENANT_ID en
// index.html deja de ser un literal fijo y resuelve por ?tenant= de la
// URL -> "quinielitaborracha" (default explícito), mismo patrón que
// TEST_MODE ya usa un poco más abajo en el mismo bloque.
//
// CORRECCIÓN URGENTE (2026-08-04, reemplaza la versión original de este
// test): la primera versión de TENANT_ID cacheaba ?tenant= en
// localStorage.qb_tenant_activo para "recordar" el tenant elegido entre
// visitas -- eso resultó ser un BUG REAL en producción: visitar un
// link de prueba con ?tenant=euro-2028 dejaba ese navegador entrando
// silenciosamente a esa quiniela de prueba incluso al volver a la URL
// real sin ningún parámetro (el admin real quedó bloqueado de su
// propia quiniela por esto el mismo día). Se sacó el cacheo por
// completo -- este test ahora confirma que NO hay ninguna persistencia
// entre visitas: sin ?tenant=, siempre es "quinielitaborracha".
//
// El bloque real vive en un <script type="module"> (imports de
// Firebase por red, imposibles de ejecutar en este entorno de test --
// ver cómo test_copa_america_e2e.js lo descarta por completo con un
// regex). En vez de mockear Firebase entero para ejercitar 2 líneas de
// lógica pura, este test EXTRAE exactamente esas líneas de index.html
// (con un regex acotado a la constante TENANT_ID) y las corre en un
// jsdom fresco por escenario -- si algún día cambia esa lógica sin
// actualizar este regex, el test falla con un mensaje claro en vez de
// silenciosamente no probar nada.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const m = indexHtml.match(
  /const TENANT_ID = new URLSearchParams[\s\S]*?"quinielitaborracha";/
);
if (!m) {
  console.log("❌ No se encontró el bloque de resolución de TENANT_ID en index.html (¿cambió la forma del código?)");
  process.exit(1);
}
const TENANT_RESOLUTION_CODE = m[0];

// Confirma que el bloque extraído NO vuelve a tener ninguna referencia
// a localStorage -- si alguien reintrodujera el cacheo (el bug real de
// esta sesión), este check falla incluso antes de correr los escenarios.
check("El bloque de TENANT_ID no usa localStorage (el bug real de esta sesión)", !TENANT_RESOLUTION_CODE.includes("localStorage"));

function runEscenario(url) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url, runScripts: "dangerously" });
  const { window } = dom;
  const script = window.document.createElement("script");
  script.textContent = TENANT_RESOLUTION_CODE;
  window.document.body.appendChild(script);
  // `const TENANT_ID` vive en el scope léxico global compartido entre
  // <script> del mismo documento, pero NO se vuelve una propiedad de
  // `window` -- hace falta un segundo script, en el mismo documento,
  // que lo exponga explícitamente para que este test (que mira desde
  // afuera, vía window.___) pueda leerlo.
  const bridge = window.document.createElement("script");
  bridge.textContent = "window.__TENANT_ID__ = TENANT_ID;";
  window.document.body.appendChild(bridge);
  return window.__TENANT_ID__;
}

/* ════════════════════════════════════════════════════════════════
   CASO 1 — sin ?tenant=: SIEMPRE el tenant real, sin excepciones.
   ════════════════════════════════════════════════════════════════ */
console.log("--- CASO 1: sin ?tenant= en la URL -> default de producción ---");
check("TENANT_ID es 'quinielitaborracha' (el de siempre)", runEscenario("https://example.org/") === "quinielitaborracha");

/* ════════════════════════════════════════════════════════════════
   CASO 2 — ?tenant= en la URL gana, sin dejar rastro para la próxima.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 2: ?tenant= en la URL ---");
check("TENANT_ID toma el valor de la URL", runEscenario("https://example.org/?tenant=euro-2028") === "euro-2028");

/* ════════════════════════════════════════════════════════════════
   CASO 3 — el bug real: una visita anterior con ?tenant= de OTRO
   tenant, con algo (mal) cacheado en localStorage de una sesión vieja,
   NO debe afectar una visita nueva sin ?tenant= en la URL.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 3: localStorage \"contaminado\" de una visita anterior no afecta nada ---");
const dom3 = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://example.org/", runScripts: "dangerously" });
dom3.window.localStorage.setItem("qb_tenant_activo", "euro-2028"); // simula el rastro que dejaba la versión vieja del código
const script3 = dom3.window.document.createElement("script");
script3.textContent = TENANT_RESOLUTION_CODE;
dom3.window.document.body.appendChild(script3);
const bridge3 = dom3.window.document.createElement("script");
bridge3.textContent = "window.__TENANT_ID__ = TENANT_ID;";
dom3.window.document.body.appendChild(bridge3);
check("TENANT_ID ignora cualquier localStorage viejo -- sin ?tenant=, siempre el tenant real", dom3.window.__TENANT_ID__ === "quinielitaborracha");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
