// Test funcional de v4.0: Premio de Batallas -- "Vitrina de Avatares".
//
// Ganar batallas (1v1 o Royal Rumble) destraba avatares ALTERNATIVOS al
// automático de siempre (país campeón predicho, pickAvatarFile): primero
// las variantes del país campeón, después las del país de residencia
// (unlockedAvatarPool(), utils.js), en ese orden fijo -- la victoria #1
// destraba el primero, la #2 el segundo, etc. effectiveAvatarFile()
// (utils.js) decide cuál mostrar: la elección propia (p.avatarElegido) SI
// sigue siendo válida contra el pool ACTUAL, si no cae al automático.
// avatarOfChampion() (app-core-data.js) es el único punto de entrada que
// usa el resto de la app (Ranking, Batallas, Predicciones, PDF...), así
// que alcanza con probarlo a él para cubrir todos los call-sites.
//
// Mismo patrón de carga que test_postulacion_batallas.js (24 archivos +
// registro.js con bridge dentro de su IIFE).
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
  <div id="rg-tabs"><button class="rg-tab on" data-tab="inicio">Inicio</button></div>
  <div id="rg-content"></div>
  <div id="toast"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
  <span id="hstat"></span><span id="hdr-master-badge"></span><span id="hdr-today"></span>
  <table><tbody id="rb"></tbody></table>
  <div id="rbasic"></div><div id="radv"></div><div id="relim"></div><div id="rlast"></div>
  <div id="t-battles" style="display:block">
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

let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = {
  DB, S, AVATAR_MAP, get DRAFT_PID(){ return DRAFT_PID; }, set DRAFT_PID(v){ DRAFT_PID = v; },
  renderParticipantDashboard, _rgPublicFieldsOf, _rgPrivadoFieldsOf,
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
W.isAdmin = () => false; // sesión real de participante

/* ════════════════════════════════════════════════════════════════
   PARTE 1 — unlockedAvatarPool(): orden (país campeón primero, país de
   residencia después), sin duplicar si son el mismo país, recortado a
   la cantidad de victorias.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── unlockedAvatarPool() ──");

const brasil = T.AVATAR_MAP["Brasil"]; // 3 variantes conocidas
const argentina = T.AVATAR_MAP["Argentina"]; // 2 variantes conocidas
check("Fixture: Brasil tiene 3 variantes y Argentina 2 (si esto falla, AVATAR_MAP cambió)",
  brasil.length === 3 && argentina.length === 2);

check("0 victorias -> pool vacío", W.unlockedAvatarPool("Brasil","Argentina",0).length === 0);
check("1 victoria -> el primer avatar de Brasil (país campeón, máxima prioridad)",
  W.unlockedAvatarPool("Brasil","Argentina",1).length === 1 &&
  W.unlockedAvatarPool("Brasil","Argentina",1)[0] === brasil[0]);
check("3 victorias -> las 3 variantes de Brasil, ninguna de Argentina todavía",
  JSON.stringify(W.unlockedAvatarPool("Brasil","Argentina",3)) === JSON.stringify(brasil));
check("4 victorias -> las 3 de Brasil + la 1ra de Argentina (empieza el 2do país)",
  JSON.stringify(W.unlockedAvatarPool("Brasil","Argentina",4)) === JSON.stringify([...brasil, argentina[0]]));
check("5 victorias (= tamaño total del pool) -> Brasil completo + Argentina completo",
  JSON.stringify(W.unlockedAvatarPool("Brasil","Argentina",5)) === JSON.stringify([...brasil, ...argentina]));
check("9 victorias (más que el pool) -> no se pasa del tamaño total (5), no revienta",
  W.unlockedAvatarPool("Brasil","Argentina",9).length === 5);
check("País campeón y país de residencia IGUALES -> no se duplica (pool = solo esas variantes, no el doble)",
  JSON.stringify(W.unlockedAvatarPool("Brasil","Brasil",9)) === JSON.stringify(brasil));
check("País de residencia sin ninguna entrada en AVATAR_MAP (ej. Suiza) -> esa parte del pool queda vacía, sin romper",
  JSON.stringify(W.unlockedAvatarPool("Brasil","Suiza",9)) === JSON.stringify(brasil));

/* ════════════════════════════════════════════════════════════════
   PARTE 2 — effectiveAvatarFile(): prioridad a la elección propia SI
   sigue siendo válida contra el pool actual; si no, automático.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── effectiveAvatarFile() ──");

const auto = W.pickAvatarFile("Brasil","Fulano");
check("Sin avatarElegido -> devuelve el automático de siempre",
  W.effectiveAvatarFile("Brasil", {name:"Fulano", country:"Argentina"}, 3) === auto);
check("Con 0 victorias, aunque avatarElegido tenga un valor -> cae al automático (nada desbloqueado todavía)",
  W.effectiveAvatarFile("Brasil", {name:"Fulano", country:"Argentina", avatarElegido:brasil[0]}, 0) === auto);
check("Con avatarElegido DENTRO del pool actual -> devuelve exactamente esa elección",
  W.effectiveAvatarFile("Brasil", {name:"Fulano", country:"Argentina", avatarElegido:brasil[1]}, 2) === brasil[1]);
check("Con avatarElegido FUERA del pool actual todavía (ej. eligió el 2do país con pocas victorias) -> cae al automático",
  W.effectiveAvatarFile("Brasil", {name:"Fulano", country:"Argentina", avatarElegido:argentina[0]}, 2) === auto);
check("Elección que YA no entra tras perder una victoria (admin corrige un resultado) -> se cae sola, sin revocar nada a mano",
  W.effectiveAvatarFile("Brasil", {name:"Fulano", country:"Argentina", avatarElegido:brasil[2]}, 1) === auto);

/* ════════════════════════════════════════════════════════════════
   PARTE 3 — totalBattleWins(): suma 1v1 + Royal Rumble
   ════════════════════════════════════════════════════════════════ */
console.log("\n── totalBattleWins() ──");

T.S.battleHistory = [
  {name:"d1", p1:"Ana", p2:"Beto", winner:"Ana", date:"d"},
  {name:"d2", p1:"Ana", p2:"Carla", winner:"Ana", date:"d"},
  {name:"d3", p1:"Ana", p2:"Diego", winner:"Diego", date:"d"}, // esta la pierde
];
T.S.rumbleHistory = [
  {name:"r1", winner:"Ana", puntos:{Ana:10,Beto:5}, date:"d"},
];
check("Ana: 2 victorias 1v1 + 1 de Rumble = 3 en total", W.totalBattleWins("Ana") === 3);
check("Diego: 1 victoria 1v1 (le ganó a Ana), 0 de Rumble = 1", W.totalBattleWins("Diego") === 1);
check("Beto: nunca ganó nada (perdió su duelo, no ganó el Rumble) = 0", W.totalBattleWins("Beto") === 0);

/* ════════════════════════════════════════════════════════════════
   PARTE 4 — avatarOfChampion(): integra todo lo de arriba, es el único
   punto de entrada que usa el resto de la app.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── avatarOfChampion(): integración de punta a punta ──");

T.DB.participants = [{id:"pA", name:"Ana", city:"C", country:"Argentina"}];
T.DB.predictions = {pA:{special:{campeon:"Brasil"}}};
W.rebuildDynamicData();

check("Ana (3 victorias, sin elegir nada) -> avatar automático (Brasil)",
  T.DB.participants[0].avatarElegido === undefined && W.avatarOfChampion("Ana") === W.pickAvatarFile("Brasil","Ana"));

T.DB.participants[0].avatarElegido = brasil[1]; // dentro del pool con 3 victorias
W.rebuildDynamicData();
check("Ana elige la 2da variante de Brasil (le entra con 3 victorias) -> avatarOfChampion la refleja",
  W.avatarOfChampion("Ana") === brasil[1]);

T.S.battleHistory = [{name:"d1", p1:"Ana", p2:"Beto", winner:"Ana", date:"d"}]; // Ana baja a 1 victoria 1v1
T.S.rumbleHistory = [];
W.rebuildDynamicData();
check("Tras perder 2 victorias, la elección (2do lugar del pool) ya no entra -> vuelve sola al automático",
  W.avatarOfChampion("Ana") === W.pickAvatarFile("Brasil","Ana"));

/* ════════════════════════════════════════════════════════════════
   PARTE 5 — Persistencia: avatarElegido viaja al documento PÚBLICO
   (a diferencia de quierePelear, que es privado) -- es un dato
   cosmético, no hay ninguna razón para ocultarlo.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Persistencia: avatarElegido es público ──");

const pFake = {id:"p0", name:"Test", city:"C", country:"Argentina", clave:"123456", email:"x@x.com", avatarElegido:brasil[0]};
check("_rgPublicFieldsOf() SÍ incluye avatarElegido (a diferencia de quierePelear)",
  T._rgPublicFieldsOf(pFake).avatarElegido === brasil[0]);
check("_rgPrivadoFieldsOf() NO incluye avatarElegido (no tiene nada que hacer en el documento privado)",
  !("avatarElegido" in T._rgPrivadoFieldsOf(pFake)));

/* ════════════════════════════════════════════════════════════════
   PARTE 6 — UI del Dashboard: "Vitrina de Avatares"
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Vitrina de Avatares en el Dashboard ──");

T.DB.participants = [{id:"pE", name:"Elena", city:"C", country:"Argentina", estadoQuiniela:"enviada"}];
T.DB.predictions = {pE:{special:{campeon:"Brasil"}}};
T.S.battleHistory = [];
T.S.rumbleHistory = [];
W.rebuildDynamicData();
T.DRAFT_PID = "pE";

let renderEx=null;
try{ T.renderParticipantDashboard("pE"); }catch(e){ renderEx=e; }
check("El Dashboard renderiza sin excepción con 0 victorias", !renderEx);
check("Con 0 victorias, se muestra el mensaje de 'ganá tu primera Batalla' (sin grilla todavía)",
  W.document.body.innerHTML.includes("Ganá tu primera Batalla") && !W.document.getElementById("avatar-picker-grid"));

T.S.battleHistory = [
  {name:"d1", p1:"Elena", p2:"X", winner:"Elena", date:"d"},
  {name:"d2", p1:"Elena", p2:"Y", winner:"Elena", date:"d"},
];
W.rebuildDynamicData();
T.renderParticipantDashboard("pE");
const grid = W.document.getElementById("avatar-picker-grid");
check("Con 2 victorias, aparece la grilla del selector", !!grid);
check("La grilla tiene 3 opciones: 'Automático' + las 2 primeras variantes de Brasil desbloqueadas",
  grid.querySelectorAll("[data-avatar-file]").length === 3);
check("La opción 'Automático' tiene data-avatar-file vacío",
  grid.querySelector('[data-avatar-file=""]') !== null);
check("La 2da variante de Brasil (desbloqueada con 2 victorias) está entre las opciones",
  !!grid.querySelector(`[data-avatar-file="${brasil[1]}"]`));
check("La 3ra variante de Brasil (todavía NO desbloqueada, hacen falta 3 victorias) NO está entre las opciones",
  !grid.querySelector(`[data-avatar-file="${brasil[2]}"]`));

grid.querySelector(`[data-avatar-file="${brasil[1]}"]`).click();
const elenaTrasClick = T.DB.participants.find(p=>p.name==="Elena");
check("Click en la 2da variante -> avatarElegido queda guardado en el participante",
  elenaTrasClick.avatarElegido === brasil[1]);

const gridTrasClick = W.document.getElementById("avatar-picker-grid");
check("Tras el click, avatarOfChampion('Elena') ya refleja la elección nueva",
  W.avatarOfChampion("Elena") === brasil[1]);

gridTrasClick.querySelector('[data-avatar-file=""]').click();
check("Click en 'Automático' -> vuelve a avatarElegido:'' (no queda ninguna elección propia)",
  T.DB.participants.find(p=>p.name==="Elena").avatarElegido === "");

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
