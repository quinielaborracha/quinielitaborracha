// Test funcional de v3.10: avatares de campeón variados.
//
// BUG REPORTADO: cada país solo tenía UN archivo asignado en AVATAR_MAP
// aunque ya hubiera 2-3 ilustraciones distintas en avatars/ para varios
// (ej. 3 de Brasil: Dinho/Neymar/Ronaldo) -- todos los participantes que
// compartían campeón veían siempre el mismo avatar, sin variedad.
// Además, Países Bajos tenía 3 archivos en la carpeta (Cruiff/Davids/
// Gullit) pero CERO entradas en AVATAR_MAP -- avatarOfChampion() devolvía
// "" siempre para quien predijera ese campeón, sin ningún error visible
// que lo delatara.
//
// FIX: AVATAR_MAP[país] pasó de ser un string a un array con todas las
// variantes disponibles; pickAvatarFile() (utils.js) elige una
// determinística por participante (crc32(name) % cantidad de opciones),
// no al azar en cada render -- mismo participante, mismo avatar siempre.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const FILES = ["participantes.js", "partidos-grupos.js", "utils.js", "paises.js", "app-static-data.js", "app-state.js", "scoring.js",
  "app-core-data.js", "app-admin-auth.js", "app-live-sync.js", "app-tabs.js",
  "app-eliminatoria-data.js", "app-batallas.js", "app-bracket-render.js",
  "app-bracket-annexc.js", "app-bracket-compute.js", "app-bracket-espn-sync.js", "app-bracket-view.js",
  "app-bracket-espn-live.js", "app-integridad.js", "app-predicciones.js",
  "app-estadisticas.js", "app-admin-tools.js", "app-bootstrap.js"];

let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
html = html.replace(/<script[^>]*src=[^>]*><\/script>/g, "");
html = html.replace(/<script type="module">[\s\S]*?<\/script>/g, "");

const dom = new JSDOM(html, { url: "https://example.org/", runScripts: "dangerously" });
const { window } = dom;
window.confirm = () => true;
window.alert = () => {};
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
window.Blob = function () {};
window.setInterval = () => 0;
window.toast = () => {};
window.__fb = { PARTICIPANTS_COL: {}, PRIVADO_COL: {}, auth: { currentUser: null }, onSnapshot: () => () => {} };

let allOk = true;
function check(label, cond) { console.log((cond ? "✅ " : "❌ ") + label); if (!cond) allOk = false; }

for (const f of FILES) {
  const code = fs.readFileSync(path.join(__dirname, f), "utf8");
  const script = window.document.createElement("script");
  script.textContent = code;
  window.document.body.appendChild(script);
}

const bridgeScript = window.document.createElement("script");
bridgeScript.textContent = `window.__test = { DB, AVATAR_MAP };`;
window.document.body.appendChild(bridgeScript);
const T = window.__test;
const W = window;

check("Los archivos cargaron sin lanzar excepción", true);

check("AVATAR_MAP['Brasil'] tiene las 3 variantes conocidas",
  Array.isArray(T.AVATAR_MAP["Brasil"]) && T.AVATAR_MAP["Brasil"].length === 3);
check("AVATAR_MAP['Países Bajos'] YA NO está vacío/ausente (antes: sin entrada)",
  Array.isArray(T.AVATAR_MAP["Países Bajos"]) && T.AVATAR_MAP["Países Bajos"].length === 3);

const nombresBrasil = ["Ana", "Beto", "Carla", "Diego", "Elena", "Franco"];
const avataresAsignados = new Set(nombresBrasil.map(n => W.pickAvatarFile("Brasil", n)));
check("Entre 6 nombres distintos con Brasil de campeón, aparece MÁS DE 1 variante de avatar",
  avataresAsignados.size > 1);
check("Todas las variantes asignadas están dentro de las 3 conocidas de Brasil",
  [...avataresAsignados].every(f => T.AVATAR_MAP["Brasil"].includes(f)));

const mismoNombreDosVeces = [W.pickAvatarFile("Brasil", "Rafita"), W.pickAvatarFile("Brasil", "Rafita")];
check("El MISMO participante obtiene SIEMPRE el mismo avatar (estable, no al azar en cada llamada)",
  mismoNombreDosVeces[0] === mismoNombreDosVeces[1]);

const avatarPaisesBajos = W.pickAvatarFile("Países Bajos", "Juan");
check("Un participante con Países Bajos de campeón SÍ obtiene un archivo de avatar (antes: '')",
  !!avatarPaisesBajos && T.AVATAR_MAP["Países Bajos"].includes(avatarPaisesBajos));

check("pickAvatarFile devuelve '' para un país sin ninguna entrada en AVATAR_MAP (ej. Suiza)",
  W.pickAvatarFile("Suiza", "Juan") === "");
check("pickAvatarFile devuelve '' si no hay campeón (string vacío)",
  W.pickAvatarFile("", "Juan") === "");

// avatarOfChampion() (el que de verdad usa el resto de la app: Ranking,
// Tarjetas, Batallas, PDF...) también tiene que reflejar esto -- no solo
// el helper de bajo nivel.
T.DB.participants = [{ id: "p0", name: "Coco", city: "", country: "" }];
T.DB.predictions = { p0: { special: { campeon: "Países Bajos" } } };
W.rebuildDynamicData();
check("avatarOfChampion('Coco') (Países Bajos) devuelve un archivo real, no ''",
  !!W.avatarOfChampion("Coco") && T.AVATAR_MAP["Países Bajos"].includes(W.avatarOfChampion("Coco")));

// Las 2 pantallas de registro.js (identidad en "Mi Quiniela" y portada del
// PDF) leen AVATAR_MAP a través de pickAvatarFile() también -- confirmamos
// que ninguna quedó leyendo el array crudo directo (lo que antes de este
// fix habría insertado "Cruiff...,Davids...,Gullit..." como nombre de
// archivo, una imagen rota).
const registroCode = fs.readFileSync(path.join(__dirname, "registro.js"), "utf8");
check("registro.js ya NO indexa AVATAR_MAP[champ] directo en ningún lado (usa pickAvatarFile en su lugar)",
  !/AVATAR_MAP\[\s*champ/.test(registroCode));

console.log("\n=== RESULTADO FINAL:", allOk ? "TODOS LOS CASOS PASAN ✅" : "HAY FALLOS ❌", "===");
process.exit(allOk ? 0 : 1);
