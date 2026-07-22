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

const ELIM_1_16_IDS=[73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88];
const ELIM_1_16_LABELS={
  73:"P73",74:"P74",75:"P75",76:"P76",
  77:"P77",78:"P78",79:"P79",80:"P80",
  81:"P81",82:"P82",83:"P83",84:"P84",
  85:"P85",86:"P86",87:"P87",88:"P88",
};

// Pool de 48 selecciones del Mundial 2026 para simulación
const WORLD_POOL=["México","Sudáfrica","Corea del Sur","República Checa","Canadá","Bosnia y Herzegovina","Qatar","Suiza","Brasil","Marruecos","Haití","Escocia","Estados Unidos","Paraguay","Australia","Turquía","Alemania","Costa de Marfil","Ecuador","Curazao","Países Bajos","Japón","Suecia","Túnez","Arabia Saudita","Uruguay","España","Cabo Verde","Irán","Nueva Zelanda","Bélgica","Egipto","Francia","Senegal","Irak","Noruega","Argentina","Argelia","Austria","Jordania","Portugal","RD Congo","Uzbekistán","Colombia","Inglaterra","Croacia","Ghana","Panamá"];

// Estructura del bracket: cada partido posterior depende de quién ganó antes
// parentH/parentA = id del partido cuyos ganadores se enfrentan aquí
// Para P103 (3er lugar): perdedores de semis
const ELIM_TREE={
  // 1/8
  89:{parentH:74,parentA:77,useLoserH:false,useLoserA:false},
  90:{parentH:73,parentA:75,useLoserH:false,useLoserA:false},
  91:{parentH:76,parentA:78,useLoserH:false,useLoserA:false},
  92:{parentH:79,parentA:80,useLoserH:false,useLoserA:false},
  93:{parentH:83,parentA:84,useLoserH:false,useLoserA:false},
  94:{parentH:81,parentA:82,useLoserH:false,useLoserA:false},
  95:{parentH:86,parentA:88,useLoserH:false,useLoserA:false},
  96:{parentH:85,parentA:87,useLoserH:false,useLoserA:false},
  // 1/4
  97:{parentH:89,parentA:90,useLoserH:false,useLoserA:false},
  98:{parentH:93,parentA:94,useLoserH:false,useLoserA:false},
  99:{parentH:91,parentA:92,useLoserH:false,useLoserA:false},
  100:{parentH:95,parentA:96,useLoserH:false,useLoserA:false},
  // 1/2
  101:{parentH:97,parentA:98,useLoserH:false,useLoserA:false},
  102:{parentH:99,parentA:100,useLoserH:false,useLoserA:false},
  // 3er/4to lugar (perdedores de semis)
  103:{parentH:101,parentA:102,useLoserH:true,useLoserA:true},
  // Final
  104:{parentH:101,parentA:102,useLoserH:false,useLoserA:false},
};

const ELIM_ROUNDS=[
  {lbl:"Dieciseisavos de final",ids:[73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88]},
  {lbl:"Octavos de final",ids:[89,90,91,92,93,94,95,96]},
  {lbl:"Cuartos de final",ids:[97,98,99,100]},
  {lbl:"Semifinales",ids:[101,102]},
  {lbl:"Tercer y cuarto lugar",ids:[103]},
  {lbl:"🏆 Gran Final",ids:[104]},
];

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

// Definición de fases con sus IDs de partido y puntos de clasificación
const BONUS_PHASES=[
  {key:"grupos",label:"Fase de Grupos",mids:Array.from({length:72},(_,i)=>i+1),elimPhase:false,lastPts:8,classifiedPts:0,llavePts:0,prevPhase:null},
  {key:"r16",label:"Dieciseisavos",mids:[73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88],elimPhase:true,lastPts:6,classifiedPts:3,llavePts:2,prevPhase:"grupos"},
  {key:"r8",label:"Octavos",mids:[89,90,91,92,93,94,95,96],elimPhase:true,lastPts:6,classifiedPts:4,llavePts:2,prevPhase:"r16"},
  {key:"qf",label:"Cuartos",mids:[97,98,99,100],elimPhase:true,lastPts:6,classifiedPts:6,llavePts:2,prevPhase:"r8"},
  {key:"sf",label:"Semifinales",mids:[101,102],elimPhase:true,lastPts:0,classifiedPts:6,llavePts:2,prevPhase:"qf"},
  // v4.3 — "third" antes que "final": ambas dependen solo de "sf" (mismo
  // prevPhase, ninguna depende de la otra — ver isPrevPhaseClosed() más
  // abajo), así que este orden no cambia ningún cálculo de puntos, solo el
  // orden en que Admin → Bonos lista las tarjetas de fase. Se invirtió
  // porque el Tercer lugar se juega ANTES que la Final en la vida real
  // (mismo orden que ya usa ELIM_ROUNDS) — antes de este cambio, Admin
  // mostraba "Final" arriba de "Tercer lugar", al revés de cómo se juegan.
  {key:"third",label:"Tercer lugar",mids:[103],elimPhase:true,lastPts:0,classifiedPts:0,llavePts:2,prevPhase:"sf"},
  {key:"final",label:"Final",mids:[104],elimPhase:true,lastPts:0,classifiedPts:0,llavePts:2,prevPhase:"sf"},
];

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
