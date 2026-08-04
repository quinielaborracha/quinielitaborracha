// Test funcional del Sprint 9 (hoja de ruta comercial, Fase 3 --
// selector de plantilla en runtime, primer paso): torneo-resolver.js
// decide cuál de los torneo-<nombre>.js registrados en
// TORNEOS_DISPONIBLES pasa a ser TORNEO_ACTUAL, leyendo en orden
// ?torneo= de la URL -> localStorage.qb_torneo_activo -> default (lo
// que haya quedado por simple orden de carga).
//
// Esta es la PRIMERA vez que un test carga torneo-mundial2026.js Y
// torneo-copaamerica.js juntos a propósito (hasta ahora, todos los
// harnesses cargaban uno u otro, nunca los dos -- ver
// test_copa_america_e2e.js). Si esto tirara un SyntaxError por
// redeclaración de TORNEO_ACTUAL, es la señal de que el cambio de
// `const` a `var` en esos 2 archivos no alcanzó.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

const TORNEO_MUNDIAL_JS = fs.readFileSync(path.join(__dirname, "torneo-mundial2026.js"), "utf8");
const TORNEO_COPAAMERICA_JS = fs.readFileSync(path.join(__dirname, "torneo-copaamerica.js"), "utf8");
const TORNEO_RESOLVER_JS = fs.readFileSync(path.join(__dirname, "torneo-resolver.js"), "utf8");

// Carga los 3 archivos en un DOM fresco (URL y localStorage a medida
// para cada escenario) y devuelve { TORNEO_ACTUAL, TORNEOS_DISPONIBLES,
// cacheado } una vez que torneo-resolver.js ya corrió.
function runEscenario(url, presetLocalStorage) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url, runScripts: "dangerously" });
  const { window } = dom;
  if (presetLocalStorage) {
    Object.entries(presetLocalStorage).forEach(([k, v]) => window.localStorage.setItem(k, v));
  }
  let thrown = null;
  for (const code of [TORNEO_MUNDIAL_JS, TORNEO_COPAAMERICA_JS, TORNEO_RESOLVER_JS]) {
    const script = window.document.createElement("script");
    script.textContent = code;
    try { window.document.body.appendChild(script); }
    catch (e) { thrown = e; }
  }
  return {
    thrown,
    TORNEO_ACTUAL: window.TORNEO_ACTUAL,
    disponibles: window.TORNEOS_DISPONIBLES,
    cacheado: window.localStorage.getItem("qb_torneo_activo"),
  };
}

/* ════════════════════════════════════════════════════════════════
   CASO 0 — cargar torneo-mundial2026.js + torneo-copaamerica.js juntos
   NO tira SyntaxError (el cambio const->var funcionó de verdad).
   ════════════════════════════════════════════════════════════════ */
console.log("--- CASO 0: cargar los 2 torneo-*.js juntos no explota ---");
const r0 = runEscenario("https://example.org/");
check("Ningún archivo lanzó una excepción al cargar (sin redeclaración de TORNEO_ACTUAL)", r0.thrown === null);

/* ════════════════════════════════════════════════════════════════
   CASO 1 — TORNEOS_DISPONIBLES tiene ambos ids, sin pisarse.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 1: registro compartido ---");
check("TORNEOS_DISPONIBLES tiene 'mundial2026'", !!r0.disponibles["mundial2026"]);
check("TORNEOS_DISPONIBLES tiene 'copaamerica-ficticia'", !!r0.disponibles["copaamerica-ficticia"]);
check("Son objetos distintos (no se pisaron entre sí)", r0.disponibles["mundial2026"] !== r0.disponibles["copaamerica-ficticia"]);
check("El Mundial 2026 conserva sus 72 partidos de grupos", r0.disponibles["mundial2026"].groupMatches.length === 72);
check("La Copa América ficticia conserva sus 24 partidos de grupos", r0.disponibles["copaamerica-ficticia"].groupMatches.length === 24);

/* ════════════════════════════════════════════════════════════════
   CASO 2 — sin ?torneo= ni localStorage: cae al default (el que quedó
   cargado último por orden de <script>, hoy Copa América -- ver nota
   en torneo-resolver.js: el resolver no fuerza ningún default propio).
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 2: sin URL ni caché -> default por orden de carga ---");
check("TORNEO_ACTUAL quedó seteado a algo (nunca undefined)", !!r0.TORNEO_ACTUAL);
check("Sin pistas explícitas, no se escribió nada en localStorage", r0.cacheado === null);

/* ════════════════════════════════════════════════════════════════
   CASO 3 — ?torneo=copaamerica-ficticia en la URL gana siempre.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 3: ?torneo= en la URL ---");
const r3 = runEscenario("https://example.org/?torneo=copaamerica-ficticia");
check("TORNEO_ACTUAL es la Copa América ficticia", r3.TORNEO_ACTUAL.id === "copaamerica-ficticia");
check("Se cacheó la elección en localStorage para el próximo load", r3.cacheado === "copaamerica-ficticia");

const r3b = runEscenario("https://example.org/?torneo=mundial2026");
check("?torneo=mundial2026 también funciona (vuelve al Mundial)", r3b.TORNEO_ACTUAL.id === "mundial2026");

/* ════════════════════════════════════════════════════════════════
   CASO 4 — sin ?torneo= pero CON localStorage: usa lo cacheado.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 4: localStorage sin ?torneo= en la URL ---");
const r4 = runEscenario("https://example.org/", { qb_torneo_activo: "copaamerica-ficticia" });
check("TORNEO_ACTUAL respeta lo cacheado en localStorage", r4.TORNEO_ACTUAL.id === "copaamerica-ficticia");

/* ════════════════════════════════════════════════════════════════
   CASO 5 — ?torneo= con un id que NO existe en TORNEOS_DISPONIBLES:
   no rompe nada, se ignora (cae al mismo criterio que sin parámetro).
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 5: ?torneo= con id inexistente no explota ---");
const r5 = runEscenario("https://example.org/?torneo=no-existe-este-id");
check("No lanzó excepción", r5.thrown === null);
check("TORNEO_ACTUAL sigue siendo un objeto válido (con id real)", !!(r5.TORNEO_ACTUAL && r5.TORNEO_ACTUAL.id));
check("No se cacheó un id inválido en localStorage", r5.cacheado === null);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
