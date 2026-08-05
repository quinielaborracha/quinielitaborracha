// Test funcional del Sprint 14 (hoja de ruta comercial, mismo día que
// el Sprint 13): "🗑️ Eliminar" en "Mis quinielas"
// (_tenantDeleteFully(), app-admin-tenants.js) -- borra un tenant AJENO
// a la sesión activa de punta a punta: sus colecciones de tamaño
// variable (registro_participants/registro_privado, enumeradas con
// getDocs()), sus documentos fijos conocidos, y al final el propio
// documento tenants/{tenantId}. El bypass real de la regla nueva
// (`allow delete`, scoped a adminEmail) ya está probado en
// sim_firestore_rules.js (bloque "ELIMINAR QUINIELA", Sprint 14).
//
// Mock simple: capturamos qué se manda a borrar -- no re-simulamos
// Firestore entero.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = `<!doctype html><html><body>
  <div id="torneo-content"></div>
  <div id="toast"></div>
</body></html>`;
const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};
window.isAdmin = () => true;
window.confirm = () => true; // ambas confirmaciones aceptadas -- ver CASO 3 para el caso "cancela"

let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

const FAKE_TENANTS = [
  { id: "quinielitaborracha", data: { adminEmail: "quinielaborracha@gmail.com", torneoId: "" } },
  { id: "euro-2028", data: { adminEmail: "quinielaborracha@gmail.com", torneoId: "euro-ficticio" } },
];
let deletedRefs = [];
let batchCommitted = false;
let getDocsCalls = [];

window.__fb = {
  db: { __db: true },
  TENANT_ID: "quinielitaborracha",
  auth: { currentUser: { email: "quinielaborracha@gmail.com" } },
  collection: (db, ...segments) => ({ __col: segments.join("/") }),
  doc: (db, ...segments) => ({ __ref: true, path: segments.join("/") }),
  where: (field, op, value) => ({ __where: { field, op, value } }),
  query: (col, whereClause) => ({ __col: col, __where: whereClause }),
  onSnapshot: (q, onNext) => {
    const filtro = q.__where.__where;
    const matching = FAKE_TENANTS.filter(t => t.data[filtro.field] === filtro.value);
    onNext({ forEach: (fn) => matching.forEach(t => fn({ id: t.id, data: () => t.data })) });
    return () => {};
  },
  getDocs: (colRef) => {
    getDocsCalls.push(colRef.__col);
    // Simula 1 participante ficticio dentro de euro-2028 -- confirma
    // que el borrado enumera y limpia también las colecciones de
    // tamaño variable, no solo los documentos fijos conocidos.
    if (colRef.__col === "tenants/euro-2028/registro_participants") {
      return Promise.resolve({ forEach: (fn) => fn({ ref: { __ref: true, path: "tenants/euro-2028/registro_participants/p1" } }) });
    }
    if (colRef.__col === "tenants/euro-2028/registro_privado") {
      return Promise.resolve({ forEach: (fn) => fn({ ref: { __ref: true, path: "tenants/euro-2028/registro_privado/p1" } }) });
    }
    return Promise.resolve({ forEach: () => {} });
  },
  writeBatch: () => ({
    delete: (ref) => deletedRefs.push(ref.path),
    commit: () => { batchCommitted = true; return Promise.resolve(); },
  }),
};

for (const f of ["utils.js", "torneo-mundial2026.js", "torneo-copaamerica.js", "torneo-euro.js", "torneo-resolver.js", "paises.js", "participantes.js", "app-admin-tenants.js"]) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

/* ════════════════════════════════════════════════════════════════
   CASO 1 — el tenant ACTUAL no tiene botón de eliminar (guard: no te
   podés borrar la quiniela en la que estás parado).
   ════════════════════════════════════════════════════════════════ */
console.log("--- CASO 1: el tenant actual no se puede eliminar ---");
window.renderMisQuinielasCard();
const listHtml = window.document.getElementById("mis_quinielas_list").innerHTML;
check("'euro-2028' (no es el actual) SÍ tiene botón de eliminar", listHtml.includes('data-delete-tenant="euro-2028"'));
check("'quinielitaborracha' (el actual) NO tiene botón de eliminar", !listHtml.includes('data-delete-tenant="quinielitaborracha"'));

/* ════════════════════════════════════════════════════════════════
   CASO 2 — click en "Eliminar" de euro-2028: enumera y borra sus 2
   colecciones + los 5 documentos fijos + el tenant en sí (8 en total).
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 2: eliminar 'euro-2028' de punta a punta ---");
const btn = window.document.querySelector('[data-delete-tenant="euro-2028"]');
btn.dispatchEvent(new window.Event("click", { bubbles: true }));

setTimeout(() => {
  check("Se enumeraron ambas colecciones de tamaño variable (participants + privado) de euro-2028", getDocsCalls.length === 2);
  check("El batch se confirmó (commit)", batchCommitted);
  check("Se borró el participante ficticio encontrado", deletedRefs.includes("tenants/euro-2028/registro_participants/p1"));
  check("Se borró su documento privado", deletedRefs.includes("tenants/euro-2028/registro_privado/p1"));
  check("Se borró registro/meta", deletedRefs.includes("tenants/euro-2028/registro/meta"));
  check("Se borró registro/admin2fa", deletedRefs.includes("tenants/euro-2028/registro/admin2fa"));
  check("Se borró registro/papelera", deletedRefs.includes("tenants/euro-2028/registro/papelera"));
  check("Se borró quiniela/estado", deletedRefs.includes("tenants/euro-2028/quiniela/estado"));
  check("Se borró quiniela/estado-test", deletedRefs.includes("tenants/euro-2028/quiniela/estado-test"));
  check("Se borró el documento tenants/euro-2028 en sí, AL FINAL", deletedRefs[deletedRefs.length - 1] === "tenants/euro-2028");
  check("En total, 8 borrados (2 de las colecciones + 5 fijos + el tenant)", deletedRefs.length === 8);
  check("NUNCA se tocó nada de 'quinielitaborracha' (el tenant actual)", !deletedRefs.some(p => p.startsWith("tenants/quinielitaborracha")));

  console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
  process.exit(ok ? 0 : 1);
}, 50);
