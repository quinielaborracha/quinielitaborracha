// Test funcional del FIX v2.7.4 al bug reportado: "a veces se descarga
// la quiniela en el último paso del registro, pero no queda enviada".
//
// CAUSA RAÍZ (idéntica en espíritu al bug de creación de participante que
// ya arregló la v7.5 — ver rgCreateParticipantConfirmed/test_registro_
// creacion_confirmada.js): el botón "Enviar mi Quiniela y Generar PDF"
// (registro.js, paso 'review') marcaba p.estadoQuiniela='enviada',
// mostraba el toast de éxito, renderizaba como enviada y disparaba la
// descarga del PDF -- todo ANTES de saber si Firestore realmente aceptó
// esa escritura, porque usaba el mismo saveData()/rgPushToFirestore()
// "fire and forget" del autoguardado continuo. Si esa escritura puntual
// fallaba en silencio (red inestable, timeout -- cualquier error que no
// fuera permission-denied no mostraba ni un aviso), la persona se iba
// con su PDF ya descargado creyendo que había enviado, pero el servidor
// (y por lo tanto Admin/Ranking) seguía viéndola en borrador.
//
// Este test ejercita el botón REAL "btn_submit" de punta a punta (click
// real, mismo evento que en el navegador) contra un "Firestore" en
// memoria con 3 escenarios: éxito, falla genérica (red/timeout) y falla
// por permission-denied -- confirmando que en los 2 últimos casos NUNCA
// se marca la quiniela como enviada localmente sin que el servidor lo
// haya confirmado de verdad.
//
// registro.js está envuelto en una única IIFE -- el bridge para acceder
// a sus funciones internas se inserta DENTRO de esa IIFE, justo antes de
// su cierre "})();", mismo patrón que test_login_reclaim.js /
// test_registro_creacion_confirmada.js.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

function makeFakeFirestore() {
  const participantsStore = {};
  let currentAuthUser = null;
  let nextSetDocError = null; // si se setea, el PRÓXIMO setDoc de un doc de participante lo consume y rechaza con este error

  return {
    db: {}, auth: { get currentUser() { return currentAuthUser; } },
    PARTICIPANTS_COL: { __isParticipantsCol: true },
    PRIVADO_COL: { __isPrivadoCol: true },
    REGISTRO_META_DOC: { __isMetaDoc: true },
    REGISTRO_PAPELERA_DOC: { __isPapeleraDoc: true },
    doc(col, id) {
      if (col && col.__isPrivadoCol) return { __isPrivadoDoc: true, id };
      if (col && col.__isMetaDoc) return { __isMetaDoc: true, id };
      return { __isParticipantDoc: true, id };
    },
    serverTimestamp() { return "ST"; },
    setDoc(ref, data) {
      if (ref.__isParticipantDoc && nextSetDocError) {
        const err = nextSetDocError; nextSetDocError = null;
        return Promise.reject(err);
      }
      if (ref.__isParticipantDoc) participantsStore[ref.id] = data;
      return Promise.resolve();
    },
    // El autoguardado normal (flushAutosave -> saveData -> rgPushToFirestore)
    // usa writeBatch -- no es lo que este test pone a prueba, así que
    // siempre "funciona" (simplificado a propósito, igual que en
    // test_login_reclaim.js).
    writeBatch() { return { set() {}, delete() {}, commit() { return Promise.resolve(); } }; },
    getDoc() { return Promise.resolve({ exists: () => false, data: () => null }); },
    deleteDoc() { return Promise.resolve(); },
    onSnapshot() { return () => {}; },
    __setAuthUser(u) { currentAuthUser = u; },
    __rejectNextSetDoc(err) { nextSetDocError = err; },
    __rawParticipants() { return participantsStore; },
  };
}

const html = `<!doctype html><html><body>
  <div id="rg-tabs"><button class="rg-tab on" data-tab="inicio">Inicio</button><button class="rg-tab admin-tab" data-tab="admin">Admin</button></div>
  <div id="rg-content"></div>
  <div id="toast"></div>
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
  DB, render, clearDraft, WIZARD_STEPS,
  GROUP_MATCHES, KO_PHASES, koSlotsOf, computeBracket, computeCompletionFromPreds,
  get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  get DRAFT_PREDS(){ return DRAFT_PREDS; }, set DRAFT_PREDS(v){ DRAFT_PREDS = v; },
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

// ── Arma una quiniela 100% completa (72 grupos + 32 llaves + 8
// especiales) para que getCompletionStatus().complete sea true y el
// checkbox/botón de envío se habiliten -- igual que llenaría alguien
// que de verdad terminó su quiniela. El equipo "a" siempre gana 2-0
// (determinista, no importa el resultado en sí para este test). ──
function buildCompletePreds() {
  const preds = {};
  T.GROUP_MATCHES.forEach(m => { preds[m.id] = { h: 2, a: 0 }; });
  let bracket = T.computeBracket(preds);
  T.KO_PHASES.forEach(ph => {
    const slots = T.koSlotsOf(bracket, ph.key);
    slots.forEach(s => { if (s.a && s.b) preds[s.slot] = { h: 2, a: 0, _a: s.a, _b: s.b }; });
    bracket = T.computeBracket(preds);
  });
  preds.special = {
    goleador: "Jugador de Prueba",
    goles_goleador: 7,
    pais_goleador: T.GROUP_MATCHES[0].a,
    goles_pais: 12,
    pais_goleado: T.GROUP_MATCHES[0].b,
  };
  return preds;
}

const preds0 = buildCompletePreds();
check("Fixture: la quiniela armada para el test queda 100% completa (computeCompletionFromPreds)",
  T.computeCompletionFromPreds(preds0).complete === true);

const reviewIdx = T.WIZARD_STEPS.findIndex(s => s.key === "review");
check("Existe el paso 'review' en WIZARD_STEPS", reviewIdx >= 0);

function seedParticipante(id, uid) {
  const p = {
    id, codigo: `QLB-2026-${id}`, name: `Participante ${id}`, city: "Ciudad", country: "Panamá", countryIso: "pa",
    email: `${id}@example.com`, clave: "123456", ownerUid: uid,
    estadoQuiniela: "borrador", lastStep: 0,
    fechaCreacion: Date.now(), fechaActualizacion: Date.now(), fechaEnvio: null,
  };
  T.DB.participants.push(p);
  const preds = buildCompletePreds();
  T.DB.predictions[id] = JSON.parse(JSON.stringify(preds));
  return p;
}

function enterReviewStepFor(p) {
  T.DRAFT_PID = p.id;
  T.DRAFT_PREDS = JSON.parse(JSON.stringify(T.DB.predictions[p.id]));
  T.WIZ_STEP = reviewIdx;
  T.render();
  const chk = W.document.getElementById("confirm_check");
  chk.checked = true;
  chk.dispatchEvent(new W.Event("change", { bubbles: true }));
}

/* ════════════════════════════════════════════════════════════════
   CASO A — Camino feliz: el servidor confirma la escritura. El botón
   debe verse "Enviando..." mientras se espera, y solo marcarse como
   enviada (localmente y mostrando el banner "Quiniela enviada") tras
   la confirmación real.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── CASO A: el servidor confirma -- se marca enviada de verdad ──");
fakeFb.__setAuthUser({ uid: "anon-a", isAnonymous: true });
const pA = seedParticipante("pA", "anon-a");
enterReviewStepFor(pA);

let btn = W.document.getElementById("btn_submit");
check("CASO A: el botón de enviar existe y está habilitado tras confirmar el checkbox", !!btn && btn.disabled === false);
btn.dispatchEvent(new W.Event("click", { bubbles: true }));

check("CASO A: el botón se deshabilita ni bien se hace click (evita doble envío)", btn.disabled === true);
check("CASO A: el botón muestra 'Enviando...' mientras se espera al servidor", btn.textContent === "Enviando...");
check("CASO A: ANTES de confirmar el servidor, todavía NO quedó marcada como enviada", pA.estadoQuiniela === "borrador");

setImmediate(() => {
  check("CASO A: tras confirmar el servidor, sí quedó marcada como enviada", pA.estadoQuiniela === "enviada");
  check("CASO A: el documento SÍ llegó al servidor con estadoQuiniela='enviada'",
    fakeFb.__rawParticipants()["pA"] && fakeFb.__rawParticipants()["pA"].estadoQuiniela === "enviada");
  // v2.7.4 — Nota: una vez marcada 'enviada', renderInicioInner() saca al
  // participante del wizard y muestra el Dashboard ("Mi Perfil") en su
  // lugar -- este test carga solo participantes.js+registro.js (sin
  // scoring.js ni el resto de app-*.js), así que ese Dashboard no puede
  // pintar sus estadísticas reales (calcPts/getRank/etc. no existen acá);
  // lo relevante para ESTE fix es que la pantalla YA NO ofrece el botón
  // de enviar (no se puede reenviar dos veces), no el contenido visual
  // del Dashboard en sí.
  check("CASO A: la pantalla ya no ofrece el botón de enviar (se salió del paso de envío)",
    !W.document.getElementById("btn_submit"));
  check("CASO A: se mostró el toast de éxito", toastLog.some(t => !t.e && /enviada correctamente/i.test(t.m)));
  runCasoB();
});

/* ════════════════════════════════════════════════════════════════
   CASO B — REPRODUCCIÓN DEL BUG: falla genérica de red/timeout (sin
   'permission-denied'). Antes de este fix, esto pasaba completamente
   desapercibido -- la quiniela igual quedaba "enviada" en pantalla y
   el PDF se descargaba. Ahora debe: reactivar el botón, NO marcar la
   quiniela como enviada, avisar con un toast de error, y NO dejar
   nada escrito en el servidor.
   ════════════════════════════════════════════════════════════════ */
function runCasoB() {
  console.log("\n── CASO B: falla de red genérica -- NO debe quedar 'enviada' en silencio ──");
  toastLog.length = 0;
  fakeFb.__setAuthUser({ uid: "anon-b", isAnonymous: true });
  const pB = seedParticipante("pB", "anon-b");
  enterReviewStepFor(pB);

  fakeFb.__rejectNextSetDoc(new Error("network timeout (simulado)"));
  const btnB = W.document.getElementById("btn_submit");
  btnB.dispatchEvent(new W.Event("click", { bubbles: true }));

  setImmediate(() => {
    const btnB2 = W.document.getElementById("btn_submit");
    check("CASO B: el botón se reactiva tras el error (se puede reintentar)", btnB2.disabled === false);
    check("CASO B: el botón vuelve a su texto original", btnB2.textContent === "📨 Enviar mi Quiniela y Generar PDF");
    check("CASO B: LA QUINIELA NO QUEDÓ MARCADA COMO ENVIADA (el bug reportado -- antes esto sí pasaba)",
      pB.estadoQuiniela === "borrador");
    check("CASO B: nada llegó al servidor con estadoQuiniela='enviada'",
      !fakeFb.__rawParticipants()["pB"] || fakeFb.__rawParticipants()["pB"].estadoQuiniela !== "enviada");
    check("CASO B: se avisó con un toast de error visible", toastLog.some(t => t.e));
    check("CASO B: el mensaje de error invita a revisar la conexión y reintentar (no jerga técnica cruda)",
      toastLog.some(t => t.e && /conexi|intent/i.test(t.m)));
    check("CASO B: NO se mostró el toast de éxito", !toastLog.some(t => !t.e && /enviada correctamente/i.test(t.m)));
    runCasoC();
  });
}

/* ════════════════════════════════════════════════════════════════
   CASO C — Rechazo explícito del servidor (permission-denied, ej.
   reglas de Firestore desactualizadas): mismo comportamiento que B,
   pero con un mensaje que sí menciona el problema de configuración.
   ════════════════════════════════════════════════════════════════ */
function runCasoC() {
  console.log("\n── CASO C: permission-denied -- mensaje distinto, mismo resguardo ──");
  toastLog.length = 0;
  fakeFb.__setAuthUser({ uid: "anon-c", isAnonymous: true });
  const pC = seedParticipante("pC", "anon-c");
  enterReviewStepFor(pC);

  const denied = new Error("permission-denied (simulado)"); denied.code = "permission-denied";
  fakeFb.__rejectNextSetDoc(denied);
  const btnC = W.document.getElementById("btn_submit");
  btnC.dispatchEvent(new W.Event("click", { bubbles: true }));

  setImmediate(() => {
    const btnC2 = W.document.getElementById("btn_submit");
    check("CASO C: el botón se reactiva tras el rechazo", btnC2.disabled === false);
    check("CASO C: LA QUINIELA NO QUEDÓ MARCADA COMO ENVIADA", pC.estadoQuiniela === "borrador");
    check("CASO C: el mensaje de error menciona el permiso/servidor denegado",
      toastLog.some(t => t.e && /permiso|servidor/i.test(t.m)));
    finish();
  });
}

function finish() {
  console.log("\n=== RESULTADO FINAL:", allOk ? "TODOS LOS CASOS PASAN ✅" : "HAY FALLOS ❌", "===");
  process.exit(allOk ? 0 : 1);
}
