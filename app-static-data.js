/* ════════════════════════════════════════════════════════════
   app-static-data.js
   ════════════════════════════════════════════════════════════
   Datos de referencia puros (sin funciones) ESPECÍFICOS DEL TORNEO en
   curso: grupos, mapeos de partido de ESPN, puntos fijos de "Reglas
   avanzadas". Nada de esto cambia según el estado en vivo del torneo
   (para eso está app-state.js), pero SÍ cambia si algún día se carga un
   torneo distinto al Mundial 2026 -- a diferencia de los datos de país
   (nombre, bandera, avatar), que son iguales sea cual sea el torneo y
   viven en paises.js.

   Sprint 2 de la "hoja de ruta comercial" (motor de datos de torneo,
   2026-07-22): ESPN_ABBR_MAP/MID_ABBRS/MGMAP/GES/ARULES ahora se
   REASIGNAN desde TORNEO_ACTUAL (torneo-mundial2026.js, carga
   justo antes que este archivo) en vez de declararse acá con su valor
   literal -- el dato en sí vive en ese objeto, consolidado junto con
   MATCH_LABELS (partidos-grupos.js hace lo mismo). Cero cambios de
   comportamiento: cada global sigue llamándose exactamente igual, así
   que ningún consumidor (utils.js, scoring.js, app-bracket-compute.js,
   etc.) necesitó tocarse. FLAGS2/ABBR/BGCOL quedan con su valor literal
   acá: no forman parte del fixture del torneo en curso (ver nota en
   torneo-mundial2026.js).

   Sprint 5 (mismo roadmap, 2026-07-23): el objeto que arma
   torneo-mundial2026.js se renombró de TORNEO_MUNDIAL_2026 a
   TORNEO_ACTUAL (nombre genérico, no atado a qué torneo sea) -- ver
   nota completa en torneo-mundial2026.js. Este archivo ya leía ese
   objeto por 5 propiedades puntuales; ahora además usa el objeto
   completo directamente (sin el alias intermedio que el Sprint 4b había
   agregado acá abajo, ya innecesario).

   Sprint 1 (mismo roadmap): TEAM_NAMES/ESPN_NAME_ES/ALL_FLAGS/
   AVATAR_MAP se habían movido antes a paises.js, por ser datos de país
   agnósticos de torneo.

   v1.7 — Consolidado desde 3 archivos distintos donde estos datos
   estaban mezclados con lógica que no tenía nada que ver: ESPN_ABBR_MAP/
   MID_ABBRS/MGMAP/GES/ALL_FLAGS/FLAGS2/ABBR/BGCOL/ARULES vivían en
   app-core-data.js (junto a rebuildDynamicData()/flagOfChampion(), que sí
   son lógica real); TEAM_NAMES vivía en app-bracket-compute.js (el motor
   de cálculo de llaves); ESPN_NAME_ES vivía en app-bracket-espn-sync.js
   (el sync de resultados). Carga temprano (después de utils.js, antes de
   app-state.js), porque utils.js ya depende de TEAM_NAMES/MID_ABBRS/
   ESPN_NAME_ES en abbr2name()/espnNameES() -- antes esos datos vivían
   varios archivos DESPUÉS de utils.js en el orden de carga; funcionaba
   igual porque esas funciones nunca se invocan hasta mucho después de
   que TODO terminó de cargar, pero ahora el orden de lectura del código
   coincide con el orden real de dependencia.
   ════════════════════════════════════════════════════════════ */

// ── ESPN: mapa de partidos de fase de grupos (abbr → matchId) ──
const ESPN_ABBR_MAP = TORNEO_ACTUAL.espnAbbrMap;

// Mapa abbr por matchId (para checksums y validación)
const MID_ABBRS = TORNEO_ACTUAL.midAbbrs;

// Normaliza abreviaturas alternativas que usa ESPN vs nuestro mapa

// ── Grupos ──
const MGMAP = TORNEO_ACTUAL.mgmap;

const GES = TORNEO_ACTUAL.ges;

// ── Banderas y colores (set reducido, no específico del fixture -- ver
//    nota de alcance en torneo-mundial2026.js) ──
const FLAGS2={"España":"🇪🇸","Paises Bajos":"🇳🇱","Países Bajos":"🇳🇱","Francia":"🇫🇷","Portugal":"🇵🇹","Inglaterra":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Argentina":"🇦🇷","Brasil":"🇧🇷","Alemania":"🇩🇪","Italia":"🇮🇹","Holanda":"🇳🇱","Colombia":"🇨🇴","Uruguay":"🇺🇾","México":"🇲🇽","Chile":"🇨🇱","Bélgica":"🇧🇪","Croacia":"🇭🇷","Marruecos":"🇲🇦","Japón":"🇯🇵","Corea del Sur":"🇰🇷","Suiza":"🇨🇭","Australia":"🇦🇺","Ecuador":"🇪🇨","Senegal":"🇸🇳","Ghana":"🇬🇭","Irán":"🇮🇷","Arabia Saudita":"🇸🇦","Turquía":"🇹🇷","Canadá":"🇨🇦","Estados Unidos":"🇺🇸","Noruega":"🇳🇴","Suecia":"🇸🇪","Dinamarca":"🇩🇰","Polonia":"🇵🇱"};
const ABBR={"España":"ES","Paises Bajos":"NL","Países Bajos":"NL","Francia":"FR","Portugal":"PT","Inglaterra":"EN","Argentina":"AR","Brasil":"BR"};
const BGCOL={"España":"#c60b1e","Paises Bajos":"#ae1c28","Países Bajos":"#ae1c28","Francia":"#002395","Portugal":"#006600","Inglaterra":"#cf111b","Argentina":"#74acdf","Brasil":"#009c3b"};

// v1.7 — BRULES/ELIMRULES/LASTRULES (reglas básicas/eliminatoria/último
// lugar) se eliminaron de acá: eran listas hardcodeadas que la pestaña
// pública "Reglas" mostraba sin importar lo que el admin configurara en
// Configuración del torneo → Reglas, así que nunca reflejaban una regla
// recién activada/desactivada ni su valor real. renderRules()
// (app-predicciones.js) ahora arma esas 3 secciones en vivo desde
// DB.configGlobal.reglas (mismos helpers que ya usa scoring.js:
// getReglasGrupos/getReglasElim/getFaseValor/getActivePhases). ARULES
// sigue acá tal cual: son los puntos fijos del juego (campeón, goleador,
// etc.) -- el "id" de cada una coincide a propósito con el id de
// SPECIAL_QUESTIONS (registro.js), la misma clave que usa
// DB.configGlobal.reglas.avanzado.<id> (v2.7.6 — switch individual por
// pregunta, ver calcAdv en scoring.js).
const ARULES = TORNEO_ACTUAL.arules;

// TORNEO_ACTUAL (declarado en torneo-mundial2026.js) también se lee
// completo en otros archivos -- scoring.js/app-core-data.js/
// app-bracket-compute.js (Sprint 4b) leen TORNEO_ACTUAL.groupMatches.length/
// TORNEO_ACTUAL.groupKeys/TORNEO_ACTUAL.bracketFormat directo, sin alias
// intermedio (el Sprint 4b lo agregaba acá cuando el objeto todavía se
// llamaba TORNEO_MUNDIAL_2026; el Sprint 5 lo volvió innecesario).
