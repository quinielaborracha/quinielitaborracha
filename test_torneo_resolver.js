// Test funcional del Sprint 9 (hoja de ruta comercial, Fase 3 --
// selector de plantilla en runtime, primer paso): torneo-resolver.js
// decide cuál de los torneo-<nombre>.js registrados en
// TORNEOS_DISPONIBLES pasa a ser TORNEO_ACTUAL, leyendo en orden
// ?torneo= de la URL -> DEFAULT_TORNEO_ID ("mundial2026", explícito).
//
// CORRECCIÓN URGENTE (2026-08-04, reemplaza la versión original de este
// test y del propio torneo-resolver.js): la primera versión, sin
// ?torneo= ni caché, dejaba TORNEO_ACTUAL "tal cual había quedado por
// el simple orden de carga de los <script> anteriores" -- eso era
// silenciosamente el ÚLTIMO template ficticio agregado (primero Copa
// América, después Euro), aplicado sobre los datos REALES del tenant
// de producción, para cualquier visitante sin ?torneo= en el link --
// es decir, todos los participantes reales. Además cacheaba la
// elección en localStorage, lo que agravaba el problema (ver la nota
// completa en torneo-resolver.js y en test_tenant_runtime.js, mismo
// día). Ahora el default es explícito y no hay ninguna persistencia
// entre visitas -- este test verifica ambas cosas.
//
// Esta es la PRIMERA vez que un test carga los 3 torneo-<nombre>.js
// juntos a propósito (hasta ahora, los harnesses de un solo torneo
// cargaban uno solo -- ver test_copa_america_e2e.js/test_euro_e2e.js).
// Si esto tirara un SyntaxError por redeclaración de TORNEO_ACTUAL, es
// la señal de que el cambio de `const` a `var` en esos archivos no
// alcanzó.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

const TORNEO_MUNDIAL_JS = fs.readFileSync(path.join(__dirname, "torneo-mundial2026.js"), "utf8");
const TORNEO_COPAAMERICA_JS = fs.readFileSync(path.join(__dirname, "torneo-copaamerica.js"), "utf8");
const TORNEO_EURO_JS = fs.readFileSync(path.join(__dirname, "torneo-euro.js"), "utf8");
const TORNEO_RESOLVER_JS = fs.readFileSync(path.join(__dirname, "torneo-resolver.js"), "utf8");

check("torneo-resolver.js no LEE/ESCRIBE localStorage (el bug real de esta sesión -- el archivo sí puede MENCIONARLO en un comentario explicando por qué se sacó)",
  !/localStorage\.(get|set)Item/.test(TORNEO_RESOLVER_JS));
check("torneo-resolver.js tiene un default EXPLÍCITO a mundial2026 (no \"lo último cargado\")", /DEFAULT_TORNEO_ID\s*=\s*['"]mundial2026['"]/.test(TORNEO_RESOLVER_JS));

// Carga los 4 archivos en un DOM fresco (mismo orden real que
// index.html: mundial -> copaamerica -> euro -> resolver) y devuelve
// { TORNEO_ACTUAL, TORNEOS_DISPONIBLES } una vez que el resolver ya corrió.
function runEscenario(url) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url, runScripts: "dangerously" });
  const { window } = dom;
  let thrown = null;
  for (const code of [TORNEO_MUNDIAL_JS, TORNEO_COPAAMERICA_JS, TORNEO_EURO_JS, TORNEO_RESOLVER_JS]) {
    const script = window.document.createElement("script");
    script.textContent = code;
    try { window.document.body.appendChild(script); }
    catch (e) { thrown = e; }
  }
  return { thrown, TORNEO_ACTUAL: window.TORNEO_ACTUAL, disponibles: window.TORNEOS_DISPONIBLES };
}

/* ════════════════════════════════════════════════════════════════
   CASO 0 — cargar los 3 torneo-*.js juntos no tira SyntaxError (el
   cambio const->var funcionó de verdad).
   ════════════════════════════════════════════════════════════════ */
console.log("--- CASO 0: cargar los 3 torneo-*.js juntos no explota ---");
const r0 = runEscenario("https://example.org/");
check("Ningún archivo lanzó una excepción al cargar (sin redeclaración de TORNEO_ACTUAL)", r0.thrown === null);

/* ════════════════════════════════════════════════════════════════
   CASO 1 — TORNEOS_DISPONIBLES tiene los 3 ids, sin pisarse.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 1: registro compartido ---");
check("TORNEOS_DISPONIBLES tiene 'mundial2026'", !!r0.disponibles["mundial2026"]);
check("TORNEOS_DISPONIBLES tiene 'copaamerica-ficticia'", !!r0.disponibles["copaamerica-ficticia"]);
check("TORNEOS_DISPONIBLES tiene 'euro-ficticio'", !!r0.disponibles["euro-ficticio"]);
check("El Mundial 2026 conserva sus 72 partidos de grupos", r0.disponibles["mundial2026"].groupMatches.length === 72);
check("La Copa América ficticia conserva sus 24 partidos de grupos", r0.disponibles["copaamerica-ficticia"].groupMatches.length === 24);

/* ════════════════════════════════════════════════════════════════
   CASO 2 — EL FIX REAL: sin ?torneo= en la URL, el default es SIEMPRE
   el Mundial 2026 real, sin importar en qué orden se cargaron los
   demás templates (antes del fix, esto daba "euro-ficticio" -- el
   último script en cargar -- rompiendo el sitio real para cualquiera
   sin el parámetro en su link).
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 2: sin ?torneo= -> SIEMPRE el Mundial 2026 real (el bug real de esta sesión) ---");
check("TORNEO_ACTUAL es 'mundial2026', NO el último template cargado", r0.TORNEO_ACTUAL.id === "mundial2026");

/* ════════════════════════════════════════════════════════════════
   CASO 3 — ?torneo= en la URL gana siempre, sin dejar rastro.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 3: ?torneo= en la URL ---");
check("?torneo=copaamerica-ficticia funciona", runEscenario("https://example.org/?torneo=copaamerica-ficticia").TORNEO_ACTUAL.id === "copaamerica-ficticia");
check("?torneo=euro-ficticio funciona", runEscenario("https://example.org/?torneo=euro-ficticio").TORNEO_ACTUAL.id === "euro-ficticio");
check("?torneo=mundial2026 también funciona (explícito, no solo por default)", runEscenario("https://example.org/?torneo=mundial2026").TORNEO_ACTUAL.id === "mundial2026");

/* ════════════════════════════════════════════════════════════════
   CASO 4 — el bug real: una visita anterior con ?torneo= de otro
   template, con algo (mal) cacheado en localStorage de una sesión
   vieja, NO debe afectar una visita nueva sin ?torneo= en la URL.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 4: localStorage \"contaminado\" de una visita anterior no afecta nada ---");
const dom4 = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://example.org/", runScripts: "dangerously" });
dom4.window.localStorage.setItem("qb_torneo_activo", "euro-ficticio"); // simula el rastro que dejaba la versión vieja del código
for (const code of [TORNEO_MUNDIAL_JS, TORNEO_COPAAMERICA_JS, TORNEO_EURO_JS, TORNEO_RESOLVER_JS]) {
  const script = dom4.window.document.createElement("script");
  script.textContent = code;
  dom4.window.document.body.appendChild(script);
}
check("TORNEO_ACTUAL ignora cualquier localStorage viejo -- sin ?torneo=, siempre el Mundial real", dom4.window.TORNEO_ACTUAL.id === "mundial2026");

/* ════════════════════════════════════════════════════════════════
   CASO 5 — ?torneo= con un id que NO existe en TORNEOS_DISPONIBLES:
   no rompe nada, cae al default explícito.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 5: ?torneo= con id inexistente no explota ---");
const r5 = runEscenario("https://example.org/?torneo=no-existe-este-id");
check("No lanzó excepción", r5.thrown === null);
check("Cae al default explícito (mundial2026), no a un id inválido", r5.TORNEO_ACTUAL.id === "mundial2026");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
