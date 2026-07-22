// Test funcional de la Fase 3 del roadmap de Batallas: sistema de Ligas
// estilo suizo (computeBattleRecord / getLigaStandings / getLigaGroups /
// getLigaDe) + la restricción de "misma liga" en 1v1 (startBattle y
// sugerirRival).
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
  <div id="t-battles" style="display:block">
    <input id="battle-slot1-dias"><input id="battle-slot1-partidos"><input id="battle-slot1-name">
    <input id="battle-slot2-dias"><input id="battle-slot2-partidos"><input id="battle-slot2-name">
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
    computeBattleRecord, getLigaStandings, getLigaGroups, getLigaDe, getLigasMeta, ligaSizes,
    startBattle, sugerirRival, renderLigasPanel,
  };
`;
window.document.body.appendChild(bridge);
if (!window.__test){ console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;
const W = window;
W.isAdmin = () => true; // reasignar DESPUÉS de cargar los archivos

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — computeBattleRecord(): wins/losses/jugadas desde
   S.battleHistory
   ════════════════════════════════════════════════════════════════ */
console.log("\n── computeBattleRecord() ──");

T.S.battleHistory = [
  {name:"D1", p1:"Alfa", p2:"Zulu", pts1:10, pts2:5, winner:"Alfa", date:"01 ene 2026"},
  {name:"D2", p1:"Beto", p2:"Alfa", pts1:3, pts2:8, winner:"Alfa", date:"02 ene 2026"},
  {name:"D3", p1:"Zulu", p2:"Beto", pts1:6, pts2:6, winner:"Empate", date:"03 ene 2026"},
];

const rec = T.computeBattleRecord();
check("Alfa ganó 2 batallas (contra Zulu y contra Beto)", rec["Alfa"].wins === 2 && rec["Alfa"].losses === 0);
check("Zulu perdió 1 (contra Alfa) y empató 1 (contra Beto) -- 0 wins, 1 loss, 2 jugadas",
  rec["Zulu"].wins === 0 && rec["Zulu"].losses === 1 && rec["Zulu"].jugadas === 2);
check("Beto perdió 1 (contra Alfa) y empató 1 (contra Zulu) -- 0 wins, 1 loss, 2 jugadas",
  rec["Beto"].wins === 0 && rec["Beto"].losses === 1 && rec["Beto"].jugadas === 2);
check("Un empate no suma win ni loss a nadie (Zulu/Beto solo tienen 1 loss cada uno, no 2)",
  rec["Zulu"].losses === 1 && rec["Beto"].losses === 1);
// v2.7.5 — los empates ahora se contabilizan aparte (rec[x].draws).
check("v2.7.5: el duelo D3 (Zulu vs Beto, Empate) sumó 1 'draws' a cada uno de los 2",
  rec["Zulu"].draws === 1 && rec["Beto"].draws === 1);
check("v2.7.5: Alfa (nunca empató) tiene draws === 0", rec["Alfa"].draws === 0);

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — getLigaStandings(): orden (wins desc, losses asc, total
   general de predicciones como último desempate)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── getLigaStandings(): criterio de orden y desempate ──");

T.DB.participants = [
  {id:"pC", name:"Charlie", city:"C", country:"P"}, // 2 wins, 1 loss
  {id:"pD", name:"Delta",   city:"C", country:"P"}, // 2 wins, 0 losses -- debería ir ANTES que Charlie
  {id:"pE", name:"Echo",    city:"C", country:"P"}, // 1 win, 0 losses, predicción CORRECTA (total alto)
  {id:"pF", name:"Foxtrot", city:"C", country:"P"}, // 1 win, 0 losses, SIN predicciones (total bajo) -- Echo antes que Foxtrot
];
T.DB.predictions = {pC:{}, pD:{}, pE:{}, pF:{}};
T.S.battleHistory = [
  {name:"h1", p1:"Charlie", p2:"X", winner:"Charlie", date:"d"},
  {name:"h2", p1:"Charlie", p2:"Y", winner:"Charlie", date:"d"},
  {name:"h3", p1:"Charlie", p2:"Z", winner:"Z", date:"d"}, // 1 derrota para Charlie
  {name:"h4", p1:"Delta", p2:"X", winner:"Delta", date:"d"},
  {name:"h5", p1:"Delta", p2:"Y", winner:"Delta", date:"d"},
  {name:"h6", p1:"Echo", p2:"X", winner:"Echo", date:"d"},
  {name:"h7", p1:"Foxtrot", p2:"Y", winner:"Foxtrot", date:"d"},
];
// Un partido de grupos real, para diferenciar el ranking general entre
// Echo (acierta) y Foxtrot (sin predicción cargada).
T.S.scores[1] = {h:2, a:0};
T.DB.predictions.pE[1] = {h:2, a:0}; // Echo acierta exacto
T.rebuildDynamicData();

const standings = T.getLigaStandings();
const posOf = (name)=>standings.findIndex(p=>p.name===name);
check("Delta (2 wins, 0 losses) queda ANTES que Charlie (2 wins, 1 loss) -- desempate por menos derrotas",
  posOf("Delta") < posOf("Charlie"));
check("Echo (1 win, total más alto por acertar el marcador) queda ANTES que Foxtrot (1 win, sin predicciones)",
  posOf("Echo") < posOf("Foxtrot"));
check("Los de 2 wins (Delta, Charlie) quedan ANTES que los de 1 win (Echo, Foxtrot)",
  Math.max(posOf("Delta"),posOf("Charlie")) < Math.min(posOf("Echo"),posOf("Foxtrot")));

/* ════════════════════════════════════════════════════════════════
   PARTE 2b (v2.7.5) — los EMPATES ahora son decisivos para el orden:
   a igualdad de victorias, gana el que empató más (independientemente
   de cuántas "jugadas" tenga cada uno en total).
   ════════════════════════════════════════════════════════════════ */
console.log("\n── getLigaStandings(): los empates desempatan antes que las derrotas ──");

T.DB.participants = [
  {id:"pG", name:"Golf",    city:"C", country:"P"}, // 3 wins, 2 draws, 0 losses (5 jugadas)
  {id:"pH", name:"Hotel",   city:"C", country:"P"}, // 3 wins, 0 draws, 0 losses (3 jugadas) -- Golf debe ir ANTES
];
T.DB.predictions = {pG:{}, pH:{}};
T.S.battleHistory = [
  {name:"e1", p1:"Golf", p2:"X", winner:"Golf", date:"d"},
  {name:"e2", p1:"Golf", p2:"Y", winner:"Golf", date:"d"},
  {name:"e3", p1:"Golf", p2:"Z", winner:"Golf", date:"d"},
  {name:"e4", p1:"Golf", p2:"W", winner:"Empate", date:"d"},
  {name:"e5", p1:"Golf", p2:"V", winner:"Empate", date:"d"},
  {name:"e6", p1:"Hotel", p2:"X", winner:"Hotel", date:"d"},
  {name:"e7", p1:"Hotel", p2:"Y", winner:"Hotel", date:"d"},
  {name:"e8", p1:"Hotel", p2:"Z", winner:"Hotel", date:"d"},
];
T.rebuildDynamicData();
const standings2b = T.getLigaStandings();
const posOf2b = (name)=>standings2b.findIndex(p=>p.name===name);
check("Golf (3 wins, 2 draws) y Hotel (3 wins, 0 draws) están empatados en victorias",
  standings2b.find(p=>p.name==="Golf").wins === standings2b.find(p=>p.name==="Hotel").wins);
check("v2.7.5: Golf (más empates) queda ANTES que Hotel (mismas ganadas, menos empates)",
  posOf2b("Golf") < posOf2b("Hotel"));

// v2.7.5 — la tabla real (renderLigasPanel -> renderLigaTable) debe
// mostrar la columna "Empatadas" con el valor correcto, no solo el
// dato interno de getLigaStandings().
T.renderLigasPanel();
const ligasHtml = W.document.getElementById("battles-ligas-wrap").innerHTML;
check("v2.7.5: la tabla de Ligas (UI real) tiene la columna 'Empatadas'", ligasHtml.includes("Empatadas"));
check("v2.7.5: el valor '2' (empates de Golf) aparece en la fila de Golf",
  /Golf[\s\S]{0,120}?<td[^>]*>\s*3\s*<\/td>[\s\S]{0,80}?<td[^>]*>\s*2\s*<\/td>/.test(ligasHtml));

/* ════════════════════════════════════════════════════════════════
   PARTE 3 (v3.14) — ligaSizes(): piso 10 / techo 20 por liga, K =
   floor(N/10), resto repartido de a 1 en las ligas más BAJAS
   ════════════════════════════════════════════════════════════════ */
console.log("\n── ligaSizes(): piso/techo y reparto del resto ──");

check("Menos de 10 -> 1 sola liga con todos (5)", JSON.stringify(T.ligaSizes(5)) === JSON.stringify([5]));
check("9 participantes -> 1 sola liga (no da para el piso de 10 x2)", JSON.stringify(T.ligaSizes(9)) === JSON.stringify([9]));
check("22 participantes -> 2 ligas de 11 (ejemplo del usuario)", JSON.stringify(T.ligaSizes(22)) === JSON.stringify([11,11]));
check("23 participantes -> 11 arriba y 12 abajo, el resto en la liga inferior (ejemplo del usuario)",
  JSON.stringify(T.ligaSizes(23)) === JSON.stringify([11,12]));
check("29 participantes -> siguen siendo 2 ligas (14/15), todavía no alcanza para una 3ra",
  JSON.stringify(T.ligaSizes(29)) === JSON.stringify([14,15]));
check("30 participantes -> recién ahí 3 ligas de 10 (mínimo para la 3ra, según lo pedido)",
  JSON.stringify(T.ligaSizes(30)) === JSON.stringify([10,10,10]));

/* ════════════════════════════════════════════════════════════════
   PARTE 3b — getLigaGroups() de punta a punta con 23 participantes:
   confirma que el reparto real (no solo la función pura) respeta
   ligaSizes(), que el mejor ranking cae en la liga de arriba, que el
   resto (el 12vo) cae en la de abajo, Y que la vieja excepción de
   "nunca jugó -> siempre Premier" YA NO EXISTE (v3.14): quien nunca
   peleó entra al mismo orden general que cualquiera con 0 wins/0
   draws/0 losses, y cae donde le toque -- acá, al fondo de la tabla
   (Array.sort es estable, así que entre empatados en todo mantiene el
   orden de DB.participants).
   ════════════════════════════════════════════════════════════════ */
console.log("\n── getLigaGroups(): 23 participantes reales, de punta a punta ──");

const RESTO_23 = Array.from({length:22}, (_,i)=>`P${String(i+2).padStart(2,"0")}`); // P02..P23
T.DB.participants = [
  {id:"camp", name:"Campeon", city:"C", country:"P"}, // único con una victoria real
  ...RESTO_23.map((n,i)=>({id:"r"+i, name:n, city:"C", country:"P"})), // ninguno peleó nunca
];
T.DB.predictions = {};
T.DB.participants.forEach(p=>{ T.DB.predictions[p.id] = {}; });
T.S.battleHistory = [{name:"b0", p1:"Campeon", p2:"Ghost", winner:"Campeon", date:"d"}]; // "Ghost" no es participante -- no cuenta para el reparto
T.rebuildDynamicData();

const groups23 = T.getLigaGroups();
check("Con 23 participantes hay exactamente 2 ligas (no aparece 'serieb')",
  Object.keys(groups23).length === 2 && !groups23.serieb);
check("La liga de arriba tiene 11 y la de abajo 12 (mismo reparto que ligaSizes(23))",
  groups23.champions.length === 11 && groups23.premier.length === 12);
check("Campeon (única victoria real) queda en la liga de ARRIBA",
  groups23.champions.some(p=>p.name==="Campeon"));
check("v3.14: P23 (nunca peleó, último en el orden de empate) cae en la liga de ABAJO -- ya no hay ningún forzado a 'Premier'",
  groups23.premier.some(p=>p.name==="P23") && !groups23.champions.some(p=>p.name==="P23"));

/* ════════════════════════════════════════════════════════════════
   PARTE 3c — menos de 10 participantes: 1 sola liga con todos adentro
   ════════════════════════════════════════════════════════════════ */
console.log("\n── getLigaGroups(): menos de 10 participantes -> 1 sola liga ──");

T.DB.participants = ["Uno","Dos","Tres","Cuatro","Cinco"].map((n,i)=>({id:"u"+i, name:n, city:"C", country:"P"}));
T.DB.predictions = {};
T.DB.participants.forEach(p=>{ T.DB.predictions[p.id] = {}; });
T.S.battleHistory = [];
T.rebuildDynamicData();

const groupsChicos = T.getLigaGroups();
check("Con 5 participantes hay UNA sola liga (key 'champions', el primer nombre de fantasía)",
  Object.keys(groupsChicos).length === 1 && groupsChicos.champions.length === 5);
check("Todos (incluido el propio 'Campeon' de antes, ya no en el roster) quedan en la misma liga entre sí",
  ["Uno","Dos","Tres","Cuatro","Cinco"].every(n=>T.getLigaDe(n)==="champions"));

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — getLigaDe() + restricción de Liga en startBattle()
   (reusa el roster de 23 participantes de la PARTE 3b -- hace falta
   volver a cargarlo porque la PARTE 3c lo pisó con uno de 5)
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Restricción de Liga en startBattle() ──");

T.DB.participants = [
  {id:"camp", name:"Campeon", city:"C", country:"P"},
  ...RESTO_23.map((n,i)=>({id:"r"+i, name:n, city:"C", country:"P"})),
];
T.DB.predictions = {};
T.DB.participants.forEach(p=>{ T.DB.predictions[p.id] = {}; });
T.S.battleHistory = [{name:"b0", p1:"Campeon", p2:"Ghost", winner:"Campeon", date:"d"}];
T.rebuildDynamicData();

check("getLigaDe() de Campeon (liga de arriba) da 'champions'", T.getLigaDe("Campeon") === "champions");
check("getLigaDe() de P23 (liga de abajo) da 'premier'", T.getLigaDe("P23") === "premier");

T.ensureBattleBuilderState();
T._battleBuilderPending[1].p1 = "Campeon"; // liga de arriba
T._battleBuilderPending[1].p2 = "P23"; // liga de abajo

let avisoLigaDistinta = false;
W.toast = (m,isErr)=>{ if(isErr) avisoLigaDistinta = true; };
T.startBattle(1);
check("startBattle() rechaza el duelo entre ligas distintas (arriba vs abajo)", avisoLigaDistinta === true);
check("No se creó ninguna batalla en la ranura 1", !T.S.battles[1]);

// Ahora 2 participantes de la MISMA liga (P12 y P13, ambos en la liga de
// abajo junto con P23) sí deben poder pelear.
T._battleBuilderPending[1].p1 = "P12";
T._battleBuilderPending[1].p2 = "P13";
// Ancla a "hoy al mediodía" en vez de "ahora + 1h": getMatchIdsInWindow(1)
// solo mira el DÍA calendario (medianoche a medianoche), no si el partido
// es futuro o pasado -- pero "ahora + 1h" cruza a mañana si el test corre
// tarde a la noche, dejando la ventana vacía (bug de fragilidad ya
// atrapado antes en test_batallas_duracion_matchmaker.js).
const hoyMediodia1 = new Date(); hoyMediodia1.setHours(12,0,0,0);
T.S.matchTimes[1] = hoyMediodia1.getTime(); // partido "de hoy" para que la ventana no quede vacía
let avisoLigaOk = false;
W.toast = (m,isErr)=>{ if(isErr) avisoLigaOk = true; };
T.startBattle(1);
check("startBattle() SÍ permite el duelo dentro de la misma liga (P12 vs P13, ambos abajo), sin avisos de error",
  !!T.S.battles[1] && avisoLigaOk === false);
delete T.S.battles[1];

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
