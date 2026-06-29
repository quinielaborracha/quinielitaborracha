// Script de una sola vez para partir app.js en módulos. No altera ninguna
// línea de código: cada archivo nuevo es un slice contiguo y literal del
// app.js original, cortado en límites de sentencia verificados (ningún
// corte cae dentro de una función, objeto o array). El orden relativo
// entre archivos se preserva exactamente igual al orden original dentro
// de app.js, así que el comportamiento en tiempo de ejecución es idéntico
// (mismo "scope" global compartido entre <script> clásicos, igual que ya
// usan participantes.js/utils.js/scoring.js/totp.js).
const fs = require("fs");

const SRC = fs.readFileSync("app.js", "utf8");
const lines = SRC.split("\n");
// slice(a,b) toma líneas 1-indexadas [a, b] inclusive
function slice(a, b) {
  return lines.slice(a - 1, b).join("\n") + "\n";
}

const BANNER = (name, desc, secciones) => `/* ════════════════════════════════════════════════════════════
   ${name} — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   ${desc}

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): ${secciones}

   Este archivo es un slice LITERAL y contiguo del app.js anterior: no se
   modificó ninguna línea de lógica, solo se trasladó tal cual a su propio
   archivo. Carga como script clásico (no ES module), igual que el resto
   del proyecto: comparte el scope global del navegador con los demás
   archivos, así que puede leer/escribir libremente variables globales
   (let/const/function de nivel superior) declaradas en archivos cargados
   antes que este, y los archivos cargados después pueden hacer lo mismo
   con lo que este archivo declara — exactamente el mismo patrón que ya
   usan participantes.js, partidos-grupos.js, utils.js, scoring.js y
   totp.js entre sí.
   ════════════════════════════════════════════════════════════ */
`;

const modules = [
  {
    file: "app-core-data.js",
    range: [1, 197],
    desc: "Datos maestros: mapa de abreviaturas ESPN, equipos/grupos/banderas, reglas de puntaje. Construye los globales PL/PM/MD/MIDS al cargar (llama rebuildDynamicData(), definida en este mismo archivo).",
    secciones: "MAPA ESPN ABBR → matchId; DATOS MAESTROS",
  },
  {
    file: "app-admin-auth.js",
    range: [198, 636],
    desc: "Autenticación de admin (Firebase Auth email/password) + 2FA (TOTP + dispositivo de confianza). También declara el objeto de estado compartido S (scores, checksums, bonos, battles, snapshots, etc.) y unas pocas variables de UI relacionadas (mmT/mmS, colas de conflicto) — quedaron físicamente acá porque así estaban en app.js original, justo después del bloque de 2FA.",
    secciones: "ADMIN AUTH; ADMIN 2FA",
  },
  {
    file: "app-live-sync.js",
    range: [637, 904],
    desc: "Mapeo ESPN gameId → pid de eliminatoria, sincronización en vivo con Firestore (onSnapshot), Modo Prueba (?test=1), y el guardado de resultados con validación (Capa 1) + checksum (Capa 2).",
    secciones: "MAPA ESPN gameId → pid de eliminatoria; SINCRONIZACIÓN EN VIVO; MODO PRUEBA; GUARDAR RESULTADO CON VALIDACIÓN + CHECKSUM",
  },
  {
    file: "app-tabs.js",
    range: [905, 983],
    desc: "Navegación entre pestañas del menú principal.",
    secciones: "TABS",
  },
  {
    file: "app-eliminatoria-data.js",
    range: [984, 1094],
    desc: "Datos/constantes de la fase eliminatoria (ids, labels, árbol de cruces, rondas) y configuración del sistema de Bonos.",
    secciones: "DATOS FASE ELIMINATORIA; SISTEMA DE BONOS",
  },
  {
    file: "app-batallas.js",
    range: [1095, 1542],
    desc: "Duelos diarios 1 vs 1 (Batallas): cálculo, render y administración.",
    secciones: "BATALLAS",
  },
  {
    file: "app-bracket-render.js",
    range: [1543, 1713],
    desc: "Render del fixture de eliminatoria con inputs, editor manual de llaves (1/16) y carga de simulación.",
    secciones: "RENDER ELIMINATORIA; EDITOR DE LLAVES (1/16); SIMULACIÓN",
  },
  {
    file: "app-bracket-compute.js",
    range: [1714, 2406],
    desc: "Motor de cálculo automático de llaves de dieciseisavos a partir de la fase de grupos (tablas de posiciones, mejores terceros, cruces dinámicos).",
    secciones: "CÁLCULO AUTOMÁTICO DE LLAVES DE DIECISEISAVOS",
  },
  {
    file: "app-bracket-espn-sync.js",
    range: [2407, 2591],
    desc: "Sincronización con ESPN para la fase eliminatoria (P73-P104) y resolución de conflictos de llave.",
    secciones: "ESPN — ELIMINATORIA (P73-P104); CONFLICTO DE LLAVE DE ELIMINATORIA",
  },
  {
    file: "app-bracket-view.js",
    range: [2592, 2927],
    desc: "Render del bracket completo, vista por participante.",
    secciones: "RENDER BRACKET — vista por participante",
  },
  {
    file: "app-bracket-espn-live.js",
    range: [2928, 3062],
    desc: "Sincronización en vivo con ESPN para resultados de eliminatoria, con protección de conflictos.",
    secciones: "ESPN — con protección de conflictos",
  },
  {
    file: "app-integridad.js",
    range: [3063, 3138],
    desc: "Panel de integridad: validación de checksums y de rangos de resultados guardados, limpieza de datos corrompidos.",
    secciones: "PANEL DE INTEGRIDAD",
  },
  {
    file: "app-predicciones.js",
    range: [3139, 3401],
    desc: "Vista de Predicciones / Avanzado / Reglas por participante, y goleadores (ESPN en vivo + manual).",
    secciones: "PREDICCIONES / AVANZADO / GOLEADORES / REGLAS; GOLEADORES — ESPN en vivo + manual",
  },
  {
    file: "app-estadisticas.js",
    range: [3402, 3672],
    desc: "Exportar imagen del ranking, snapshots (seguimiento de movimiento en el ranking) y panel de Estadísticas.",
    secciones: "EXPORT IMAGEN; SNAPSHOTS — ranking movement tracking; ESTADÍSTICAS",
  },
  {
    file: "app-admin-tools.js",
    range: [3673, 3815],
    desc: "Edición de datos de un participante (admin) y backup/restore del estado completo en JSON.",
    secciones: "EDIT PARTICIPANT; BACKUP / RESTORE JSON",
  },
  {
    file: "app-bootstrap.js",
    range: [3816, lines.length - 1],
    desc: "Toggle de tema claro/oscuro, atajo de teclado Escape, y el bootstrap final de la app: fija el logo, pinta el header, hace el primer render desde caché local (load()+renderRank()+...), aplica la pestaña inicial configurada por el admin, registra el listener de cambios de participantes, y arranca Firebase Auth + sincronización en vivo. DEBE SER EL ÚLTIMO de los archivos derivados de app.js en cargar: llama funciones definidas en todos los anteriores.",
    secciones: "THEME TOGGLE; (bootstrap final, sin encabezado propio en el app.js original)",
  },
];

let totalLines = 0;
for (const m of modules) {
  const [a, b] = m.range;
  const body = slice(a, b);
  const banner = BANNER(m.file, m.desc, m.secciones);
  fs.writeFileSync(m.file, banner + "\n" + body);
  const n = b - a + 1;
  totalLines += n;
  console.log(`${m.file}: líneas ${a}-${b} (${n} líneas) -> ${fs.statSync(m.file).size} bytes`);
}
console.log(`\nTotal líneas originales cubiertas: ${totalLines} (app.js original tenía ${lines.length} líneas)`);
