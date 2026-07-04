// Test funcional de v3.1.2 — BUG REPORTADO (urgente): al importar el
// .json de "info de participantes" (exportarInfoParticipantes(), el que
// trae la quiniela completa de cada persona), varios participantes NO
// se cargaban -- solo el primero del archivo aparecía, y encima con
// resultados vacíos al editarlo.
//
// CAUSA RAÍZ confirmada con el archivo real que reportó el usuario:
// nextCode() (participantes.js) genera el código de un participante
// nuevo leyendo DB.nextSeq LOCAL -- si 2+ personas se registran casi al
// mismo tiempo desde dispositivos distintos, cada una puede leer el
// mismo valor (todavía no le llegó el commit de la otra) y terminar con
// el MISMO "código" (ej. 4 personas reales distintas, las 4 con
// "QLB-2026-0001"). importarInfoParticipantesComoNuevos() identificaba
// a cada persona SOLO por su código -- con códigos duplicados, la
// 2da/3ra/4ta del archivo quedaban marcadas como "la 1ra, repetida" y se
// descartaban en silencio.
//
// FIX: la identidad ahora se arma con el CORREO normalizado (único de
// verdad por persona real) y solo cae al código si no hay correo. Y a
// cualquier código que ya esté en uso (por alguien existente, o por
// otra persona de este mismo lote) se le asigna uno nuevo de verdad con
// nextCode(), para que la tabla del admin no vuelva a mostrar 2 personas
// con el mismo código.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","partidos-grupos.js","utils.js","app-static-data.js","app-state.js","scoring.js","totp.js",
  "app-core-data.js","app-admin-auth.js","app-live-sync.js","app-tabs.js",
  "app-eliminatoria-data.js","app-batallas.js","app-bracket-render.js",
  "app-bracket-annexc.js","app-bracket-compute.js","app-bracket-espn-sync.js","app-bracket-view.js",
  "app-bracket-espn-live.js","app-integridad.js","app-predicciones.js",
  "app-estadisticas.js","app-admin-tools.js","app-bootstrap.js"
];

const html = `<!doctype html><html><body>
  <div id="rg-tabs"><button class="rg-tab on" data-tab="inicio">Inicio</button></div>
  <div id="rg-content"></div>
  <div id="torneo-content"></div>
  <div id="toast"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="teams-editor-body"></div><div id="teams-modal" style="display:none"></div>
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
window.isAdmin = () => true;
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
// Mock mínimo: solo necesitamos que la validación temprana de
// importarInfoParticipantes() pase (fb.PARTICIPANTS_COL/PRIVADO_COL
// truthy) -- este test verifica el estado en memoria (DB.participants/
// DB.predictions), no la escritura real a Firestore.
window.__fb = {
  PARTICIPANTS_COL: {}, PRIVADO_COL: {},
  auth: { currentUser: null },
  onSnapshot: () => () => {},
};
window.requestAnimationFrame = () => 0;
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
window.Blob = function (parts) { this.parts = parts; };

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

for (const file of FILES_IN_ORDER){
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try{ window.document.body.appendChild(script); }
  catch(e){ console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`); ok = false; }
}

let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = {
  DB, importarInfoParticipantes,
};
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

const T = window.__test;
const W = window;

// Mismo mock de FileReader que usa test_import_correos_claves.js.
function importarArchivo(payloadObj){
  const jsonText = JSON.stringify(payloadObj);
  window.FileReader = function(){ this.readAsText = () => { this.onload({ target: { result: jsonText } }); }; };
  T.importarInfoParticipantes({});
}

/* ════════════════════════════════════════════════════════════════
   SETUP — reproduce el archivo real reportado: 4 participantes con
   CORREOS distintos pero el MISMO código "QLB-2026-0001" (la carrera
   de nextCode() al registrarse casi simultáneo), cada uno con SU
   PROPIA quiniela (predicciones distintas y verificables).
   ════════════════════════════════════════════════════════════════ */
T.DB.participants = [];
T.DB.predictions = {};
T.DB.nextSeq = 5;

const archivo = {
  tipo: "quinielaborracha_info_participantes",
  version: "2.8.1",
  exportedAt: new Date(0).toISOString(),
  participantes: [
    { codigo:"QLB-2026-0001", nombre:"Bethzabe Marquez", correo:"bethzabemarquez@gmail.com", ciudad:"Medellín", pais:"Colombia", paisIso:"co", clave:"", creado:1, enviado:2, estado:"enviada", avance:11,
      predicciones: { r16_1:{h:1,a:0,_a:"Paraguay",_b:"Francia"} } },
    { codigo:"QLB-2026-0001", nombre:"Giorgiana Portillo", correo:"giorgiportillo@hotmail.com", ciudad:"Caracas", pais:"Venezuela", paisIso:"ve", clave:"", creado:3, enviado:4, estado:"enviada", avance:18,
      predicciones: { r16_1:{h:0,a:4,_a:"Paraguay",_b:"Francia"} } },
    { codigo:"QLB-2026-0001", nombre:"Rox Polanco", correo:"soyroxa33@gmail.com", ciudad:"Panama", pais:"Panamá", paisIso:"pa", clave:"", creado:5, enviado:6, estado:"enviada", avance:18,
      predicciones: { r16_1:{h:1,a:2,_a:"Paraguay",_b:"Francia"} } },
    { codigo:"QLB-2026-0001", nombre:"Tato Guevara", correo:"Agustingb23@gmail.com", ciudad:"Panamá", pais:"Panamá", paisIso:"pa", clave:"230985", creado:7, enviado:8, estado:"enviada", avance:18,
      predicciones: { r16_1:{h:1,a:3,_a:"Paraguay",_b:"Francia"} } },
  ]
};

console.log("── Primera importación (los 4 son nuevos) ──");
importarArchivo(archivo);

check("Se agregaron los 4 participantes (antes: solo 1 de 4)", T.DB.participants.length === 4);

const porCorreo = {};
T.DB.participants.forEach(p=>{ porCorreo[(p.email||'').toLowerCase()] = p; });
["bethzabemarquez@gmail.com","giorgiportillo@hotmail.com","soyroxa33@gmail.com","agustingb23@gmail.com"].forEach(correo=>{
  check(`Existe un participante con el correo ${correo}`, !!porCorreo[correo]);
});

check("Los 4 códigos quedaron ÚNICOS (no los 4 con 'QLB-2026-0001')",
  new Set(T.DB.participants.map(p=>p.codigo)).size === 4);

// Cada quien con SUS PROPIAS predicciones (no vacías, no mezcladas con otro).
const beth = porCorreo["bethzabemarquez@gmail.com"];
const giorgi = porCorreo["giorgiportillo@hotmail.com"];
const rox = porCorreo["soyroxa33@gmail.com"];
const tato = porCorreo["agustingb23@gmail.com"];
check("Bethzabe: predicciones NO vacías y son las suyas (1:0)", T.DB.predictions[beth.id]?.r16_1?.h===1 && T.DB.predictions[beth.id]?.r16_1?.a===0);
check("Giorgiana: predicciones NO vacías y son las suyas (0:4)", T.DB.predictions[giorgi.id]?.r16_1?.h===0 && T.DB.predictions[giorgi.id]?.r16_1?.a===4);
check("Rox: predicciones NO vacías y son las suyas (1:2)", T.DB.predictions[rox.id]?.r16_1?.h===1 && T.DB.predictions[rox.id]?.r16_1?.a===2);
check("Tato: predicciones NO vacías y son las suyas (1:3)", T.DB.predictions[tato.id]?.r16_1?.h===1 && T.DB.predictions[tato.id]?.r16_1?.a===3);

/* ════════════════════════════════════════════════════════════════
   Reimportar el MISMO archivo: las 4 personas ya existen (por correo)
   -- no debe duplicarse a nadie.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Reimportar el mismo archivo: no debe duplicar a nadie ──");
importarArchivo(archivo);
check("Sigue habiendo exactamente 4 participantes (no se duplicaron)", T.DB.participants.length === 4);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
