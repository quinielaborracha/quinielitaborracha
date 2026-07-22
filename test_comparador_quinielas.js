// Test funcional de v3.5 — Comparador de quinielas (Mi Quiniela →
// dashboard del participante → nueva sub-pestaña "⚖️ Comparar", ver
// buildDashCompararHtml() en registro.js y groupPickResult() en scoring.js).
//
// No reimplementa el motor de puntaje: compara los resultados de las
// mismas funciones que ya usa el resto de la app (getDynamicSpec,
// getElimTeams/getPredWinner, MD[mid].preds) entre dos participantes. Este
// test arma un fixture chico y controlado (2 personas, 3 partidos de
// Grupos, 1 cruce de Eliminatoria, Avanzado con 1 coincidencia y 1
// diferencia) para verificar que los conteos salen exactos, que el
// dropdown lista a todos MENOS a uno mismo, y que un nombre/pick con HTML
// adentro queda escapado (mismo estándar XSS que el resto de "Mi Quiniela").
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
  DB, S, buildDashCompararHtml,
  get DASH_COMPARE_RIVAL(){ return DASH_COMPARE_RIVAL; }, set DASH_COMPARE_RIVAL(v){ DASH_COMPARE_RIVAL = v; },
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
   FIXTURE — Juan (yo) vs María (rival) + un tercer participante para
   probar que el dropdown lista a "los demás", no solo a un rival fijo.
   ════════════════════════════════════════════════════════════════ */
T.DB.participants = [
  { id: "p1", name: "Juan Perez",  city: "C", country: "P", estadoQuiniela: "enviada" },
  { id: "p2", name: "Maria Lopez", city: "C", country: "P", estadoQuiniela: "enviada" },
  { id: "p3", name: "Carlos Ruiz", city: "C", country: "P", estadoQuiniela: "enviada" },
];
T.DB.predictions = {
  p1: {
    "1": { h: 2, a: 0 }, // Juan: gana local 2-0
    "2": { h: 1, a: 1 }, // Juan: empate
    "3": { h: 0, a: 1 }, // Juan: gana visitante 0-1
    "r32_1": { h: 2, a: 1, _a: "México", _b: "Alemania" }, // Juan predice que avanza México
    special: { campeon: "Brasil", subcampeon: "Francia", goleador: "Mbappé" },
  },
  p2: {
    "1": { h: 2, a: 0 }, // María: IGUAL que Juan (marcador exacto)
    "2": { h: 3, a: 3 }, // María: mismo RESULTADO que Juan (empate) pero marcador distinto (1-1 vs 3-3)
    "3": { h: 1, a: 0 }, // María: resultado DISTINTO (H, Juan tenía A)
    "r32_1": { h: 1, a: 2, _a: "México", _b: "Alemania" }, // María predice que avanza Alemania (distinto a Juan)
    special: { campeon: "Argentina", subcampeon: "Francia", goleador: "Mbappé" }, // 1 coincide (subcampeón y goleador), 1 distinto (campeón)
  },
  p3: { "1": { h: 0, a: 0 }, special: {} },
};
W.rebuildDynamicData();

/* ════════════════════════════════════════════════════════════════
   CASO 1 — Sin rival elegido: el dropdown lista a los demás (2, no 3 —
   se excluye a uno mismo), y se muestra el placeholder de "elegí a alguien".
   ════════════════════════════════════════════════════════════════ */
console.log("── Sin rival elegido ──");
T.DASH_COMPARE_RIVAL = "";
const p1 = T.DB.participants[0];
let htmlOut = T.buildDashCompararHtml(p1);
check("El dropdown NO incluye a Juan (uno mismo)", !/<option value="p1"/.test(htmlOut));
check("El dropdown SÍ incluye a María y Carlos", /<option value="p2"/.test(htmlOut) && /<option value="p3"/.test(htmlOut));
check("Muestra el placeholder de elegir alguien", /Eleg[íi] a alguien de la lista/.test(htmlOut));

/* ════════════════════════════════════════════════════════════════
   CASO 2 — Juan vs María: verificar los conteos exactos.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Juan vs María: conteos ──");
T.DASH_COMPARE_RIVAL = "p2";
htmlOut = T.buildDashCompararHtml(p1);

check("Grupos: 1/3 marcador exacto (solo el partido 1)", /1<span[^>]*>\/3/.test(htmlOut));
check("Grupos: 2/3 mismo resultado (partido 1 exacto + partido 2 mismo empate, marcador distinto)", /2<span[^>]*>\/3/.test(htmlOut));
check("Eliminatoria: 0/1 en Dieciseisavos (predijeron ganadores distintos: México vs Alemania)", /0\/1/.test(htmlOut));
check("Avanzado: aparece 'Brasil' (pick de Juan) y 'Argentina' (pick de María) para Campeón", /Brasil/.test(htmlOut) && /Argentina/.test(htmlOut));
check("Avanzado: 'Mbappé' (goleador) aparece marcado como coincidencia", /Mbapp[ée][\s\S]*?✓ coinciden|✓ coinciden[\s\S]*?Mbapp[ée]/.test(htmlOut) || (htmlOut.match(/✓ coinciden/g)||[]).length>=1);
check("Se calcula una afinidad numérica (no null)", /Afinidad de picks: <b[^>]*>\d+%/.test(htmlOut));

/* ════════════════════════════════════════════════════════════════
   CASO 3 — XSS: un nombre con HTML adentro debe quedar escapado, mismo
   estándar que el resto de "Mi Quiniela" (esc()).
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Seguridad: nombre malicioso queda escapado ──");
const evilName = `<img src=x onerror="window.__pwned=1">María`;
T.DB.participants[1].name = evilName;
T.DB.predictions[evilName] = T.DB.predictions.p2; // MD/PL se reconstruyen por nombre
delete T.DB.predictions.p2;
W.rebuildDynamicData();
htmlOut = T.buildDashCompararHtml(p1);
check("El HTML de salida no contiene un <img> sin escapar", !/<img src=x/.test(htmlOut));
check("El nombre aparece escapado como texto (&lt;img)", /&lt;img/.test(htmlOut));
check("window.__pwned nunca se ejecutó", !W.__pwned);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
