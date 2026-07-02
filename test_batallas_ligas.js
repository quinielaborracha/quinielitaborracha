// Test funcional de la Fase 3 del roadmap de Batallas: sistema de Ligas
// estilo suizo (computeBattleRecord / getLigaStandings / getLigaGroups /
// getLigaDe) + la restricción de "misma liga" en 1v1 (startBattle y
// sugerirRival).
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","partidos-grupos.js","utils.js","app-state.js","scoring.js","totp.js",
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
    DB, S, rebuildDynamicData,
    computeBattleRecord, getLigaStandings, getLigaGroups, getLigaDe, LIGAS,
    startBattle, sugerirRival, asignarPostulado,
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
   PARTE 3 — getLigaGroups(): tamaños (Champions=top10, Premier=mitad del
   resto, Serie B=el resto) + quien nunca jugó arranca SIEMPRE en Premier
   ════════════════════════════════════════════════════════════════ */
console.log("\n── getLigaGroups(): tamaños y default de 'nunca jugó' ──");

const GANADORES = ["G1","G2","G3","G4","G5","G6"];
const PERDEDORES = ["P1","P2","P3","P4","P5","P6"];
const NUNCA_JUGARON = ["Nuevo1","Nuevo2"];

T.DB.participants = [
  ...GANADORES.map((n,i)=>({id:"g"+i, name:n, city:"C", country:"P"})),
  ...PERDEDORES.map((n,i)=>({id:"p"+i, name:n, city:"C", country:"P"})),
  ...NUNCA_JUGARON.map((n,i)=>({id:"n"+i, name:n, city:"C", country:"P"})),
];
T.DB.predictions = {};
T.DB.participants.forEach(p=>{ T.DB.predictions[p.id] = {}; });
T.S.battleHistory = GANADORES.map((g,i)=>({name:"b"+i, p1:g, p2:PERDEDORES[i], winner:g, date:"d"}));
T.rebuildDynamicData();

const groups = T.getLigaGroups();
check("Champions tiene exactamente 10 (min(10, 12 que ya jugaron))", groups.champions.length === 10);
check("Los 6 ganadores están TODOS en Champions (0 derrotas, máxima prioridad)",
  GANADORES.every(g => groups.champions.some(p=>p.name===g)));
check("Premier + Serie B sí suman 2 (los perdedores que no entraron en Champions) + los 2 nuevos en Premier",
  groups.premier.length + groups.serieb.length === 4);
check("Los 2 que NUNCA jugaron ninguna batalla están en Premier (default, no en Champions ni Serie B)",
  NUNCA_JUGARON.every(n => groups.premier.some(p=>p.name===n)) &&
  !NUNCA_JUGARON.some(n => groups.champions.some(p=>p.name===n) || groups.serieb.some(p=>p.name===n)));
check("Serie B tiene exactamente 1 (el resto tras Champions=10 y Premier)", groups.serieb.length === 1);

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — getLigaDe() + restricción de Liga en startBattle()
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Restricción de Liga en startBattle() ──");

check("getLigaDe() de un ganador (Champions) da 'champions'", T.getLigaDe("G1") === "champions");
check("getLigaDe() de alguien que nunca jugó da 'premier'", T.getLigaDe("Nuevo1") === "premier");

W.document.getElementById("battle-slot1-p1").innerHTML = T.DB.participants.map(p=>`<option value="${p.name}">${p.name}</option>`).join("");
W.document.getElementById("battle-slot1-p2").innerHTML = W.document.getElementById("battle-slot1-p1").innerHTML;
W.document.getElementById("battle-slot1-p1").value = "G1"; // Champions
W.document.getElementById("battle-slot1-p2").value = "Nuevo1"; // Premier

let avisoLigaDistinta = false;
W.toast = (m,isErr)=>{ if(isErr) avisoLigaDistinta = true; };
T.startBattle(1);
check("startBattle() rechaza el duelo entre ligas distintas (Champions vs Premier)", avisoLigaDistinta === true);
check("No se creó ninguna batalla en la ranura 1", !T.S.battles[1]);

// Ahora 2 participantes de la MISMA liga (Premier, los 2 nuevos) sí deben poder pelear.
W.document.getElementById("battle-slot1-p1").value = "Nuevo1";
W.document.getElementById("battle-slot1-p2").value = "Nuevo2";
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
check("startBattle() SÍ permite el duelo dentro de la misma liga (Premier vs Premier), sin avisos de error",
  !!T.S.battles[1] && avisoLigaOk === false);
delete T.S.battles[1];

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
