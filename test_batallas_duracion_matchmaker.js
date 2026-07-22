// Test funcional de la Fase 2 del roadmap de Batallas: duración
// configurable en días (getMatchIdsInWindow) + "Sugerime un rival"
// (calcularDiffPrediccion / sugerirRival).
//
// Carga los 22 archivos de producción en el mismo orden que index.html,
// mismo patrón de bridge que el resto de los tests de Batallas.
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
    <input id="battle-dias"><input id="battle-partidos">
    <input id="battle-slot1-name"><input id="battle-slot2-name">
    <div id="battle-builder-body"></div><div id="battles-body"></div>
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
    DB, S, PID_TO_SLOT, ELIM_1_16_IDS, _battleBuilderPending,
    rebuildDynamicData, getMatchIdsInWindow, getMatchIdsByCount, areBattleMatchesDone,
    calcularDiffPrediccion, sugerirRival, startBattle, ensureBattleBuilderState, getVentanaRanura,
  };
`;
window.document.body.appendChild(bridge);
if (!window.__test){ console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;
const W = window;
W.isAdmin = () => true; // reasignar DESPUÉS de cargar los archivos (isAdmin() real pisa cualquier override previo)

const now = new Date();
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
function atDayOffset(days, hour){
  const d = new Date(startOfToday);
  d.setDate(d.getDate()+days);
  d.setHours(hour===undefined?12:hour, 0, 0, 0);
  return d.getTime();
}

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — getMatchIdsInWindow(days): ventana de N días calendario
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Ventana de N días (getMatchIdsInWindow) ──");

T.S.matchTimes[1] = atDayOffset(0);  // hoy
T.S.matchTimes[2] = atDayOffset(1);  // mañana
T.S.matchTimes[3] = atDayOffset(2);  // pasado mañana
T.S.matchTimes[4] = atDayOffset(3);  // 3 días desde hoy -- fuera de una ventana de 3 días
T.S.matchTimes[5] = atDayOffset(-1); // ayer -- nunca debería entrar

let w1 = T.getMatchIdsInWindow(1);
check("Con 1 día (default, igual a 'hoy' de siempre): solo el mid de hoy",
  JSON.stringify(w1.groupMids) === JSON.stringify([1]));

let w3 = T.getMatchIdsInWindow(3);
check("Con 3 días: hoy + mañana + pasado mañana (3 mids), sin el de +3 días ni el de ayer",
  JSON.stringify(w3.groupMids) === JSON.stringify([1,2,3]));

let wSinArg = T.getMatchIdsInWindow();
check("Sin argumento, se comporta igual que con 1 día (fallback seguro)",
  JSON.stringify(wSinArg.groupMids) === JSON.stringify([1]));

let wInvalido = T.getMatchIdsInWindow(-5);
check("Con un valor inválido (negativo), cae a 1 día en vez de romper",
  JSON.stringify(wInvalido.groupMids) === JSON.stringify([1]));

/* ════════════════════════════════════════════════════════════════
   PARTE 1b — getMatchIdsByCount(n): duración por CANTIDAD de partidos
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Duración por cantidad de partidos (getMatchIdsByCount) ──");

// getMatchIdsByCount mira hacia ADELANTE desde AHORA MISMO (Date.now()),
// no desde medianoche de hoy -- a propósito NO reusa los mids 1-5 de la
// Parte 1 (eso rompería sus horarios fijados por día calendario) NI
// horarios fijos tipo "mediodía": si el test corre después del mediodía,
// el mid "de hoy" ya habría quedado en el pasado y jamás podría entrar en
// una ventana que mira hacia adelante. Mids nuevos (30-34), offsets
// relativos al instante real de ejecución.
//
// FLAKY DETECTADO (v3.2.1): mid=1 ("hoy a las 12:00", Parte 1) nunca se
// borraba de S.matchTimes antes de esta parte -- si el test corre en
// las horas cercanas al mediodía LOCAL de quien lo ejecuta, "hoy 12:00"
// cae DENTRO de la ventana de horas que mira getMatchIdsByCount acá
// abajo, colándose antes que los mids 30/31 esperados y rompiendo el
// resultado exacto. Se guardan y se sacan los mids de la Parte 1 antes
// de arrancar esta (se restauran después, ver más abajo -- la Parte 2
// todavía los necesita), para que esta parte quede aislada sin importar
// la hora real.
const _mids1a5Backup = {1:T.S.matchTimes[1],2:T.S.matchTimes[2],3:T.S.matchTimes[3],4:T.S.matchTimes[4],5:T.S.matchTimes[5]};
delete T.S.matchTimes[1];delete T.S.matchTimes[2];delete T.S.matchTimes[3];
delete T.S.matchTimes[4];delete T.S.matchTimes[5];
const nowMs = Date.now();
T.S.matchTimes[30] = nowMs + 1*3600000;  // dentro de 1h
T.S.matchTimes[31] = nowMs + 2*3600000;  // dentro de 2h
T.S.matchTimes[32] = nowMs + 3*3600000;  // dentro de 3h
T.S.matchTimes[33] = nowMs + 4*3600000;  // dentro de 4h
T.S.matchTimes[34] = nowMs - 3600000;    // hace 1h (pasado) -- nunca debería entrar

let c2 = T.getMatchIdsByCount(2);
check("Con 2 partidos: toma los 2 más próximos en el futuro (mid 30 y 31), sin el pasado",
  JSON.stringify(c2.groupMids) === JSON.stringify([30,31]));

let c4 = T.getMatchIdsByCount(4);
check("Con 4 partidos: toma los 4 próximos en orden cronológico (30,31,32,33), salta el pasado",
  JSON.stringify(c4.groupMids) === JSON.stringify([30,31,32,33]));

let cInvalido = T.getMatchIdsByCount(0);
check("Con 0 (inválido), cae a 1 partido en vez de romper",
  JSON.stringify(cInvalido.groupMids) === JSON.stringify([30]));

// Limpiar para no contaminar la Parte 2 (que sigue usando mids 1-5 con
// horarios fijados por día calendario) -- y restaurar los mids 1-5
// guardados arriba, que la Parte 2 necesita de vuelta.
delete T.S.matchTimes[30];delete T.S.matchTimes[31];delete T.S.matchTimes[32];
delete T.S.matchTimes[33];delete T.S.matchTimes[34];
Object.assign(T.S.matchTimes, _mids1a5Backup);

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — startBattle respeta el input de días/partidos y lo guarda en
   S.battles (ventanaModo/ventanaValor)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── startBattle() con duración configurable ──");

T.DB.participants = [
  {id:"p0", name:"Ana", city:"C", country:"P"},
  {id:"p1", name:"Beto", city:"C", country:"P"},
];
T.DB.predictions = {p0:{}, p1:{}};
T.rebuildDynamicData();

T.ensureBattleBuilderState();
T._battleBuilderPending[1].p1 = "Ana";
T._battleBuilderPending[1].p2 = "Beto";
W.document.getElementById("battle-dias").value = "3";

T.startBattle(1);
check("S.battles[1].ventanaModo quedó 'dias' y ventanaValor 3 (el valor del input, no el default)",
  T.S.battles[1] && T.S.battles[1].ventanaModo==="dias" && T.S.battles[1].ventanaValor===3);
check("S.battles[1].groupMids usó la ventana de 3 días (incluye mids 1,2,3)",
  T.S.battles[1] && JSON.stringify(T.S.battles[1].groupMids) === JSON.stringify([1,2,3]));
delete T.S.battles[1];

/* ════════════════════════════════════════════════════════════════
   PARTE 2b — "Partidos de duración" tiene precedencia sobre "Días" si
   ambos están cargados
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Precedencia de 'Partidos de duración' sobre 'Días' ──");

// Igual que en la Parte 1b: mid 1/2 necesitan quedar en el futuro
// GARANTIZADO relativo a AHORA (getMatchIdsByCount mira hacia adelante
// desde Date.now(), no desde medianoche) -- se reasignan acá para no
// depender de a qué hora del día corra el test.
T.S.matchTimes[1] = Date.now() + 1*3600000;
T.S.matchTimes[2] = Date.now() + 2*3600000;

// startBattle(1) de la Parte 2 limpió _battleBuilderPending[1] al iniciar
// el duelo (ver nota en startBattle(), app-batallas.js) -- se vuelve a
// cargar el mismo par para poder armar el duelo 1 de nuevo acá.
T._battleBuilderPending[1].p1 = "Ana";
T._battleBuilderPending[1].p2 = "Beto";
W.document.getElementById("battle-dias").value = "3"; // sigue cargado
W.document.getElementById("battle-partidos").value = "2"; // ahora también

T.startBattle(1);
check("Con ambos campos cargados, gana 'partidos': ventanaModo='partidos', ventanaValor=2",
  T.S.battles[1] && T.S.battles[1].ventanaModo==="partidos" && T.S.battles[1].ventanaValor===2);
check("La ventana real son los 2 próximos partidos (mid 1 y 2), NO los 3 días (que serían 1,2,3)",
  T.S.battles[1] && JSON.stringify(T.S.battles[1].groupMids) === JSON.stringify([1,2]));

W.document.getElementById("battle-partidos").value = ""; // vacío -> vuelve a caer en "días"
const ventanaSinPartidos = T.getVentanaRanura(1);
check("Con 'partidos' vacío, getVentanaRanura() vuelve a usar 'días' (modo='dias')",
  ventanaSinPartidos.modo==="dias" && ventanaSinPartidos.valor===3);

delete T.S.battles[1];
W.document.getElementById("battle-dias").value = "1";

delete T.S.battles[1];

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — calcularDiffPrediccion: la fórmula de discrepancia
   ════════════════════════════════════════════════════════════════ */
console.log("\n── calcularDiffPrediccion() ──");

T.DB.participants = [
  {id:"pA", name:"Carla", city:"C", country:"P"},
  {id:"pB", name:"Diego", city:"C", country:"P"},
];
T.DB.predictions = {pA:{}, pB:{}};
// mid 10: mismo resultado, mismo marcador exacto -> 0
T.DB.predictions.pA[10] = {h:2,a:0}; T.DB.predictions.pB[10] = {h:2,a:0};
// mid 11: mismo resultado (gana H), marcador distinto -> +0.3
T.DB.predictions.pA[11] = {h:3,a:0}; T.DB.predictions.pB[11] = {h:1,a:0};
// mid 12: resultado distinto (uno gana H, el otro empate) -> +1
T.DB.predictions.pA[12] = {h:2,a:0}; T.DB.predictions.pB[12] = {h:1,a:1};
// mid 13: a Diego le falta la predicción -> se salta, no suma
T.DB.predictions.pA[13] = {h:1,a:0};
T.rebuildDynamicData();

const diffGrupos = T.calcularDiffPrediccion("Carla","Diego",[10,11,12,13],[]);
check("Diff de 3 partidos de grupos comparables (0 + 0.3 + 1) = 1.3, el 4to se salteó por falta de predicción",
  Math.abs(diffGrupos - 1.3) < 1e-9);

// Eliminatoria: P73 con equipos "a mano" (dieciseisavos), mismo patrón que
// test_batallas_todas_fases.js.
T.S.elimTeams[73] = {h:"Argentina", a:"Brasil"};
T.S.elimTimes[73] = atDayOffset(0);
const slot73 = T.PID_TO_SLOT[73];
// Mismo ganador (Argentina), marcador distinto -> +0.3
T.DB.predictions.pA[slot73] = {h:2,a:0,_a:"Argentina",_b:"Brasil"};
T.DB.predictions.pB[slot73] = {h:1,a:0,_a:"Argentina",_b:"Brasil"};

T.S.elimTeams[74] = {h:"Francia", a:"España"};
T.S.elimTimes[74] = atDayOffset(0);
const slot74 = T.PID_TO_SLOT[74];
// Ganador distinto (Francia vs España) -> +1
T.DB.predictions.pA[slot74] = {h:2,a:0,_a:"Francia",_b:"España"};
T.DB.predictions.pB[slot74] = {h:0,a:1,_a:"Francia",_b:"España"};
T.rebuildDynamicData();

const diffElim = T.calcularDiffPrediccion("Carla","Diego",[],[73,74]);
check("Diff de eliminatoria (mismo ganador+marcador distinto=0.3, ganador distinto=1) = 1.3",
  Math.abs(diffElim - 1.3) < 1e-9);

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — sugerirRival(): elige el par con mayor diferencia
   ════════════════════════════════════════════════════════════════ */
console.log("\n── sugerirRival() ──");

T.DB.participants = [
  {id:"q1", name:"Elena", city:"C", country:"P", quierePelear:true},
  {id:"q2", name:"Fede", city:"C", country:"P", quierePelear:true},
  {id:"q3", name:"Gonzalo", city:"C", country:"P", quierePelear:true},
];
T.DB.predictions = {q1:{}, q2:{}, q3:{}};
// mid 20: Elena y Fede predicen IGUAL (diff 0 entre ellos); Gonzalo predice
// distinto a ambos -> Gonzalo debería terminar emparejado con cualquiera de
// los otros dos antes que Elena-Fede entre sí.
T.DB.predictions.q1[20] = {h:1,a:0};
T.DB.predictions.q2[20] = {h:1,a:0};
T.DB.predictions.q3[20] = {h:0,a:1};
T.rebuildDynamicData();

T.ensureBattleBuilderState();
T._battleBuilderPending[1] = {p1:null,p2:null,name:"",dias:1,partidos:""};
T._battleBuilderPending[2] = {p1:null,p2:null,name:"",dias:1,partidos:""};
W.document.getElementById("battle-dias").value = "1";
T.S.matchTimes[20] = atDayOffset(0);

T.sugerirRival(2);
const sugeridoP1 = T._battleBuilderPending[2].p1;
const sugeridoP2 = T._battleBuilderPending[2].p2;
check("sugerirRival() cargó a Gonzalo en alguna de las 2 ranuras (es quien más discrepa)",
  sugeridoP1 === "Gonzalo" || sugeridoP2 === "Gonzalo");
check("sugerirRival() NO sugirió el par Elena-Fede (diff 0 entre ellos, el peor par posible)",
  !((sugeridoP1==="Elena"&&sugeridoP2==="Fede") || (sugeridoP1==="Fede"&&sugeridoP2==="Elena")));

// Si el duelo ya tiene algo cargado, no debe pisarlo.
let avisoRanuraLlena = false;
W.toast = (m,isErr)=>{ if(isErr) avisoRanuraLlena = true; };
T.sugerirRival(2); // ya está lleno por la sugerencia anterior
check("Con el duelo ya ocupado, sugerirRival() avisa en vez de pisar la selección",
  avisoRanuraLlena === true);

// Con menos de 2 disponibles, también debe avisar (no reventar).
T._battleBuilderPending[2] = {p1:null,p2:null,name:"",dias:1,partidos:""};
T._battleBuilderPending[1].p1 = "Elena";
T._battleBuilderPending[1].p2 = "Fede"; // ocupa a 2 de los 3 disponibles en el OTRO duelo
let avisoPocos = false;
W.toast = (m,isErr)=>{ if(isErr) avisoPocos = true; };
T.sugerirRival(2); // solo queda Gonzalo disponible -> menos de 2
check("Con menos de 2 disponibles, sugerirRival() avisa sin romper",
  avisoPocos === true);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
