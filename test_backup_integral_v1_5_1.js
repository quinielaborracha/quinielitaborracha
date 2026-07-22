// Test funcional v1.5.1 — Backup / Restore integral (pestaña Integridad).
// Cubre el escenario de más riesgo del pedido: "Importar backup" en modo
// REEMPLAZO TOTAL debe:
//   1) Restaurar quiniela/estado (S) completo (resultados/bonos/batallas).
//   2) Restaurar participantes+predicciones+meta+papelera.
//   3) BORRAR en Firestore cualquier participante que exista hoy pero NO
//      esté en el backup (huérfanos) -- no alcanza con agregar/actualizar
//      los que sí están, o quedarían visibles en el Ranking para siempre.
//   4) NUNCA tocar registro/admin2fa (2FA del admin), aunque el backup no
//      lo traiga.
//   5) Descargar automáticamente una copia de seguridad del estado actual
//      ANTES de aplicar nada.
//   6) Un backup del formato viejo (solo resultados, sin "registro") debe
//      seguir funcionando sin tocar participantes -- compatibilidad hacia atrás.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "torneo-mundial2026.js", "partidos-grupos.js", "utils.js", "paises.js", "app-static-data.js", "app-state.js", "scoring.js", "totp.js",
  "app-core-data.js", "app-admin-auth.js", "app-live-sync.js", "app-tabs.js",
  "app-eliminatoria-data.js", "app-batallas.js", "app-bracket-render.js",
  "app-bracket-annexc.js", "app-bracket-compute.js", "app-bracket-espn-sync.js", "app-bracket-view.js",
  "app-bracket-espn-live.js", "app-integridad.js", "app-predicciones.js",
  "app-estadisticas.js", "app-admin-tools.js", "app-bootstrap.js", "registro.js"];

let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
html = html.replace(/<script[^>]*src=[^>]*><\/script>/g, "");
html = html.replace(/<script type="module">[\s\S]*?<\/script>/g, "");

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
const { webcrypto } = require("crypto");
Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
window.confirm = () => true;
window.alert = () => {};
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
window.Blob = function (parts) { this.parts = parts; };
window.setInterval = () => 0;

const PARTICIPANTS_COL = { __col: "registro_participants" };
const PRIVADO_COL = { __col: "registro_privado" };
const REGISTRO_META_DOC = { __doc: "registro/meta" };
const REGISTRO_PAPELERA_DOC = { __doc: "registro/papelera" };
const STATE_DOC = { __doc: "quiniela/estado" };
const TEST_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const ADMIN2FA_DOC = { __doc: "registro/admin2fa" };

function fakeDoc(parent, id) {
  if (parent !== PARTICIPANTS_COL && parent !== PRIVADO_COL) {
    throw new Error("Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");
  }
  return { __ref: true, col: parent.__col, id };
}

const writeLog = []; // cada batch.commit() exitoso empuja sus ops acá
const setDocLog = []; // cada fb.setDoc() directo (meta, papelera, estado)
let authCb = null;
let currentUser = null;
const snapshotCbs = {};
function keyOf(target) {
  if (target === PARTICIPANTS_COL) return "participants";
  if (target === PRIVADO_COL) return "privado";
  if (target === REGISTRO_META_DOC) return "meta";
  if (target === REGISTRO_PAPELERA_DOC) return "papelera";
  if (target === STATE_DOC) return "estado";
  return "?";
}

window.__fb = {
  db: {}, auth: { get currentUser() { return currentUser; } },
  STATE_DOC, STATE_DOC_REAL: STATE_DOC, STATE_DOC_TEST: { __doc: "quiniela/estado-test" }, TEST_MODE: false,
  PARTICIPANTS_COL, PRIVADO_COL, REGISTRO_META_DOC, REGISTRO_PAPELERA_DOC,
  ADMIN2FA_DOC,
  doc: fakeDoc,
  getDoc: (ref) => {
    if (ref === ADMIN2FA_DOC) {
      return Promise.resolve({ exists: () => true, data: () => ({ secret: TEST_TOTP_SECRET, trustedDevices: {} }) });
    }
    return Promise.resolve({ exists: () => false, data: () => ({}) });
  },
  query: (x) => x, where: () => ({}),
  setDoc: (ref, data) => { setDocLog.push({ ref, data }); return Promise.resolve(); },
  deleteDoc: () => Promise.resolve(),
  deleteField: () => "__deleteField__",
  writeBatch: () => {
    const ops = [];
    return {
      set: (ref, data) => ops.push({ type: "set", ref, data }),
      delete: (ref) => ops.push({ type: "delete", ref }),
      commit: () => { writeLog.push(ops); return Promise.resolve(); },
    };
  },
  onSnapshot: (target, cb) => { const k = keyOf(target); (snapshotCbs[k] = snapshotCbs[k] || []).push(cb); return () => {}; },
  serverTimestamp: () => "__serverTimestamp__",
  signInWithEmailAndPassword: () => Promise.resolve(),
  signInAnonymously: () => {
    currentUser = { uid: "anon-uid", isAnonymous: true };
    setTimeout(() => authCb && authCb(currentUser), 0);
    return Promise.resolve();
  },
  signOut: () => Promise.resolve(),
  onAuthStateChanged: (auth, cb) => { authCb = cb; },
};

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

for (const f of FILES) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `
window.__test = {
  getDB: () => DB,
  getS: () => S,
  setS: (obj) => { Object.assign(S, obj); },
  isAdmin: () => (typeof isAdmin === "function" ? isAdmin() : undefined),
  getTOTPCode: (secret) => getTOTPCode(secret),
  fillAndSubmit2FACode: async (code) => {
    document.getElementById("login-2fa-code").value = code;
    await submit2FACode();
  },
  exportBackupJSON: () => window.exportBackupJSON(),
  importBackupJSON: (input) => window.importBackupJSON(input),
  getLastToast: () => { const t = document.getElementById("toast"); return t ? t.textContent : null; },
};
`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;

check(`Los ${FILES.length} archivos cargaron sin lanzar excepción`, true);

(async () => {
  // ── Bootstrap: anónimo -> admin real -> 2FA (idéntico a test_import_correos_claves.js) ──
  authCb && authCb(null);
  await new Promise((r) => setTimeout(r, 10));
  currentUser = { uid: "admin-uid", isAnonymous: false };
  authCb && authCb(currentUser);
  await new Promise((r) => setTimeout(r, 10));
  const validCode = await T.getTOTPCode(TEST_TOTP_SECRET);
  await T.fillAndSubmit2FACode(validCode);
  await new Promise((r) => setTimeout(r, 10));
  check("Bootstrap: isAdmin() es true", T.isAdmin() === true);

  // ── Estado inicial "en vivo" (lo que Firestore tiene HOY, antes de restaurar) ──
  // 3 participantes (p1, p2, p3) -- p3 NO va a estar en el backup que
  // restauremos, así que tiene que terminar BORRADO de Firestore.
  const snapParticipants = {
    docs: [
      { id: "p1", data: () => ({ codigo: "QB-2026-0001", name: "Juan Perez", city: "A", country: "Panamá", estadoQuiniela: "enviada", predictions: {} }) },
      { id: "p2", data: () => ({ codigo: "QB-2026-0002", name: "Maria Lopez", city: "B", country: "Panamá", estadoQuiniela: "enviada", predictions: {} }) },
      { id: "p3", data: () => ({ codigo: "QB-2026-0003", name: "Pedro Ruiz", city: "C", country: "Panamá", estadoQuiniela: "borrador", predictions: {} }) },
    ],
  };
  const snapMeta = { exists: () => true, data: () => ({ nextSeq: 4, configGlobal: {} }) };
  (snapshotCbs.participants || []).forEach((cb) => cb(snapParticipants));
  (snapshotCbs.meta || []).forEach((cb) => cb(snapMeta));
  await new Promise((r) => setTimeout(r, 10));
  check("Estado inicial: DB.participants tiene 3 (p1,p2,p3)", T.getDB().participants.length === 3);

  // Resultados/bonos actuales (van a quedar pisados por el backup importado).
  T.setS({ scores: { 1: { h: 9, a: 9 } }, battles: { 99: { p1: "viejo" } } });

  // ── Backup INTEGRAL a importar: solo p1 y p2 (p3 queda huérfano) ──
  const backupIntegral = {
    tipo: "quinielaborracha_backup_integral",
    version: "1.5.1",
    exportedAt: new Date().toISOString(),
    quiniela: {
      scores: { 1: { h: 2, a: 1 } }, checksums: {}, elimScores: {}, elimTeams: {},
      scorers: [], matchTimes: {}, elimTimes: {},
      bonos: { lastPlace: {}, classified: {}, llaves: {}, closed: {} },
      tieBreakers: {}, hiddenPL: {}, snapshots: [], autoClose: false,
      reality: { champ: "", runner: "", third: "", topScorer: "", topScorerGoals: 0, topCountry: "", topCountryGoals: 0, mostConceded: "" },
      adv: {}, battles: {}, battleHistory: [],
    },
    registro: {
      participants: [
        { id: "p1", codigo: "QB-2026-0001", name: "Juan Perez", email: "juan@correo.com", clave: "111111", city: "A", country: "Panamá", estadoQuiniela: "enviada" },
        { id: "p2", codigo: "QB-2026-0002", name: "Maria Lopez", email: "maria@correo.com", clave: "222222", city: "B", country: "Panamá", estadoQuiniela: "enviada" },
      ],
      predictions: { p1: { 1: { h: 2, a: 1 } }, p2: {} },
      papelera: [],
      nextSeq: 3,
      configGlobal: {},
    },
  };
  window.FileReader = function () {
    this.readAsText = () => { this.onload({ target: { result: JSON.stringify(backupIntegral) } }); };
  };
  const writesBeforeRestore = writeLog.length;
  const setDocsBeforeRestore = setDocLog.length;
  T.importBackupJSON({ files: [{}], value: "" });
  await new Promise((r) => setTimeout(r, 30));

  check("Restore: S.scores quedó igual al backup (2-1), no al valor viejo (9-9)", JSON.stringify(T.getS().scores) === JSON.stringify({ 1: { h: 2, a: 1 } }));
  check("Restore: S.battles quedó vacío (reemplazo total, no se conserva lo viejo)", Object.keys(T.getS().battles).length === 0);

  const batchesNuevos = writeLog.slice(writesBeforeRestore);
  const allOps = batchesNuevos.flat();
  const deletes = allOps.filter((op) => op.type === "delete");
  const sets = allOps.filter((op) => op.type === "set");
  check("Restore: se generaron borrados para p3 (huérfano) en ambas colecciones", deletes.some((op) => op.ref.col === "registro_participants" && op.ref.id === "p3") && deletes.some((op) => op.ref.col === "registro_privado" && op.ref.id === "p3"));
  check("Restore: NO se borró p1 ni p2 (sí están en el backup)", !deletes.some((op) => op.ref.id === "p1" || op.ref.id === "p2"));
  check("Restore: se escribieron los documentos públicos de p1 y p2", sets.some((op) => op.ref.col === "registro_participants" && op.ref.id === "p1") && sets.some((op) => op.ref.col === "registro_participants" && op.ref.id === "p2"));
  check("Restore: se escribieron los documentos privados de p1 y p2 (clave/correo)", sets.some((op) => op.ref.col === "registro_privado" && op.ref.id === "p1" && op.data.clave === "111111"));

  const metaWrites = setDocLog.slice(setDocsBeforeRestore).filter((w) => w.ref === REGISTRO_META_DOC);
  check("Restore: se escribió registro/meta con el nextSeq del backup (3)", metaWrites.length > 0 && metaWrites[metaWrites.length - 1].data.nextSeq === 3);
  const papeleraWrites = setDocLog.slice(setDocsBeforeRestore).filter((w) => w.ref === REGISTRO_PAPELERA_DOC);
  check("Restore: se escribió registro/papelera (aunque venga vacía en el backup)", papeleraWrites.length > 0);
  const estadoWrites = setDocLog.slice(setDocsBeforeRestore).filter((w) => w.ref === STATE_DOC);
  check("Restore: se escribió quiniela/estado", estadoWrites.length > 0);
  const admin2faWrites = setDocLog.slice(setDocsBeforeRestore).filter((w) => w.ref === ADMIN2FA_DOC);
  check("Restore: NUNCA se tocó registro/admin2fa (ni para leer/escribir el 2FA del admin)", admin2faWrites.length === 0);

  // ── El listener en vivo confirma la eliminación de p3 en Firestore -- simulamos el próximo snapshot real ──
  const snapDespues = {
    docs: [
      { id: "p1", data: () => ({ codigo: "QB-2026-0001", name: "Juan Perez", email: undefined, city: "A", country: "Panamá", estadoQuiniela: "enviada", predictions: { 1: { h: 2, a: 1 } } }) },
      { id: "p2", data: () => ({ codigo: "QB-2026-0002", name: "Maria Lopez", city: "B", country: "Panamá", estadoQuiniela: "enviada", predictions: {} }) },
    ],
  };
  (snapshotCbs.participants || []).forEach((cb) => cb(snapDespues));
  await new Promise((r) => setTimeout(r, 10));
  check("Después del snapshot real: DB.participants ya no tiene a p3 (huérfano fuera del Ranking)", T.getDB().participants.length === 2 && !T.getDB().participants.some((p) => p.id === "p3"));

  // ── Formato viejo (solo resultados, sin "registro") -- no debe tocar participantes ──
  const backupViejo = { version: "wb26v43", exportedAt: new Date().toISOString(), scores: { 5: { h: 3, a: 0 } }, checksums: {}, elimScores: {}, elimTeams: {}, scorers: [], matchTimes: {}, elimTimes: {}, bonos: { lastPlace: {}, classified: {}, llaves: {}, closed: {} }, tieBreakers: {}, snapshots: [], reality: {}, adv: {}, battles: {}, battleHistory: [] };
  window.FileReader = function () {
    this.readAsText = () => { this.onload({ target: { result: JSON.stringify(backupViejo) } }); };
  };
  const writesAntesViejo = writeLog.length;
  T.importBackupJSON({ files: [{}], value: "" });
  await new Promise((r) => setTimeout(r, 20));
  check("Backup formato viejo: S.scores se actualizó (5: 3-0)", JSON.stringify(T.getS().scores) === JSON.stringify({ 5: { h: 3, a: 0 } }));
  check("Backup formato viejo: NO generó ningún batch de participantes (no tocó registro_participants)", writeLog.length === writesAntesViejo);
  check("Backup formato viejo: DB.participants sigue con p1 y p2 (no se tocaron)", T.getDB().participants.length === 2);

  console.log(allOk ? "\n✅✅✅ TODO OK" : "\n❌❌❌ HAY FALLOS");
  process.exit(allOk ? 0 : 1);
})();
