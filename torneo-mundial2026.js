/* ════════════════════════════════════════════════════════════
   torneo-mundial2026.js
   ════════════════════════════════════════════════════════════
   Config del torneo actual: Mundial 2026. Consolida en UN objeto todo
   lo que hasta ahora vivía repartido entre partidos-grupos.js
   (MATCH_LABELS) y app-static-data.js (ESPN_ABBR_MAP/MID_ABBRS/MGMAP/
   GES/ARULES) -- el fixture de 72 partidos de fase de grupos, sus
   mapeos a la API de ESPN, y los puntos fijos de "Reglas avanzadas".

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

   Nota: FLAGS2/ABBR/BGCOL (app-static-data.js) NO se movieron acá --
   son un set más chico y con equipos que no están en el Mundial 2026
   (Chile, Italia, Holanda, Dinamarca, Polonia), aparentan servir a
   "Torneo Real" (campeones históricos) más que al fixture del torneo en
   curso. Quedan fuera del alcance de este sprint.
   ════════════════════════════════════════════════════════════ */

const TORNEO_MUNDIAL_2026 = {
  id: "mundial2026",
  nombre: "Mundial 2026",

  // Nombre de cada uno de los 72 partidos de fase de grupos (dato
  // público del fixture, sin datos de ningún participante).
  matchLabels: {1:"México vs Sudáfrica",2:"Corea del Sur vs República Checa",3:"Canadá vs Bosnia y Herzegovina",4:"Estados Unidos vs Paraguay",5:"Haití vs Escocia",6:"Australia vs Turquía",7:"Brasil vs Marruecos",8:"Catar vs Suiza",9:"Costa de Marfil vs Ecuador",10:"Alemania vs Curazao",11:"Países Bajos vs Japón",12:"Suecia vs Túnez",13:"Arabia Saudita vs Uruguay",14:"España vs Cabo Verde",15:"Irán vs Nueva Zelanda",16:"Bélgica vs Egipto",17:"Francia vs Senegal",18:"Irak vs Noruega",19:"Argentina vs Argelia",20:"Austria vs Jordania",21:"Ghana vs Panamá",22:"Inglaterra vs Croacia",23:"Portugal vs RD Congo",24:"Uzbekistán vs Colombia",25:"República Checa vs Sudáfrica",26:"Suiza vs Bosnia y Herzegovina",27:"Canadá vs Catar",28:"México vs Corea del Sur",29:"Brasil vs Haití",30:"Escocia vs Marruecos",31:"Turquía vs Paraguay",32:"Estados Unidos vs Australia",33:"Alemania vs Costa de Marfil",34:"Ecuador vs Curazao",35:"Países Bajos vs Suecia",36:"Túnez vs Japón",37:"Uruguay vs Cabo Verde",38:"España vs Arabia Saudita",39:"Bélgica vs Irán",40:"Nueva Zelanda vs Egipto",41:"Noruega vs Senegal",42:"Francia vs Irak",43:"Argentina vs Austria",44:"Jordania vs Argelia",45:"Inglaterra vs Ghana",46:"Panamá vs Croacia",47:"Portugal vs Uzbekistán",48:"Colombia vs RD Congo",49:"Escocia vs Brasil",50:"Marruecos vs Haití",51:"Suiza vs Canadá",52:"Bosnia y Herzegovina vs Catar",53:"República Checa vs México",54:"Sudáfrica vs Corea del Sur",55:"Curazao vs Costa de Marfil",56:"Ecuador vs Alemania",57:"Japón vs Suecia",58:"Túnez vs Países Bajos",59:"Turquía vs Estados Unidos",60:"Paraguay vs Australia",61:"Noruega vs Francia",62:"Senegal vs Irak",63:"Egipto vs Irán",64:"Nueva Zelanda vs Bélgica",65:"Cabo Verde vs Arabia Saudita",66:"Uruguay vs España",67:"Panamá vs Inglaterra",68:"Croacia vs Ghana",69:"Argelia vs Austria",70:"Jordania vs Argentina",71:"Colombia vs Portugal",72:"RD Congo vs Uzbekistán"},

  // MAPA ESPN ABBR → matchId (confirmado API real 11/06/2026)
  espnAbbrMap: {"MEX|RSA":1,"RSA|MEX":1,"KOR|CZE":2,"CZE|KOR":2,"CAN|BIH":3,"BIH|CAN":3,"USA|PAR":4,"PAR|USA":4,"HAI|SCO":5,"SCO|HAI":5,"AUS|TUR":6,"TUR|AUS":6,"BRA|MAR":7,"MAR|BRA":7,"QAT|SUI":8,"SUI|QAT":8,"CIV|ECU":9,"ECU|CIV":9,"GER|CUR":10,"CUR|GER":10,"NED|JPN":11,"JPN|NED":11,"SWE|TUN":12,"TUN|SWE":12,"KSA|URU":13,"URU|KSA":13,"ESP|CPV":14,"CPV|ESP":14,"IRN|NZL":15,"NZL|IRN":15,"BEL|EGY":16,"EGY|BEL":16,"FRA|SEN":17,"SEN|FRA":17,"IRQ|NOR":18,"NOR|IRQ":18,"ARG|ALG":19,"ALG|ARG":19,"AUT|JOR":20,"JOR|AUT":20,"GHA|PAN":21,"PAN|GHA":21,"ENG|CRO":22,"CRO|ENG":22,"POR|CGO":23,"CGO|POR":23,"UZB|COL":24,"COL|UZB":24,"CZE|RSA":25,"RSA|CZE":25,"SUI|BIH":26,"BIH|SUI":26,"CAN|QAT":27,"QAT|CAN":27,"MEX|KOR":28,"KOR|MEX":28,"BRA|HAI":29,"HAI|BRA":29,"SCO|MAR":30,"MAR|SCO":30,"TUR|PAR":31,"PAR|TUR":31,"USA|AUS":32,"AUS|USA":32,"GER|CIV":33,"CIV|GER":33,"ECU|CUR":34,"CUR|ECU":34,"NED|SWE":35,"SWE|NED":35,"TUN|JPN":36,"JPN|TUN":36,"URU|CPV":37,"CPV|URU":37,"ESP|KSA":38,"KSA|ESP":38,"BEL|IRN":39,"IRN|BEL":39,"NZL|EGY":40,"EGY|NZL":40,"NOR|SEN":41,"SEN|NOR":41,"FRA|IRQ":42,"IRQ|FRA":42,"ARG|AUT":43,"AUT|ARG":43,"JOR|ALG":44,"ALG|JOR":44,"ENG|GHA":45,"GHA|ENG":45,"PAN|CRO":46,"CRO|PAN":46,"POR|UZB":47,"UZB|POR":47,"COL|CGO":48,"CGO|COL":48,"SCO|BRA":49,"BRA|SCO":49,"MAR|HAI":50,"HAI|MAR":50,"SUI|CAN":51,"CAN|SUI":51,"BIH|QAT":52,"QAT|BIH":52,"CZE|MEX":53,"MEX|CZE":53,"RSA|KOR":54,"KOR|RSA":54,"CUR|CIV":55,"CIV|CUR":55,"ECU|GER":56,"GER|ECU":56,"JPN|SWE":57,"SWE|JPN":57,"TUN|NED":58,"NED|TUN":58,"TUR|USA":59,"USA|TUR":59,"PAR|AUS":60,"AUS|PAR":60,"NOR|FRA":61,"FRA|NOR":61,"SEN|IRQ":62,"IRQ|SEN":62,"EGY|IRN":63,"IRN|EGY":63,"NZL|BEL":64,"BEL|NZL":64,"CPV|KSA":65,"KSA|CPV":65,"URU|ESP":66,"ESP|URU":66,"PAN|ENG":67,"ENG|PAN":67,"CRO|GHA":68,"GHA|CRO":68,"ALG|AUT":69,"AUT|ALG":69,"JOR|ARG":70,"ARG|JOR":70,"COL|POR":71,"POR|COL":71,"CGO|UZB":72,"UZB|CGO":72},

  // Mapa abbr por matchId (para checksums y validación)
  midAbbrs: {1:"MEX|RSA",2:"KOR|CZE",3:"CAN|BIH",4:"USA|PAR",5:"HAI|SCO",6:"AUS|TUR",7:"BRA|MAR",8:"QAT|SUI",9:"CIV|ECU",10:"GER|CUR",11:"NED|JPN",12:"SWE|TUN",13:"KSA|URU",14:"ESP|CPV",15:"IRN|NZL",16:"BEL|EGY",17:"FRA|SEN",18:"IRQ|NOR",19:"ARG|ALG",20:"AUT|JOR",21:"GHA|PAN",22:"ENG|CRO",23:"POR|CGO",24:"UZB|COL",25:"CZE|RSA",26:"SUI|BIH",27:"CAN|QAT",28:"MEX|KOR",29:"BRA|HAI",30:"SCO|MAR",31:"TUR|PAR",32:"USA|AUS",33:"GER|CIV",34:"ECU|CUR",35:"NED|SWE",36:"TUN|JPN",37:"URU|CPV",38:"ESP|KSA",39:"BEL|IRN",40:"NZL|EGY",41:"NOR|SEN",42:"FRA|IRQ",43:"ARG|AUT",44:"JOR|ALG",45:"ENG|GHA",46:"PAN|CRO",47:"POR|UZB",48:"COL|CGO",49:"SCO|BRA",50:"MAR|HAI",51:"SUI|CAN",52:"BIH|QAT",53:"CZE|MEX",54:"RSA|KOR",55:"CUR|CIV",56:"ECU|GER",57:"JPN|SWE",58:"TUN|NED",59:"TUR|USA",60:"PAR|AUS",61:"NOR|FRA",62:"SEN|IRQ",63:"EGY|IRN",64:"NZL|BEL",65:"CPV|KSA",66:"URU|ESP",67:"PAN|ENG",68:"CRO|GHA",69:"ALG|AUT",70:"JOR|ARG",71:"COL|POR",72:"CGO|UZB"},

  // Grupo (A-L) de cada matchId
  mgmap: {1:"A",2:"A",3:"B",4:"D",5:"C",6:"D",7:"C",8:"B",9:"E",10:"E",11:"F",12:"F",13:"H",14:"H",15:"G",16:"G",17:"I",18:"I",19:"J",20:"J",21:"L",22:"L",23:"K",24:"K",25:"A",26:"B",27:"B",28:"A",29:"C",30:"C",31:"D",32:"D",33:"E",34:"E",35:"F",36:"F",37:"H",38:"H",39:"G",40:"G",41:"I",42:"I",43:"J",44:"J",45:"L",46:"L",47:"K",48:"K",49:"C",50:"C",51:"B",52:"B",53:"A",54:"A",55:"E",56:"E",57:"F",58:"F",59:"D",60:"D",61:"I",62:"I",63:"G",64:"G",65:"H",66:"H",67:"L",68:"L",69:"J",70:"J",71:"K",72:"K"},

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
};
