// Test funcional del fix v3.9: la tarjeta "🎖️ Puntos por Jornada" (Mi
// Quiniela → Evolución) no sumaba lo mismo que el total real del
// Ranking -- solo agrupaba puntos de partido (Básicos/Eliminatoria),
// nunca los bonos (Último lugar/Racha/MVP/Batallas) ni Avanzado
// (campeón/goleador/etc.).
//
// Arreglo (ver notas en scoring.js/groupSnapshotsByJornada y
// registro.js/buildEvolucionJornadaCardHtml): el bono de MVP -- el ÚNICO
// de los 5 bonos con una fecha exacta y sin ambigüedad -- ahora se suma
// día por día, y el resto (que no tiene una jornada limpia a la que
// atribuirse: Último lugar/Racha/Batallas/Avanzado) se muestra como un
// residuo aparte, calculado como `total real - suma de las barras`. Este
// test verifica que esa suma + residuo sea SIEMPRE exactamente igual al
// total que muestra el Ranking (getDashStatsInfo().total).
//
// Mismo patrón de carga que test_evolucion_v1_5.js (22 archivos +
// registro.js con bridge dentro de su IIFE).
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
  <div id="rg-tabs"><button class="rg-tab on" data-tab="inicio">Inicio</button></div>
  <div id="rg-content"></div>
  <div id="toast"></div>
  <div id="em_continue"></div><div id="em_save_exit"></div><div id="em_discard"></div>
  <div id="block_ok"></div><div id="block_goto"></div>
  <div id="exitModal" style="display:none"></div><div id="blockModal" style="display:none"></div>
  <div id="blockModalText"></div><div id="pdfPoster"></div>
  <div id="root"></div><div id="integ-banner"></div><img id="logo-img"><span id="admin-indicator"></span>
</body></html>`;

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.toast = () => {};
window.isAdmin = () => false;
window.setInterval = () => 0;
window.confirm = () => true;
window.alert = () => {};
window.__fb = null;

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

for (const f of FILES_IN_ORDER) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

let regCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
const closeIdx = regCode.lastIndexOf("})();");
if (closeIdx === -1) throw new Error("No se encontró el cierre de la IIFE en registro.js");
const bridge = `
window.__test = { DB, S, getDashStatsInfo, buildEvolucionJornadaCardHtml };
`;
regCode = regCode.slice(0, closeIdx) + bridge + regCode.slice(closeIdx);
const regScript = window.document.createElement("script");
regScript.textContent = regCode;
window.document.body.appendChild(regScript);

const T = window.__test;
const W = window;

// ── Fixture: 3 participantes, 4 partidos de grupos en 2 días. Ana
// acierta EXACTO los 4 (única en la punta los 2 días -> MVP sin empates,
// asserts deterministas); Beto/Carla siempre fallan. ──
const NAMES = ["Ana", "Beto", "Carla"];
T.DB.participants = NAMES.map((n, i) => ({ id: "p" + i, name: n, city: "", country: "" }));
T.DB.predictions = {}; NAMES.forEach((n, i) => { T.DB.predictions["p" + i] = {}; });

const baseTs = Date.parse("2026-06-11T12:00:00Z");
const DAY = 24 * 3600 * 1000;
for (let mid = 1; mid <= 4; mid++) {
  const dayOffset = mid <= 2 ? 0 : 1; // mids 1-2 día 1, mids 3-4 día 2
  T.S.matchTimes[mid] = baseTs + dayOffset * DAY + mid * 60000;
  T.S.scores[mid] = { h: 2, a: 1 };
  T.DB.predictions.p0[mid] = { h: 2, a: 1 }; // Ana: exacto siempre (2+3=5pts/partido)
  T.DB.predictions.p1[mid] = { h: 0, a: 0 }; // Beto: siempre falla
  T.DB.predictions.p2[mid] = { h: 0, a: 3 }; // Carla: siempre falla
}
W.rebuildDynamicData();

// MVP activo (5 pts/día) + Racha activa (hito en 3 aciertos = 6 pts) --
// mismo criterio de "acierto" que ya usa buildChronologicalResults() (le
// pega al ganador/empate, no hace falta el marcador exacto).
T.DB.configGlobal.fasesActivas = {};
T.DB.configGlobal.reglas = T.DB.configGlobal.reglas || {};
T.DB.configGlobal.reglas.mvp = { activo: true, pts: 5 };
T.DB.configGlobal.reglas.racha = { activo: true, hitos: [{ n: 3, pts: 6 }] };

const stats = T.getDashStatsInfo(T.DB.participants[0]); // Ana
console.log(`Ana -- calcPts=${W.calcPts("Ana")} calcAdv=${W.calcAdv("Ana")} calcElimPts=${W.calcElimPts("Ana")} calcBonos=${W.calcBonos("Ana")} total=${stats.total}`);

const events = W.getChronoMatchEvents();
const snapshots = W.buildHistoricalSnapshots(events);
const days = W.groupSnapshotsByJornada(snapshots);

check("Se detectan 2 jornadas (día 1 y día 2)", days.length === 2);

const day1Val = (days[0].endCum["Ana"] || 0) - (days[0].startCum["Ana"] || 0);
const day2Val = (days[1].endCum["Ana"] || 0) - (days[1].startCum["Ana"] || 0);
console.log(`Jornada 1 = ${day1Val} pts, Jornada 2 = ${day2Val} pts para Ana`);

check("Jornada 1 incluye los 10pts de partido (5+5, exacto en los 2 mids) MÁS 5pts de MVP del día = 15",
  day1Val === 15);
check("Jornada 2 también son 10pts de partido + 5pts de MVP = 15 (Ana vuelve a ser la única líder de ese día)",
  day2Val === 15);

const sumDias = day1Val + day2Val;
check("La SUMA de las 2 jornadas (30) + el residuo (6, del bono de Racha) da EXACTO el total del Ranking (36)",
  sumDias + (stats.total - sumDias) === stats.total && stats.total === 36
);
check("El residuo calculado (total - suma de jornadas) es exactamente 6 -- el bono de Racha, que no tiene jornada propia",
  (stats.total - sumDias) === 6
);

const cardHtml = T.buildEvolucionJornadaCardHtml("Ana", days, stats.total);
check("La tarjeta muestra la barra de composición con jornadas=30, bonos=6 y total=36",
  /36<span[^>]*>pts<\/span>/.test(cardHtml) &&
  /title="Jornadas jugadas: 30 pts"/.test(cardHtml) &&
  /title="Avanzado\/bonos: 6 pts"/.test(cardHtml) &&
  /Jornadas jugadas <b[^>]*>30<\/b>/.test(cardHtml) &&
  /Avanzado\/bonos <b[^>]*>6<\/b>/.test(cardHtml)
);
check("La barra de la Jornada 1 SIGUE mostrando 15 -- el residuo no se le pega a ninguna barra", />15<\/text>/.test(cardHtml));
check("La barra de la Jornada 2 TAMBIÉN sigue mostrando 15 (no 21) -- ya no se infla ninguna barra con el residuo",
  cardHtml.match(/>15<\/text>/g)?.length === 2 && !cardHtml.includes(">21<")
);
check("Ninguna etiqueta de jornada lleva asterisco (ya no se marca ninguna barra)", !cardHtml.includes("*<"));

/* ── Sin bonos activos (caso más común hoy): el residuo debe ser 0 y la
   línea de residuo no debe aparecer -- mismo comportamiento que antes
   del fix para un torneo sin Racha/MVP/Batallas activados. ── */
console.log("\n── Sin bonos activos (Racha/MVP apagados) ──");
T.DB.configGlobal.reglas.mvp = { activo: false };
T.DB.configGlobal.reglas.racha = { activo: false };
// calcMvpBonos() cachea el líder de cada día en _mvpCache y solo se
// invalida al llamar getRank() -- getDashStatsInfo() llama calcBonos()
// (que lee esa caché) ANTES de llamar getRank() (que recién ahí la
// refresca), así que hace falta una llamada de por medio para que la
// próxima ya lea el config nuevo (en la app real esto lo garantiza
// cualquier renderRank() de fondo antes de abrir Evolución).
W.getRank();
const stats2 = T.getDashStatsInfo(T.DB.participants[0]);
const events2 = W.getChronoMatchEvents();
const days2 = W.groupSnapshotsByJornada(W.buildHistoricalSnapshots(events2));
const sum2 = days2.reduce((s, d) => s + ((d.endCum["Ana"] || 0) - (d.startCum["Ana"] || 0)), 0);
check("Sin bonos activos, la suma de jornadas YA coincide sola con el total (residuo 0)", sum2 === stats2.total);
const cardHtml2 = T.buildEvolucionJornadaCardHtml("Ana", days2, stats2.total);
check("Sin residuo, la tarjeta NO muestra ningún resumen de 'pts de Avanzado/bonos'", !cardHtml2.includes("pts de Avanzado"));

console.log("\n=== RESULTADO FINAL:", allOk ? "TODOS LOS CASOS PASAN ✅" : "HAY FALLOS ❌", "===");
process.exit(allOk ? 0 : 1);
