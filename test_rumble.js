// Test funcional de la Fase 4 del roadmap de Batallas: Royal Rumble.
// Estructura propia (S.rumble = {participantes:[...]}, no una extensión
// de p1/p2), sin restricción de Liga, y calcRumblePts = calcBattlePts +
// Avanzado (a diferencia del 1v1, que excluye Avanzado a propósito).
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
  <div id="t-battles" style="display:block">
    <select id="battle-slot1-p1"></select><select id="battle-slot1-p2"></select>
    <input id="battle-slot1-dias"><input id="battle-slot1-partidos"><input id="battle-slot1-name">
    <select id="battle-slot2-p1"></select><select id="battle-slot2-p2"></select>
    <input id="battle-slot2-dias"><input id="battle-slot2-partidos"><input id="battle-slot2-name">
    <div id="battles-postulados"></div><div id="battles-body"></div>
    <div id="battles-ligas-wrap"></div>
    <div id="rumble-participants-list"></div>
    <input id="rumble-name"><input id="rumble-dias"><input id="rumble-partidos">
    <div id="rumble-active-body"></div><div id="rumble-history-body"></div>
  </div>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
window.__fb = null;

let ok = true;
function check(label, cond){ console.log((cond?"✅ ":"❌ ")+label); if(!cond) ok=false; }

for (const file of FILES_IN_ORDER){
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  try{ window.document.body.appendChild(script); }
  catch(e){ console.log(`❌ ${file} lanzó un error al cargar: ${e.message}`); ok = false; }
}

const bridge = window.document.createElement("script");
bridge.textContent = `
  window.__test = {
    DB, S, rebuildDynamicData, calcBattlePts, calcAdv, calcRumblePts,
    startRumble, resetRumble, renderRumblePanel, getVentanaRumble,
    getParticipantesSeleccionadosRumble, getLigaDe,
    buildStatePayload, load, applyRemoteState, applyStatePayload, save,
  };
`;
window.document.body.appendChild(bridge);
if (!window.__test){ console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;
const W = window;
W.isAdmin = () => true; // reasignar DESPUÉS de cargar los archivos

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — calcRumblePts: Básico + Avanzado + Eliminatoria (sin Bonos)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── calcRumblePts() incluye Avanzado (a diferencia de calcBattlePts) ──");

T.DB.participants = [{id:"p0", name:"Rumbler", city:"C", country:"P"}];
T.DB.predictions = {p0:{}};
T.rebuildDynamicData();

// Ancla a "hoy al mediodía" (no "ahora + 1h") -- getMatchIdsInWindow(1)
// mira el día calendario, y "+1h" cruza a mañana si el test corre tarde
// a la noche, dejando la ventana vacía sin querer.
const hoyMediodiaP1 = new Date(); hoyMediodiaP1.setHours(12,0,0,0);
T.S.matchTimes[1] = hoyMediodiaP1.getTime();
T.S.scores[1] = {h:2, a:0};
T.DB.predictions.p0[1] = {h:2, a:0}; // acierta exacto
T.rebuildDynamicData();

T.S.reality = {champ:"Argentina",runner:"",third:"",topScorer:"",topScorerGoals:0,topCountry:"",topCountryGoals:0,mostConceded:""};
T.S.adv["Rumbler"] = {champ:"Argentina"}; // acierta campeón -> calcAdv > 0

const battlePts = T.calcBattlePts("Rumbler", [1], []);
const advPts = T.calcAdv("Rumbler");
const rumblePts = T.calcRumblePts("Rumbler", [1], []);

check("calcAdv() da puntos (>0) por acertar el campeón", advPts > 0);
// v1.9 — calcBattlePts() ahora suma Avanzado por su cuenta (antes lo
// excluía a propósito para duelos 1v1); calcRumblePts() dejó de sumarlo
// aparte para no contarlo dos veces -- ver nota en app-batallas.js.
check("calcBattlePts() ya incluye Avanzado (v1.9): da al menos los puntos de acertar el campeón",
  battlePts >= advPts);
check("calcRumblePts() = calcBattlePts() (ya no se duplica Avanzado)",
  rumblePts === battlePts);

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — startRumble(): validaciones, estructura propia, sin
   restricción de Liga
   ════════════════════════════════════════════════════════════════ */
console.log("\n── startRumble() ──");

// v3.14 — el sistema de Ligas dinámico necesita al menos 20 participantes
// para que existan 2 ligas (ver ligaSizes() en app-batallas.js); con solo
// 4 personas todas caerían en la única liga posible. Se agregan 16
// "Filler" sin ninguna batalla jugada para completar el piso -- Campeon1
// (única victoria real) queda en la liga de arriba, y NuevoA/NuevoB (sin
// pelear nunca, insertados AL FINAL del grupo empatado en 0/0/0) caen en
// la de abajo junto a la mayoría de los Filler.
const FILLERS = Array.from({length:16}, (_,i)=>`Filler${i+1}`);
T.DB.participants = [
  {id:"g0", name:"Campeon1", city:"C", country:"P"}, // va a terminar en la liga de arriba
  ...FILLERS.map((n,i)=>({id:"f"+i, name:n, city:"C", country:"P"})),
  {id:"n0", name:"NuevoA",   city:"C", country:"P"}, // nunca peleó -> liga de abajo
  {id:"n1", name:"NuevoB",   city:"C", country:"P"}, // nunca peleó -> liga de abajo
  {id:"g1", name:"Rival1",   city:"C", country:"P"},
];
T.DB.predictions = {}; T.DB.participants.forEach(p=>{ T.DB.predictions[p.id] = {}; });
T.S.battleHistory = [{name:"h1", p1:"Campeon1", p2:"Rival1", winner:"Campeon1", date:"d"}];
T.rebuildDynamicData();

check("Campeon1 y NuevoA quedan en ligas DISTINTAS -- setup previo a probar que el Rumble las ignora",
  T.getLigaDe("Campeon1") !== T.getLigaDe("NuevoA"));

let avisoPocos = false;
W.toast = (m,isErr)=>{ if(isErr) avisoPocos = true; };
T.startRumble(); // sin ningún checkbox tildado
check("startRumble() sin participantes seleccionados avisa en vez de arrancar uno vacío", avisoPocos === true);
check("No se creó S.rumble", !T.S.rumble);

// Tildar a los 4 (2 de Champions/Premier distintas, cruzando ligas libremente).
["Campeon1","Rival1","NuevoA","NuevoB"].forEach(n=>{
  const cb = W.document.createElement("input");
  cb.type="checkbox"; cb.className="js-rumble-check"; cb.value=n; cb.checked=true;
  W.document.getElementById("rumble-participants-list").appendChild(cb);
});
W.document.getElementById("rumble-dias").value = "1";
const hoyMediodiaP2 = new Date(); hoyMediodiaP2.setHours(12,0,0,0);
T.S.matchTimes[2] = hoyMediodiaP2.getTime(); // partido "de hoy" para que la ventana no quede vacía

T.startRumble();
check("S.rumble se creó con los 4 participantes, CRUZANDO ligas sin ningún rechazo",
  T.S.rumble && T.S.rumble.participantes.length === 4);
check("S.rumble.participantes incluye tanto a Campeon1 (Champions) como a NuevoA (Premier) -- sin restricción de Liga",
  T.S.rumble.participantes.includes("Campeon1") && T.S.rumble.participantes.includes("NuevoA"));

let avisoYaActivo = false;
W.toast = (m,isErr)=>{ if(isErr) avisoYaActivo = true; };
T.startRumble();
check("Con un Rumble ya activo, startRumble() avisa en vez de crear un segundo",
  avisoYaActivo === true);

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — resetRumble(): gana quien más puntos suma; se guarda en
   S.rumbleHistory; limpia S.rumble
   ════════════════════════════════════════════════════════════════ */
console.log("\n── resetRumble(): ganador y guardado en historial ──");

// Predicciones para que Campeon1 saque más puntos que el resto (acierta
// el partido 2; los demás no tienen predicción para ese mid).
T.S.scores[2] = {h:1, a:0};
T.DB.predictions.g0[2] = {h:1, a:0};
T.rebuildDynamicData();

T.resetRumble();
check("S.rumble quedó null tras terminar (Rumble cerrado)", T.S.rumble === null);
check("Se agregó 1 entrada a S.rumbleHistory", T.S.rumbleHistory.length === 1);
check("El ganador guardado es Campeon1 (acertó de más que el resto)",
  T.S.rumbleHistory[0].winner === "Campeon1");
check("El registro guarda los puntos de los 4 participantes",
  Object.keys(T.S.rumbleHistory[0].puntos).length === 4);

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — Empate: si 2+ participantes quedan con el mismo máximo,
   el ganador guardado es "Empate" (mismo criterio que las Batallas 1v1)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── resetRumble(): empate entre 2+ participantes ──");

T.DB.participants = [
  {id:"e0", name:"Empate1", city:"C", country:"P"},
  {id:"e1", name:"Empate2", city:"C", country:"P"},
];
T.DB.predictions = {e0:{}, e1:{}};
T.rebuildDynamicData(); // ninguno tiene predicciones -> ambos con 0pts, calcAdv también 0

const cbs = W.document.getElementById("rumble-participants-list");
cbs.innerHTML = "";
["Empate1","Empate2"].forEach(n=>{
  const cb = W.document.createElement("input");
  cb.type="checkbox"; cb.className="js-rumble-check"; cb.value=n; cb.checked=true;
  cbs.appendChild(cb);
});
W.document.getElementById("rumble-dias").value = "1";
T.startRumble();
T.resetRumble();
check("Con 2 participantes empatados en puntos, el ganador guardado es 'Empate'",
  T.S.rumbleHistory[0].winner === "Empate");

/* ════════════════════════════════════════════════════════════════
   PARTE 5 (v4.0.1) — BUG REPORTADO: el Royal Rumble activo se perdía en
   cada recarga de página. Causa real: S.rumble/S.rumbleHistory nunca se
   agregaron a buildStatePayload()/load()/applyRemoteState()/
   applyStatePayload() (app-live-sync.js) -- vivían SOLO en memoria, así
   que cualquier recarga (no hacía falta que fuera un deploy, cualquier
   F5 alcanzaba) los perdía. Verifica el round-trip completo.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── v4.0.1: persistencia del Royal Rumble (bug reportado) ──");

const payloadKeys = Object.keys(T.buildStatePayload());
check("buildStatePayload() incluye rumble y rumbleHistory",
  payloadKeys.includes("rumble") && payloadKeys.includes("rumbleHistory"));

T.S.rumble = {participantes:["Ana","Beto"], name:"Test", ventanaModo:"dias", ventanaValor:1, groupMids:[], elimMids:[], startedAt:Date.now()};
T.S.rumbleHistory = [{name:"viejo", winner:"Ana", puntos:{Ana:5,Beto:2}, date:"d"}];
T.save();

// Simula una recarga real de página: S vuelve a sus defaults (sin
// rumble, como declara app-state.js), y load() tiene que traerlo de
// vuelta desde localStorage -- lo mismo que pasaría en el navegador.
T.S.rumble = undefined;
T.S.rumbleHistory = undefined;
T.load();
check("Tras 'recargar' (load() desde localStorage), S.rumble volvió con sus 2 participantes",
  !!T.S.rumble && T.S.rumble.participantes.length === 2 && T.S.rumble.name === "Test");
check("S.rumbleHistory también se restauró", T.S.rumbleHistory.length === 1 && T.S.rumbleHistory[0].winner === "Ana");

// applyRemoteState(): sincronización en vivo desde otra sesión.
T.S.rumble = null; T.S.rumbleHistory = [];
T.applyRemoteState({rumble:{participantes:["Carla"],name:"Remoto",ventanaModo:"dias",ventanaValor:1,groupMids:[],elimMids:[],startedAt:Date.now()}, rumbleHistory:[{name:"r",winner:"Carla",puntos:{Carla:1},date:"d"}]});
check("applyRemoteState() también propaga un Rumble activo iniciado en OTRA sesión",
  !!T.S.rumble && T.S.rumble.name === "Remoto");

T.applyRemoteState({rumble:null, rumbleHistory:T.S.rumbleHistory});
check("applyRemoteState() con rumble:null limpia el Rumble activo (ej. otro admin lo cerró) -- usa !==undefined, no un chequeo truthy que lo ignoraría",
  T.S.rumble === null);

// applyStatePayload(): restaurar un backup íntegro (reemplazo total).
T.applyStatePayload({rumble:{participantes:["Diego"],name:"Backup",ventanaModo:"dias",ventanaValor:1,groupMids:[],elimMids:[],startedAt:1}, rumbleHistory:[]});
check("applyStatePayload() (restaurar backup) también trae de vuelta un Rumble activo",
  !!T.S.rumble && T.S.rumble.name === "Backup");

T.applyStatePayload({});
check("Un backup SIN rumble (formato viejo, de antes de este fix) resetea a null/[] en vez de romper",
  T.S.rumble === null && Array.isArray(T.S.rumbleHistory) && T.S.rumbleHistory.length === 0);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
