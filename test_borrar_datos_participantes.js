// Test funcional de v3.1.4:
//  1) El botón que antes decía "Borrar todos los datos de prueba" ahora
//     dice "Restaurar configuración original" (mismo comportamiento de
//     siempre: borra participantes+predicciones+papelera Y resetea
//     configGlobal a los defaults).
//  2) Botón nuevo "Borrar datos de participantes": mismo borrado de
//     participantes+predicciones+papelera, pero SIN tocar configGlobal
//     -- verificado contra rgDeleteAllParticipants() (participantes.js),
//     comparándolo con rgResetAll() (que sí lo resetea).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = `<!doctype html><html><body></body></html>`;
const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

// Mock simple: solo necesitamos capturar QUÉ se manda a borrar/escribir,
// no simular las reglas reales de Firestore (eso ya lo cubre
// test_participantes_security.js para rgResetAll()).
let deletedRefs = [];
let metaPayloadSent = null;
const REGISTRO_META_DOC = { __doc: "registro/meta" };
window.__fb = {
  db: {}, auth: { currentUser: { uid: "admin-uid" } },
  PARTICIPANTS_COL: { __col: "registro_participants" },
  PRIVADO_COL: { __col: "registro_privado" },
  REGISTRO_META_DOC,
  REGISTRO_PAPELERA_DOC: { __doc: "registro/papelera" },
  doc: (col, id) => ({ __ref: true, col, id }),
  writeBatch: () => {
    const ops = [];
    return { delete: (ref) => ops.push(ref), commit: () => { deletedRefs.push(...ops); return Promise.resolve(); } };
  },
  setDoc: (ref, data) => { if (ref === REGISTRO_META_DOC) metaPayloadSent = data; return Promise.resolve(); },
  onSnapshot: () => () => {},
  serverTimestamp: () => "__serverTimestamp__",
};

for (const f of ["utils.js", "paises.js", "participantes.js"]) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

// Bridge: exponer lo que hace falta para el test (mismo patrón que
// test_participantes_security.js).
const bridge = window.document.createElement("script");
bridge.textContent = `
window.rgResetAll = rgResetAll;
window.rgDeleteAllParticipants = rgDeleteAllParticipants;
window.__setLatestParticipants = (arr) => { _rgLatestParticipants = arr; };
window.__getDB = () => DB;
`;
window.document.body.appendChild(bridge);

const CONFIG_NO_DEFAULT = { modoConsultaHabilitado:false, registroAbierto:false, loginPorNombreHabilitado:false, fechaCierre:'2026-08-01', horaCierre:'12:00', usarMiQuinielaComoInicio:true, fasesActivas:{grupos:false,r16:false}, reglas:{avanzado:{campeon:false}} };

/* ════════════════════════════════════════════════════════════════
   CASO 1 — rgDeleteAllParticipants(): borra participantes/predicciones/
   papelera, pero configGlobal se manda TAL CUAL estaba (no se resetea).
   ════════════════════════════════════════════════════════════════ */
console.log("--- CASO 1: rgDeleteAllParticipants() NO toca configGlobal ---");
window.__getDB().configGlobal = { ...CONFIG_NO_DEFAULT };
window.__setLatestParticipants([{ id: "p1" }, { id: "p2" }]);
deletedRefs = []; metaPayloadSent = null;

window.rgDeleteAllParticipants().then(() => {
  check("Se mandó a borrar el documento público Y privado de cada participante (2 x 2 = 4)", deletedRefs.length === 4);
  check("Entre lo borrado están los 2 documentos públicos", deletedRefs.filter(r=>r.col.__col==="registro_participants").length===2);
  check("Entre lo borrado están los 2 documentos privados", deletedRefs.filter(r=>r.col.__col==="registro_privado").length===2);
  check("meta.nextSeq se resetea a 1", metaPayloadSent && metaPayloadSent.nextSeq === 1);
  check("meta.configGlobal se manda TAL CUAL estaba (no se resetea a los defaults)",
    metaPayloadSent && JSON.stringify(metaPayloadSent.configGlobal) === JSON.stringify(CONFIG_NO_DEFAULT));

  runCaso2();
}).catch(err=>{ check("rgDeleteAllParticipants() no debería fallar: "+err.message, false); runCaso2(); });

/* ════════════════════════════════════════════════════════════════
   CASO 2 — rgResetAll(): a diferencia de rgDeleteAllParticipants(),
   ESTE sí resetea configGlobal a los defaults (RG_DEFAULT_CONFIG) --
   comportamiento de siempre, ahora bajo el botón "Restaurar
   configuración original".
   ════════════════════════════════════════════════════════════════ */
function runCaso2(){
  console.log("\n--- CASO 2: rgResetAll() SÍ resetea configGlobal (comportamiento de siempre) ---");
  window.__getDB().configGlobal = { ...CONFIG_NO_DEFAULT };
  window.__setLatestParticipants([{ id: "p3" }]);
  deletedRefs = []; metaPayloadSent = null;

  window.rgResetAll().then(() => {
    check("meta.nextSeq se resetea a 1", metaPayloadSent && metaPayloadSent.nextSeq === 1);
    check("meta.configGlobal YA NO es el que estaba configurado (se pisó con los defaults)",
      metaPayloadSent && JSON.stringify(metaPayloadSent.configGlobal) !== JSON.stringify(CONFIG_NO_DEFAULT));
    check("meta.configGlobal quedó con registroAbierto:true (default), no false (lo que estaba antes)",
      metaPayloadSent && metaPayloadSent.configGlobal.registroAbierto === true);

    finish();
  }).catch(err=>{ check("rgResetAll() no debería fallar: "+err.message, false); finish(); });
}

function finish(){
  /* ════════════════════════════════════════════════════════════════
     CASO 3 — el HTML del panel Admin (registro.js) muestra los textos
     correctos de los 2 botones.
     ════════════════════════════════════════════════════════════════ */
  console.log("\n--- CASO 3: textos de los botones en registro.js ---");
  const regSrc = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
  check("Ya NO existe el texto viejo 'Borrar todos los datos de prueba'", !regSrc.includes("Borrar todos los datos de prueba"));
  check("Existe el botón 'Restaurar configuración original'", regSrc.includes("Restaurar configuración original"));
  check("Existe el botón nuevo 'Borrar datos de participantes'", regSrc.includes("Borrar datos de participantes"));
  check("El botón nuevo tiene su propio id (a_del_participantes), distinto de a_reset", regSrc.includes('id="a_del_participantes"'));

  console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
  process.exit(ok ? 0 : 1);
}
