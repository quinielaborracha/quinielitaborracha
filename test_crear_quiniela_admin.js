// Test funcional del Sprint 12 (hoja de ruta comercial, Fase 3 --
// selector de plantilla en runtime, última pieza): "🏗️ Crear nueva
// quiniela" (app-admin-tenants.js), el formulario que junta
// TORNEOS_DISPONIBLES (Sprint 9), el TENANT_ID en runtime (Sprint 10) y
// el tercer template (Sprint 11) en un flujo real para el admin.
//
// Mock simple de Firestore (mismo criterio que test_borrar_datos_
// participantes.js/test_participantes_ficticios.js): solo necesitamos
// capturar QUÉ se manda a crear y en qué ORDEN -- el bypass real de
// isAdmin()/la regla de auto-servicio de tenants ya están probados en
// sim_firestore_rules.js (bloque "AUTO-SERVICIO DE TENANTS", Sprint 10).
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
window.isAdmin = () => true; // stub -- ver nota abajo, no se carga app-admin-auth.js completo
// setTimeout inmediato (sin esperar los 500ms reales del redirect) --
// mismo criterio que otros tests override window.setInterval.
window.setTimeout = (fn) => { fn(); return 0; };
let redirectedTo = null;

let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

let setDocCalls = [];
window.__fb = {
  db: { __db: true },
  auth: { currentUser: { uid: "admin-uid", email: "quinielaborracha@gmail.com" } },
  // participantes.js arranca rgWireFirestoreSync() apenas carga -- estos
  // 4 campos + onSnapshot alcanzan para que "se conecte" en el primer
  // intento y no quede reintentando con setTimeout (que en este test
  // corre inmediato, ver más abajo -- un reintento indefinido sería una
  // recursión infinita real, no solo un detalle cosmético).
  PARTICIPANTS_COL: { __col: "registro_participants" },
  PRIVADO_COL: { __col: "registro_privado" },
  REGISTRO_META_DOC: { __doc: "registro/meta" },
  REGISTRO_PAPELERA_DOC: { __doc: "registro/papelera" },
  // ADMIN2FA_DOC simula el 2FA del tenant DESDE el que se está creando
  // la quiniela nueva (donde la sesión actual ya pasó el 2FA para
  // llegar a este formulario) -- app-admin-tenants.js lo copia tal
  // cual al tenant nuevo (2026-08-05, pedido real del usuario).
  ADMIN2FA_DOC: { __doc: "registro/admin2fa" },
  onSnapshot: () => () => {},
  doc: (dbOrCol, ...segments) => ({ __ref: true, path: segments.join("/") }),
  getDoc: (ref) => {
    if (ref === window.__fb.ADMIN2FA_DOC) {
      return Promise.resolve({
        exists: () => true,
        data: () => ({ secret: "SECRETO-2FA-DEL-TENANT-ACTUAL", trustedDevices: { "hash-de-este-navegador": { expiresAt: Date.now() + 1000000 } } }),
      });
    }
    return Promise.resolve({ exists: () => false, data: () => null });
  },
  setDoc: (ref, data) => {
    setDocCalls.push({ path: ref.path, data });
    return Promise.resolve();
  },
  serverTimestamp: () => "__serverTimestamp__",
};

// Nota sobre el stub de isAdmin(): app-admin-auth.js (donde vive la
// versión real) trae consigo Firebase Auth/2FA/localStorage de sesión
// -- mockearlo todo para probar 6 líneas de UI de este archivo sería
// más frágil que útil (mismo criterio ya usado en
// test_borrar_datos_participantes.js). renderTorneoConfig()
// (app-admin-tools.js) SÍ se carga real más abajo -- confirma que el
// stub conversa bien con el resto del panel real.
for (const f of ["utils.js", "torneo-mundial2026.js", "torneo-copaamerica.js", "torneo-euro.js", "torneo-resolver.js", "paises.js", "participantes.js", "app-admin-tenants.js"]) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

// jsdom no implementa navegación real (asignar location.href tira "Not
// implemented" y queda en un no-op silencioso) -- app-admin-tenants.js
// separa el redirect en su propia función (_tenantRedirectTo) solo para
// que este test pueda espiarla en vez de pelear contra esa limitación.
// Se pisa DESPUÉS de cargar el archivo real (que la declara), no antes.
window._tenantRedirectTo = (url) => { redirectedTo = url; };

/* ════════════════════════════════════════════════════════════════
   CASO 1 — renderTenantsCard() arma el formulario con las 3 plantillas
   disponibles (Mundial 2026, Copa América ficticia, Euro ficticio).
   ════════════════════════════════════════════════════════════════ */
console.log("--- CASO 1: renderTenantsCard() arma el formulario ---");
window.renderTenantsCard();
const card = window.document.getElementById("tenants_card");
check("La tarjeta '🏗️ Crear nueva quiniela' se agregó a #torneo-content", !!card);
const select = window.document.getElementById("a_tenant_torneo");
const opciones = Array.from(select.options).map(o => o.value);
check("El selector tiene las 3 plantillas registradas", opciones.length === 3);
check("Incluye 'mundial2026'", opciones.includes("mundial2026"));
check("Incluye 'copaamerica-ficticia'", opciones.includes("copaamerica-ficticia"));
check("Incluye 'euro-ficticio'", opciones.includes("euro-ficticio"));

/* ════════════════════════════════════════════════════════════════
   CASO 2 — completar el formulario y crear la quiniela: 3 escrituras
   SECUENCIALES (tenant -> meta -> admin2fa, nunca en paralelo, ver el
   comentario en app-admin-tenants.js sobre por qué el orden importa
   para que isAdmin() de cada paso siguiente resuelva bien). El 2FA
   nuevo se copia TAL CUAL del tenant actual (mismo secreto, mismos
   navegadores de confianza) -- corrección del 2026-08-05: antes cada
   tenant nuevo quedaba SIN 2FA hasta configurarlo a mano en Firebase
   Console, y "recordar este navegador" nunca se heredaba entre tenants.
   ════════════════════════════════════════════════════════════════ */
console.log("\n--- CASO 2: crear una quiniela nueva ---");
window.document.getElementById("a_tenant_id").value = "Mi Quiniela Champions";
window.document.getElementById("a_tenant_torneo").value = "euro-ficticio";
window.document.getElementById("a_tenant_crear").dispatchEvent(new window.Event("click"));

// El click handler encadena 2 fb.setDoc() + un toast + un redirect, TODO
// vía promesas (microtasks) -- aunque window.setTimeout de arriba corre
// su callback "en el momento", eso no adelanta las promesas ya
// encadenadas. Se usa el setTimeout REAL de Node (no el de `window`,
// solo pisado para el `window` de jsdom) para dejar que la cola de
// microtasks drene antes de revisar qué se escribió.
setTimeout(() => {
  check("Se hicieron exactamente 3 escrituras (tenant + meta + admin2fa)", setDocCalls.length === 3);
  const tenantWrite = setDocCalls[0];
  const metaWrite = setDocCalls[1];
  const admin2faWrite = setDocCalls[2];

  check("El nombre se convirtió en un slug válido (sin espacios ni mayúsculas)",
    tenantWrite && tenantWrite.path === "tenants/mi-quiniela-champions");
  check("El tenant se crea CON adminEmail = el email real de la sesión actual",
    tenantWrite && tenantWrite.data.adminEmail === "quinielaborracha@gmail.com");
  check("El tenant trae torneoId con la plantilla elegida (Euro ficticio)",
    tenantWrite && tenantWrite.data.torneoId === "euro-ficticio");
  check("El tenant trae createdAt", tenantWrite && tenantWrite.data.createdAt === "__serverTimestamp__");

  check("El segundo write es registro/meta DEL MISMO tenant (nunca en paralelo con el primero)",
    metaWrite && metaWrite.path === "tenants/mi-quiniela-champions/registro/meta");
  check("meta.nextSeq arranca en 1 (quiniela nueva, sin participantes)",
    metaWrite && metaWrite.data.nextSeq === 1);
  check("meta.configGlobal.torneoId coincide con la plantilla elegida",
    metaWrite && metaWrite.data.configGlobal.torneoId === "euro-ficticio");
  check("meta.configGlobal trae el resto de RG_DEFAULT_CONFIG (registroAbierto:true, etc.)",
    metaWrite && metaWrite.data.configGlobal.registroAbierto === true);

  check("El tercer write es registro/admin2fa DEL MISMO tenant nuevo",
    admin2faWrite && admin2faWrite.path === "tenants/mi-quiniela-champions/registro/admin2fa");
  check("Copia el MISMO secreto TOTP que ya tenía el tenant actual (mismo authenticator, sin reconfigurar nada)",
    admin2faWrite && admin2faWrite.data.secret === "SECRETO-2FA-DEL-TENANT-ACTUAL");
  check("Copia también los navegadores YA marcados como de confianza (este dispositivo no vuelve a pedir código)",
    admin2faWrite && !!admin2faWrite.data.trustedDevices["hash-de-este-navegador"]);

  check("Redirige a la quiniela nueva con ?tenant= y ?torneo= en la URL",
    !!redirectedTo && redirectedTo.includes("?tenant=mi-quiniela-champions") && redirectedTo.includes("&torneo=euro-ficticio"));

  console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
  process.exit(ok ? 0 : 1);
}, 50);
