// Test funcional de v2.8.1: "Exportar info de participantes" ahora
// también incluye las predicciones de cada quiniela (DB.predictions), y
// "Importar info de participantes" -- para ESE formato -- cambió de
// "sobreescribir campos de quien ya existe" a "agregar como NUEVOS (con
// su quiniela completa) solo a quienes todavía no existen; a quien ya
// existe no lo toca ni lo duplica".
//
// El formato CSV/json-legado (backups viejos) sigue con su comportamiento
// de siempre (parchear a quien ya existe) -- eso ya lo cubre
// test_import_correos_claves.js y no se toca acá.
//
// Carga el index.html real (mismo patrón que test_import_correos_claves.js)
// para ejercitar exportarInfoParticipantes()/importarInfoParticipantes()
// tal cual viven en producción (registro.js, dentro de su IIFE).
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "partidos-grupos.js", "utils.js", "paises.js", "app-static-data.js", "app-state.js", "scoring.js", "totp.js",
  "app-core-data.js", "app-admin-auth.js", "app-live-sync.js", "app-tabs.js",
  "app-eliminatoria-data.js", "app-batallas.js", "app-bracket-render.js",
  "app-bracket-annexc.js", "app-bracket-compute.js", "app-bracket-espn-sync.js", "app-bracket-view.js",
  "app-bracket-espn-live.js", "app-integridad.js", "app-predicciones.js",
  "app-estadisticas.js", "app-admin-tools.js", "app-bootstrap.js", "registro.js"];

let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
html = html.replace(/<script[^>]*src=[^>]*><\/script>/g, "");
html = html.replace(/<script type="module">[\s\S]*?<\/script>/g, "");

// Igual que test_import_correos_claves.js: silencia el ruido conocido de
// jsdom ("navigation to another Document") que dispara la descarga real
// del blob de backup -- comportamiento real e intencional de la app, no
// un error nuestro.
const virtualConsole = new VirtualConsole();
virtualConsole.forwardTo(console, { jsdomErrors: "none" });

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously", virtualConsole });
const { window } = dom;
window.confirm = () => true;
window.alert = () => {};
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
window.Blob = function (parts) { this.parts = parts; };
window.setInterval = () => 0;
// Mock mínimo de Firebase: no probamos reglas de Firestore acá (eso ya lo
// cubre test_import_correos_claves.js) -- solo hace falta que
// importarInfoParticipantes() no corte apenas arranca por "Firebase
// todavía no está listo" (chequea PARTICIPANTS_COL/PRIVADO_COL antes que
// nada). saveData()/rgPushToFirestore() es fire-and-forget con su propio
// catch, así que un mock que simplemente resuelve alcanza.
window.__fb = {
  db: {}, auth: { currentUser: { uid: "admin-uid" } },
  PARTICIPANTS_COL: { __col: "registro_participants" },
  PRIVADO_COL: { __col: "registro_privado" },
  REGISTRO_META_DOC: { __doc: "registro/meta" },
  REGISTRO_PAPELERA_DOC: { __doc: "registro/papelera" },
  doc: (col, id) => ({ __ref: true, col, id }),
  writeBatch: () => ({ set: () => {}, delete: () => {}, commit: () => Promise.resolve() }),
  onSnapshot: () => () => {},
  serverTimestamp: () => "__serverTimestamp__",
};

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

for (const f of FILES) {
  let code = fs.readFileSync(path.join(__dirname, f), "utf8");
  if (f === "registro.js") {
    code = code.replace(/\}\)\(\);\s*$/, `
window.exportarInfoParticipantes = exportarInfoParticipantes;
window.importarInfoParticipantes = importarInfoParticipantes;
})();`);
  }
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `
window.__test = {
  getDB: () => DB,
  getLastToast: () => { const t = document.getElementById("toast"); return t ? t.textContent : null; },
};
`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;
const W = window;

check(`Los ${FILES.length} archivos cargaron sin lanzar excepción`, true);

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — Exportar: el .json ahora incluye "predicciones" por
   participante (además de todo lo que ya exportaba)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── exportarInfoParticipantes(): incluye predicciones ──");

T.getDB().participants = [
  { id: "p1", codigo: "QLB-2026-0001", name: "Juan Perez", email: "juan@x.com", city: "Panamá", country: "Panamá", countryIso: "pa", clave: "111111", estadoQuiniela: "enviada", fechaCreacion: 1000, fechaEnvio: 2000 },
];
T.getDB().predictions = { p1: { 1: { h: 2, a: 0 }, special: { campeon: "Argentina" } } };

let exportedPayload = null;
W.URL.createObjectURL = (blob) => { exportedPayload = JSON.parse(blob.parts[0]); return "blob:fake"; };
let clickedAnchor = false;
const origCreateElement = W.document.createElement.bind(W.document);
W.document.createElement = (tag) => {
  const el = origCreateElement(tag);
  if (tag === "a") { const origClick = el.click.bind(el); el.click = () => { clickedAnchor = true; }; }
  return el;
};

W.exportarInfoParticipantes();

check("Se generó y 'descargó' el archivo (createObjectURL + click)", !!exportedPayload && clickedAnchor);
check("version quedó en '2.9'", exportedPayload.version === "2.9");
const expJuan = exportedPayload.participantes.find(p => p.codigo === "QLB-2026-0001");
check("El participante exportado trae 'predicciones' con su quiniela real",
  !!expJuan && expJuan.predicciones && expJuan.predicciones[1] && expJuan.predicciones[1].h === 2 && expJuan.predicciones.special.campeon === "Argentina");
check("También sigue trayendo el resto de los campos de siempre (correo, ciudad, clave, estado)",
  expJuan.correo === "juan@x.com" && expJuan.ciudad === "Panamá" && expJuan.clave === "111111" && expJuan.estado === "enviada");

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — Importar el mismo formato: participantes que YA existen
   (mismo código) se dejan INTACTOS -- ni un campo se sobreescribe
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Importar: a quien ya existe NO se lo toca ──");

// Mismo código que "Juan Perez" pero con datos DISTINTOS en el archivo --
// si el import sobreescribiera, esto lo detectaría.
const archivoConExistente = {
  tipo: "quinielaborracha_info_participantes",
  version: "2.8.1",
  exportedAt: new Date().toISOString(),
  participantes: [
    { codigo: "QLB-2026-0001", nombre: "Juan Perez (otro)", correo: "otro@x.com", ciudad: "Otra ciudad", pais: "Otro país", paisIso: "xx", clave: "999999", creado: 5000, enviado: 6000, estado: "borrador", avance: 50, predicciones: { 1: { h: 9, a: 9 } } },
  ],
};
window.FileReader = function () {
  this.readAsText = () => { this.onload({ target: { result: JSON.stringify(archivoConExistente) } }); };
};
W.importarInfoParticipantes({});

const juanTrasImport = T.getDB().participants.find(p => p.codigo === "QLB-2026-0001");
check("Juan Perez sigue teniendo SU correo original (no se pisó con 'otro@x.com')", juanTrasImport.email === "juan@x.com");
check("Juan Perez sigue teniendo SU clave original (no se pisó con '999999')", juanTrasImport.clave === "111111");
check("La quiniela de Juan Perez sigue siendo la suya (P1 = 2-0, no 9-9 del archivo)",
  T.getDB().predictions.p1[1].h === 2 && T.getDB().predictions.p1[1].a === 0);
check("NO se creó un participante duplicado con el mismo código",
  T.getDB().participants.filter(p => p.codigo === "QLB-2026-0001").length === 1);
check("El toast avisa que ya existía y no se agregó nada nuevo",
  /ya existen|no se agregó/i.test(T.getLastToast() || ""));

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — Importar: participantes que NO existen se agregan como
   NUEVOS, con su quiniela completa
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Importar: a quien no existe se lo agrega como nuevo, con su quiniela ──");

const archivoMixto = {
  tipo: "quinielaborracha_info_participantes",
  version: "2.8.1",
  exportedAt: new Date().toISOString(),
  participantes: [
    // Ya existe (QLB-2026-0001) -- de nuevo con datos distintos, para reconfirmar que NO se toca en esta segunda pasada
    { codigo: "QLB-2026-0001", nombre: "Juan Perez (otro 2)", correo: "otro2@x.com", clave: "888888", estado: "borrador", predicciones: {} },
    // Nuevo de verdad
    { codigo: "QLB-2026-0002", nombre: "Maria Lopez", correo: "maria@x.com", ciudad: "Ciudad de Panamá", pais: "Panamá", paisIso: "pa", clave: "222222", estado: "enviada", creado: 3000, enviado: 4000, predicciones: { 1: { h: 1, a: 1 }, special: { campeon: "Brasil" } } },
  ],
};
window.FileReader = function () {
  this.readAsText = () => { this.onload({ target: { result: JSON.stringify(archivoMixto) } }); };
};
const countAntes = T.getDB().participants.length;
W.importarInfoParticipantes({});

check("Se agregó exactamente 1 participante nuevo (Maria, no Juan que ya existía)",
  T.getDB().participants.length === countAntes + 1);
const maria = T.getDB().participants.find(p => p.codigo === "QLB-2026-0002");
check("María se creó con sus datos del archivo (nombre, correo, ciudad, clave, estado)",
  !!maria && maria.name === "Maria Lopez" && maria.email === "maria@x.com" && maria.city === "Ciudad de Panamá" && maria.clave === "222222" && maria.estadoQuiniela === "enviada");
check("María se creó con un 'id' interno propio (no reutiliza el de nadie)", !!maria.id && maria.id !== "p1");
check("María quedó SIN dueño (ownerUid null) -- puede reclamarse después con correo+clave", maria.ownerUid === null);
check("Las fechas de creado/enviado del archivo se preservaron", maria.fechaCreacion === 3000 && maria.fechaEnvio === 4000);
check("La quiniela COMPLETA de María se importó junto con ella (P1 = 1-1, campeón Brasil)",
  T.getDB().predictions[maria.id] && T.getDB().predictions[maria.id][1].h === 1 && T.getDB().predictions[maria.id].special.campeon === "Brasil");

const juanOtraVez = T.getDB().participants.find(p => p.codigo === "QLB-2026-0001");
check("Juan Perez SIGUE intacto (no se tocó ni en esta segunda importación)", juanOtraVez.email === "juan@x.com" && juanOtraVez.clave === "111111");

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — Reimportar el MISMO archivo del backup original: idempotente,
   no duplica a nadie
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Reimportar el mismo archivo no crea duplicados ──");
window.FileReader = function () {
  this.readAsText = () => { this.onload({ target: { result: JSON.stringify(exportedPayload) } }); };
};
const countAntesReimport = T.getDB().participants.length;
W.importarInfoParticipantes({});
check("Reimportar el propio backup exportado (mismo código QLB-2026-0001) no agrega ni duplica a nadie",
  T.getDB().participants.length === countAntesReimport);

console.log(`\n${allOk ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(allOk ? 0 : 1);
