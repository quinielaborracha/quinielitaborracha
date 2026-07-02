// Test funcional de Batallas (Fase 0 del brief de evolución): confirma que
// calcBattlePts() da el puntaje correcto en TODAS las fases del torneo
// (Grupos + las 6 rondas de Eliminatoria: Dieciseisavos, Octavos, Cuartos,
// Semifinales, Tercer/cuarto lugar, Gran Final), y que Avanzado y Bonos
// quedan SIEMPRE afuera del cálculo de una batalla (decisión tomada en el
// brief: una batalla mide la ventana puntual de partidos de ese día, no
// apuestas de todo el torneo ni premios acumulados).
//
// Carga los 22 archivos de producción en el mismo orden que index.html,
// mismo patrón de bridge que ya usan test_full_page_load.js/test_v1_6_ajustes.js.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES_IN_ORDER = [
  "participantes.js","partidos-grupos.js","utils.js","app-state.js","scoring.js","totp.js",
  "app-core-data.js","app-admin-auth.js","app-live-sync.js","app-tabs.js",
  "app-eliminatoria-data.js","app-batallas.js","app-bracket-render.js",
  "app-bracket-annexc.js","app-bracket-compute.js","app-bracket-espn-sync.js","app-bracket-view.js",
  "app-bracket-espn-live.js","app-integridad.js","app-predicciones.js",
  "app-estadisticas.js","app-admin-tools.js","app-bootstrap.js","registro.js"
];

const html = `<!doctype html><html><body>
  <div id="root"></div><div id="toast"></div><div id="integ-banner"></div>
  <img id="logo-img"><span id="admin-indicator"></span>
  <span id="hstat"></span><span id="hdr-master-badge"></span>
  <table><tbody id="rb"></tbody></table>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="rg-tabs"></div><div id="rg-content"></div>
  <div id="rbasic"></div><div id="radv"></div><div id="relim"></div><div id="rlast"></div>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = (m,e) => {};
window.isAdmin = () => false;
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

// Bridge: expone al scope de Node lo que hace falta (let/const de nivel
// superior no se vuelven window.X solos, mismo patrón que el resto de tests).
const bridge = window.document.createElement("script");
bridge.textContent = `
  window.__test = {
    DB, S, PID_TO_SLOT, ELIM_1_16_IDS, ELIM_ROUNDS, BONUS_PHASES,
    rebuildDynamicData, calcBattlePts, calcElimMatchPts, calcAdv, calcBonos,
    getRealElimTeams,
  };
`;
window.document.body.appendChild(bridge);
if (!window.__test){ console.error("❌ El bridge no se ejecutó."); process.exit(1); }
const T = window.__test;
const W = window;

const NAME = "Bracket Perfecto";
T.DB.participants = [{id:"p0", name:NAME, city:"C", country:"P"}];
T.DB.predictions = {p0:{}};
T.rebuildDynamicData();

/* ════════════════════════════════════════════════════════════════
   Confirmar los valores por defecto que sostienen toda la matemática
   de este test (si alguna vez cambian, este test debe re-derivarse).
   ════════════════════════════════════════════════════════════════ */
const RG = T.DB.configGlobal.reglas.grupos;
const RE = T.DB.configGlobal.reglas.elim;
check("Reglas de Grupos por defecto: ganador=2, exacto=3",
  RG.ganador===2 && RG.exacto===3);
check("Reglas de Eliminatoria por defecto: llave=2, ganador=2, exacto=3",
  RE.llave===2 && RE.ganador===2 && RE.exacto===3);

/* ════════════════════════════════════════════════════════════════
   FASE DE GRUPOS — 3 partidos "de hoy", marcador exacto (ganador+exacto)
   ════════════════════════════════════════════════════════════════ */
const baseTs = Date.parse("2026-06-11T12:00:00Z");
const GROUP_MIDS_HOY = [1,2,3];
GROUP_MIDS_HOY.forEach(mid=>{
  T.S.matchTimes[mid] = baseTs + mid*60000;
  T.S.scores[mid] = {h:2,a:1};
  T.DB.predictions.p0[mid] = {h:2,a:1}; // acierta ganador Y marcador exacto
});
T.rebuildDynamicData();
T.S.bonos.closed = T.S.bonos.closed || {};
T.S.bonos.closed.grupos = true;

const PTS_POR_PARTIDO_GRUPO = RG.ganador + RG.exacto; // 5
const basicoEsperado = GROUP_MIDS_HOY.length * PTS_POR_PARTIDO_GRUPO; // 15
check(`Básico: ${GROUP_MIDS_HOY.length} partidos de grupos exactos dan ${basicoEsperado}pts en la batalla`,
  T.calcBattlePts(NAME, GROUP_MIDS_HOY, []) === basicoEsperado);

/* ════════════════════════════════════════════════════════════════
   ELIMINATORIA — arma el bracket completo, ronda por ronda, usando las
   funciones REALES de resolución de equipos (getRealElimTeams) para no
   duplicar la lógica del árbol (ELIM_TREE) acá en el test.
   ════════════════════════════════════════════════════════════════ */
const PTS_POR_PARTIDO_ELIM = RE.llave + RE.ganador + RE.exacto; // 2+2+3 = 7
const ALL_ELIM_IDS = [];

function jugarRonda(pids, prevPhaseKey, roundKey){
  pids.forEach(pid=>{
    let teams;
    if (T.ELIM_1_16_IDS.includes(pid)){
      // Dieciseisavos: equipos "a mano" (editor admin/ESPN), no derivados del árbol.
      teams = {h:`H${pid}`, a:`A${pid}`};
      T.S.elimTeams[pid] = teams;
    } else {
      // Rondas posteriores: los equipos reales salen de derivar el árbol con
      // los resultados YA cargados de la ronda anterior — se usa la función
      // real de producción, no una reimplementación propia del árbol.
      teams = T.getRealElimTeams(pid);
    }
    T.S.elimTimes[pid] = baseTs + pid*60000;
    T.S.elimScores[pid] = {h:2,a:1}; // local gana 2-1, siempre
    const slot = T.PID_TO_SLOT[pid];
    // Predicción exacta y con la llave correcta: acierta equipos + marcador.
    T.DB.predictions.p0[slot] = {h:2,a:1,_a:teams.h,_b:teams.a};
    ALL_ELIM_IDS.push(pid);
  });
  T.rebuildDynamicData();
  T.S.bonos.closed[roundKey] = true;
}

jugarRonda(T.BONUS_PHASES.find(p=>p.key==="r16").mids, "grupos", "r16");
jugarRonda(T.BONUS_PHASES.find(p=>p.key==="r8").mids, "r16", "r8");
jugarRonda(T.BONUS_PHASES.find(p=>p.key==="qf").mids, "r8", "qf");
jugarRonda(T.BONUS_PHASES.find(p=>p.key==="sf").mids, "qf", "sf");
jugarRonda(T.BONUS_PHASES.find(p=>p.key==="final").mids, "sf", "final");
jugarRonda(T.BONUS_PHASES.find(p=>p.key==="third").mids, "sf", "third");

console.log("\n── Eliminatoria dentro de Batallas, ronda por ronda ──");
T.ELIM_ROUNDS.forEach(round=>{
  const esperado = round.ids.length * PTS_POR_PARTIDO_ELIM;
  const real = T.calcBattlePts(NAME, [], round.ids);
  check(`${round.lbl} (${round.ids.length} partido(s)): ${esperado}pts en una batalla de esa ventana`,
    real === esperado);
});

const elimEsperadoTotal = ALL_ELIM_IDS.length * PTS_POR_PARTIDO_ELIM;
check(`Eliminatoria completa (${ALL_ELIM_IDS.length} partidos, todas las rondas): ${elimEsperadoTotal}pts`,
  T.calcBattlePts(NAME, [], ALL_ELIM_IDS) === elimEsperadoTotal);

const totalEsperado = basicoEsperado + elimEsperadoTotal;
check(`Básico + Eliminatoria combinados (una batalla que cruza Grupos y Eliminatoria): ${totalEsperado}pts`,
  T.calcBattlePts(NAME, GROUP_MIDS_HOY, ALL_ELIM_IDS) === totalEsperado);

/* ════════════════════════════════════════════════════════════════
   Avanzado y Bonos: deben quedar SIEMPRE afuera del cálculo de Batallas
   (decisión del brief), aunque el participante tenga puntos ahí.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Avanzado y Bonos quedan afuera de Batallas ──");

T.S.reality = {champ:"Argentina",runner:"Francia",third:"Brasil",topScorer:"Messi",topScorerGoals:8,topCountry:"Argentina",topCountryGoals:15,mostConceded:"Alemania"};
T.S.adv[NAME] = {champ:"Argentina",runner:"Francia",third:"Brasil",scorer:"Messi",scorerGoals:8,topCountry:"Argentina",topCountryGoals:15,mostConceded:"Alemania"};
check("calcAdv() efectivamente da puntos (>0) con esta predicción avanzada perfecta",
  T.calcAdv(NAME) > 0);
check("calcBattlePts() NO se mueve al agregar Avanzado con puntos reales",
  T.calcBattlePts(NAME, GROUP_MIDS_HOY, ALL_ELIM_IDS) === totalEsperado);

T.S.bonos.lastPlace.grupos = {name:NAME, pts:8, total:0, phase:"Fase de Grupos"};
check("calcBonos() efectivamente da puntos (>0) con este Bono de último lugar",
  T.calcBonos(NAME) > 0);
check("calcBattlePts() NO se mueve al agregar Bonos con puntos reales",
  T.calcBattlePts(NAME, GROUP_MIDS_HOY, ALL_ELIM_IDS) === totalEsperado);

/* ════════════════════════════════════════════════════════════════
   Fase desactivada por el admin: una batalla sobre esa ventana da 0,
   igual que en el resto del sistema (Constructor de Torneos, v1.2).
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Fase desactivada dentro de Batallas ──");
T.DB.configGlobal.fasesActivas = T.DB.configGlobal.fasesActivas || {};
T.DB.configGlobal.fasesActivas.final = false;
check("Con 'Final' desactivada por el admin, una batalla sobre P104 da 0pts",
  T.calcBattlePts(NAME, [], [104]) === 0);
T.DB.configGlobal.fasesActivas.final = true; // reactivar para no afectar lo que sigue

/* ════════════════════════════════════════════════════════════════
   Multiplicador por ronda (Cuartos ×2): debe aplicar sobre
   Ganador/Empate + Marcador exacto, pero NUNCA sobre Llave.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Multiplicador por ronda dentro de Batallas ──");
T.DB.configGlobal.reglas.multiplicador = {activo:true, fases:{qf:2}};
const ptsQfConMultiplicador = RE.llave + (RE.ganador*2) + (RE.exacto*2); // 2 + 4 + 6 = 12
check(`Cuartos con multiplicador ×2: P97 da ${ptsQfConMultiplicador}pts (llave sin multiplicar + ganador/exacto ×2) en una batalla`,
  T.calcBattlePts(NAME, [], [97]) === ptsQfConMultiplicador);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
