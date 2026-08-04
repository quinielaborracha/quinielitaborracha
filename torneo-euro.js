/* ════════════════════════════════════════════════════════════
   torneo-euro.js
   ════════════════════════════════════════════════════════════
   Sprint 11 (hoja de ruta comercial, Fase 3 -- selector de plantilla en
   runtime): el checkpoint real de esta etapa, mismo espíritu que
   torneo-copaamerica.js probó en su momento para la Fase 1 (Sprint 4c)
   -- un segundo caso concreto prueba que la generalización (acá, el
   registro compartido del Sprint 9) funciona de verdad, no solo en el
   caso ya conocido.

   La diferencia real que este archivo prueba: es el PRIMER torneo SIN
   fase de grupos (`groupMatches:[]`, `groupKeys:[]`) -- todos los
   templates anteriores (Mundial 2026, Copa América ficticia) tenían
   uno. La primera fase de `bonusPhases` acá ya es de eliminatoria
   (Semifinales), con `prevPhase:null` -- los 4 equipos se cargan a
   mano desde "✏️ Editar llaves" (mecanismo YA EXISTENTE para "empezar
   desde una fase que no es Dieciseisavos", ver la nota en
   `renderTorneoConfig()`, `app-admin-tools.js`) o con "🎲 Simular".

   Ficticio, selecciones (no clubes) -- reusa países ya presentes en
   `paises.js` sin necesitar escudos/assets nuevos (a diferencia de un
   torneo de clubes real tipo Champions League, que sí los necesitaría
   -- ver la nota de alcance en el plan de sprints).

   DECISIÓN DE DISEÑO IMPORTANTE (encontrada al escribir este archivo,
   no anticipada en el plan original): `bracketFormat` acá es "direct",
   NO el default "best-thirds" del Mundial -- aunque este torneo no
   tiene NINGÚN cruce que resolver de grupos (`directCrosses:{}`), es
   la única opción segura. `generarLlavesDieciseisavos()`
   (`app-bracket-compute.js`) solo delega en `generarLlavesDirecto()`
   cuando `bracketFormat==="direct"`; en cualquier otro caso corre su
   rama "mejores terceros", que tiene los pids 73-88 y las letras A-L
   del Mundial 2026 HARDCODEADOS en el cuerpo de la función (no
   derivados de `TORNEO_ACTUAL`) -- con `groupKeys:[]` esa rama no
   explota, pero ESCRIBE datos falsos en esos pids ajenos a este
   torneo. Con `bracketFormat:"direct"` y `directCrosses:{}`,
   `generarLlavesDirecto()` simplemente no encuentra nada que resolver
   (`Object.entries({}).forEach` no itera) y no escribe nada -- seguro
   por diseño. `updateGenerarBtn()` además deja el botón "Generar
   llaves" habilitado de entrada (con `groupMatches.length===0`, "0
   partidos jugados >= 0 total" ya cuenta como fase de grupos
   completa) -- esto es exactamente lo que este archivo prueba que NO
   rompe nada aunque el admin lo apriete por error.
   ════════════════════════════════════════════════════════════ */

var TORNEO_ACTUAL = (function(){
  return {
    id: "euro-ficticio",
    nombre: "Euro (datos ficticios, checkpoint Sprint 11 -- sin fase de grupos)",

    // Sin fase de grupos: los 4 equipos de Semifinales se cargan a
    // mano (Editar llaves / Simular), nunca calculados de standings.
    groupMatches: [],
    matchLabels: {},
    mgmap: {},
    espnAbbrMap: {},
    midAbbrs: {},
    ges: {},
    groupKeys: [],

    // Mismos "puntos fijos" genéricos que el resto de los torneos.
    arules: [
      {id:"campeon",        l:"Acertar campeón",                    p:15},
      {id:"subcampeon",     l:"Acertar subcampeón",                 p:10},
      {id:"tercer",         l:"Acertar 3er lugar",                  p:8},
      {id:"goleador",       l:"Acertar goleador del torneo",        p:12},
      {id:"goles_goleador", l:"Goles del goleador (exactos)",       p:8},
      {id:"pais_goleador",  l:"País más goleador",                  p:8},
      {id:"goles_pais",     l:"Goles de ese país (exactos)",        p:10},
      {id:"pais_goleado",   l:"País más goleado en 1 partido",      p:8},
    ],

    espnGameIdToPid: {},

    // "direct", no el default "best-thirds" -- ver la nota de diseño
    // arriba: es la única opción segura sin fase de grupos.
    bracketFormat: "direct",
    directCrosses: {},

    // Primera ronda de eliminatoria: Semifinales (pids 1-2), no
    // Dieciseisavos -- se cargan a mano, mismo mecanismo que ya usa
    // cualquier torneo que empiece más adelante que Dieciseisavos.
    elim1_16Ids: [1, 2],
    elim1_16Labels: {1:"P1", 2:"P2"},

    worldPool: ["Alemania","Francia","España","Inglaterra","Bélgica","Croacia","Portugal","Suiza"],

    elimTree: {
      3: {parentH:1, parentA:2, useLoserH:true,  useLoserA:true},  // 3er/4to lugar: perdedores de semis
      4: {parentH:1, parentA:2, useLoserH:false, useLoserA:false}, // Final: ganadores de semis
    },

    elimRounds: [
      {lbl:"Semifinales", ids:[1,2]},
      {lbl:"Tercer lugar", ids:[3]},
      {lbl:"🏆 Final", ids:[4]},
    ],

    bonusPhases: [
      {key:"sf",    label:"Semifinales",   mids:[1,2], elimPhase:true, lastPts:6, classifiedPts:6, llavePts:2, prevPhase:null},
      {key:"third", label:"Tercer lugar",  mids:[3],   elimPhase:true, lastPts:0, classifiedPts:0, llavePts:2, prevPhase:"sf"},
      {key:"final", label:"Final",         mids:[4],   elimPhase:true, lastPts:0, classifiedPts:0, llavePts:2, prevPhase:"sf"},
    ],
  };
})();

// Sprint 9/11 -- ver la nota equivalente en torneo-mundial2026.js.
window.TORNEOS_DISPONIBLES = window.TORNEOS_DISPONIBLES || {};
TORNEOS_DISPONIBLES[TORNEO_ACTUAL.id] = TORNEO_ACTUAL;
