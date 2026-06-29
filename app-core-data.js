/* ════════════════════════════════════════════════════════════
   app-core-data.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Datos maestros: mapa de abreviaturas ESPN, equipos/grupos/banderas, reglas de puntaje. Construye los globales PL/PM/MD/MIDS al cargar (llama rebuildDynamicData(), definida en este mismo archivo).

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): MAPA ESPN ABBR → matchId; DATOS MAESTROS

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

// ══════════════════════════════════════════════════════════════
// MAPA ESPN ABBR → matchId (confirmado API real 11/06/2026)
// ══════════════════════════════════════════════════════════════
const ESPN_ABBR_MAP={"MEX|RSA":1,"RSA|MEX":1,"KOR|CZE":2,"CZE|KOR":2,"CAN|BIH":3,"BIH|CAN":3,"USA|PAR":4,"PAR|USA":4,"HAI|SCO":5,"SCO|HAI":5,"AUS|TUR":6,"TUR|AUS":6,"BRA|MAR":7,"MAR|BRA":7,"QAT|SUI":8,"SUI|QAT":8,"CIV|ECU":9,"ECU|CIV":9,"GER|CUR":10,"CUR|GER":10,"NED|JPN":11,"JPN|NED":11,"SWE|TUN":12,"TUN|SWE":12,"KSA|URU":13,"URU|KSA":13,"ESP|CPV":14,"CPV|ESP":14,"IRN|NZL":15,"NZL|IRN":15,"BEL|EGY":16,"EGY|BEL":16,"FRA|SEN":17,"SEN|FRA":17,"IRQ|NOR":18,"NOR|IRQ":18,"ARG|ALG":19,"ALG|ARG":19,"AUT|JOR":20,"JOR|AUT":20,"GHA|PAN":21,"PAN|GHA":21,"ENG|CRO":22,"CRO|ENG":22,"POR|CGO":23,"CGO|POR":23,"UZB|COL":24,"COL|UZB":24,"CZE|RSA":25,"RSA|CZE":25,"SUI|BIH":26,"BIH|SUI":26,"CAN|QAT":27,"QAT|CAN":27,"MEX|KOR":28,"KOR|MEX":28,"BRA|HAI":29,"HAI|BRA":29,"SCO|MAR":30,"MAR|SCO":30,"TUR|PAR":31,"PAR|TUR":31,"USA|AUS":32,"AUS|USA":32,"GER|CIV":33,"CIV|GER":33,"ECU|CUR":34,"CUR|ECU":34,"NED|SWE":35,"SWE|NED":35,"TUN|JPN":36,"JPN|TUN":36,"URU|CPV":37,"CPV|URU":37,"ESP|KSA":38,"KSA|ESP":38,"BEL|IRN":39,"IRN|BEL":39,"NZL|EGY":40,"EGY|NZL":40,"NOR|SEN":41,"SEN|NOR":41,"FRA|IRQ":42,"IRQ|FRA":42,"ARG|AUT":43,"AUT|ARG":43,"JOR|ALG":44,"ALG|JOR":44,"ENG|GHA":45,"GHA|ENG":45,"PAN|CRO":46,"CRO|PAN":46,"POR|UZB":47,"UZB|POR":47,"COL|CGO":48,"CGO|COL":48,"SCO|BRA":49,"BRA|SCO":49,"MAR|HAI":50,"HAI|MAR":50,"SUI|CAN":51,"CAN|SUI":51,"BIH|QAT":52,"QAT|BIH":52,"CZE|MEX":53,"MEX|CZE":53,"RSA|KOR":54,"KOR|RSA":54,"CUR|CIV":55,"CIV|CUR":55,"ECU|GER":56,"GER|ECU":56,"JPN|SWE":57,"SWE|JPN":57,"TUN|NED":58,"NED|TUN":58,"TUR|USA":59,"USA|TUR":59,"PAR|AUS":60,"AUS|PAR":60,"NOR|FRA":61,"FRA|NOR":61,"SEN|IRQ":62,"IRQ|SEN":62,"EGY|IRN":63,"IRN|EGY":63,"NZL|BEL":64,"BEL|NZL":64,"CPV|KSA":65,"KSA|CPV":65,"URU|ESP":66,"ESP|URU":66,"PAN|ENG":67,"ENG|PAN":67,"CRO|GHA":68,"GHA|CRO":68,"ALG|AUT":69,"AUT|ALG":69,"JOR|ARG":70,"ARG|JOR":70,"COL|POR":71,"POR|COL":71,"CGO|UZB":72,"UZB|CGO":72};

// Mapa abbr por matchId (para checksums y validación)
const MID_ABBRS={1:"MEX|RSA",2:"KOR|CZE",3:"CAN|BIH",4:"USA|PAR",5:"HAI|SCO",6:"AUS|TUR",7:"BRA|MAR",8:"QAT|SUI",9:"CIV|ECU",10:"GER|CUR",11:"NED|JPN",12:"SWE|TUN",13:"KSA|URU",14:"ESP|CPV",15:"IRN|NZL",16:"BEL|EGY",17:"FRA|SEN",18:"IRQ|NOR",19:"ARG|ALG",20:"AUT|JOR",21:"GHA|PAN",22:"ENG|CRO",23:"POR|CGO",24:"UZB|COL",25:"CZE|RSA",26:"SUI|BIH",27:"CAN|QAT",28:"MEX|KOR",29:"BRA|HAI",30:"SCO|MAR",31:"TUR|PAR",32:"USA|AUS",33:"GER|CIV",34:"ECU|CUR",35:"NED|SWE",36:"TUN|JPN",37:"URU|CPV",38:"ESP|KSA",39:"BEL|IRN",40:"NZL|EGY",41:"NOR|SEN",42:"FRA|IRQ",43:"ARG|AUT",44:"JOR|ALG",45:"ENG|GHA",46:"PAN|CRO",47:"POR|UZB",48:"COL|CGO",49:"SCO|BRA",50:"MAR|HAI",51:"SUI|CAN",52:"BIH|QAT",53:"CZE|MEX",54:"RSA|KOR",55:"CUR|CIV",56:"ECU|GER",57:"JPN|SWE",58:"TUN|NED",59:"TUR|USA",60:"PAR|AUS",61:"NOR|FRA",62:"SEN|IRQ",63:"EGY|IRN",64:"NZL|BEL",65:"CPV|KSA",66:"URU|ESP",67:"PAN|ENG",68:"CRO|GHA",69:"ALG|AUT",70:"JOR|ARG",71:"COL|POR",72:"CGO|UZB"};

// Normaliza abreviaturas alternativas que usa ESPN vs nuestro mapa

// ══════════════════════════════════════════════════════════════
// DATOS MAESTROS
// ══════════════════════════════════════════════════════════════

// v6.2 — PL/PM/MD/MIDS ahora son dinámicos: se construyen desde DB
// (participantes.js, compartido con Mi Quiniela) en vez de viejas
// constantes hardcodeadas. Quedan declarados con "let" porque
// rebuildDynamicData() los reconstruye cada vez que DB cambia (carga
// inicial desde caché, y de nuevo cuando llega algo nuevo de Firestore
// — alguien se registra, edita su quiniela, etc).
//
// NOTA: rebuildDynamicData() (más abajo) usa MATCH_LABELS para los
// nombres de partido ("México vs Sudáfrica") — esa constante vive en
// partidos-grupos.js (solo el fixture público del Mundial, sin datos de
// ningún participante), que se carga ANTES que este archivo en
// index.html, así que sigue disponible acá como global.
//
// Mapeo entre el slot dinámico de Mi Quiniela ("r32_1".."final") y el pid
// numérico legacy (73-104) que ya usa todo el motor de puntaje de abajo
// (ELIM_TREE, ELIM_1_16_IDS, calcElimMatchPts...) — se mantiene el pid
// numérico en TODO el motor de puntaje para no tocarlo; solo esta
// traducción es nueva.
const KO_SLOT_IDS_V62 = [
  ...Array.from({length:16},(_,i)=>`r32_${i+1}`),
  ...Array.from({length:8}, (_,i)=>`r16_${i+1}`),
  ...Array.from({length:4}, (_,i)=>`qf_${i+1}`),
  ...Array.from({length:2}, (_,i)=>`sf_${i+1}`),
  'third','final'
];
const SLOT_TO_PID={};const PID_TO_SLOT={};
KO_SLOT_IDS_V62.forEach((slot,i)=>{ const pid=73+i; SLOT_TO_PID[slot]=pid; PID_TO_SLOT[pid]=slot; });

let PL=[];let PM={};let MD={};let MIDS=[];

// v6.5 — Punto 4: la bandera que se muestra de cada participante (Ranking,
// Estadísticas, selectores, etc.) ahora es la del PAÍS QUE PREDIJO COMO
// CAMPEÓN, no su país de residencia. getDynamicSpec() ya resuelve "champ"
// tanto para quienes se registraron por el wizard (preds.special.campeon,
// vía SPECIAL_FIELD_MAP_V62) como para participantes viejos migrados del
// sistema legacy (S.adv[name].champ) — así esto funciona igual para ambos
// sin duplicar lógica. Si todavía no eligió campeón (quiniela incompleta o
// participante sin esa predicción), se cae de vuelta a la bandera de su
// país de residencia, para no dejar el espacio vacío.
// Devuelve el EMOJI crudo (igual formato que ALL_FLAGS/FLAGS2), no HTML —
// cada sitio que lo usa lo envuelve con su propio tamaño, igual que ya
// hacían con flagD().
function flagOfChampion(name, residenceCountry){
  // v6.5 — TODO el cuerpo va dentro del try: la primerísima llamada a esta
  // función ocurre desde rebuildDynamicData() en su invocación top-level
  // (antes de que termine de cargar el resto de app.js), así que en ese
  // instante ni getDynamicSpec()/SPECIAL_FIELD_MAP_V62 (definidas más abajo
  // en scoring.js/app.js) ni ALL_FLAGS/FLAGS2 (const definidas más abajo en
  // este mismo archivo) existen todavía — acceder a ellas ahí lanza
  // ReferenceError (temporal dead zone) y aborta TODO app.js a la mitad,
  // dejando el Ranking en blanco. Por eso ningún acceso a esos globals
  // puede quedar fuera del catch.
  try{
    let champ = '';
    const spec = (typeof getDynamicSpec==='function') ? getDynamicSpec(name) : null;
    champ = spec && spec.champ ? spec.champ : '';
    if(champ && typeof ALL_FLAGS!=='undefined' && ALL_FLAGS[champ]) return ALL_FLAGS[champ];
    return (typeof FLAGS2!=='undefined' && FLAGS2[residenceCountry]) || '🌐';
  }catch(e){
    return '🌐';
  }
}

function rebuildDynamicData(){
  PL = (DB.participants||[]).map(p=>p.name).filter(Boolean);
  PM = {};
  (DB.participants||[]).forEach(p=>{
    PM[p.name] = {city:p.city, country:p.country, champFlag: flagOfChampion(p.name, p.country)};
  });
  MD = {}; MIDS = [];
  for(let mid=1; mid<=72; mid++){
    const preds = {};
    (DB.participants||[]).forEach(p=>{
      const v = (DB.predictions[p.id]||{})[mid];
      if(v) preds[p.name] = {h:v.h, a:v.a};
    });
    MD[mid] = {id:mid, lbl: MATCH_LABELS[mid]||`Partido ${mid}`, preds};
    MIDS.push(mid);
  }
}
// Construcción inicial síncrona con lo que ya haya en caché local — se
// reconstruye sola en cuanto llegue algo nuevo de Firestore (suscripción
// más abajo, junto al resto del arranque de la app).
rebuildDynamicData();

const MGMAP={1:"A",2:"A",3:"B",4:"D",5:"C",6:"D",7:"C",8:"B",9:"E",10:"E",11:"F",12:"F",13:"H",14:"H",15:"G",16:"G",17:"I",18:"I",19:"J",20:"J",21:"L",22:"L",23:"K",24:"K",25:"A",26:"B",27:"B",28:"A",29:"C",30:"C",31:"D",32:"D",33:"E",34:"E",35:"F",36:"F",37:"H",38:"H",39:"G",40:"G",41:"I",42:"I",43:"J",44:"J",45:"L",46:"L",47:"K",48:"K",49:"C",50:"C",51:"B",52:"B",53:"A",54:"A",55:"E",56:"E",57:"F",58:"F",59:"D",60:"D",61:"I",62:"I",63:"G",64:"G",65:"H",66:"H",67:"L",68:"L",69:"J",70:"J",71:"K",72:"K"};

const GES={A:["🇲🇽 México","🇿🇦 Sudáfrica","🇰🇷 Corea del Sur","🇨🇿 Chequia"],B:["🇨🇦 Canadá","🇧🇦 Bosnia-Herz.","🇶🇦 Qatar","🇨🇭 Suiza"],C:["🇧🇷 Brasil","🇲🇦 Marruecos","🇭🇹 Haití","🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia"],D:["🇺🇸 EE.UU.","🇵🇾 Paraguay","🇦🇺 Australia","🇹🇷 Turquía"],E:["🇩🇪 Alemania","🇨🇮 C.Marfil","🇪🇨 Ecuador","🇨🇼 Curazao"],F:["🇳🇱 P.Bajos","🇯🇵 Japón","🇸🇪 Suecia","🇹🇳 Túnez"],G:["🇧🇪 Bélgica","🇪🇬 Egipto","🇮🇷 Irán","🇳🇿 N.Zelanda"],H:["🇪🇸 España","🇨🇻 C.Verde","🇸🇦 A.Saudita","🇺🇾 Uruguay"],I:["🇫🇷 Francia","🇸🇳 Senegal","🇮🇶 Irak","🇳🇴 Noruega"],J:["🇦🇷 Argentina","🇩🇿 Argelia","🇦🇹 Austria","🇯🇴 Jordania"],K:["🇵🇹 Portugal","🇨🇩 R.D.Congo","🇺🇿 Uzbekistán","🇨🇴 Colombia"],L:["🇬🇧 Inglaterra","🇭🇷 Croacia","🇬🇭 Ghana","🇵🇦 Panamá"]};

// Complete flag map for all 48 nations including problematic ones
const ALL_FLAGS={
  "México":"🇲🇽","Mexico":"🇲🇽",
  "Sudáfrica":"🇿🇦","Sudafrica":"🇿🇦","South Africa":"🇿🇦",
  "Corea del Sur":"🇰🇷","Korea":"🇰🇷",
  "República Checa":"🇨🇿","Chequia":"🇨🇿","Czech":"🇨🇿",
  "Canadá":"🇨🇦","Canada":"🇨🇦",
  "Bosnia y Herzegovina":"🇧🇦","Bosnia":"🇧🇦",
  "Catar":"🇶🇦","Qatar":"🇶🇦",
  "Suiza":"🇨🇭","Switzerland":"🇨🇭",
  "Brasil":"🇧🇷","Brazil":"🇧🇷",
  "Marruecos":"🇲🇦","Morocco":"🇲🇦",
  "Haití":"🇭🇹","Haiti":"🇭🇹",
  "Escocia":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Estados Unidos":"🇺🇸","EE.UU.":"🇺🇸","USA":"🇺🇸","United States":"🇺🇸",
  "Paraguay":"🇵🇾",
  "Australia":"🇦🇺",
  "Turquía":"🇹🇷","Turkey":"🇹🇷","Turkiye":"🇹🇷",
  "Alemania":"🇩🇪","Germany":"🇩🇪",
  "Costa de Marfil":"🇨🇮","C.Marfil":"🇨🇮","Ivory Coast":"🇨🇮","Côte d'Ivoire":"🇨🇮",
  "Ecuador":"🇪🇨",
  "Curazao":"🇨🇼","Curacao":"🇨🇼",
  "Países Bajos":"🇳🇱","Paises Bajos":"🇳🇱","Netherlands":"🇳🇱","P.Bajos":"🇳🇱",
  "Japón":"🇯🇵","Japan":"🇯🇵",
  "Suecia":"🇸🇪","Sweden":"🇸🇪",
  "Túnez":"🇹🇳","Tunisia":"🇹🇳",
  "Arabia Saudita":"🇸🇦","A.Saudita":"🇸🇦","Saudi Arabia":"🇸🇦",
  "Uruguay":"🇺🇾",
  "España":"🇪🇸","Spain":"🇪🇸",
  "Cabo Verde":"🇨🇻","C.Verde":"🇨🇻","Cape Verde":"🇨🇻",
  "Irán":"🇮🇷","Iran":"🇮🇷",
  "Nueva Zelanda":"🇳🇿","New Zealand":"🇳🇿","N.Zelanda":"🇳🇿",
  "Bélgica":"🇧🇪","Belgium":"🇧🇪",
  "Egipto":"🇪🇬","Egypt":"🇪🇬",
  "Francia":"🇫🇷","France":"🇫🇷",
  "Senegal":"🇸🇳",
  "Irak":"🇮🇶","Iraq":"🇮🇶",
  "Noruega":"🇳🇴","Norway":"🇳🇴",
  "Argentina":"🇦🇷",
  "Argelia":"🇩🇿","Algeria":"🇩🇿",
  "Austria":"🇦🇹",
  "Jordania":"🇯🇴","Jordan":"🇯🇴",
  "Portugal":"🇵🇹",
  "RD Congo":"🇨🇩","R.D.Congo":"🇨🇩","DR Congo":"🇨🇩","Congo":"🇨🇩","República Del Congo":"🇨🇩",
  "Uzbekistán":"🇺🇿","Uzbekistan":"🇺🇿",
  "Colombia":"🇨🇴",
  "Inglaterra":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Croacia":"🇭🇷","Croatia":"🇭🇷",
  "Ghana":"🇬🇭",
  "Panamá":"🇵🇦","Panama":"🇵🇦",
};

const FLAGS2={"España":"🇪🇸","Paises Bajos":"🇳🇱","Países Bajos":"🇳🇱","Francia":"🇫🇷","Portugal":"🇵🇹","Inglaterra":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Argentina":"🇦🇷","Brasil":"🇧🇷","Alemania":"🇩🇪","Italia":"🇮🇹","Holanda":"🇳🇱","Colombia":"🇨🇴","Uruguay":"🇺🇾","México":"🇲🇽","Chile":"🇨🇱","Bélgica":"🇧🇪","Croacia":"🇭🇷","Marruecos":"🇲🇦","Japón":"🇯🇵","Corea del Sur":"🇰🇷","Suiza":"🇨🇭","Australia":"🇦🇺","Ecuador":"🇪🇨","Senegal":"🇸🇳","Ghana":"🇬🇭","Irán":"🇮🇷","Arabia Saudita":"🇸🇦","Turquía":"🇹🇷","Canadá":"🇨🇦","Estados Unidos":"🇺🇸","Noruega":"🇳🇴","Suecia":"🇸🇪","Dinamarca":"🇩🇰","Polonia":"🇵🇱"};
const ABBR={"España":"ES","Paises Bajos":"NL","Países Bajos":"NL","Francia":"FR","Portugal":"PT","Inglaterra":"EN","Argentina":"AR","Brasil":"BR"};
const BGCOL={"España":"#c60b1e","Paises Bajos":"#ae1c28","Países Bajos":"#ae1c28","Francia":"#002395","Portugal":"#006600","Inglaterra":"#cf111b","Argentina":"#74acdf","Brasil":"#009c3b"};

const BRULES=[{l:"Acertar ganador del partido",p:2},{l:"Acertar empate",p:3},{l:"Marcador exacto (adicional)",p:3}];
const ARULES=[
  {l:"Acertar campeón",p:15},
  {l:"Acertar subcampeón",p:10},
  {l:"Acertar 3er lugar",p:8},
  {l:"Acertar goleador del torneo",p:12},
  {l:"Goles del goleador (exactos)",p:8},
  {l:"País más goleador",p:8},
  {l:"Goles de ese país (exactos)",p:10},
  {l:"País más goleado en 1 partido",p:8},
];
const ELIMRULES=[
  {l:"Acertar llave exacta (por partido, todas las fases)",p:2},
  {l:"Acertar resultado si llave correcta (mismas reglas 1ª fase)",p:"2-5"},
  {l:"Clasificado a Octavos de Final (por equipo)",p:3},
  {l:"Clasificado a Cuartos de Final (por equipo)",p:4},
  {l:"Clasificado a Semifinales (por equipo)",p:6},
  {l:"Finalista (por equipo)",p:6},
];
const LASTRULES=[
  {l:"Último al cierre de la Fase de Grupos",p:"*8"},
  {l:"Último al cierre de Dieciseisavos de Final",p:"*6"},
  {l:"Último al cierre de Octavos de Final",p:"*6"},
  {l:"Último al cierre de Cuartos de Final",p:"*6"},
];

// ══════════════════════════════════════════════════════════════
// CAPA 2 — CHECKSUM (CRC32 simple)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// CAPA 1 — VALIDACIÓN antes de guardar
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
