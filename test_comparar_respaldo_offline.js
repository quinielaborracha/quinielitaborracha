// Test funcional de v3.6 — Comparar con respaldo offline (Admin → 🔒
// Integridad, ver compararRespaldoOffline()/_icCompararConLive() en
// app-integridad.js).
//
// Motivación real: resultados/predicciones de participantes aparecieron
// cambiados sin que el admin lo pidiera. Este feature deja cargar un
// archivo "Info de participantes" (mismo formato de
// exportarInfoParticipantes(), registro.js) que el admin guardó offline
// cuando estaba seguro de que los datos eran correctos, y lo compara
// campo por campo contra lo que hay en línea AHORA MISMO -- sin escribir
// nada, solo informa diferencias y deja un resumen en S.integrityChecks.
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
  <div id="rg-tabs"></div><div id="rg-content"></div><div id="admin-content"></div>
  <div id="integ-results"></div><div id="integ-changelog"></div>
  <div id="integ-compare-result"></div><div id="integ-compare-history"></div>
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

const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = "window.__test = { S, getDB: () => DB };";
window.document.body.appendChild(bridgeScript);
if (!window.__test){ console.error("❌ El puente no se ejecutó."); process.exit(1); }

const W = window;
const T = window.__test;
W.S = T.S;

function subirRespaldo(payload){
  W.FileReader = function(){
    this.readAsText = () => { this.onload({ target: { result: JSON.stringify(payload) } }); };
  };
  const fakeInput = { files: [{ name: "respaldo_test.json" }], value: "" };
  W.compararRespaldoOffline(fakeInput);
}

function baseRespaldo(){
  return {
    tipo: "quinielaborracha_info_participantes",
    version: "2.9",
    exportedAt: new Date().toISOString(),
    participantes: [
      { codigo: "QLB-1", nombre: "Ana", correo: "ana@x.com", estado: "enviada", ownerUid: "uid-ana",
        predicciones: { 1: { h: 2, a: 1 }, r16_1: { h: 2, a: 0, _a: "México", _b: "Alemania" }, special: { campeon: "Argentina" } } },
      { codigo: "QLB-2", nombre: "Beto", correo: "beto@x.com", estado: "enviada", ownerUid: "uid-beto",
        predicciones: { 1: { h: 0, a: 0 }, r16_1: { h: 1, a: 1, pick: "Alemania", _a: "México", _b: "Alemania" } } },
    ],
  };
}

T.getDB().participants = [
  { id: "p1", codigo: "QLB-1", name: "Ana", email: "ana@x.com", estadoQuiniela: "enviada", ownerUid: "uid-ana" },
  { id: "p2", codigo: "QLB-2", name: "Beto", email: "beto@x.com", estadoQuiniela: "enviada", ownerUid: "uid-beto" },
];
T.getDB().predictions = {
  p1: { 1: { h: 2, a: 1 }, r16_1: { h: 2, a: 0, _a: "México", _b: "Alemania" }, special: { campeon: "Argentina" } },
  p2: { 1: { h: 0, a: 0 }, r16_1: { h: 1, a: 1, pick: "Alemania", _a: "México", _b: "Alemania" } },
};

/* ════════════════════════════════════════════════════════════════
   CASO 1 — Respaldo idéntico a lo que hay en línea: no debe reportar
   ninguna diferencia.
   ════════════════════════════════════════════════════════════════ */
console.log("── Respaldo idéntico a los datos en línea ──");
subirRespaldo(baseRespaldo());
check("El resultado en pantalla dice que no hay diferencias",
  /sin diferencias|Ningún participante tiene diferencias/i.test(W.document.getElementById("integ-compare-result").innerHTML));
check("Se guardó UNA entrada en el historial de comparaciones", W.S.integrityChecks.length === 1);
check("La entrada dice 0 participantes con cambios", W.S.integrityChecks[0].numConCambios === 0);
check("La entrada dice 2 comparados", W.S.integrityChecks[0].totalComparados === 2);

/* ════════════════════════════════════════════════════════════════
   CASO 2 — Una predicción cambió en línea respecto al respaldo: debe
   aparecer Ana con el antes/después correcto.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Una predicción cambió en línea (tampering simulado) ──");
T.getDB().predictions.p1[1] = { h: 3, a: 1 };
subirRespaldo(baseRespaldo());
const resultHtml2 = W.document.getElementById("integ-compare-result").innerHTML;
check("El resultado marca 1 participante con diferencias", W.S.integrityChecks[0].numConCambios === 1);
check("Ana aparece en el detalle de diferencias", resultHtml2.includes("Ana"));
check("Se ve el resultado viejo (2-1) y el nuevo (3-1)", resultHtml2.includes("2-1") && resultHtml2.includes("3-1"));
check("Beto NO aparece como afectado (su predicción no cambió)",
  !W.S.integrityChecks[0].afectados.some(a => a.codigo === "QLB-2"));

/* ════════════════════════════════════════════════════════════════
   CASO 2B — BUG REPORTADO (v3.6.1): cuando el bracket avanza, _a/_b (los
   nombres de los dos equipos de un slot de eliminatoria) se actualizan
   SOLOS para todo el mundo (ver registro.js:639-640) -- eso NO es un
   cambio de predicción y NO debe marcarse como diferencia, aunque el pick
   real (h/a) siga siendo exactamente el mismo.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── _a/_b cambian solos por avance del bracket: NO debe marcarse como diferencia ──");
T.getDB().predictions.p1[1] = { h: 2, a: 1 }; // deshacer el cambio del CASO anterior
T.getDB().predictions.p1.r16_1 = { h: 2, a: 0, _a: "México (corregido)", _b: "Alemania" }; // mismo pick, solo cambió el nombre snapshot
subirRespaldo(baseRespaldo());
check("Sin diferencias: _a/_b no son parte de la predicción real", W.S.integrityChecks[0].numConCambios === 0);

console.log("\n── Pero un pick real distinto SÍ se detecta, aunque _a/_b sean iguales ──");
T.getDB().predictions.p2.r16_1 = { h: 1, a: 1, pick: "México", _a: "México", _b: "Alemania" }; // Beto predijo Alemania, ahora dice México
subirRespaldo(baseRespaldo());
const resultHtml2b = W.document.getElementById("integ-compare-result").innerHTML;
check("Se detecta el cambio de pick real (Alemania → México)",
  W.S.integrityChecks[0].numConCambios === 1 && resultHtml2b.includes("Ganador: Alemania") && resultHtml2b.includes("Ganador: México"));
T.getDB().predictions.p1.r16_1 = { h: 2, a: 0, _a: "México", _b: "Alemania" }; // restaurar
T.getDB().predictions.p2.r16_1 = { h: 1, a: 1, pick: "Alemania", _a: "México", _b: "Alemania" }; // restaurar

/* ════════════════════════════════════════════════════════════════
   CASO 3 — El "special" (Reglas Avanzadas) también se compara, no solo
   los partidos de grupos/eliminatoria.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Un bono de Reglas Avanzadas cambió (campeón) ──");
T.getDB().predictions.p1[1] = { h: 2, a: 1 }; // deshacer el cambio anterior
T.getDB().predictions.p1.special = { campeon: "Brasil" };
subirRespaldo(baseRespaldo());
const resultHtml3 = W.document.getElementById("integ-compare-result").innerHTML;
check("Se detecta el cambio de campeón (Argentina → Brasil)",
  resultHtml3.includes("Argentina") && resultHtml3.includes("Brasil"));
T.getDB().predictions.p1.special = { campeon: "Argentina" }; // restaurar para los próximos casos

/* ════════════════════════════════════════════════════════════════
   CASO 4 — El dueño (ownerUid) de una cuenta cambió respecto al
   respaldo: se marca como posible reclamo, aunque las predicciones
   sean iguales.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── El ownerUid de una cuenta cambió (posible reclamo) ──");
T.getDB().participants.find(p => p.codigo === "QLB-2").ownerUid = "uid-otro-dispositivo";
subirRespaldo(baseRespaldo());
const resultHtml4 = W.document.getElementById("integ-compare-result").innerHTML;
check("Se marca a Beto con diferencias por el cambio de dueño", resultHtml4.includes("Beto"));
check("El aviso menciona el dueño de la cuenta", /Dueño de la cuenta/i.test(resultHtml4));
T.getDB().participants.find(p => p.codigo === "QLB-2").ownerUid = "uid-beto"; // restaurar

/* ════════════════════════════════════════════════════════════════
   CASO 5 — Un respaldo viejo (versión 2.8.1, sin ownerUid) no debe
   generar falsos positivos de "reclamo de cuenta" solo por no traer
   ese campo.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Un respaldo sin ownerUid (formato viejo) no genera falso positivo ──");
const respaldoViejo = baseRespaldo();
respaldoViejo.version = "2.8.1";
delete respaldoViejo.participantes[0].ownerUid;
delete respaldoViejo.participantes[1].ownerUid;
subirRespaldo(respaldoViejo);
check("Sin diferencias (el respaldo viejo no trae ownerUid para comparar)", W.S.integrityChecks[0].numConCambios === 0);

/* ════════════════════════════════════════════════════════════════
   CASO 6 — Participante en el respaldo que ya no existe en línea
   (borrado), y uno nuevo en línea que no estaba en el respaldo.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Faltantes (borrados) y nuevos (registrados después) ──");
T.getDB().participants.push({ id: "p3", codigo: "QLB-3", name: "Carla", estadoQuiniela: "borrador", ownerUid: "uid-carla" });
T.getDB().predictions.p3 = {};
const respaldoConBorrado = baseRespaldo();
// "Diego" estaba en el respaldo (se guardó offline en su momento) pero ya
// no existe en línea -- simula que alguien lo borró después.
respaldoConBorrado.participantes.push({ codigo: "QLB-4", nombre: "Diego", estado: "borrador", predicciones: {} });
subirRespaldo(respaldoConBorrado); // Carla (en línea) no está en el respaldo; Diego (en el respaldo) ya no está en línea
const resultHtml6 = W.document.getElementById("integ-compare-result").innerHTML;
check("Diego aparece como faltante (estaba en el respaldo, ya no en línea)", /Diego/.test(resultHtml6) && /ya no existen en línea/i.test(resultHtml6));
check("Carla aparece como nueva (está en línea, no en el respaldo)", /Carla/.test(resultHtml6) && /no estaban en el respaldo/i.test(resultHtml6));

/* ════════════════════════════════════════════════════════════════
   CASO 6B — BUG REPORTADO (v3.6.2): "codigo" NO es único en la base real
   (un caso reportado tenía 19 de 22 participantes compartiendo el mismo
   código). Emparejar por código nada más hacía que TODOS los que
   comparten código se compararan contra la predicción de uno solo. Ahora
   se empareja por correo -- cada quien debe quedar comparado contra SU
   PROPIA predicción, sin importar que el código esté duplicado, y encima
   debe avisarse el código duplicado como problema aparte.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Código duplicado en línea: cada quien se compara contra SU propia predicción (no la de otro) ──");
T.getDB().participants.push(
  { id: "p4", codigo: "QLB-DUP", name: "Diana", email: "diana@x.com", estadoQuiniela: "enviada", ownerUid: "uid-diana" },
  { id: "p5", codigo: "QLB-DUP", name: "Emilio", email: "emilio@x.com", estadoQuiniela: "enviada", ownerUid: "uid-emilio" },
);
T.getDB().predictions.p4 = { 1: { h: 1, a: 1 } };
T.getDB().predictions.p5 = { 1: { h: 2, a: 2 } };
const respaldoConDup = baseRespaldo();
respaldoConDup.participantes.push(
  { codigo: "QLB-DUP", nombre: "Diana", correo: "diana@x.com", estado: "enviada", predicciones: { 1: { h: 1, a: 1 } } },
  { codigo: "QLB-DUP", nombre: "Emilio", correo: "emilio@x.com", estado: "enviada", predicciones: { 1: { h: 2, a: 2 } } },
);
subirRespaldo(respaldoConDup);
check("Sin diferencias: Diana y Emilio quedaron cada uno comparado contra SU propia predicción",
  W.S.integrityChecks[0].numConCambios === 0);
check("Se avisa el código duplicado como problema aparte", W.S.integrityChecks[0].numCodigosDuplicados === 1);
const resultHtmlDup = W.document.getElementById("integ-compare-result").innerHTML;
check("El aviso de código duplicado menciona a ambos nombres", /Diana/.test(resultHtmlDup) && /Emilio/.test(resultHtmlDup));

console.log("\n── Con código duplicado, un cambio real en SOLO uno de los dos se detecta en el correcto ──");
T.getDB().predictions.p5 = { 1: { h: 3, a: 3 } }; // Emilio cambió, Diana no
subirRespaldo(respaldoConDup);
check("Se marca 1 participante con diferencias (Emilio, no Diana)", W.S.integrityChecks[0].numConCambios === 1);
check("El afectado es Emilio", W.S.integrityChecks[0].afectados[0].nombre === "Emilio");
T.getDB().predictions.p5 = { 1: { h: 2, a: 2 } }; // restaurar
T.getDB().participants = T.getDB().participants.filter(p => p.codigo !== "QLB-DUP");
delete T.getDB().predictions.p4;
delete T.getDB().predictions.p5;

/* ════════════════════════════════════════════════════════════════
   CASO 7 — Un archivo que no es del formato esperado se rechaza sin
   romper nada ni agregar una entrada fantasma al historial.
   ════════════════════════════════════════════════════════════════ */
console.log("\n── Un archivo con el 'tipo' equivocado se rechaza ──");
const countAntes = W.S.integrityChecks.length;
subirRespaldo({ tipo: "otra_cosa", participantes: [] });
check("No se agregó ninguna entrada nueva al historial", W.S.integrityChecks.length === countAntes);

/* ════════════════════════════════════════════════════════════════
   CASO 8 — El historial persiste y se re-renderiza (renderIntegCheckHistory).
   ════════════════════════════════════════════════════════════════ */
console.log("\n── El historial de comparaciones se re-renderiza sin romper ──");
W.renderIntegCheckHistory();
const histHtml = W.document.getElementById("integ-compare-history").innerHTML;
check("El historial muestra al menos una corrida", /respaldo_test\.json/.test(histHtml));
check("La entrada más nueva queda primero", W.S.integrityChecks[0].ts >= W.S.integrityChecks[W.S.integrityChecks.length - 1].ts);

console.log(`\n${ok ? "TODO OK ✅" : "HAY FALLOS ❌"}`);
process.exit(ok ? 0 : 1);
