/* ════════════════════════════════════════════════════════════
   torneo-copaamerica.js
   ════════════════════════════════════════════════════════════
   Sprint 4c (hoja de ruta comercial, 2026-07-23): el checkpoint real de
   la Fase 1 -- cargar un SEGUNDO torneo completo sobre el motor
   generalizado en los Sprints 1-3c/4a/4b, para probar que "armar un
   torneo nuevo" de verdad es "completar un archivo de datos" y no
   "tocar scoring.js/utils.js/app-bracket-*.js/registro.js".

   Mismo formato que TORNEO_MUNDIAL_2026 (torneo-mundial2026.js), pero:
   - 16 equipos / 4 grupos de 4 (no 48/12) -- CONMEBOL completo (10)
     + 6 invitados, usando países ya presentes en paises.js más los 5
     que se agregaron en este mismo sprint (Chile/Perú/Bolivia/
     Venezuela/Costa Rica).
   - bracketFormat: "direct" -- los 2 primeros de cada grupo cruzan
     directo a Cuartos de Final, SIN mejores terceros ni Annex C (a
     diferencia del Mundial 2026, que con 12 grupos de 4 sí los tiene).

   Sorteo, fixture y datos: TODOS FICTICIOS (no es el sorteo real de
   ninguna edición) -- alcanza para probar el motor de punta a punta,
   que es el objetivo de este sprint, sin necesitar el calendario real
   de una Copa América todavía sin fecha confirmada.

   Este archivo NO se carga desde index.html todavía (Quinielita
   Borracha sigue siendo una instancia de Mundial 2026) -- se usa desde
   test_copa_america_e2e.js, que arma su propio DOM/FILES_IN_ORDER
   reemplazando torneo-mundial2026.js por este archivo + un shim de una
   línea (`const TORNEO_MUNDIAL_2026 = TORNEO_COPA_AMERICA;`) para que
   partidos-grupos.js/app-static-data.js/app-eliminatoria-data.js -- que
   hoy leen el identificador TORNEO_MUNDIAL_2026 literal, no uno
   genérico -- funcionen sin tocarles una línea. Volver ese identificador
   elegible en runtime (para que un futuro selector de plantillas de la
   Fase 2 no necesite este shim) queda para cuando se construya ese
   selector, no antes.
   ════════════════════════════════════════════════════════════ */

const TORNEO_COPA_AMERICA = (function(){
  // 16 equipos, 4 grupos de 4. Sorteo ficticio (ver nota arriba).
  const groupMatches = [
    // Grupo A: Argentina, Chile, Perú, Canadá
    {id:1,g:"A",a:"Argentina",b:"Canadá"},
    {id:2,g:"A",a:"Chile",b:"Perú"},
    {id:3,g:"A",a:"Argentina",b:"Perú"},
    {id:4,g:"A",a:"Canadá",b:"Chile"},
    {id:5,g:"A",a:"Argentina",b:"Chile"},
    {id:6,g:"A",a:"Perú",b:"Canadá"},
    // Grupo B: Brasil, Colombia, Paraguay, México
    {id:7,g:"B",a:"Brasil",b:"México"},
    {id:8,g:"B",a:"Colombia",b:"Paraguay"},
    {id:9,g:"B",a:"Brasil",b:"Paraguay"},
    {id:10,g:"B",a:"México",b:"Colombia"},
    {id:11,g:"B",a:"Brasil",b:"Colombia"},
    {id:12,g:"B",a:"Paraguay",b:"México"},
    // Grupo C: Uruguay, Ecuador, Bolivia, Estados Unidos
    {id:13,g:"C",a:"Uruguay",b:"Estados Unidos"},
    {id:14,g:"C",a:"Ecuador",b:"Bolivia"},
    {id:15,g:"C",a:"Uruguay",b:"Bolivia"},
    {id:16,g:"C",a:"Estados Unidos",b:"Ecuador"},
    {id:17,g:"C",a:"Uruguay",b:"Ecuador"},
    {id:18,g:"C",a:"Bolivia",b:"Estados Unidos"},
    // Grupo D: Venezuela, Panamá, Haití, Costa Rica
    {id:19,g:"D",a:"Venezuela",b:"Costa Rica"},
    {id:20,g:"D",a:"Panamá",b:"Haití"},
    {id:21,g:"D",a:"Venezuela",b:"Haití"},
    {id:22,g:"D",a:"Costa Rica",b:"Panamá"},
    {id:23,g:"D",a:"Venezuela",b:"Panamá"},
    {id:24,g:"D",a:"Haití",b:"Costa Rica"},
  ];

  const matchLabels = {};
  const mgmap = {};
  groupMatches.forEach(m => { matchLabels[m.id] = `${m.a} vs ${m.b}`; mgmap[m.id] = m.g; });

  return {
    id: "copaamerica-ficticia",
    nombre: "Copa América (datos ficticios, checkpoint Sprint 4c)",

    groupMatches,
    matchLabels,

    // Sin sync ESPN para este torneo ficticio -- no hay partido real que
    // consultar. app-bracket-espn-sync.js/app-live-sync.js siguen
    // funcionando (esos botones simplemente no encuentran nada que
    // sincronizar), y Modo Prueba/simulación no los necesita.
    espnAbbrMap: {},

    midAbbrs: {
      1:"ARG|CAN",2:"CHI|PER",3:"ARG|PER",4:"CAN|CHI",5:"ARG|CHI",6:"PER|CAN",
      7:"BRA|MEX",8:"COL|PAR",9:"BRA|PAR",10:"MEX|COL",11:"BRA|COL",12:"PAR|MEX",
      13:"URU|USA",14:"ECU|BOL",15:"URU|BOL",16:"USA|ECU",17:"URU|ECU",18:"BOL|USA",
      19:"VEN|CRC",20:"PAN|HAI",21:"VEN|HAI",22:"CRC|PAN",23:"VEN|PAN",24:"HAI|CRC",
    },

    mgmap,

    ges: {
      A:["🇦🇷 Argentina","🇨🇱 Chile","🇵🇪 Perú","🇨🇦 Canadá"],
      B:["🇧🇷 Brasil","🇨🇴 Colombia","🇵🇾 Paraguay","🇲🇽 México"],
      C:["🇺🇾 Uruguay","🇪🇨 Ecuador","🇧🇴 Bolivia","🇺🇸 Estados Unidos"],
      D:["🇻🇪 Venezuela","🇵🇦 Panamá","🇭🇹 Haití","🇨🇷 Costa Rica"],
    },

    // Mismos "puntos fijos" que el Mundial 2026 -- son conceptos
    // genéricos de cualquier torneo de eliminación (campeón, goleador,
    // etc.), no específicos de fútbol de selecciones ni del formato de
    // grupos.
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

    // Formato "direct": 2 primeros de cada grupo cruzan directo a
    // Cuartos, sin mejores terceros ni Annex C -- a diferencia del
    // Mundial 2026 (bracketFormat:"best-thirds").
    bracketFormat: "direct",
    groupKeys: ["A","B","C","D"],

    // Cruces de Cuartos de Final ("1A" = 1ero del grupo A, etc.) --
    // dato puro del torneo, generarLlavesDirecto() (app-bracket-compute.js,
    // Sprint 4b) solo lo resuelve contra los standings reales.
    directCrosses: {
      25: {h:"1A", a:"2B"},
      26: {h:"1B", a:"2A"},
      27: {h:"1C", a:"2D"},
      28: {h:"1D", a:"2C"},
    },

    // Primera ronda de eliminatoria de este torneo: Cuartos, no
    // Dieciseisavos -- el nombre "elim1_16..." es heredado del Mundial
    // (ver comentario en app-eliminatoria-data.js), funcionalmente solo
    // representa "IDs/labels de la primera ronda de KO".
    elim1_16Ids: [25,26,27,28],
    elim1_16Labels: {25:"P25",26:"P26",27:"P27",28:"P28"},

    worldPool: ["Argentina","Chile","Perú","Canadá","Brasil","Colombia","Paraguay","México","Uruguay","Ecuador","Bolivia","Estados Unidos","Venezuela","Panamá","Haití","Costa Rica"],

    elimTree: {
      29:{parentH:25,parentA:26,useLoserH:false,useLoserA:false},
      30:{parentH:27,parentA:28,useLoserH:false,useLoserA:false},
      31:{parentH:29,parentA:30,useLoserH:true,useLoserA:true},
      32:{parentH:29,parentA:30,useLoserH:false,useLoserA:false},
    },

    elimRounds: [
      {lbl:"Cuartos de final",ids:[25,26,27,28]},
      {lbl:"Semifinales",ids:[29,30]},
      {lbl:"Tercer lugar",ids:[31]},
      {lbl:"🏆 Final",ids:[32]},
    ],

    bonusPhases: [
      {key:"grupos",label:"Fase de Grupos",mids:groupMatches.map(m=>m.id),elimPhase:false,lastPts:8,classifiedPts:0,llavePts:0,prevPhase:null},
      {key:"qf",label:"Cuartos",mids:[25,26,27,28],elimPhase:true,lastPts:6,classifiedPts:6,llavePts:2,prevPhase:"grupos"},
      {key:"sf",label:"Semifinales",mids:[29,30],elimPhase:true,lastPts:0,classifiedPts:6,llavePts:2,prevPhase:"qf"},
      {key:"third",label:"Tercer lugar",mids:[31],elimPhase:true,lastPts:0,classifiedPts:0,llavePts:2,prevPhase:"sf"},
      {key:"final",label:"Final",mids:[32],elimPhase:true,lastPts:0,classifiedPts:0,llavePts:2,prevPhase:"sf"},
    ],
  };
})();
