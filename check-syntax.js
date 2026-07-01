// check-syntax.js — corre `node --check` sobre todos los .js del proyecto
// (raíz del repo, sin bajar a node_modules). Portable entre sistemas: no
// depende de un `for` de bash ni de glob de shell, que se comportan
// distinto en Windows -- por eso es un script de Node en vez de una
// línea de shell en package.json.
//
// Uso: node check-syntax.js  (o "npm run check")
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const files = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith(".js"))
  .sort();

let ok = true;
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", path.join(__dirname, file)], { stdio: "pipe" });
    console.log(`✅ ${file}`);
  } catch (err) {
    ok = false;
    console.log(`❌ ${file}`);
    console.log(String(err.stderr || err.message).trim());
  }
}

console.log(`\n=== ${files.length} archivo(s) revisados — ${ok ? "TODO OK ✅" : "HAY ERRORES DE SINTAXIS ❌"} ===`);
process.exit(ok ? 0 : 1);
