// Test funcional de v3.2.3 — BUG URGENTE REPORTADO: "ya pasó un partido
// y está corriendo otro y el ranking no actualiza la puntuación".
//
// CAUSA RAÍZ: la pantalla de Mi Quiniela/Ranking que ve cada participante
// (registro.js, "rg-content") solo se volvía a dibujar cuando cambiaba la
// colección registro_participants (onParticipantesChange). Pero un
// resultado real (ESPN Live, o el admin cargándolo a mano) vive en un
// documento TOTALMENTE distinto (quiniela/estado -> S.scores/elimScores),
// cuyo listener remoto (applyRemoteState, app-live-sync.js) solo
// refrescaba el panel de Admin (renderRank(), app-bracket-view.js) --
// nunca esta pantalla. Un participante mirando su posición/puntos se
// quedaba con el valor VIEJO hasta cambiar de pestaña o que, por
// casualidad, algún OTRO participante tocara registro_participants.
//
// FIX: refreshRegistroViewFromStateChange() (registro.js) -- mismos
// criterios de "no pisar tecleo sin guardar" que onParticipantesChange
// (WIZ_DIRTY/INICIO_DIRTY) -- se llama ahora desde save() (el actor local
// que carga el resultado) Y desde applyRemoteState() (todos los demás
// que lo reciben por Firestore), ambas en app-live-sync.js.
//
// Este test reproduce el flujo real: un participante con su quiniela ya
// enviada, viendo "Mi Perfil" (con su cantidad de puntos en pantalla) --
// se carga un resultado real que coincide con su predicción, se llama a
// save() (como hace onESC()/fetchESPNElim() al cargar un marcador), y se
// verifica que el badge de puntos se actualiza SOLO, sin llamar a
// render() a mano.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","torneo-mundial2026.js", "partidos-grupos.js","utils.js", "paises.js","app-static-data.js","app-state.js","scoring.js","totp.js",
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

let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = {
  DB, S, get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  get WIZ_DIRTY(){ return WIZ_DIRTY; }, set WIZ_DIRTY(v){ WIZ_DIRTY = v; },
  render, refreshRegistroViewFromStateChange,
};
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
try{ window.document.body.appendChild(regScript); }
catch(e){ console.log(`❌ registro.js (con bridge) lanzó un error al cargar: ${e.message}`); ok = false; }

if (!window.__test){ console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;
const W = window;

/* ════════════════════════════════════════════════════════════════
   CASO 1 — Dashboard (Mi Perfil) de un participante con quiniela YA
   enviada: se carga un resultado real que coincide con su predicción
   vía save() (igual que onESC()/fetchESPNElim()) -- el badge de puntos
   debe actualizarse SOLO, sin llamar a render() a mano.
   ════════════════════════════════════════════════════════════════ */
console.log("── Dashboard: el resultado real se refleja solo, sin llamar a render() ──");
T.DB.participants = [{id:"p1", name:"Juan Perez", city:"C", country:"P", estadoQuiniela:"enviada", fechaEnvio:Date.now()}];
T.DB.predictions = {p1:{1:{h:2,a:1}}}; // predice 2-1 para el partido 1
W.rebuildDynamicData();
T.DRAFT_PID = "p1";
T.render();

const before = W.document.getElementById("rg-content").innerHTML;
check("Antes de cargar el resultado, el badge muestra 0 pts", /badge-green">0 pts</.test(before));

// Simula lo que hace onESC()/fetchESPNElim() al cargar un marcador real:
// tocar S.scores y llamar a save() -- SIN llamar a render() ni a
// refreshRegistroViewFromStateChange() manualmente.
T.S.scores[1] = { h:2, a:1, live:false };
W.save();

const after = W.document.getElementById("rg-content").innerHTML;
check("save() por sí solo actualiza el badge a 5 pts (2 ganador + 3 exacto) SIN llamar a render() a mano",
  /badge-green">5 pts</.test(after));

/* ════════════════════════════════════════════════════════════════
   CASO 2 — Mientras hay tecleo sin guardar (WIZ_DIRTY), un resultado
   real que llega no debe pisar la pantalla -- mismo criterio que ya
   protege a onParticipantesChange().
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Con WIZ_DIRTY encendido, refreshRegistroViewFromStateChange() no pisa la pantalla ──");
const marker = W.document.createElement("div");
marker.id = "marca-no-deberia-borrarse";
W.document.getElementById("rg-content").appendChild(marker);

T.WIZ_DIRTY = true;
T.refreshRegistroViewFromStateChange();
check("Con WIZ_DIRTY=true, la marca sigue ahí (no se re-renderizó)",
  !!W.document.getElementById("marca-no-deberia-borrarse"));

T.WIZ_DIRTY = false;
T.refreshRegistroViewFromStateChange();
check("Con WIZ_DIRTY=false, ahora sí se re-renderiza (la marca desaparece, rg-content se reconstruyó)",
  !W.document.getElementById("marca-no-deberia-borrarse"));

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
