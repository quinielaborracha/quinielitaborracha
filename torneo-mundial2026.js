/* ════════════════════════════════════════════════════════════
   torneo-mundial2026.js
   ════════════════════════════════════════════════════════════
   Config del torneo actual: Mundial 2026. Consolida en UN objeto todo
   lo que hasta ahora vivía repartido entre partidos-grupos.js
   (MATCH_LABELS), app-static-data.js (ESPN_ABBR_MAP/MID_ABBRS/MGMAP/
   GES/ARULES), registro.js (GROUP_MATCHES) y app-live-sync.js
   (ESPN_GAMEID_TO_PID) -- el fixture de 72 partidos de fase de grupos,
   sus mapeos a la API de ESPN, y los puntos fijos de "Reglas avanzadas".

   Sprint 2 de la "hoja de ruta comercial" (motor de datos de torneo,
   2026-07-22): un futuro segundo torneo (Copa América, Euro, etc.)
   define su propio objeto TORNEO_<NOMBRE> con esta misma forma, en su
   propio archivo -- sin tocar scoring.js/utils.js/app-bracket-*.js, que
   siguen leyendo los globals MATCH_LABELS/ESPN_ABBR_MAP/MID_ABBRS/
   MGMAP/GES/ARULES tal cual (partidos-grupos.js y app-static-data.js
   ahora solo reasignan esos globals desde TORNEO_MUNDIAL_2026, ver
   comentario en esos archivos). Carga antes que partidos-grupos.js
   (primer script después de participantes.js) porque ese archivo
   depende de este objeto para poblar MATCH_LABELS.

   Sprint 3b (mismo roadmap, 2026-07-22): hasta acá, `matchLabels` y
   `mgmap` eran diccionarios paralelos, y registro.js tenía su PROPIA
   copia estructurada del mismo fixture (`GROUP_MATCHES`, {id,g,a,b}) --
   3 representaciones del mismo dato que coincidían por disciplina
   manual, no por construcción (verificado byte a byte que las 3 eran
   idénticas antes de consolidar). Ahora `groupMatches` es la ÚNICA
   fuente: `matchLabels`/`mgmap` se DERIVAN de `groupMatches` acá abajo,
   y registro.js reasigna `GROUP_MATCHES` desde este mismo array (ver
   comentario en registro.js). Mismo criterio para
   `ESPN_GAMEID_TO_PID` (antes hardcodeado en app-live-sync.js): ahora
   vive acá como `espnGameIdToPid`.

   Nota: FLAGS2/ABBR/BGCOL (app-static-data.js) NO se movieron acá --
   son un set más chico y con equipos que no están en el Mundial 2026
   (Chile, Italia, Holanda, Dinamarca, Polonia), aparentan servir a
   "Torneo Real" (campeones históricos) más que al fixture del torneo en
   curso. Quedan fuera del alcance de este sprint.

   Pendiente (Sprint 3c, sesión aparte): KO_SLOT_IDS/parentSlotsOf en
   registro.js siguen con los tamaños de ronda del bracket (16/8/4/2/1)
   y los prevBasePid (73/89/97/101) escritos a mano -- es una
   generalización más grande (iterar ELIM_ROUNDS genéricamente en vez
   de 5 bloques desenrollados a mano por ronda), no una extracción de
   dato como esta.
   ════════════════════════════════════════════════════════════ */

const TORNEO_MUNDIAL_2026 = (function(){
  // Fuente única de los 72 partidos de fase de grupos: id, grupo (A-L)
  // y los 2 equipos. matchLabels/mgmap (que consumen scoring.js/
  // utils.js/app-bracket-*.js) se derivan de este mismo array más
  // abajo -- ya no son datos escritos aparte.
  const groupMatches = [
    {id:1,g:"A",a:"México",b:"Sudáfrica"},{id:2,g:"A",a:"Corea del Sur",b:"República Checa"},{id:3,g:"B",a:"Canadá",b:"Bosnia y Herzegovina"},{id:4,g:"D",a:"Estados Unidos",b:"Paraguay"},{id:5,g:"C",a:"Haití",b:"Escocia"},{id:6,g:"D",a:"Australia",b:"Turquía"},{id:7,g:"C",a:"Brasil",b:"Marruecos"},{id:8,g:"B",a:"Catar",b:"Suiza"},{id:9,g:"E",a:"Costa de Marfil",b:"Ecuador"},{id:10,g:"E",a:"Alemania",b:"Curazao"},{id:11,g:"F",a:"Países Bajos",b:"Japón"},{id:12,g:"F",a:"Suecia",b:"Túnez"},{id:13,g:"H",a:"Arabia Saudita",b:"Uruguay"},{id:14,g:"H",a:"España",b:"Cabo Verde"},{id:15,g:"G",a:"Irán",b:"Nueva Zelanda"},{id:16,g:"G",a:"Bélgica",b:"Egipto"},{id:17,g:"I",a:"Francia",b:"Senegal"},{id:18,g:"I",a:"Irak",b:"Noruega"},{id:19,g:"J",a:"Argentina",b:"Argelia"},{id:20,g:"J",a:"Austria",b:"Jordania"},{id:21,g:"L",a:"Ghana",b:"Panamá"},{id:22,g:"L",a:"Inglaterra",b:"Croacia"},{id:23,g:"K",a:"Portugal",b:"RD Congo"},{id:24,g:"K",a:"Uzbekistán",b:"Colombia"},{id:25,g:"A",a:"República Checa",b:"Sudáfrica"},{id:26,g:"B",a:"Suiza",b:"Bosnia y Herzegovina"},{id:27,g:"B",a:"Canadá",b:"Catar"},{id:28,g:"A",a:"México",b:"Corea del Sur"},{id:29,g:"C",a:"Brasil",b:"Haití"},{id:30,g:"C",a:"Escocia",b:"Marruecos"},{id:31,g:"D",a:"Turquía",b:"Paraguay"},{id:32,g:"D",a:"Estados Unidos",b:"Australia"},{id:33,g:"E",a:"Alemania",b:"Costa de Marfil"},{id:34,g:"E",a:"Ecuador",b:"Curazao"},{id:35,g:"F",a:"Países Bajos",b:"Suecia"},{id:36,g:"F",a:"Túnez",b:"Japón"},{id:37,g:"H",a:"Uruguay",b:"Cabo Verde"},{id:38,g:"H",a:"España",b:"Arabia Saudita"},{id:39,g:"G",a:"Bélgica",b:"Irán"},{id:40,g:"G",a:"Nueva Zelanda",b:"Egipto"},{id:41,g:"I",a:"Noruega",b:"Senegal"},{id:42,g:"I",a:"Francia",b:"Irak"},{id:43,g:"J",a:"Argentina",b:"Austria"},{id:44,g:"J",a:"Jordania",b:"Argelia"},{id:45,g:"L",a:"Inglaterra",b:"Ghana"},{id:46,g:"L",a:"Panamá",b:"Croacia"},{id:47,g:"K",a:"Portugal",b:"Uzbekistán"},{id:48,g:"K",a:"Colombia",b:"RD Congo"},{id:49,g:"C",a:"Escocia",b:"Brasil"},{id:50,g:"C",a:"Marruecos",b:"Haití"},{id:51,g:"B",a:"Suiza",b:"Canadá"},{id:52,g:"B",a:"Bosnia y Herzegovina",b:"Catar"},{id:53,g:"A",a:"República Checa",b:"México"},{id:54,g:"A",a:"Sudáfrica",b:"Corea del Sur"},{id:55,g:"E",a:"Curazao",b:"Costa de Marfil"},{id:56,g:"E",a:"Ecuador",b:"Alemania"},{id:57,g:"F",a:"Japón",b:"Suecia"},{id:58,g:"F",a:"Túnez",b:"Países Bajos"},{id:59,g:"D",a:"Turquía",b:"Estados Unidos"},{id:60,g:"D",a:"Paraguay",b:"Australia"},{id:61,g:"I",a:"Noruega",b:"Francia"},{id:62,g:"I",a:"Senegal",b:"Irak"},{id:63,g:"G",a:"Egipto",b:"Irán"},{id:64,g:"G",a:"Nueva Zelanda",b:"Bélgica"},{id:65,g:"H",a:"Cabo Verde",b:"Arabia Saudita"},{id:66,g:"H",a:"Uruguay",b:"España"},{id:67,g:"L",a:"Panamá",b:"Inglaterra"},{id:68,g:"L",a:"Croacia",b:"Ghana"},{id:69,g:"J",a:"Argelia",b:"Austria"},{id:70,g:"J",a:"Jordania",b:"Argentina"},{id:71,g:"K",a:"Colombia",b:"Portugal"},{id:72,g:"K",a:"RD Congo",b:"Uzbekistán"},
  ];

  const matchLabels = {};
  const mgmap = {};
  groupMatches.forEach(m => { matchLabels[m.id] = `${m.a} vs ${m.b}`; mgmap[m.id] = m.g; });

  return {
    id: "mundial2026",
    nombre: "Mundial 2026",

    groupMatches,
    matchLabels,
    mgmap,

    // MAPA ESPN ABBR → matchId (confirmado API real 11/06/2026)
    espnAbbrMap: {"MEX|RSA":1,"RSA|MEX":1,"KOR|CZE":2,"CZE|KOR":2,"CAN|BIH":3,"BIH|CAN":3,"USA|PAR":4,"PAR|USA":4,"HAI|SCO":5,"SCO|HAI":5,"AUS|TUR":6,"TUR|AUS":6,"BRA|MAR":7,"MAR|BRA":7,"QAT|SUI":8,"SUI|QAT":8,"CIV|ECU":9,"ECU|CIV":9,"GER|CUR":10,"CUR|GER":10,"NED|JPN":11,"JPN|NED":11,"SWE|TUN":12,"TUN|SWE":12,"KSA|URU":13,"URU|KSA":13,"ESP|CPV":14,"CPV|ESP":14,"IRN|NZL":15,"NZL|IRN":15,"BEL|EGY":16,"EGY|BEL":16,"FRA|SEN":17,"SEN|FRA":17,"IRQ|NOR":18,"NOR|IRQ":18,"ARG|ALG":19,"ALG|ARG":19,"AUT|JOR":20,"JOR|AUT":20,"GHA|PAN":21,"PAN|GHA":21,"ENG|CRO":22,"CRO|ENG":22,"POR|CGO":23,"CGO|POR":23,"UZB|COL":24,"COL|UZB":24,"CZE|RSA":25,"RSA|CZE":25,"SUI|BIH":26,"BIH|SUI":26,"CAN|QAT":27,"QAT|CAN":27,"MEX|KOR":28,"KOR|MEX":28,"BRA|HAI":29,"HAI|BRA":29,"SCO|MAR":30,"MAR|SCO":30,"TUR|PAR":31,"PAR|TUR":31,"USA|AUS":32,"AUS|USA":32,"GER|CIV":33,"CIV|GER":33,"ECU|CUR":34,"CUR|ECU":34,"NED|SWE":35,"SWE|NED":35,"TUN|JPN":36,"JPN|TUN":36,"URU|CPV":37,"CPV|URU":37,"ESP|KSA":38,"KSA|ESP":38,"BEL|IRN":39,"IRN|BEL":39,"NZL|EGY":40,"EGY|NZL":40,"NOR|SEN":41,"SEN|NOR":41,"FRA|IRQ":42,"IRQ|FRA":42,"ARG|AUT":43,"AUT|ARG":43,"JOR|ALG":44,"ALG|JOR":44,"ENG|GHA":45,"GHA|ENG":45,"PAN|CRO":46,"CRO|PAN":46,"POR|UZB":47,"UZB|POR":47,"COL|CGO":48,"CGO|COL":48,"SCO|BRA":49,"BRA|SCO":49,"MAR|HAI":50,"HAI|MAR":50,"SUI|CAN":51,"CAN|SUI":51,"BIH|QAT":52,"QAT|BIH":52,"CZE|MEX":53,"MEX|CZE":53,"RSA|KOR":54,"KOR|RSA":54,"CUR|CIV":55,"CIV|CUR":55,"ECU|GER":56,"GER|ECU":56,"JPN|SWE":57,"SWE|JPN":57,"TUN|NED":58,"NED|TUN":58,"TUR|USA":59,"USA|TUR":59,"PAR|AUS":60,"AUS|PAR":60,"NOR|FRA":61,"FRA|NOR":61,"SEN|IRQ":62,"IRQ|SEN":62,"EGY|IRN":63,"IRN|EGY":63,"NZL|BEL":64,"BEL|NZL":64,"CPV|KSA":65,"KSA|CPV":65,"URU|ESP":66,"ESP|URU":66,"PAN|ENG":67,"ENG|PAN":67,"CRO|GHA":68,"GHA|CRO":68,"ALG|AUT":69,"AUT|ALG":69,"JOR|ARG":70,"ARG|JOR":70,"COL|POR":71,"POR|COL":71,"CGO|UZB":72,"UZB|CGO":72},

    // Mapa abbr por matchId (para checksums y validación)
    midAbbrs: {1:"MEX|RSA",2:"KOR|CZE",3:"CAN|BIH",4:"USA|PAR",5:"HAI|SCO",6:"AUS|TUR",7:"BRA|MAR",8:"QAT|SUI",9:"CIV|ECU",10:"GER|CUR",11:"NED|JPN",12:"SWE|TUN",13:"KSA|URU",14:"ESP|CPV",15:"IRN|NZL",16:"BEL|EGY",17:"FRA|SEN",18:"IRQ|NOR",19:"ARG|ALG",20:"AUT|JOR",21:"GHA|PAN",22:"ENG|CRO",23:"POR|CGO",24:"UZB|COL",25:"CZE|RSA",26:"SUI|BIH",27:"CAN|QAT",28:"MEX|KOR",29:"BRA|HAI",30:"SCO|MAR",31:"TUR|PAR",32:"USA|AUS",33:"GER|CIV",34:"ECU|CUR",35:"NED|SWE",36:"TUN|JPN",37:"URU|CPV",38:"ESP|KSA",39:"BEL|IRN",40:"NZL|EGY",41:"NOR|SEN",42:"FRA|IRQ",43:"ARG|AUT",44:"JOR|ALG",45:"ENG|GHA",46:"PAN|CRO",47:"POR|UZB",48:"COL|CGO",49:"SCO|BRA",50:"MAR|HAI",51:"SUI|CAN",52:"BIH|QAT",53:"CZE|MEX",54:"RSA|KOR",55:"CUR|CIV",56:"ECU|GER",57:"JPN|SWE",58:"TUN|NED",59:"TUR|USA",60:"PAR|AUS",61:"NOR|FRA",62:"SEN|IRQ",63:"EGY|IRN",64:"NZL|BEL",65:"CPV|KSA",66:"URU|ESP",67:"PAN|ENG",68:"CRO|GHA",69:"ALG|AUT",70:"JOR|ARG",71:"COL|POR",72:"CGO|UZB"},

    // Grupo (A-L) de cada matchId
    mgmap,

    // Composición de los 12 grupos (bandera + nombre corto)
    ges: {A:["🇲🇽 México","🇿🇦 Sudáfrica","🇰🇷 Corea del Sur","🇨🇿 Chequia"],B:["🇨🇦 Canadá","🇧🇦 Bosnia-Herz.","🇶🇦 Qatar","🇨🇭 Suiza"],C:["🇧🇷 Brasil","🇲🇦 Marruecos","🇭🇹 Haití","🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia"],D:["🇺🇸 EE.UU.","🇵🇾 Paraguay","🇦🇺 Australia","🇹🇷 Turquía"],E:["🇩🇪 Alemania","🇨🇮 C.Marfil","🇪🇨 Ecuador","🇨🇼 Curazao"],F:["🇳🇱 P.Bajos","🇯🇵 Japón","🇸🇪 Suecia","🇹🇳 Túnez"],G:["🇧🇪 Bélgica","🇪🇬 Egipto","🇮🇷 Irán","🇳🇿 N.Zelanda"],H:["🇪🇸 España","🇨🇻 C.Verde","🇸🇦 A.Saudita","🇺🇾 Uruguay"],I:["🇫🇷 Francia","🇸🇳 Senegal","🇮🇶 Irak","🇳🇴 Noruega"],J:["🇦🇷 Argentina","🇩🇿 Argelia","🇦🇹 Austria","🇯🇴 Jordania"],K:["🇵🇹 Portugal","🇨🇩 R.D.Congo","🇺🇿 Uzbekistán","🇨🇴 Colombia"],L:["🇬🇧 Inglaterra","🇭🇷 Croacia","🇬🇭 Ghana","🇵🇦 Panamá"]},

    // Puntos fijos del juego para "Reglas avanzadas" (campeón, goleador,
    // etc.) -- el "id" de cada una coincide a propósito con el id de
    // SPECIAL_QUESTIONS (registro.js), la misma clave que usa
    // DB.configGlobal.reglas.avanzado.<id>.
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

    // MAPA ESPN gameId → pid de eliminatoria (P73-P104) -- IDs fijos por
    // el calendario oficial del torneo (cada cruce del bracket tiene su
    // gameId asignado desde el sorteo de fechas, sin importar qué
    // selección termine cayendo ahí), confirmado contra el cuadro real
    // de ESPN (espndeportes.espn.com/futbol/cuadro) el 25/06/2026.
    espnGameIdToPid: {
      "760486":73,"760489":74,"760488":75,"760487":76,
      "760492":77,"760490":78,"760491":79,"760495":80,
      "760494":81,"760493":82,"760496":83,"760497":84,
      "760498":85,"760500":86,"760501":87,"760499":88,
      "760503":89,"760502":90,"760504":91,"760505":92,
      "760506":93,"760507":94,"760509":95,"760508":96,
      "760510":97,"760511":98,"760512":99,"760513":100,
      "760514":101,"760515":102,"760516":103,"760517":104,
    },

    // Formato de bracket de eliminatoria: "best-thirds" (mejores terceros
    // de grupo avanzan vía Annex C, formato Mundial 2026 con 12 grupos)
    // vs. "direct" (los 2 primeros de cada grupo avanzan directo, sin
    // terceros -- formato Copa América/Euro). app-bracket-compute.js
    // (Sprint 4b, hoja de ruta comercial) lee este flag para decidir qué
    // lógica de cruces usar.
    bracketFormat: "best-thirds",

    // Grupos del torneo, en el orden en que se muestran (A-L) -- antes
    // hardcodeado como Array literal directo en generarLlavesDieciseisavos()
    // (app-bracket-compute.js).
    groupKeys: ["A","B","C","D","E","F","G","H","I","J","K","L"],

    // Partidos 1/16 -- solo IDs y slot labels (equipos se cargan
    // dinámicamente). Antes vivían como ELIM_1_16_IDS/ELIM_1_16_LABELS
    // hardcodeados en app-eliminatoria-data.js (Sprint 4a).
    elim1_16Ids: [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88],
    elim1_16Labels: {
      73:"P73",74:"P74",75:"P75",76:"P76",
      77:"P77",78:"P78",79:"P79",80:"P80",
      81:"P81",82:"P82",83:"P83",84:"P84",
      85:"P85",86:"P86",87:"P87",88:"P88",
    },

    // Pool de 48 selecciones del Mundial 2026 para simulación. Antes
    // WORLD_POOL hardcodeado en app-eliminatoria-data.js (Sprint 4a).
    worldPool: ["México","Sudáfrica","Corea del Sur","República Checa","Canadá","Bosnia y Herzegovina","Qatar","Suiza","Brasil","Marruecos","Haití","Escocia","Estados Unidos","Paraguay","Australia","Turquía","Alemania","Costa de Marfil","Ecuador","Curazao","Países Bajos","Japón","Suecia","Túnez","Arabia Saudita","Uruguay","España","Cabo Verde","Irán","Nueva Zelanda","Bélgica","Egipto","Francia","Senegal","Irak","Noruega","Argentina","Argelia","Austria","Jordania","Portugal","RD Congo","Uzbekistán","Colombia","Inglaterra","Croacia","Ghana","Panamá"],

    // Estructura del bracket: cada partido posterior depende de quién
    // ganó antes (parentH/parentA = id del partido cuyos ganadores se
    // enfrentan acá). Para P103 (3er lugar): perdedores de semis. Antes
    // ELIM_TREE hardcodeado en app-eliminatoria-data.js (Sprint 4a).
    elimTree: {
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
    },

    // Rondas de eliminatoria en orden de juego. Antes ELIM_ROUNDS
    // hardcodeado en app-eliminatoria-data.js (Sprint 4a).
    elimRounds: [
      {lbl:"Dieciseisavos de final",ids:[73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88]},
      {lbl:"Octavos de final",ids:[89,90,91,92,93,94,95,96]},
      {lbl:"Cuartos de final",ids:[97,98,99,100]},
      {lbl:"Semifinales",ids:[101,102]},
      {lbl:"Tercer y cuarto lugar",ids:[103]},
      {lbl:"🏆 Gran Final",ids:[104]},
    ],

    // Fases con sus IDs de partido y puntos de Bonos (último lugar,
    // clasificados, llaves). Antes BONUS_PHASES hardcodeado en
    // app-eliminatoria-data.js (Sprint 4a) -- la fase "grupos" ahora usa
    // groupMatches.map() en vez de Array.from({length:72}) literal.
    bonusPhases: [
      {key:"grupos",label:"Fase de Grupos",mids:groupMatches.map(m=>m.id),elimPhase:false,lastPts:8,classifiedPts:0,llavePts:0,prevPhase:null},
      {key:"r16",label:"Dieciseisavos",mids:[73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88],elimPhase:true,lastPts:6,classifiedPts:3,llavePts:2,prevPhase:"grupos"},
      {key:"r8",label:"Octavos",mids:[89,90,91,92,93,94,95,96],elimPhase:true,lastPts:6,classifiedPts:4,llavePts:2,prevPhase:"r16"},
      {key:"qf",label:"Cuartos",mids:[97,98,99,100],elimPhase:true,lastPts:6,classifiedPts:6,llavePts:2,prevPhase:"r8"},
      {key:"sf",label:"Semifinales",mids:[101,102],elimPhase:true,lastPts:0,classifiedPts:6,llavePts:2,prevPhase:"qf"},
      {key:"third",label:"Tercer lugar",mids:[103],elimPhase:true,lastPts:0,classifiedPts:0,llavePts:2,prevPhase:"sf"},
      {key:"final",label:"Final",mids:[104],elimPhase:true,lastPts:0,classifiedPts:0,llavePts:2,prevPhase:"sf"},
    ],
  };
})();
