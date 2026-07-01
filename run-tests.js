// run-tests.js — corre todos los test_*.js del proyecto (los 9 harnesses
// funcionales con jsdom) y da un resumen final. Portable entre sistemas
// por el mismo motivo que check-syntax.js: un script de Node en vez de
// un `for`/`&&` de shell.
//
// Cada test_*.js ya imprime su propio detalle (✅/❌ por caso) y termina
// con process.exit(0) si todo pasó o process.exit(1) si algo falló --
// este runner simplemente los corre a todos en orden, deja pasar toda
// su salida tal cual (para no perder el detalle si algo se rompe), y al
// final resume cuáles archivos fallaron.
//
// Uso: node run-tests.js  (o "npm test")
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// v1.5.6 — Fase 3 (proceso/CI): además de los test_*.js, corre también
// sim_firestore_rules.js -- no sigue el prefijo test_ por historia
// (nombrado antes de que ese fuera el criterio), pero es un harness
// ejecutable real (36 checks propios, exit code según pass/fail), y el
// propio README.md ya lo agrupa junto con los tests como "harness de
// verificación". Sin esto, correr `npm test` daba una falsa sensación de
// cobertura completa mientras este archivo quedaba corriendo (o no) solo
// si alguien se acordaba de invocarlo a mano.
const files = fs
  .readdirSync(__dirname)
  .filter((f) => (f.startsWith("test_") && f.endsWith(".js")) || f === "sim_firestore_rules.js")
  .sort();

const results = [];
for (const file of files) {
  console.log(`\n─────────────────────────────────────────────────────`);
  console.log(`▶ ${file}`);
  console.log(`─────────────────────────────────────────────────────`);
  const res = spawnSync(process.execPath, [path.join(__dirname, file)], {
    stdio: "inherit",
  });
  results.push({ file, code: res.status });
}

console.log(`\n═════════════════════════════════════════════════════`);
console.log(`RESUMEN (${results.length} archivo(s) de test)`);
console.log(`═════════════════════════════════════════════════════`);
let ok = true;
for (const { file, code } of results) {
  const passed = code === 0;
  if (!passed) ok = false;
  console.log(`${passed ? "✅" : "❌"} ${file}${passed ? "" : ` (exit code ${code})`}`);
}
console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
