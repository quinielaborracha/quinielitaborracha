// Test funcional de v3.6.3 — BUG REPORTADO: 19 de 22 participantes reales
// terminaron con el MISMO código (QLB-2026-0002). Causa raíz: nextCode()
// calculaba el código leyendo DB.nextSeq LOCAL de forma síncrona, y el
// incremento real se persistía en una llamada APARTE (saveData) que podía
// fallar en silencio (permission-denied) si el configGlobal local estaba
// un instante desactualizado -- nextSeq nunca avanzaba en el servidor, así
// que TODOS los que se registraban después volvían a leer el mismo valor.
//
// Fix: rgCreateParticipantConfirmed() (participantes.js) ahora reserva el
// código DENTRO de una transacción de Firestore (fb.runTransaction) que
// lee registro/meta.nextSeq, arma el código, y en la MISMA operación
// atómica escribe participante + privado + nextSeq incrementado (solo ese
// campo, nunca configGlobal). Este test simula el escenario exacto que
// causó el bug real: varios participantes "registrándose al mismo
// tiempo" (todas las llamadas disparadas ANTES de que cualquiera
// resuelva) -- el fake Firestore de abajo encola las transacciones una
// por una (misma garantía de atomicidad/serialización que el servidor
// real), así que si el código de producción tuviera el bug viejo, esto
// fallaría con códigos repetidos.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

function makeFakeFirestoreConcurrente() {
  const participantsStore = {};
  const privadoStore = {};
  const metaStore = { current: null };
  let currentAuthUser = null;
  let _txChain = Promise.resolve(); // serializa transacciones, como el servidor real ante escrituras concurrentes al mismo documento

  return {
    db: {},
    auth: { get currentUser() { return currentAuthUser; } },
    PARTICIPANTS_COL: { __isParticipantsCol: true },
    PRIVADO_COL: { __isPrivadoCol: true },
    REGISTRO_META_DOC: { __isMetaDoc: true },
    doc(col, id) {
      if (col && col.__isPrivadoCol) return { __isPrivadoDoc: true, id };
      return { __isParticipantDoc: true, id };
    },
    serverTimestamp() { return "ST"; },
    onSnapshot() { return () => {}; },
    runTransaction(_db, updateFn) {
      const ops = [];
      const tx = {
        get(ref) {
          if (ref.__isMetaDoc) return Promise.resolve({ exists: () => metaStore.current !== null, data: () => metaStore.current });
          if (ref.__isPrivadoDoc) return Promise.resolve({ exists: () => privadoStore[ref.id] !== undefined, data: () => privadoStore[ref.id] });
          return Promise.resolve({ exists: () => participantsStore[ref.id] !== undefined, data: () => participantsStore[ref.id] });
        },
        set(ref, data, opts) { ops.push({ ref, data, merge: !!(opts && opts.merge) }); },
      };
      const runOnce = () => Promise.resolve().then(() => updateFn(tx)).then((result) => {
        ops.forEach(op => {
          if (op.ref.__isMetaDoc) metaStore.current = op.merge ? { ...(metaStore.current || {}), ...op.data } : op.data;
          else if (op.ref.__isPrivadoDoc) privadoStore[op.ref.id] = op.merge ? { ...(privadoStore[op.ref.id] || {}), ...op.data } : op.data;
          else participantsStore[op.ref.id] = op.merge ? { ...(participantsStore[op.ref.id] || {}), ...op.data } : op.data;
        });
        return result;
      });
      // Encola: esta transacción no arranca (ni siquiera su primer get())
      // hasta que la anterior haya terminado de aplicar sus escrituras --
      // exactamente la garantía de atomicidad/serialización que Firestore
      // real da ante transacciones concurrentes sobre el mismo documento.
      const result = _txChain.then(runOnce);
      _txChain = result.catch(() => {});
      return result;
    },
    __setAuthUser(u) { currentAuthUser = u; },
    __rawParticipants() { return participantsStore; },
  };
}

const html = `<!doctype html><html><body></body></html>`;
const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};

const fakeFb = makeFakeFirestoreConcurrente();
window.__fb = fakeFb;

const utilsCode = fs.readFileSync(path.join(__dirname, "utils.js"), "utf8");
const partCode = fs.readFileSync(path.join(__dirname, "participantes.js"), "utf8");
[utilsCode, partCode].forEach(code => {
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
});

// DB se declara con "let" en participantes.js -- eso no lo cuelga solo de
// window (a diferencia de las function declarations), hace falta un
// puente chico, mismo patrón que el resto de los tests de este archivo.
const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = "window.__test = { DB };";
window.document.body.appendChild(bridgeScript);
window.DB = window.__test.DB;

const W = window;
let ok = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) ok = false; }

/* ════════════════════════════════════════════════════════════════
   CASO 1 — N participantes "se registran al mismo tiempo": ninguna
   llamada espera a la anterior antes de dispararse (mismo patrón que
   el bug real: cada quien cargó la página y hace clic en "Crear" casi
   a la vez). Ninguno debe terminar con un código repetido.
   ════════════════════════════════════════════════════════════════ */
console.log("── 5 registros disparados 'al mismo tiempo' ──");
const N = 5;
const promesas = [];
for (let i = 0; i < N; i++) {
  W.fakeFb = fakeFb; // no-op, solo por claridad
  fakeFb.__setAuthUser({ uid: `anon-${i}`, isAnonymous: true });
  const p = { id: W.uid(), name: `Participante ${i}`, city: "Ciudad", country: "Pais", email: `p${i}@x.com`,
    clave: "111111", ownerUid: `anon-${i}`, estadoQuiniela: "borrador",
    fechaCreacion: Date.now(), fechaActualizacion: Date.now() };
  promesas.push(W.rgCreateParticipantConfirmed(p).then(() => p));
}

Promise.all(promesas).then((participantesCreados) => {
  const codigos = participantesCreados.map(p => p.codigo);
  check(`Los ${N} registros se confirmaron sin errores`, participantesCreados.length === N);
  check("Ningún código quedó vacío", codigos.every(c => !!c));
  check(`Los ${N} códigos son TODOS DISTINTOS (el bug real: 19/22 compartían el mismo)`,
    new Set(codigos).size === N);
  const secuencia = codigos.slice().sort();
  check("Los códigos son consecutivos (QLB-2026-0001..000" + N + ", sin saltos ni repetidos)",
    JSON.stringify(secuencia) === JSON.stringify(
      Array.from({ length: N }, (_, i) => `QLB-2026-000${i + 1}`)
    ));
  check(`DB.nextSeq quedó en ${N + 1} (avanzó una vez por cada registro real, no se perdió ningún incremento)`,
    W.DB.nextSeq === N + 1);
  check("Los 5 documentos llegaron al 'servidor' (no se quedó ninguno solo en memoria local)",
    Object.keys(fakeFb.__rawParticipants()).length === N);

  console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
  process.exit(ok ? 0 : 1);
}).catch(err => {
  console.error("❌ Una o más promesas se rechazaron inesperadamente:", err);
  process.exit(1);
});
