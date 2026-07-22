// ══════════════════════════════════════════════════════════════
// PARTIDOS — Fase de grupos, Mundial 2026 (Quinielita Borracha)
// ══════════════════════════════════════════════════════════════
// MATCH_LABELS: nombre de cada uno de los 72 partidos de fase de grupos
// (dato público del fixture del Mundial, no de ningún participante), que
// app.js usa para mostrar el nombre del partido ("México vs Sudáfrica")
// en vez de un genérico "Partido 1".
//
// Sprint 2 de la "hoja de ruta comercial" (motor de datos de torneo,
// 2026-07-22): el dato en sí se movió a torneo-mundial2026.js (que
// carga justo antes que este archivo) junto con el resto de la config
// del torneo en curso (ESPN_ABBR_MAP/MID_ABBRS/MGMAP/GES/ARULES, ver
// app-static-data.js). Este archivo queda como un re-export delgado
// para que ningún consumidor existente (rebuildDynamicData() en
// app-core-data.js, que depende de MATCH_LABELS) necesite tocarse.
const MATCH_LABELS = TORNEO_MUNDIAL_2026.matchLabels;
