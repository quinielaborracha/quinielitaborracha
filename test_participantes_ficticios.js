// Test funcional del Sprint 8 (hoja de ruta comercial) — "Participantes
// ficticios": rgCreateFakeParticipants()/rgDeleteFakeParticipants()
// (participantes.js), más el wiring nuevo en el panel Admin (registro.js).
//
// Mock simple de Firestore: solo necesitamos capturar QUÉ se manda a
// crear/borrar, no re-simular las reglas reales de Firestore -- el
// bypass de isAdmin() en el `create` de registro_participants/
// registro_privado (lo que hace posible este feature sin reglas nuevas)
// ya está probado en test_participantes_security.js y en
// sim_firestore_rules.js ("restaurar desde papelera", mismo camino).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = `<!doctype html><html><body></body></html>`;
const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

let setOps = [];
let deleteOps = [];
const REGISTRO_META_DOC = { __doc: "registro/meta" };
window.__fb = {
  db: {}, auth: { currentUser: { uid: "admin-uid", email: "quinielaborracha@gmail.com" } },
  PARTICIPANTS_COL: { __col: "registro_participants" },
  PRIVADO_COL: { __col: "registro_privado" },
  REGISTRO_META_DOC,
  REGISTRO_PAPELERA_DOC: { __doc: "registro/papelera" },
  doc: (col, id) => ({ __ref: true, col, id }),
  writeBatch: () => {
    const ops = [];
    return {
      set: (ref, data) => ops.push({ type: "set", ref, data }),
      delete: (ref) => ops.push({ type: "delete", ref }),
      commit: () => {
        ops.forEach(op => {
          if (op.type === "set") setOps.push(op);
          else deleteOps.push(op);
        });
        return Promise.resolve();
      }
    };
  },
  setDoc: () => Promise.resolve(),
  onSnapshot: () => () => {},
  serverTimestamp: () => "__serverTimestamp__",
};

// torneo-mundial2026.js hace falta para que _rgFakePredictions() tenga
// TORNEO_ACTUAL.groupMatches de dónde generar marcadores random -- mismo
// criterio que test_copa_america_e2e.js: cargar el archivo de datos real
// del torneo, no un stub.
for (const f of ["utils.js", "torneo-mundial2026.js", "paises.js", "participantes.js"]) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

const bridge = window.document.createElement("script");
bridge.textContent = `
window.rgCreateFakeParticipants = rgCreateFakeParticipants;
window.rgDeleteFakeParticipants = rgDeleteFakeParticipants;
window.__getDB = () => DB;
window.__setLatestParticipants = (arr) => { _rgLatestParticipants = arr; };
`;
window.document.body.appendChild(bridge);

/* ════════════════════════════════════════════════════════════════
   CASO 1 — rgCreateFakeParticipants(3): forma del documento.
   ════════════════════════════════════════════════════════════════ */
console.log("--- CASO 1: rgCreateFakeParticipants(3) ---");
window.rgCreateFakeParticipants(3).then(() => {
  const publicSets = setOps.filter(op => op.ref.col.__col === "registro_participants");
  const privadoSets = setOps.filter(op => op.ref.col.__col === "registro_privado");

  check("Se crearon 3 documentos públicos", publicSets.length === 3);
  check("Se crearon 3 documentos privados (mismos ids)", privadoSets.length === 3);
  check("Todos tienen esFicticio:true", publicSets.every(op => op.data.esFicticio === true));
  check("Todos tienen código con prefijo FAKE- (no consume la numeración real QLB-2026-)",
    publicSets.every(op => /^FAKE-\d{4}$/.test(op.data.codigo)));
  check("Los 3 códigos son distintos entre sí",
    new Set(publicSets.map(op => op.data.codigo)).size === 3);
  check("ownerUid es sintético (prefijo fake-, nunca un UID anónimo real)",
    privadoSets.every(op => typeof op.data.ownerUid === "string" && op.data.ownerUid.startsWith("fake-")));
  check("estadoQuiniela queda 'enviada' (para que aparezcan completos en Ranking/Estadísticas)",
    publicSets.every(op => op.data.estadoQuiniela === "enviada"));
  check("Cada uno trae predicciones de fase de grupos ya cargadas (72 partidos del Mundial 2026)",
    publicSets.every(op => Object.keys(op.data.predictions).length === 72));
  check("Las predicciones son marcadores h/a numéricos válidos (0-3)",
    publicSets.every(op => Object.values(op.data.predictions).every(p => Number.isInteger(p.h) && Number.isInteger(p.a))));

  runCaso2(publicSets);
}).catch(err => { check("rgCreateFakeParticipants(3) no debería fallar: " + err.message, false); runCaso2([]); });

/* ════════════════════════════════════════════════════════════════
   CASO 2 — Llamar de nuevo sigue la numeración sin pisar códigos ya
   usados (yaFicticios se calcula sobre DB.participants).
   ════════════════════════════════════════════════════════════════ */
function runCaso2(primerosTres){
  console.log("\n--- CASO 2: numeración no colisiona entre llamadas ---");
  // Simula lo que en producción hace el listener en tiempo real: refleja
  // los 3 ya creados en DB.participants antes de la segunda tanda.
  window.__getDB().participants = primerosTres.map(op => ({ id: op.ref.id, ...op.data }));
  setOps = [];

  window.rgCreateFakeParticipants(2).then(() => {
    const nuevos = setOps.filter(op => op.ref.col.__col === "registro_participants");
    check("Se crearon 2 participantes más", nuevos.length === 2);
    check("Los códigos nuevos siguen después de FAKE-0003 (no repiten 0001/0002/0003)",
      nuevos.every(op => Number(op.data.codigo.split("-")[1]) > 3));

    runCaso3(primerosTres.concat(nuevos));
  }).catch(err => { check("La segunda tanda no debería fallar: " + err.message, false); runCaso3(primerosTres); });
}

/* ════════════════════════════════════════════════════════════════
   CASO 3 — rgDeleteFakeParticipants(): borra SOLO los marcados
   esFicticio, nunca a un participante real.
   ════════════════════════════════════════════════════════════════ */
function runCaso3(todosLosFicticios){
  console.log("\n--- CASO 3: rgDeleteFakeParticipants() no toca participantes reales ---");
  const real = { id: "p_real_1", esFicticio: undefined, name: "Participante Real" };
  window.__setLatestParticipants([real, ...todosLosFicticios.map(op => ({ id: op.ref.id, ...op.data }))]);
  deleteOps = [];

  window.rgDeleteFakeParticipants().then((cantidadBorrada) => {
    check(`Se borraron los ${todosLosFicticios.length} ficticios (y solo esos)`, cantidadBorrada === todosLosFicticios.length);
    const idsBorrados = new Set(deleteOps.map(op => op.ref.id));
    check("El participante real NO está entre los borrados", !idsBorrados.has("p_real_1"));
    check("Se borró tanto el documento público como el privado de cada ficticio",
      deleteOps.length === todosLosFicticios.length * 2);

    finish();
  }).catch(err => { check("rgDeleteFakeParticipants() no debería fallar: " + err.message, false); finish(); });
}

function finish(){
  /* ════════════════════════════════════════════════════════════════
     CASO 4 — el panel Admin (registro.js) tiene la tarjeta nueva
     wireada con sus dos botones.
     ════════════════════════════════════════════════════════════════ */
  console.log("\n--- CASO 4: tarjeta '🎭 Participantes ficticios' en registro.js ---");
  const regSrc = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
  check("Existe la tarjeta '🎭 Participantes ficticios'", regSrc.includes("🎭 Participantes ficticios"));
  check("Botón 'Crear ficticios' con su id", regSrc.includes('id="a_fake_crear"'));
  check("Botón 'Borrar todos los ficticios' con su id", regSrc.includes('id="a_fake_borrar"'));
  check("El botón de crear llama a rgCreateFakeParticipants(", regSrc.includes("rgCreateFakeParticipants(n)"));
  check("El botón de borrar llama a rgDeleteFakeParticipants()", regSrc.includes("rgDeleteFakeParticipants()"));

  console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
  process.exit(ok ? 0 : 1);
}
