// Test funcional de la regla de BALANCE de duelos 1v1 (v3.15): la
// diferencia entre el participante con MÁS duelos jugados y el que tiene
// MENOS no puede superar 2 -- battleCountFor/wouldBreakBattleBalance
// (app-batallas.js), y su aplicación en sugerirRival() (debe priorizar a
// quien menos jugó, no solo a mayor diferencia de predicción) y en
// startBattle() (debe rechazar un duelo que rompa el balance).
//
// Carga los 24 archivos de producción en el mismo orden que index.html,
// mismo patrón de bridge que el resto de los tests de Batallas.
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
  <div id="root"></div><div id="toast"></div><div id="integ-banner"></div>
  <img id="logo-img"><span id="admin-indicator"></span>
  <span id="hstat"></span><span id="hdr-master-badge"></span><span id="hdr-today"></span>
  <table><tbody id="rb"></tbody></table>
  <div id="rbasic"></div><div id="radv"></div><div id="relim"></div><div id="rlast"></div>
  <div id="t-battles" style="display:block">
    <input id="battle-dias"><input id="battle-partidos">
    <input id="battle-slot1-name"><input id="battle-slot2-name">
    <div id="battle-builder-body"></div><div id="battles-body"></div>
    <div id="battles-ligas-wrap"></div>
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
    DB, S, rebuildDynamicData, _battleBuilderPending, ensureBattleBuilderState,
    battleCountFor, wouldBreakBattleBalance, startBattle, sugerirRival,
  };
`;
window.document.body.appendChild(bridge);
if (!window.__test){ console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;
const W = window;
W.isAdmin = () => true;

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — battleCountFor(): jugadas cerradas + duelos activos
   ════════════════════════════════════════════════════════════════ */
console.log("\n── battleCountFor() ──");

T.DB.participants = [
  {id:"p0", name:"Ana", city:"C", country:"P"},
  {id:"p1", name:"Beto", city:"C", country:"P"},
  {id:"p2", name:"Carla", city:"C", country:"P"},
];
T.DB.predictions = {p0:{}, p1:{}, p2:{}};
T.S.battleHistory = [
  {name:"h1", p1:"Ana", p2:"Beto", winner:"Ana", date:"d"},
  {name:"h2", p1:"Ana", p2:"Carla", winner:"Ana", date:"d"},
];
T.rebuildDynamicData();

check("Ana tiene 2 duelos cerrados y ningún duelo activo -> battleCountFor da 2",
  T.battleCountFor("Ana") === 2);
check("Beto tiene 1 duelo cerrado -> battleCountFor da 1", T.battleCountFor("Beto") === 1);
check("Carla tiene 1 duelo cerrado -> battleCountFor da 1", T.battleCountFor("Carla") === 1);

T.S.battles[1] = {p1:"Beto", p2:"Carla", groupMids:[], elimMids:[]};
check("Con un duelo ACTIVO sumado, Beto pasa a contar 2 (1 cerrado + 1 activo)",
  T.battleCountFor("Beto") === 2);
check("Con el mismo duelo activo, Carla también pasa a contar 2", T.battleCountFor("Carla") === 2);
delete T.S.battles[1];

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — wouldBreakBattleBalance(): compara SOLO el nuevo conteo de
   p1/p2 contra el "piso" (mínimo del roster ANTES del duelo), no el
   spread de TODO el roster después -- ver la nota grande junto a la
   función (app-batallas.js) sobre por qué la primera versión trababa el
   sistema por completo apenas había más de 1 rezagado en 0.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── wouldBreakBattleBalance() ──");

// Ana: 2, Beto: 1, Carla: 1 (setup de la Parte 1, ya sin duelo activo) -- piso=1
check("Ana(2) vs Beto(1): pasarían a 3 y 2, piso=1 (Carla) -- 3-1=2, OK, no rompe",
  T.wouldBreakBattleBalance("Ana","Beto") === false);

T.DB.participants.push({id:"p3", name:"Diego", city:"C", country:"P"});
T.DB.predictions.p3 = {};
T.rebuildDynamicData();
// Diego nunca peleó (0) -- piso ahora es 0. Ana(2) ya no puede jugar de nuevo
// (pasaría a 3, y el piso sigue en 0 hasta que Diego consiga su propio duelo).
check("Con Diego en 0 (piso=0), Ana(2) NO puede volver a jugar contra nadie -- pasaría a 3, 3-0=3>2, rompe",
  T.wouldBreakBattleBalance("Ana","Beto") === true);
check("Diego(0) vs Beto(1): pasarían a 1 y 2, piso=0 -- 2-0=2, OK, no rompe (los rezagados sí pueden avanzar)",
  T.wouldBreakBattleBalance("Diego","Beto") === false);

T.DB.participants.push({id:"p4", name:"Elena", city:"C", country:"P"});
T.DB.predictions.p4 = {};
T.rebuildDynamicData();
// Con Elena TAMBIÉN en 0, Diego(0) sigue pudiendo emparejarse (su propio
// avance no depende de que Elena también avance en la MISMA jugada) --
// esta es la clave que resuelve el bloqueo total reportado: cada rezagado
// puede subir su propio conteo sin esperar a que todos suban juntos.
check("Con Elena TAMBIÉN en 0, Diego(0) vs Beto(1) SIGUE sin romper (el avance de Diego no depende de Elena)",
  T.wouldBreakBattleBalance("Diego","Beto") === false);
check("Elena(0) vs Diego(0) tampoco rompe -- ambos suben parejo a 1", T.wouldBreakBattleBalance("Elena","Diego") === false);
check("Ana(2) sigue bloqueada mientras el piso siga en 0 (Elena y Diego sin jugar todavía)",
  T.wouldBreakBattleBalance("Ana","Beto") === true);

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — startBattle() rechaza un duelo que rompería el balance,
   pero SIGUE permitiendo que los rezagados avancen (no hay traba total)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── startBattle() respeta el balance sin trabar el sistema ──");

T.ensureBattleBuilderState();
T._battleBuilderPending[1].p1 = "Ana";
T._battleBuilderPending[1].p2 = "Beto";
T.S.matchTimes = T.S.matchTimes || {};
T.S.matchTimes[1] = Date.now();
let avisoBalance = false;
W.toast = (m,isErr)=>{ if(isErr) avisoBalance = true; };
T.startBattle(1);
check("startBattle() rechaza Ana(2) vs Beto(1) mientras Diego/Elena sigan en 0 (Ana pasaría a 3)",
  avisoBalance === true);
check("No se creó ninguna batalla en la ranura 1", !T.S.battles[1]);

T._battleBuilderPending[1].p1 = "Diego";
T._battleBuilderPending[1].p2 = "Elena";
let avisoOk = false;
W.toast = (m,isErr)=>{ if(isErr) avisoOk = true; };
T.startBattle(1);
check("startBattle() SÍ permite Diego(0) vs Elena(0) -- ambos suben parejo a 1, sin avisos de error",
  !!T.S.battles[1] && avisoOk === false);
delete T.S.battles[1];

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — sugerirRival() prioriza a quien menos jugó, no solo la
   mayor diferencia de predicción (BUG REPORTADO por el usuario)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── sugerirRival() prioriza el balance sobre la diferencia de predicción ──");

T.DB.participants = [
  {id:"x0", name:"Veterana", city:"C", country:"P"}, // 2 duelos jugados
  {id:"x1", name:"Novato1", city:"C", country:"P"},  // 0 duelos
  {id:"x2", name:"Novato2", city:"C", country:"P"},  // 0 duelos
];
T.DB.predictions = {x0:{}, x1:{}, x2:{}};
T.S.battleHistory = [
  {name:"h1", p1:"Veterana", p2:"Ghost1", winner:"Veterana", date:"d"},
  {name:"h2", p1:"Veterana", p2:"Ghost2", winner:"Veterana", date:"d"},
];
// Predicciones armadas para que Veterana-Novato1 tenga la MAYOR diferencia
// posible (el criterio viejo la elegiría a ella), pero el balance debe
// igual preferir el par Novato1-Novato2 (ambos en 0).
T.S.matchTimes[20] = Date.now();
T.DB.predictions.x0[20] = {h:3,a:0};
T.DB.predictions.x1[20] = {h:0,a:3}; // máxima discrepancia con Veterana
T.DB.predictions.x2[20] = {h:0,a:3}; // igual a Novato1 -- diff 0 entre ellos
T.rebuildDynamicData();

T.ensureBattleBuilderState();
T._battleBuilderPending[1] = {p1:null,p2:null,name:""};
T._battleBuilderPending[2] = {p1:null,p2:null,name:""};
W.document.getElementById("battle-dias").value = "1";

T.sugerirRival(1);
const sp1 = T._battleBuilderPending[1].p1, sp2 = T._battleBuilderPending[1].p2;
check("sugerirRival() eligió el par Novato1-Novato2 (ambos en 0), NO a Veterana pese a tener mayor diff de predicción",
  (sp1==="Novato1"&&sp2==="Novato2") || (sp1==="Novato2"&&sp2==="Novato1"));
check("sugerirRival() NO metió a Veterana en la sugerencia", sp1!=="Veterana" && sp2!=="Veterana");

/* ════════════════════════════════════════════════════════════════
   PARTE 5 — REGRESIÓN DEL BLOQUEO TOTAL REPORTADO: roster grande (25
   participantes) con UN líder que ya jugó 3 duelos y 24 rezagados en 0 --
   el estado real que el usuario describió. Antes del fix v3.15.1, la
   versión que exigía spread<=2 sobre TODO el roster no podía arreglar 24
   rezagados en una sola jugada, así que NINGÚN par pasaba el filtro y
   sugerirRival()/startBattle() quedaban trabados para siempre. Con el fix,
   los rezagados deben poder emparejarse entre sí sin problema.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Regresión: roster grande con 1 líder y muchos rezagados NO queda trabado ──");

const REZAGADOS = Array.from({length:24}, (_,i)=>`R${String(i+1).padStart(2,"0")}`);
T.DB.participants = [
  {id:"lead", name:"Lider", city:"C", country:"P"},
  ...REZAGADOS.map((n,i)=>({id:"z"+i, name:n, city:"C", country:"P"})),
];
T.DB.predictions = {};
T.DB.participants.forEach(p=>{ T.DB.predictions[p.id] = {}; });
T.S.battleHistory = [
  {name:"g1", p1:"Lider", p2:"Ghost1", winner:"Lider", date:"d"},
  {name:"g2", p1:"Lider", p2:"Ghost2", winner:"Lider", date:"d"},
  {name:"g3", p1:"Lider", p2:"Ghost3", winner:"Lider", date:"d"},
];
T.rebuildDynamicData();

check("Setup: Lider ya tiene 3 duelos jugados", T.battleCountFor("Lider") === 3);
check("Setup: los 24 rezagados están en 0", REZAGADOS.every(n=>T.battleCountFor(n)===0));

T.ensureBattleBuilderState();
T._battleBuilderPending[1] = {p1:null,p2:null,name:""};
T._battleBuilderPending[2] = {p1:null,p2:null,name:""};
T._battleBuilderPending[3] = {p1:null,p2:null,name:""};
T._battleBuilderPending[4] = {p1:null,p2:null,name:""};
let avisoSugerir = false;
W.toast = (m,isErr)=>{ if(isErr) avisoSugerir = true; };
T.sugerirRival(1);
check("sugerirRival() SÍ encuentra un par válido pese a 24 rezagados en 0 (no queda trabado)",
  avisoSugerir === false && !!T._battleBuilderPending[1].p1 && !!T._battleBuilderPending[1].p2);
check("El par sugerido NO incluye a Lider (ya está 3 arriba del piso en 0)",
  T._battleBuilderPending[1].p1!=="Lider" && T._battleBuilderPending[1].p2!=="Lider");

// startBattle() entre 2 rezagados cualquiera debe andar sin drama.
T._battleBuilderPending[2].p1 = "R01";
T._battleBuilderPending[2].p2 = "R02";
let avisoRezagados = false;
W.toast = (m,isErr)=>{ if(isErr) avisoRezagados = true; };
T.startBattle(2);
check("startBattle() permite emparejar 2 rezagados (R01 vs R02) sin ningún aviso de error",
  !!T.S.battles[2] && avisoRezagados === false);

// Lider sigue sin poder jugar: quedan 22 rezagados todavía en 0.
T._battleBuilderPending[3].p1 = "Lider";
T._battleBuilderPending[3].p2 = "R03";
let avisoLider = false;
W.toast = (m,isErr)=>{ if(isErr) avisoLider = true; };
T.startBattle(3);
check("Lider SIGUE bloqueado (pasaría a 4 duelos mientras 22 rezagados siguen en 0)",
  avisoLider === true && !T.S.battles[3]);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
