// Test funcional de v3.4 — Historial de cambios de resultados (Admin →
// 🔒 Integridad, ver _clRecordChanges() en app-live-sync.js y
// renderChangeLogCard() en app-integridad.js).
//
// Solo para consulta del propio admin: cada vez que save() detecta que
// S.scores/S.elimScores cambió respecto a la última foto conocida,
// agrega una entrada a S.changeLog con el resultado antes/después. Este
// test ejercita el flujo real: cargar un resultado por primera vez,
// corregirlo después, un partido sin tocar (no debe aparecer), el tope
// de entradas, y que un cambio remoto (applyRemoteState) no genere una
// entrada fantasma la próxima vez que este mismo admin guarda algo.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","partidos-grupos.js","utils.js", "paises.js","app-static-data.js","app-state.js","scoring.js","totp.js",
  "app-core-data.js","app-admin-auth.js","app-live-sync.js","app-tabs.js",
  "app-eliminatoria-data.js","app-batallas.js","app-bracket-render.js",
  "app-bracket-annexc.js","app-bracket-compute.js","app-bracket-espn-sync.js","app-bracket-view.js",
  "app-bracket-espn-live.js","app-integridad.js","app-predicciones.js",
  "app-estadisticas.js","app-admin-tools.js","app-bootstrap.js"
];

const html = `<!doctype html><html><body>
  <div id="root"></div><div id="toast"></div><div id="integ-banner"></div>
  <img id="logo-img"><span id="admin-indicator"></span>
  <span id="hstat"></span><span id="hdr-master-badge"></span><span id="hdr-today"></span>
  <table><tbody id="rb"></tbody></table>
  <div id="rbasic"></div><div id="radv"></div><div id="relim"></div><div id="rlast"></div>
  <div id="rg-tabs"></div><div id="rg-content"></div><div id="admin-content"></div>
  <div id="integ-results"></div><div id="integ-changelog"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};
window.isAdmin = () => true;
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
window.__fb = null;
window.requestAnimationFrame = () => 0;

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

for (const file of FILES_IN_ORDER){
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try{ window.document.body.appendChild(script); }
  catch(e){ console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`); ok = false; }
}

// S se declara con "let" en app-state.js -- eso NO lo cuelga de window
// (a diferencia de las function declarations como save()/buildStatePayload(),
// que sí quedan expuestas solas), así que hace falta un puente chico como el
// que ya usa test_ranking_actualiza_resultado_real.js para registro.js.
const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = "window.__test = { S };";
window.document.body.appendChild(bridgeScript);
if (!window.__test){ console.error("❌ El puente no se ejecutó."); process.exit(1); }
window.S = window.__test.S;

const W = window;

/* ════════════════════════════════════════════════════════════════
   CASO 1 — El primer save() de la sesión (sin foto previa) NO debe
   generar entradas: solo establece la línea de base.
   ════════════════════════════════════════════════════════════════ */
console.log("── Primer save() de la sesión: no loguea nada, solo establece la base ──");
W.S.scores[1] = { h: 2, a: 1, live: false };
W.save();
check("changeLog sigue vacío tras el primer save()", W.S.changeLog.length === 0);

/* ════════════════════════════════════════════════════════════════
   CASO 2 — Cargar un resultado NUEVO en un partido que no tenía nada
   antes: debe loguearse como "🆕 Cargado" (before:null).
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Cargar un resultado nuevo (P2) ──");
W.S.scores[2] = { h: 0, a: 0, live: false };
W.save();
check("Se agregó UNA entrada nueva", W.S.changeLog.length === 1);
check("La entrada es del partido 2, fase grupos", W.S.changeLog[0].fase === "grupos" && W.S.changeLog[0].id === 2);
check("before es null (primera carga, no corrección)", W.S.changeLog[0].before === null);
check("after refleja el resultado cargado (0-0)", W.S.changeLog[0].after.h === 0 && W.S.changeLog[0].after.a === 0);

/* ════════════════════════════════════════════════════════════════
   CASO 3 — Corregir un resultado YA cargado: debe loguearse con
   before = valor viejo, after = valor nuevo, más reciente primero.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Corregir el resultado del partido 1 (2-1 → 2-2) ──");
W.S.scores[1] = { h: 2, a: 2, live: false };
W.save();
check("Ahora hay 2 entradas en total", W.S.changeLog.length === 2);
check("La más nueva (índice 0) es la corrección del partido 1", W.S.changeLog[0].id === 1 && W.S.changeLog[0].fase === "grupos");
check("before refleja el resultado viejo (2-1)", W.S.changeLog[0].before.h === 2 && W.S.changeLog[0].before.a === 1);
check("after refleja el resultado corregido (2-2)", W.S.changeLog[0].after.h === 2 && W.S.changeLog[0].after.a === 2);

/* ════════════════════════════════════════════════════════════════
   CASO 4 — Guardar SIN tocar ningún resultado (ej. solo cambió Bonos)
   no debe agregar entradas nuevas.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── save() sin cambios de resultados no agrega entradas ──");
W.save();
check("Sigue habiendo exactamente 2 entradas (no se duplicó nada)", W.S.changeLog.length === 2);

/* ════════════════════════════════════════════════════════════════
   CASO 5 — Eliminatoria: con equipos cargados en S.elimTeams, el label
   usa los nombres reales en vez de "Partido {pid}".
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Eliminatoria: label con nombres de equipos reales ──");
W.S.elimTeams[73] = { h: "BRA", a: "ARG" };
W.S.elimScores[73] = { h: 1, a: 0, live: true };
W.save();
const elimEntry = W.S.changeLog.find(e => e.fase === "elim" && e.id === 73);
check("Se logueó la entrada de eliminatoria", !!elimEntry);
check("El label usa los nombres reales de los equipos", elimEntry && elimEntry.label.includes("Brasil") && elimEntry.label.includes("Argentina"));
check("live=true quedó reflejado (cargado por ESPN Live)", elimEntry && elimEntry.live === true);

/* ════════════════════════════════════════════════════════════════
   CASO 6 — applyRemoteState() (un cambio remoto genuino) resincroniza
   la línea de base: el próximo save() de ESTA sesión no debe re-loguear
   ese mismo valor como si fuera un cambio propio.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Un cambio remoto no genera una entrada fantasma en el próximo save() propio ──");
const countBeforeRemote = W.S.changeLog.length;
const remotePayload = W.buildStatePayload();
remotePayload.scores[3] = { h: 5, a: 5, live: false }; // "otro admin" cargó P3 en otra sesión
W.applyRemoteState(remotePayload);
check("applyRemoteState() por sí solo NO agrega entradas al historial", W.S.changeLog.length === countBeforeRemote);

W.save(); // esta sesión guarda algo sin tocar P3
check("El save() posterior tampoco relogea P3 (la base ya lo conocía)", !W.S.changeLog.some(e => e.id === 3 && e.fase === "grupos" && e.after.h === 5));

/* ════════════════════════════════════════════════════════════════
   CASO 7 — Tope de entradas (CL_MAX_ENTRIES): el historial no crece
   sin límite, se queda con las más recientes.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── El historial respeta el tope de entradas ──");
for (let i = 0; i < 310; i++) {
  W.S.scores[1] = { h: 2, a: (i % 2), live: false }; // alterna el resultado para forzar un diff real cada vez
  W.save();
}
check("El historial no supera las 300 entradas", W.S.changeLog.length <= 300);
check("La entrada más nueva sigue siendo la del partido 1 (la última guardada)", W.S.changeLog[0].id === 1 && W.S.changeLog[0].fase === "grupos");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
