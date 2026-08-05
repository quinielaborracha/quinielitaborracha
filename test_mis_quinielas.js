// Test funcional del Sprint 13 (hoja de ruta comercial, un día después
// de los Sprints 8-12): "📋 Mis quinielas" (renderMisQuinielasCard(),
// app-admin-tenants.js) -- lista, vía query()+where()+onSnapshot(), los
// tenants donde el admin logueado ES el adminEmail. Necesitó la regla
// nueva `allow read` en firestore.rules (antes era `if false` sin
// excepción) -- el bypass real de esa regla (cada admin ve solo los
// suyos) ya está probado en sim_firestore_rules.js (bloque "MIS
// QUINIELAS", Sprint 13).
//
// Mock simple: capturamos el filtro que se le pasa a where() y
// devolvemos nosotros la lista de docs -- no re-simulamos Firestore
// entero, eso ya lo hace sim_firestore_rules.js.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = `<!doctype html><html><body>
  <div id="quinielas-content"></div>
  <div id="toast"></div>
</body></html>`;
const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};
window.isAdmin = () => true;

let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

let whereFilterCaptured = null;
let onSnapshotCallback = null;
const FAKE_TENANTS = [
  { id: "quinielitaborracha", data: { adminEmail: "quinielaborracha@gmail.com", torneoId: "", createdAt: { seconds: 1000, toDate: () => new Date(1000000) } } },
  { id: "euro-2028", data: { adminEmail: "quinielaborracha@gmail.com", torneoId: "euro-ficticio", createdAt: { seconds: 5000, toDate: () => new Date(5000000) } } },
];

window.__fb = {
  db: { __db: true },
  TENANT_ID: "quinielitaborracha", // simula estar navegando DENTRO del tenant real
  auth: { currentUser: { uid: "admin-uid", email: "quinielaborracha@gmail.com" } },
  collection: (db, name) => ({ __col: name }),
  where: (field, op, value) => { whereFilterCaptured = { field, op, value }; return { __where: true }; },
  query: (col, whereClause) => ({ __col: col, __where: whereClause }),
  onSnapshot: (q, onNext, onError) => {
    onSnapshotCallback = onNext;
    // Simula el servidor ya filtrando por adminEmail (mismo criterio
    // que probó sim_firestore_rules.js) -- acá alcanza con devolver
    // los que coinciden con el filtro capturado.
    const matching = FAKE_TENANTS.filter(t => t.data[whereFilterCaptured.field] === whereFilterCaptured.value);
    onNext({ forEach: (fn) => matching.forEach(t => fn({ id: t.id, data: () => t.data })) });
    return () => {};
  },
};

for (const f of ["utils.js", "torneo-mundial2026.js", "torneo-copaamerica.js", "torneo-euro.js", "torneo-resolver.js", "paises.js", "participantes.js", "app-admin-tenants.js"]) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

/* ════════════════════════════════════════════════════════════════
   CASO 1 — renderMisQuinielasCard() consulta con el email del admin
   logueado, no un literal fijo.
   ════════════════════════════════════════════════════════════════ */
console.log("--- CASO 1: la consulta filtra por el email del admin actual ---");
window.renderMisQuinielasCard();
check("Se agregó la tarjeta '📋 Mis quinielas'", !!window.document.getElementById("mis_quinielas_card"));
check("where() se llamó con adminEmail == el email de la sesión actual",
  whereFilterCaptured && whereFilterCaptured.field === "adminEmail" && whereFilterCaptured.op === "==" && whereFilterCaptured.value === "quinielaborracha@gmail.com");

/* ════════════════════════════════════════════════════════════════
   CASO 2 — la lista muestra ambos tenants, marca cuál es el actual, y
   solo pone link "Entrar" en los que NO son el actual.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 2: contenido de la lista ---");
const listHtml = window.document.getElementById("mis_quinielas_list").innerHTML;
check("Aparece 'quinielitaborracha' en la lista", listHtml.includes("quinielitaborracha"));
check("Aparece 'euro-2028' en la lista", listHtml.includes("euro-2028"));
check("'quinielitaborracha' (el actual, ver fb.TENANT_ID) tiene el badge 'actual'",
  /quinielitaborracha[\s\S]{0,80}badge-muted[\s\S]{0,20}actual/.test(listHtml));
check("'euro-2028' tiene un link para entrar con ?tenant=euro-2028&torneo=euro-ficticio",
  // innerHTML serializa el "&" del atributo como "&amp;" -- comportamiento
  // normal del DOM al leer de vuelta, no un bug del código real.
  listHtml.includes('href="?tenant=euro-2028&amp;torneo=euro-ficticio"'));
check("El tenant actual NO tiene link de 'Entrar' (ya estás ahí)",
  !new RegExp('href="\\?tenant=quinielitaborracha').test(listHtml));
check("Muestra el nombre real de la plantilla (Euro ficticio), no solo el id crudo",
  listHtml.includes("Euro (datos ficticios"));

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
