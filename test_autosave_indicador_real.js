// Test funcional del fix v3.8.2: "Guardado ✓" del autoguardado de
// predicciones (flushAutosave, wiz_save_indicator) era optimista -- se
// mostraba apenas terminaba el guardado LOCAL (localStorage), sin esperar
// la confirmación real de Firestore. Si esa escritura fallaba en
// silencio (mala señal, timeout, permisos), el participante veía
// "Guardado ✓" creyendo que su predicción había llegado al servidor
// cuando en realidad solo estaba en su dispositivo.
//
// Mismo espíritu que test_envio_quiniela_confirmado.js (que ya arregló
// este mismo problema para el botón "Enviar mi Quiniela"), pero acá para
// el autoguardado continuo mientras se llena el formulario.
//
// registro.js está envuelto en una única IIFE -- el bridge para acceder
// a sus funciones internas se inserta DENTRO de esa IIFE, justo antes de
// su cierre "})();", mismo patrón que test_login_reclaim.js /
// test_envio_quiniela_confirmado.js.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

function makeFakeFirestore() {
  let currentAuthUser = { uid: "anon-1", isAnonymous: true };
  let nextCommit = () => Promise.resolve(); // lo reemplaza cada caso de prueba

  return {
    db: {}, auth: { get currentUser() { return currentAuthUser; } },
    PARTICIPANTS_COL: { __isParticipantsCol: true },
    PRIVADO_COL: { __isPrivadoCol: true },
    REGISTRO_META_DOC: { __isMetaDoc: true },
    doc(col, id) {
      if (col && col.__isPrivadoCol) return { __isPrivadoDoc: true, id };
      if (col && col.__isMetaDoc) return { __isMetaDoc: true, id };
      return { __isParticipantDoc: true, id };
    },
    serverTimestamp() { return "ST"; },
    writeBatch() {
      return { set() {}, delete() {}, commit() { return nextCommit(); } };
    },
    onSnapshot() { return () => {}; },
    __setAuthUser(u) { currentAuthUser = u; },
    __setNextCommit(fn) { nextCommit = fn; },
  };
}

const html = `<!doctype html><html><body>
  <div id="rg-tabs"><button class="rg-tab on" data-tab="inicio">Inicio</button><button class="rg-tab admin-tab" data-tab="admin">Admin</button></div>
  <div id="rg-content"></div>
  <div id="toast"></div>
  <div id="wiz_save_indicator" class="save-indicator">&nbsp;</div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
const toastLog = [];
window.toast = (m, e) => { toastLog.push({ m, e: !!e }); console.log(`[toast]${e ? " ERR" : ""}: ${m}`); };
window.isAdmin = () => false;
window.setInterval = () => 0;
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
window.Blob = function () {};
window.confirm = () => true;
window.alert = () => {};

const fakeFb = makeFakeFirestore();
window.__fb = fakeFb;

const codeUtils = fs.readFileSync(path.join(__dirname, "utils.js"), "utf8");
const utilsScript = window.document.createElement("script");
utilsScript.textContent = codeUtils;
window.document.body.appendChild(utilsScript);

const codeTorneo = fs.readFileSync(path.join(__dirname, "torneo-mundial2026.js"), "utf8");
const code1 = codeTorneo + ";\n" + fs.readFileSync(path.join(__dirname, "participantes.js"), "utf8");
let code2 = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");

const closeIdx = code2.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = {
  DB, flushAutosave,
  get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  get DRAFT_PREDS(){ return DRAFT_PREDS; }, set DRAFT_PREDS(v){ DRAFT_PREDS = v; },
  get DRAFT_PERSONAL(){ return DRAFT_PERSONAL; }, set DRAFT_PERSONAL(v){ DRAFT_PERSONAL = v; },
  get WIZ_STEP(){ return WIZ_STEP; }, set WIZ_STEP(v){ WIZ_STEP = v; },
};
`;
code2 = code2.slice(0, closeIdx) + bridge + code2.slice(closeIdx);

const script = window.document.createElement("script");
script.textContent = code1 + "\n;\n" + code2;
window.document.body.appendChild(script);

if (!window.__test) { console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;
const W = window;
let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function indicatorText() { return W.document.getElementById("wiz_save_indicator").textContent; }

function seedParticipante(id) {
  const p = {
    id, codigo: `QLB-2026-${id}`, name: `Participante ${id}`, city: "Ciudad", country: "Panamá", countryIso: "pa",
    email: `${id}@example.com`, clave: "123456", ownerUid: "anon-1",
    estadoQuiniela: "borrador", lastStep: 0,
    fechaCreacion: Date.now(), fechaActualizacion: Date.now(), fechaEnvio: null,
  };
  T.DB.participants.push(p);
  T.DB.predictions[id] = {};
  return p;
}

function primeDraft(p) {
  T.DRAFT_PID = p.id;
  T.DRAFT_PREDS = {};
  T.DRAFT_PERSONAL = {};
  T.WIZ_STEP = 0;
}

async function run() {
  /* ══════════════════════════════════════════════════════════════
     CASO A — Camino feliz, pero con la escritura DEMORADA: el
     indicador debe pasar por "Guardando…" y recién mostrar
     "Guardado ✓" DESPUÉS de que el commit() se resuelve, no antes.
     ══════════════════════════════════════════════════════════════ */
  console.log("\n── CASO A: guardado exitoso pero demorado ──");
  const pA = seedParticipante("pA");
  primeDraft(pA);
  let resolveCommit;
  fakeFb.__setNextCommit(() => new Promise(res => { resolveCommit = res; }));

  T.flushAutosave();
  check("CASO A: apenas se llama flushAutosave(), el indicador dice 'Guardando…' (no 'Guardado ✓' todavía)",
    indicatorText() === "Guardando…");

  await sleep(30);
  check("CASO A: mientras el commit no resolvió, el indicador SIGUE en 'Guardando…'",
    indicatorText() === "Guardando…");

  resolveCommit();
  await sleep(0); await sleep(0); // deja correr los microtasks del .then()
  check("CASO A: recién cuando el commit se resuelve, el indicador pasa a 'Guardado ✓'",
    indicatorText() === "Guardado ✓");

  /* ══════════════════════════════════════════════════════════════
     CASO B — Falla genérica (red/timeout, sin permission-denied): el
     indicador NO debe mostrar "Guardado ✓" -- debe avisar que quedó
     sin confirmar.
     ══════════════════════════════════════════════════════════════ */
  console.log("\n── CASO B: falla de red -- NO debe decir 'Guardado ✓' ──");
  const pB = seedParticipante("pB");
  primeDraft(pB);
  fakeFb.__setNextCommit(() => Promise.reject(new Error("network timeout (simulado)")));

  T.flushAutosave();
  check("CASO B: apenas se llama flushAutosave(), dice 'Guardando…'", indicatorText() === "Guardando…");
  await sleep(0); await sleep(0); await sleep(0);
  check("CASO B: tras la falla, el indicador NO dice 'Guardado ✓'", indicatorText() !== "Guardado ✓");
  check("CASO B: el indicador avisa que no se confirmó en el servidor", /sin conexión|no.*confirm/i.test(indicatorText()));

  /* ══════════════════════════════════════════════════════════════
     CASO C — Guard de respuestas fuera de orden: dos autoguardados
     seguidos (edición rápida). El primero (viejo) tarda más que el
     segundo (nuevo) en resolver. Cuando el viejo por fin resuelve, NO
     debe pisar el indicador que ya puso el más nuevo.
     ══════════════════════════════════════════════════════════════ */
  console.log("\n── CASO C: una respuesta vieja no debe pisar al indicador de la más nueva ──");
  const pC = seedParticipante("pC");
  primeDraft(pC);

  let resolveOld;
  fakeFb.__setNextCommit(() => new Promise(res => { resolveOld = res; })); // llamada #1 (vieja, lenta)
  T.flushAutosave();
  await sleep(5);
  fakeFb.__setNextCommit(() => Promise.resolve()); // llamada #2 (nueva, rápida)
  T.flushAutosave();
  await sleep(0); await sleep(0);
  check("CASO C: la llamada #2 (nueva) ya confirmó -- el indicador dice 'Guardado ✓'",
    indicatorText() === "Guardado ✓");

  resolveOld(); // la llamada #1 (vieja) recién ahora "llega"
  await sleep(0); await sleep(0);
  check("CASO C: cuando la respuesta VIEJA llega tarde, NO pisa el 'Guardado ✓' ya confirmado",
    indicatorText() === "Guardado ✓");

  console.log("\n=== RESULTADO FINAL:", allOk ? "TODOS LOS CASOS PASAN ✅" : "HAY FALLOS ❌", "===");
  process.exit(allOk ? 0 : 1);
}

run();
