// Test funcional del Sprint 10 (hoja de ruta comercial, Fase 3 --
// selector de plantilla en runtime, segundo paso): TENANT_ID en
// index.html deja de ser un literal fijo y resuelve por ?tenant= de la
// URL -> localStorage.qb_tenant_activo -> default ("quinielitaborracha"),
// mismo patrón exacto que TEST_MODE ya usa un poco más abajo en el
// mismo bloque.
//
// El bloque real vive en un <script type="module"> (imports de
// Firebase por red, imposibles de ejecutar en este entorno de test --
// ver cómo test_copa_america_e2e.js lo descarta por completo con un
// regex). En vez de mockear Firebase entero para ejercitar 6 líneas de
// lógica pura, este test EXTRAE exactamente esas líneas de index.html
// (con un regex acotado a la constante TENANT_ID y su cacheo) y las
// corre en un jsdom fresco por escenario -- si algún día cambia esa
// lógica sin actualizar este regex, el test falla con un mensaje claro
// en vez de silenciosamente no probar nada.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const m = indexHtml.match(
  /const TENANT_ID = new URLSearchParams[\s\S]*?"quinielitaborracha";[\s\S]*?\n\s*\}\s*\n/
);
if (!m) {
  console.log("❌ No se encontró el bloque de resolución de TENANT_ID en index.html (¿cambió la forma del código?)");
  process.exit(1);
}
const TENANT_RESOLUTION_CODE = m[0];

function runEscenario(url, presetLocalStorage) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url, runScripts: "dangerously" });
  const { window } = dom;
  if (presetLocalStorage) {
    Object.entries(presetLocalStorage).forEach(([k, v]) => window.localStorage.setItem(k, v));
  }
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
  return {
    TENANT_ID: window.__TENANT_ID__,
    cacheado: window.localStorage.getItem("qb_tenant_activo"),
  };
}

/* ════════════════════════════════════════════════════════════════
   CASO 1 — sin ?tenant= ni caché: cae en el tenant real de siempre
   (cero riesgo de romper producción con este cambio).
   ════════════════════════════════════════════════════════════════ */
console.log("--- CASO 1: sin URL ni caché -> default de producción ---");
const r1 = runEscenario("https://example.org/");
check("TENANT_ID es 'quinielitaborracha' (el de siempre)", r1.TENANT_ID === "quinielitaborracha");
check("No se escribió nada en localStorage (no había nada explícito que cachear)", r1.cacheado === null);

/* ════════════════════════════════════════════════════════════════
   CASO 2 — ?tenant= en la URL gana siempre, y se cachea.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 2: ?tenant= en la URL ---");
const r2 = runEscenario("https://example.org/?tenant=cliente-demo");
check("TENANT_ID toma el valor de la URL", r2.TENANT_ID === "cliente-demo");
check("Se cachea en localStorage para el próximo load", r2.cacheado === "cliente-demo");

/* ════════════════════════════════════════════════════════════════
   CASO 3 — sin ?tenant= en la URL pero con localStorage: usa lo
   cacheado (simula volver a entrar sin repetir el parámetro).
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 3: localStorage sin ?tenant= en la URL ---");
const r3 = runEscenario("https://example.org/", { qb_tenant_activo: "cliente-demo" });
check("TENANT_ID respeta lo cacheado en localStorage", r3.TENANT_ID === "cliente-demo");

/* ════════════════════════════════════════════════════════════════
   CASO 4 — ?tenant= en la URL tiene prioridad sobre localStorage
   (permite cambiar de tenant explícitamente aunque haya uno cacheado).
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 4: ?tenant= gana por encima de un caché distinto ---");
const r4 = runEscenario("https://example.org/?tenant=quinielitaborracha", { qb_tenant_activo: "cliente-demo" });
check("TENANT_ID usa el de la URL, no el cacheado", r4.TENANT_ID === "quinielitaborracha");
check("El caché se actualiza al nuevo valor de la URL", r4.cacheado === "quinielitaborracha");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
