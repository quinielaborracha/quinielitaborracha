/* ════════════════════════════════════════════════════════════
   app-eliminatoria-data.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Datos/constantes de la fase eliminatoria (ids, labels, árbol de cruces, rondas) y configuración del sistema de Bonos.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): DATOS FASE ELIMINATORIA; SISTEMA DE BONOS

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

// DATOS FASE ELIMINATORIA
// ══════════════════════════════════════════════════════════════

// Partidos 1/16 — solo IDs y slot labels (equipos se cargan dinámicamente)
// Sprint 4a (hoja de ruta comercial, 2026-07-23): antes estos eran arrays/
// objetos literales acá mismo -- Mundial-2026-específicos igual que
// GROUP_MATCHES lo era en registro.js antes del Sprint 3b. Ahora se
// reasignan desde TORNEO_MUNDIAL_2026 (mismo patrón, cero cambio de
// comportamiento) para que un futuro segundo torneo (Copa América) traiga
// su propio ELIM_1_16_IDS/ELIM_TREE/ELIM_ROUNDS/BONUS_PHASES/WORLD_POOL
// vía su propio TORNEO_<NOMBRE>, sin tocar scoring.js/app-bracket-*.js/
// registro.js, que siguen leyendo estos mismos globals tal cual.

const ELIM_1_16_IDS=TORNEO_MUNDIAL_2026.elim1_16Ids;
const ELIM_1_16_LABELS=TORNEO_MUNDIAL_2026.elim1_16Labels;

// Pool de selecciones del torneo en curso, para simulación
const WORLD_POOL=TORNEO_MUNDIAL_2026.worldPool;

// Estructura del bracket: cada partido posterior depende de quién ganó antes
// parentH/parentA = id del partido cuyos ganadores se enfrentan aquí
// Para P103 (3er lugar): perdedores de semis
const ELIM_TREE=TORNEO_MUNDIAL_2026.elimTree;

const ELIM_ROUNDS=TORNEO_MUNDIAL_2026.elimRounds;

// v6.2 — Antes esto leía ELIMRAW[name] (array fijo) y recorría ELIM_TREE
// recursivamente para resolver equipos en rondas posteriores a 1/16.
// Ahora no hace falta: tanto Mi Quiniela (wizard) como la migración de
// los 27 antiguos ya dejan _a/_b (equipos) y h/a (marcador) "congelados"
// por slot en el momento en que se guardan — acá solo se lee.

// Obtener los equipos que un participante predijo para un partido —
// igual para 1/16 y para rondas posteriores, porque ya vienen resueltos
// (ver nota arriba). _a/_b en blanco o "?" cuenta como "todavía no llenó esto".

// Quién predijo que gana (o pierde) un partido

// Obtener equipos REALES de un partido de eliminatoria

// Calcular si la llave de un partido es correcta para un participante
// La llave es correcta si los 2 equipos predichos coinciden con los 2 equipos reales

// Calcular puntos de eliminatoria para un partido
// 2pts de llave en tiempo real (si llave coincide, con o sin resultado)
// + puntos de resultado (2/3/+3) solo cuando hay score Y llave correcta
// Get which BONUS_PHASE a pid belongs to

// Pts for a single elim match — only counts if prev phase closed
// Includes: result pts (always if llave ok + prev closed) + 2pts llave (if prev closed)
// Classified pts are summed separately in calcClassifiedPtsElim

// Classified pts for a phase — LIVE: se activan en cuanto la fase PREVIA
// está cerrada (igual que calcElimMatchPts), no esperan a que cierre esta
// misma fase. Así se van sumando partido a partido a medida que hay
// resultados, y al cerrar esta fase el total ya está completo (v5.6).
// Rule: per match, check if the team predicted to WIN that match
//       actually advanced (is in real winners of this phase).
//       Team matters, not the llave. So if Brazil was predicted
//       to win P73 and Brazil also won P74 (different match),
//       the player still gets the classified pts.

// Total Elim pts = match pts (result+llave) + classified pts (ambos EN VIVO
// en cuanto la fase previa está cerrada, no esperan al cierre de esta fase)

// ══════════════════════════════════════════════════════════════
// SISTEMA DE BONOS — Último lugar + Clasificados + Llaves
// ══════════════════════════════════════════════════════════════

// Definición de fases con sus IDs de partido y puntos de clasificación.
// v4.3 — "third" antes que "final" en TORNEO_MUNDIAL_2026.bonusPhases:
// ambas dependen solo de "sf" (mismo prevPhase, ninguna depende de la
// otra — ver isPrevPhaseClosed() más abajo), así que este orden no cambia
// ningún cálculo de puntos, solo el orden en que Admin → Bonos lista las
// tarjetas de fase. Se invirtió porque el Tercer lugar se juega ANTES que
// la Final en la vida real (mismo orden que ya usa ELIM_ROUNDS) — antes
// mostraba "Final" arriba de "Tercer lugar", al revés de cómo se juegan.
const BONUS_PHASES=TORNEO_MUNDIAL_2026.bonusPhases;

// Sprint 3a (hoja de ruta comercial, 2026-07-22): rango de match-ID de
// TODA la eliminatoria, derivado de BONUS_PHASES en vez de hardcodeado
// a mano. scoring.js/utils.js antes escribían "73"/"104" literal en ~9
// lugares (loops de puntaje, validación de rango) -- ahora leen
// ELIM_MID_MIN/ELIM_MID_MAX, que se recalculan solos si BONUS_PHASES
// cambia. Un futuro segundo torneo con menos partidos de eliminatoria
// (ej. Copa América: 8 en vez de 32) solo necesita su propio
// BONUS_PHASES -- scoring.js/utils.js no se tocan.
const ELIM_MIDS_ALL = BONUS_PHASES.filter(p=>p.elimPhase).flatMap(p=>p.mids);
const ELIM_MID_MIN = Math.min(...ELIM_MIDS_ALL);
const ELIM_MID_MAX = Math.max(...ELIM_MIDS_ALL);

// Check if previous phase is closed (prereq for llaves+classified pts)

// Bonos = ONLY last place. Classified+llaves are in calcElimPts.

// ══════════════════════════════════════════════════════════════
