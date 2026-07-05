/* ════════════════════════════════════════════════════════════
   QUINIELA BORRACHA 2026 — Módulo REGISTRO (Fase 1, v6.0)
   Wizard de inscripción + bracket dinámico + panel admin, portado
   desde el prototipo registro-quiniela_1_0.html e integrado a la
   app principal:
     - Persistencia: Firestore (doc registro/estado) + caché local,
       mismo patrón que quiniela/estado en app.js.
     - Admin: reusa Firebase Auth + isAdmin() ya existentes (antes
       el panel admin de este prototipo no tenía autenticación).
     - Todo este archivo vive en su propio scope (IIFE) para no
       chocar con ningún global de app.js; no expone nada a window
       porque no lo necesita (los botones se conectan con
       addEventListener acá adentro, no con onclick= en el HTML).
     - Clases/ids con riesgo real de choque ya fueron renombrados:
       .tab→.rg-tab (ya no se usa, ver nota v6.6.1), #content→#rg-content;
       el toast() local se eliminó para reusar el toast() global de app.js.
     - v6.6.1 — Admin dejó de ser una sub-pestaña adentro de Mi Quiniela
       (#rg-tabs) y pasó a ser su propia pestaña del menú principal
       (#t-admin / #admin-content, ver index.html y tab() en app.js).
       Mi Quiniela ahora muestra la pantalla del participante directo.
   ════════════════════════════════════════════════════════════ */
(function(){
/* ════════════════════════════════════════
   CONFIG — PARTIDOS
   GROUP_MATCHES: los 72 partidos reales de fase de grupos (id, grupo, equipos).
     -> el participante predice el marcador exacto.

   v0.2 — BRACKET DINÁMICO. Ya no hay llaves eliminatorias fijas. Los 32
   cruces de la fase eliminatoria (dieciseisavos -> final) se calculan en
   tiempo real a partir de los marcadores que el participante predijo en
   grupos: tabla de posiciones -> 24 (1°s y 2°s) + 8 mejores terceros ->
   cruce. Ver bloque "BRACKET DINÁMICO" más abajo para el detalle.
   ════════════════════════════════════════ */
const GROUP_MATCHES=[{"id":1,"g":"A","a":"México","b":"Sudáfrica"},{"id":2,"g":"A","a":"Corea del Sur","b":"República Checa"},{"id":3,"g":"B","a":"Canadá","b":"Bosnia y Herzegovina"},{"id":4,"g":"D","a":"Estados Unidos","b":"Paraguay"},{"id":5,"g":"C","a":"Haití","b":"Escocia"},{"id":6,"g":"D","a":"Australia","b":"Turquía"},{"id":7,"g":"C","a":"Brasil","b":"Marruecos"},{"id":8,"g":"B","a":"Catar","b":"Suiza"},{"id":9,"g":"E","a":"Costa de Marfil","b":"Ecuador"},{"id":10,"g":"E","a":"Alemania","b":"Curazao"},{"id":11,"g":"F","a":"Países Bajos","b":"Japón"},{"id":12,"g":"F","a":"Suecia","b":"Túnez"},{"id":13,"g":"H","a":"Arabia Saudita","b":"Uruguay"},{"id":14,"g":"H","a":"España","b":"Cabo Verde"},{"id":15,"g":"G","a":"Irán","b":"Nueva Zelanda"},{"id":16,"g":"G","a":"Bélgica","b":"Egipto"},{"id":17,"g":"I","a":"Francia","b":"Senegal"},{"id":18,"g":"I","a":"Irak","b":"Noruega"},{"id":19,"g":"J","a":"Argentina","b":"Argelia"},{"id":20,"g":"J","a":"Austria","b":"Jordania"},{"id":21,"g":"L","a":"Ghana","b":"Panamá"},{"id":22,"g":"L","a":"Inglaterra","b":"Croacia"},{"id":23,"g":"K","a":"Portugal","b":"RD Congo"},{"id":24,"g":"K","a":"Uzbekistán","b":"Colombia"},{"id":25,"g":"A","a":"República Checa","b":"Sudáfrica"},{"id":26,"g":"B","a":"Suiza","b":"Bosnia y Herzegovina"},{"id":27,"g":"B","a":"Canadá","b":"Catar"},{"id":28,"g":"A","a":"México","b":"Corea del Sur"},{"id":29,"g":"C","a":"Brasil","b":"Haití"},{"id":30,"g":"C","a":"Escocia","b":"Marruecos"},{"id":31,"g":"D","a":"Turquía","b":"Paraguay"},{"id":32,"g":"D","a":"Estados Unidos","b":"Australia"},{"id":33,"g":"E","a":"Alemania","b":"Costa de Marfil"},{"id":34,"g":"E","a":"Ecuador","b":"Curazao"},{"id":35,"g":"F","a":"Países Bajos","b":"Suecia"},{"id":36,"g":"F","a":"Túnez","b":"Japón"},{"id":37,"g":"H","a":"Uruguay","b":"Cabo Verde"},{"id":38,"g":"H","a":"España","b":"Arabia Saudita"},{"id":39,"g":"G","a":"Bélgica","b":"Irán"},{"id":40,"g":"G","a":"Nueva Zelanda","b":"Egipto"},{"id":41,"g":"I","a":"Noruega","b":"Senegal"},{"id":42,"g":"I","a":"Francia","b":"Irak"},{"id":43,"g":"J","a":"Argentina","b":"Austria"},{"id":44,"g":"J","a":"Jordania","b":"Argelia"},{"id":45,"g":"L","a":"Inglaterra","b":"Ghana"},{"id":46,"g":"L","a":"Panamá","b":"Croacia"},{"id":47,"g":"K","a":"Portugal","b":"Uzbekistán"},{"id":48,"g":"K","a":"Colombia","b":"RD Congo"},{"id":49,"g":"C","a":"Escocia","b":"Brasil"},{"id":50,"g":"C","a":"Marruecos","b":"Haití"},{"id":51,"g":"B","a":"Suiza","b":"Canadá"},{"id":52,"g":"B","a":"Bosnia y Herzegovina","b":"Catar"},{"id":53,"g":"A","a":"República Checa","b":"México"},{"id":54,"g":"A","a":"Sudáfrica","b":"Corea del Sur"},{"id":55,"g":"E","a":"Curazao","b":"Costa de Marfil"},{"id":56,"g":"E","a":"Ecuador","b":"Alemania"},{"id":57,"g":"F","a":"Japón","b":"Suecia"},{"id":58,"g":"F","a":"Túnez","b":"Países Bajos"},{"id":59,"g":"D","a":"Turquía","b":"Estados Unidos"},{"id":60,"g":"D","a":"Paraguay","b":"Australia"},{"id":61,"g":"I","a":"Noruega","b":"Francia"},{"id":62,"g":"I","a":"Senegal","b":"Irak"},{"id":63,"g":"G","a":"Egipto","b":"Irán"},{"id":64,"g":"G","a":"Nueva Zelanda","b":"Bélgica"},{"id":65,"g":"H","a":"Cabo Verde","b":"Arabia Saudita"},{"id":66,"g":"H","a":"Uruguay","b":"España"},{"id":67,"g":"L","a":"Panamá","b":"Inglaterra"},{"id":68,"g":"L","a":"Croacia","b":"Ghana"},{"id":69,"g":"J","a":"Argelia","b":"Austria"},{"id":70,"g":"J","a":"Jordania","b":"Argentina"},{"id":71,"g":"K","a":"Colombia","b":"Portugal"},{"id":72,"g":"K","a":"RD Congo","b":"Uzbekistán"}];
/* v0.4 — BANDERAS POR IMAGEN
   Antes se usaban emojis de bandera (TEAM_FLAG). Inglaterra y Escocia
   compartían el mismo emoji genérico (🏴) porque sus banderas reales usan
   secuencias Unicode "tag" con soporte muy inconsistente entre sistemas.
   Ahora se usa flagcdn.com (SVG, vectorial, con CORS abierto) por código
   ISO 3166-1 alpha-2; Inglaterra/Escocia/Gales usan los códigos especiales
   de flagcdn para las "home nations" del Reino Unido (gb-eng, gb-sct, gb-wls).
   Si una imagen falla al cargar, el onerror la sustituye por un SVG de
   respaldo inline (no depende de red), así nunca queda un hueco vacío. */
const TEAM_ISO={"Alemania":"de","Arabia Saudita":"sa","Argelia":"dz","Argentina":"ar","Australia":"au","Austria":"at","Bosnia y Herzegovina":"ba","Brasil":"br","Bélgica":"be","Cabo Verde":"cv","Canadá":"ca","Catar":"qa","Colombia":"co","Corea del Sur":"kr","Costa de Marfil":"ci","Croacia":"hr","Curazao":"cw","Ecuador":"ec","Egipto":"eg","Escocia":"gb-sct","España":"es","Estados Unidos":"us","Francia":"fr","Ghana":"gh","Haití":"ht","Inglaterra":"gb-eng","Irak":"iq","Irán":"ir","Japón":"jp","Jordania":"jo","Marruecos":"ma","México":"mx","Noruega":"no","Nueva Zelanda":"nz","Panamá":"pa","Paraguay":"py","Países Bajos":"nl","Portugal":"pt","RD Congo":"cd","República Checa":"cz","Senegal":"sn","Sudáfrica":"za","Suecia":"se","Suiza":"ch","Turquía":"tr","Túnez":"tn","Uruguay":"uy","Uzbekistán":"uz"};

// SVG de respaldo (inline, no depende de red) para cuando una bandera no
// existe en el mapeo o falla la carga desde flagcdn.com.
const FLAG_FALLBACK_SRC = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14">'+
  '<rect width="20" height="14" rx="2" ry="2" fill="#1C2030"/>'+
  '<rect x="0.5" y="0.5" width="19" height="13" rx="1.5" ry="1.5" fill="none" stroke="#2E3448"/>'+
  '<text x="10" y="10.5" font-size="8" text-anchor="middle" font-family="sans-serif" fill="#6B7384">?</text>'+
  '</svg>'
);

// flagImgByIso() es la base real de todas las banderas (equipos y, desde
// v1.0, también países de residencia): un <img> de flagcdn.com (SVG) con
// respaldo inline si no existe el código o falla la carga.
function flagImgByIso(iso, h){
  h = h || 14;
  const w = Math.round(h*1.43);
  const src = iso ? `https://flagcdn.com/${iso}.svg` : FLAG_FALLBACK_SRC;
  return `<img class="flag-img" src="${src}" width="${w}" height="${h}" alt="" loading="lazy" crossorigin="anonymous" onerror="this.onerror=null;this.src='${FLAG_FALLBACK_SRC}'">`;
}
// flagOf() se mantiene (con el mismo nombre) por compatibilidad con todo el
// código existente (equipos del Mundial).
function flagOf(name, h){
  return flagImgByIso(TEAM_ISO[name], h);
}

// v1.0 — Lista de países reconocidos internacionalmente (los ~195 Estados
// miembros de la ONU + un puñado de casos comúnmente incluidos como el
// Vaticano), con su código ISO 3166-1 alpha-2 para la bandera y para
// guardar en la base de datos. Es la fuente del selector de País del
// formulario de registro.
const COUNTRY_LIST = [
  ["Afganistán","af"],["Albania","al"],["Alemania","de"],["Andorra","ad"],["Angola","ao"],
  ["Antigua y Barbuda","ag"],["Arabia Saudita","sa"],["Argelia","dz"],["Argentina","ar"],["Armenia","am"],
  ["Australia","au"],["Austria","at"],["Azerbaiyán","az"],["Bahamas","bs"],["Baréin","bh"],
  ["Bangladés","bd"],["Barbados","bb"],["Bélgica","be"],["Belice","bz"],["Benín","bj"],
  ["Bielorrusia","by"],["Bolivia","bo"],["Bosnia y Herzegovina","ba"],["Botsuana","bw"],["Brasil","br"],
  ["Brunéi","bn"],["Bulgaria","bg"],["Burkina Faso","bf"],["Burundi","bi"],["Bután","bt"],
  ["Cabo Verde","cv"],["Camboya","kh"],["Camerún","cm"],["Canadá","ca"],["Catar","qa"],
  ["Chad","td"],["Chile","cl"],["China","cn"],["Chipre","cy"],["Ciudad del Vaticano","va"],
  ["Colombia","co"],["Comoras","km"],["Corea del Norte","kp"],["Corea del Sur","kr"],["Costa de Marfil","ci"],
  ["Costa Rica","cr"],["Croacia","hr"],["Cuba","cu"],["Dinamarca","dk"],["Dominica","dm"],
  ["Ecuador","ec"],["Egipto","eg"],["El Salvador","sv"],["Emiratos Árabes Unidos","ae"],["Eritrea","er"],
  ["Eslovaquia","sk"],["Eslovenia","si"],["España","es"],["Estados Unidos","us"],["Estonia","ee"],
  ["Esuatini","sz"],["Etiopía","et"],["Filipinas","ph"],["Finlandia","fi"],["Fiyi","fj"],
  ["Francia","fr"],["Gabón","ga"],["Gambia","gm"],["Georgia","ge"],["Ghana","gh"],
  ["Granada","gd"],["Grecia","gr"],["Guatemala","gt"],["Guyana","gy"],["Guinea","gn"],
  ["Guinea-Bisáu","gw"],["Guinea Ecuatorial","gq"],["Haití","ht"],["Honduras","hn"],["Hungría","hu"],
  ["India","in"],["Indonesia","id"],["Irak","iq"],["Irán","ir"],["Irlanda","ie"],
  ["Islandia","is"],["Islas Marshall","mh"],["Islas Salomón","sb"],["Israel","il"],["Italia","it"],
  ["Jamaica","jm"],["Japón","jp"],["Jordania","jo"],["Kazajistán","kz"],["Kenia","ke"],
  ["Kirguistán","kg"],["Kiribati","ki"],["Kosovo","xk"],["Kuwait","kw"],["Laos","la"],
  ["Lesoto","ls"],["Letonia","lv"],["Líbano","lb"],["Liberia","lr"],["Libia","ly"],
  ["Liechtenstein","li"],["Lituania","lt"],["Luxemburgo","lu"],["Macedonia del Norte","mk"],["Madagascar","mg"],
  ["Malasia","my"],["Malaui","mw"],["Maldivas","mv"],["Mali","ml"],["Malta","mt"],
  ["Marruecos","ma"],["Mauricio","mu"],["Mauritania","mr"],["México","mx"],["Micronesia","fm"],
  ["Moldavia","md"],["Mónaco","mc"],["Mongolia","mn"],["Montenegro","me"],["Mozambique","mz"],
  ["Myanmar","mm"],["Namibia","na"],["Nauru","nr"],["Nepal","np"],["Nicaragua","ni"],
  ["Níger","ne"],["Nigeria","ng"],["Noruega","no"],["Nueva Zelanda","nz"],["Omán","om"],
  ["Países Bajos","nl"],["Pakistán","pk"],["Palaos","pw"],["Palestina","ps"],["Panamá","pa"],
  ["Papúa Nueva Guinea","pg"],["Paraguay","py"],["Perú","pe"],["Polonia","pl"],["Portugal","pt"],
  ["Reino Unido","gb"],["RD Congo","cd"],["República Centroafricana","cf"],["República Checa","cz"],["República del Congo","cg"],
  ["República Dominicana","do"],["Ruanda","rw"],["Rumania","ro"],["Rusia","ru"],["Samoa","ws"],
  ["San Cristóbal y Nieves","kn"],["San Marino","sm"],["San Vicente y las Granadinas","vc"],["Santa Lucía","lc"],["Santo Tomé y Príncipe","st"],
  ["Senegal","sn"],["Serbia","rs"],["Seychelles","sc"],["Sierra Leona","sl"],["Singapur","sg"],
  ["Siria","sy"],["Somalia","so"],["Sri Lanka","lk"],["Sudáfrica","za"],["Sudán","sd"],
  ["Sudán del Sur","ss"],["Suecia","se"],["Suiza","ch"],["Surinam","sr"],["Tailandia","th"],
  ["Tanzania","tz"],["Tayikistán","tj"],["Timor Oriental","tl"],["Togo","tg"],["Tonga","to"],
  ["Trinidad y Tobago","tt"],["Túnez","tn"],["Turkmenistán","tm"],["Turquía","tr"],["Tuvalu","tv"],
  ["Ucrania","ua"],["Uganda","ug"],["Uruguay","uy"],["Uzbekistán","uz"],["Vanuatu","vu"],
  ["Venezuela","ve"],["Vietnam","vn"],["Yemen","ye"],["Yibuti","dj"],["Zambia","zm"],["Zimbabue","zw"]
].map(([name,iso])=>({name,iso})).sort((a,b)=>a.name.localeCompare(b.name,'es'));

// Ciudades sugeridas para un país: no existe (ni puede embeberse offline)
// una base de datos mundial de ciudades, así que las sugerencias crecen
// solas a partir de lo que otros participantes de ese mismo país ya
// escribieron — sigue permitiendo texto libre para cualquier ciudad nueva.
function getCityOptionsForCountry(iso){
  const set = new Set();
  DB.participants.forEach(p=>{ if(p.countryIso===iso && p.city) set.add(p.city.trim()); });
  return [...set].sort((a,b)=>a.localeCompare(b,'es'));
}

const GROUP_LETTERS = [...new Set(GROUP_MATCHES.map(m=>m.g))].sort();
const ALL_TEAMS = Object.keys(TEAM_ISO).sort((a,b)=>a.localeCompare(b,'es'));

// IDs fijos de las 32 llaves eliminatorias (16+8+4+2+1+1). El equipo que
// ocupa cada llave SÍ cambia según los resultados de grupo, pero el ID
// del slot no — así la predicción se guarda por posición del bracket.
const KO_PHASES = [
  {key:'r32',   label:'Dieciseisavos de Final', n:16},
  {key:'r16',   label:'Octavos de Final',       n:8},
  {key:'qf',    label:'Cuartos de Final',       n:4},
  {key:'sf',    label:'Semifinales',            n:2},
  {key:'third', label:'Tercer lugar',           n:1},
  {key:'final', label:'Final',                  n:1},
];
const KO_SLOT_IDS = [
  ...Array.from({length:16},(_,i)=>`r32_${i+1}`),
  ...Array.from({length:8}, (_,i)=>`r16_${i+1}`),
  ...Array.from({length:4}, (_,i)=>`qf_${i+1}`),
  ...Array.from({length:2}, (_,i)=>`sf_${i+1}`),
  'third','final'
];

/* ════════════════════════════════════════
   v1.2 — CONSTRUCTOR DE TORNEOS (fase 1)
   Soporte para que el torneo arranque desde cualquier fase. Las claves de
   fase de ESTE archivo (KO_PHASES: r32/r16/qf/sf/third/final) son
   distintas a las de BONUS_PHASES (scoring.js: r16/r8/qf/sf/third/final
   — ahí "r16" es Dieciseisavos, acá "r32" lo es) por motivos históricos
   de cada módulo; KO_TO_BONUS_KEY es la única traducción entre ambas, así
   BONUS_PHASES sigue siendo la ÚNICA fuente de verdad de qué fases existen
   (isFaseActiva, en scoring.js) — este archivo nunca duplica ese registro,
   solo lo consulta traduciendo la clave.
   ════════════════════════════════════════ */
const KO_TO_BONUS_KEY = {r32:'r16', r16:'r8', qf:'qf', sf:'sf', third:'third', final:'final'};
function isKoPhaseActive(koKey){
  return (typeof isFaseActiva==='function') ? isFaseActiva(KO_TO_BONUS_KEY[koKey]) : true;
}
function isGruposActivaWizard(){
  return (typeof isFaseActiva==='function') ? isFaseActiva('grupos') : true;
}
// Primera fase de KO_PHASES que está activa en este torneo (o null si
// ninguna fase de eliminatoria está activa).
function firstActiveKoKey(){
  for(const ph of KO_PHASES){ if(isKoPhaseActive(ph.key)) return ph.key; }
  return null;
}
// Equipos REALES (los que carga el admin en Fixture → Eliminatoria, a
// mano o por ESPN Live) para un slot del bracket dinámico — vía el mismo
// puente SLOT_TO_PID que ya usa todo el motor de puntaje (app-core-data.js),
// para no mantener una segunda traducción slot↔pid.
function realTeamsForSlot(slot){
  const pid = (typeof SLOT_TO_PID!=='undefined') ? SLOT_TO_PID[slot] : null;
  if(!pid || typeof getRealElimTeams!=='function') return null;
  const t = getRealElimTeams(pid);
  return t ? {a:t.h, b:t.a} : null;
}
// Ganador REAL de un cruce — se usa para una fase que está ANTES de la
// primera fase activa (el participante nunca la vio en el wizard, así que
// no hay nada que preguntarle): en vez de inventar una predicción, se
// encadena directo con lo que de verdad pasó, para que las rondas
// siguientes (que sí son activas) puedan seguir calculándose con
// normalidad.
function realWinnerForSlot(slot){
  const pid = (typeof SLOT_TO_PID!=='undefined') ? SLOT_TO_PID[slot] : null;
  if(!pid || typeof getRealWinner!=='function') return null;
  return getRealWinner(pid) || null;
}
// Resuelve un cruce de KO_PHASES (salvo r32, que tiene su propio caso
// especial cuando Grupos está activa — ver computeBracket) según dónde
// está esta fase respecto a la primera fase ACTIVA del torneo (firstKo):
//   · ANTES de firstKo  → la fase nunca se mostró en el wizard: se usa el
//     resultado REAL directo (equipos y ganador), sin pedir nada.
//   · ES firstKo        → los equipos son los REALES del torneo, pero
//     quién gana lo sigue prediciendo el participante (igual que siempre).
//   · DESPUÉS de firstKo → comportamiento de SIEMPRE: se encadena desde
//     fallbackA/fallbackB (ganadores de la ronda anterior), con el mismo
//     escape _migrated de siempre para predicciones del sistema viejo.
function resolveKoMatch(koKey, slot, preds, firstKo, fallbackA, fallbackB){
  const pred = preds[slot];
  const order = KO_PHASES.map(p=>p.key);
  const idxThis = order.indexOf(koKey);
  const idxFirst = firstKo ? order.indexOf(firstKo) : -1;
  if(idxFirst===-1 || idxThis < idxFirst){
    return { a:null, b:null, winner: realWinnerForSlot(slot) };
  }
  if(idxThis === idxFirst){
    const real = realTeamsForSlot(slot);
    if(!real) return { a:null, b:null, winner:null }; // admin todavía no cargó los equipos reales
    return { a:real.a, b:real.b, winner: koWinner(pred, real.a, real.b, true) };
  }
  if(pred && pred._migrated) return { a:pred._a, b:pred._b, winner:koWinner(pred, pred._a, pred._b) };
  const a=fallbackA, b=fallbackB;
  return { a, b, winner:(a&&b)?koWinner(pred,a,b):null };
}

// Pasos del wizard que existen en este torneo: "personal" no se cuenta acá
// (se excluye aparte, ver buildStepperHtml — no es parte del flujo normal
// de predicciones), y "groups"/las fases de KO_PHASES se excluyen si están
// desactivadas. "special"/"review" siempre existen.
function isStepActive(key){
  if(key==='groups') return isGruposActivaWizard();
  if(KO_TO_BONUS_KEY[key]) return isKoPhaseActive(key);
  return true;
}
// Índices REALES (dentro de WIZARD_STEPS, que nunca cambia de forma para
// no romper el lastStep guardado de quinielas viejas) de los pasos que el
// participante realmente ve, en orden. Única fuente para el breadcrumb,
// el cálculo de primer/último paso visible, y la navegación Anterior/
// Siguiente — así "saltarse" un paso desactivado se decide en un solo
// lugar.
function visibleStepIndices(){
  const out=[];
  WIZARD_STEPS.forEach((s,i)=>{ if(s.key!=='personal' && isStepActive(s.key)) out.push(i); });
  return out;
}
// Próximo índice real visible a partir de fromIdx, en la dirección dir
// (-1 ó +1). Si fromIdx no es visible (ej. viene de "personal"), cae al
// primer/último visible según la dirección. Si ya está en el extremo, se
// queda donde está.
function adjacentVisibleStepIdx(fromIdx, dir){
  const vis = visibleStepIndices();
  if(!vis.length) return fromIdx;
  const pos = vis.indexOf(fromIdx);
  if(pos===-1) return dir<0 ? vis[0] : vis[vis.length-1];
  const next = pos+dir;
  if(next<0 || next>=vis.length) return fromIdx;
  return vis[next];
}
// v1.2 — Si un participante quedó con lastStep guardado apuntando a un
// paso que, para CUANDO vuelve a entrar, ya está desactivado (el admin
// cambió "Fases activas" entre medio), lo manda al paso visible más
// cercano en vez de mostrarle un paso que "ya no existe".
function nearestVisibleStepIdx(idx){
  const s = WIZARD_STEPS[idx];
  if(!s) return idx;
  if(s.key==='personal' || isStepActive(s.key)) return idx;
  const vis = visibleStepIndices();
  if(!vis.length) return idx;
  const next = vis.find(i=>i>=idx);
  return next!==undefined ? next : vis[vis.length-1];
}

// Las 8 preguntas especiales, tal como existen en el proyecto principal
// (sección "Avanzado"). No se agregan ni se quitan preguntas.
const SPECIAL_QUESTIONS = [
  {id:'campeon',         label:'Campeón del Mundial',                  type:'team'},
  {id:'subcampeon',      label:'Subcampeón',                           type:'team'},
  {id:'tercer',          label:'Tercer lugar',                         type:'team'},
  {id:'goleador',        label:'Goleador del torneo',                  type:'text', placeholder:'Nombre del jugador'},
  {id:'goles_goleador',  label:'Goles del goleador (exactos)',         type:'number'},
  {id:'pais_goleador',   label:'País más goleador',                    type:'team'},
  {id:'goles_pais',      label:'Goles de ese país (exactos)',          type:'number'},
  {id:'pais_goleado',    label:'País más goleado en un partido',       type:'team'},
];

// v0.7 (Fase 4) — Campeón, Subcampeón y Tercer lugar ya NO son preguntas
// manuales: se "queman" siempre con el resultado del bracket (Final y
// partido por el Tercer lugar) y se recalculan solos si el usuario cambia
// una llave. computeAutoSpecial() es la única fuente de verdad para estos
// 3 campos en TODAS las vistas (paso de Preguntas especiales, Revisión,
// y el PDF) — la UI nunca los lee desde preds.special, para evitar que
// quede un valor manual "viejo" guardado de antes de este cambio.
//
// v6.4 — Aclaración importante: lo de arriba sigue siendo cierto para la
// UI, pero scoring.js (calcAdv, vía SPECIAL_FIELD_MAP_V62) SÍ lee estos 3
// campos desde preds.special — es el único lugar donde calcAdv() encuentra
// campeón/subcampeón/3er lugar para otorgar sus 15+10+8 pts. Por eso ahora
// el botón "Enviar predicciones" (ver renderQuinielaForm, paso 'review')
// los persiste ahí justo antes de marcar la quiniela como enviada. Quien
// ya había enviado su quiniela ANTES de este fix quedó con preds.special
// vacío en esos 3 campos — backfillAutoSpecialForAll() (botón en el panel
// Admin) corrige eso retroactivamente, sin tocar nada más de su quiniela.
const AUTO_SPECIAL_IDS = ['campeon', 'subcampeon', 'tercer'];

// v2.8.2 — Antes, apagar una "Regla avanzada" (Configuración del torneo →
// Reglas → 🎯 Preguntas avanzadas) solo dejaba de sumarle puntos
// (isPreguntaAvanzadaActiva, scoring.js) pero el wizard la seguía
// mostrando y pidiendo igual, lo cual confundía a los participantes
// (ej. "Goleador del torneo" apagado, pero el formulario lo sigue
// exigiendo). Ahora el wizard, el contador de completitud y el PDF usan
// esta lista filtrada en vez de SPECIAL_QUESTIONS directo, así que una
// pregunta apagada desaparece de todos lados a la vez.
function activeSpecialQuestions(){
  if(typeof isPreguntaAvanzadaActiva!=="function") return SPECIAL_QUESTIONS; // scoring.js no cargado (algunos tests de registro.js aislado)
  return SPECIAL_QUESTIONS.filter(q=>isPreguntaAvanzadaActiva(q.id));
}
function computeAutoSpecial(bracket){
  const out = { campeon:'', subcampeon:'', tercer:'' };
  if(!bracket || !bracket.ready) return out;
  if(bracket.final && bracket.final.winner){
    out.campeon = bracket.final.winner;
    out.subcampeon = (bracket.final.winner===bracket.final.a) ? bracket.final.b : bracket.final.a;
  }
  if(bracket.third && bracket.third.winner){
    out.tercer = bracket.third.winner;
  }
  return out;
}

// v6.4 — Backfill retroactivo del bug de campeón/subcampeón/3er lugar no
// persistidos. Recorre a TODOS los participantes (no solo los "enviada",
// por si alguien tiene su bracket completo en borrador) y, para cada uno
// cuyo bracket ya esté listo (bracket.ready), escribe en preds.special los
// 3 campos auto-calculados — sin pisar ningún otro dato de su quiniela.
// Es seguro correrlo más de una vez: si el campo ya está correcto, se
// vuelve a escribir el mismo valor (no-op real). Descarga un backup
// automático antes de escribir, mismo patrón que runMigracionLegacy().
function backfillAutoSpecialForAll(){
  if(!isAdmin()){toast("🔒 Solo el admin puede ejecutar el backfill.",true);return;}
  const candidatos=[];
  (DB.participants||[]).forEach(p=>{
    const preds=DB.predictions[p.id];
    if(!preds) return;
    const bracket=computeBracket(preds);
    if(!bracket.ready) return; // sin bracket completo no hay nada que "quemar" todavía
    const autoSp=computeAutoSpecial(bracket);
    if(!autoSp.campeon && !autoSp.subcampeon && !autoSp.tercer) return; // bracket.ready pero sin ganador resuelto (no debería pasar, por si acaso)
    const sp=preds.special||{};
    const yaCorrecto = sp.campeon===autoSp.campeon && sp.subcampeon===autoSp.subcampeon && sp.tercer===autoSp.tercer;
    candidatos.push({p,preds,autoSp,yaCorrecto});
  });

  const aCorregir=candidatos.filter(c=>!c.yaCorrecto);
  if(!candidatos.length){
    toast("Nadie tiene su bracket completo todavía — nada que corregir.");
    return;
  }
  if(!aCorregir.length){
    toast(`✓ Los ${candidatos.length} participante(s) con bracket completo ya tienen campeón/subcampeón/3er lugar correctos.`);
    return;
  }
  if(!confirm(`Esto va a corregir campeón/subcampeón/3er lugar de ${aCorregir.length} participante(s) (de ${candidatos.length} con bracket completo). No toca ningún otro dato de su quiniela. Antes de escribir nada se descarga un backup. ¿Continuar?`)) return;

  // Backup descargable ANTES de tocar nada — mismo patrón que la migración legacy.
  const backup={
    tipo:"backup_pre_backfill_special_v64",
    fecha:new Date().toISOString(),
    dbAntesDelBackfill:JSON.parse(JSON.stringify(DB))
  };
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`backup_pre_backfill_special_${Date.now()}.json`;
  document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(url);

  aCorregir.forEach(({p,preds,autoSp})=>{
    preds.special = {...(preds.special||{}), ...autoSp};
    p.fechaActualizacion = Date.now();
  });

  saveData(DB);
  if(typeof rebuildDynamicData==="function")rebuildDynamicData();
  if(typeof renderRank==="function")renderRank();
  if(typeof renderBonosPanel==="function")renderBonosPanel();
  if(typeof renderStatCards==="function")renderStatCards();
  toast(`✓ ${aCorregir.length} participante(s) corregido(s). Se descargó un backup por si hay que volver atrás.`);
  if(typeof renderAdminTab==="function") renderAdminTab();
}

/* ════════════════════════════════════════
   WIZARD — alpha 0.3
   10 pasos navegables. El paso "Enviar predicciones" del pedido original
   se resolvió como el botón de confirmación dentro del paso 10 (Revisión
   final), no como un paso independiente — así se acordó.
   ════════════════════════════════════════ */
const WIZARD_STEPS = [
  {key:'personal', label:'Datos personales',      icon:'👤'},
  {key:'groups',   label:'Fase de grupos',        icon:'⚽'},
  {key:'r32',      label:'Dieciseisavos',         icon:'🔥'},
  {key:'r16',      label:'Octavos',               icon:'🏆'},
  {key:'qf',       label:'Cuartos',                icon:'⭐'},
  {key:'sf',       label:'Semifinales',           icon:'🥇'},
  {key:'third',    label:'Tercer lugar',          icon:'🥉'},
  {key:'final',    label:'Final',                  icon:'🏆'},
  {key:'special',  label:'Preguntas especiales',  icon:'✨'},
  {key:'review',   label:'Revisión final',        icon:'📋'},
];

// Bloqueo: una quiniela enviada queda en solo lectura. La reapertura por
// admin (estado vuelve a "borrador") la libera de nuevo. v1.0 suma una
// segunda condición: el cierre automático global por fecha/hora — afecta
// a TODOS los participantes por igual (no hace falta que cada uno haya
// "enviado" su quiniela), pero el admin siempre puede seguir editando
// (ver ADMIN_OVERRIDE en renderQuinielaForm, que ya ignora isLocked()).
// v3.2.1 — BUG URGENTE REPORTADO: a varios participantes les aparecía
// "No se pudo guardar (permiso denegado)" con el formulario TODAVÍA
// visible como editable (sin ningún aviso de "cerrado") -- porque este
// cálculo interpretaba fechaCierre+horaCierre como hora LOCAL del
// navegador de quien mira la pantalla (new Date("...T...") sin sufijo
// de zona horaria se parsea así), mientras que firestore.rules
// (_isPastDeadlineInner(), donde vive la única prohibición real del
// servidor) SIEMPRE lo interpretó como UTC (le agrega ":00Z" a
// propósito, para tener UN solo instante real sin importar desde dónde
// se mire -- ver la nota completa en firestore.rules). Para cualquiera
// en una zona horaria detrás de UTC (todo Latinoamérica), el servidor
// cerraba HORAS antes de que el cliente mostrara el cierre -- el
// participante veía el formulario abierto y guardable, pero cada
// autoguardado se rechazaba en silencio (bien silencioso: el único
// aviso era ese toast rojo, sin explicar por qué). Ahora el cliente
// interpreta EXACTAMENTE lo mismo que el servidor (":00Z"), eliminando
// la ventana de "parece abierto pero ya está cerrado".
function getCierreTimestamp(){
  const fc = DB.configGlobal.fechaCierre;
  if(!fc) return null;
  const t = new Date(`${fc}T${DB.configGlobal.horaCierre || '23:59'}:00Z`).getTime();
  return isNaN(t) ? null : t;
}
function isGloballyClosed(){
  const t = getCierreTimestamp();
  return t!==null && Date.now() >= t;
}
function isLocked(p){
  return p.estadoQuiniela === 'enviada' || isGloballyClosed();
}

// v1.6 — Formatea una duración en ms como "2d 5h 32min 10s" (unidades
// vacías se omiten de izquierda a derecha: si faltan menos de 1h ya no
// muestra "0d 0h", pero SIEMPRE muestra segundos, para que el reloj se
// vea "vivo" tickeando incluso en el último minuto). Nunca baja de "0s".
function formatCountdown(ms){
  let s = Math.max(0, Math.floor(ms/1000));
  const d = Math.floor(s/86400); s -= d*86400;
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  const parts = [];
  if(d>0) parts.push(`${d}d`);
  if(d>0||h>0) parts.push(`${h}h`);
  if(d>0||h>0||m>0) parts.push(`${m}min`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/* ════════════════════════════════════════
   BRACKET DINÁMICO — alpha 0.2
   El participante NUNCA escribe equipos a mano en la fase eliminatoria.
   A partir de los marcadores de grupo se calcula:
     1) Tabla de cada uno de los 12 grupos (puntos, DG, GF, enfrentamiento
        directo si el empate es entre exactamente 2 equipos; si no se puede
        resolver, queda el orden alfabético — es una simplificación
        consciente, no replica criterios FIFA como fair play).
     2) 24 clasificados directos (1°s y 2°s) + 8 mejores terceros = 32.
     3) Cruce de Dieciseisavos: simplificado y determinista (semilla 1
        contra semilla 32, semilla 2 contra semilla 31, etc.) — NO es el
        draw oficial de FIFA (ese depende de una tabla de contingencia
        completa según qué terceros clasifican, que no está disponible
        aquí). Acordado como aproximación válida para este prototipo.
     4) Octavos, Cuartos, Semis, Tercer lugar y Final se construyen
        encadenando los ganadores de la ronda anterior.
   Cada predicción eliminatoria guarda los nombres de los dos equipos con
   los que se hizo (_a/_b). Si después el usuario cambia un resultado de
   grupo y los equipos de ese cruce cambian, la predicción vieja se
   ignora automáticamente (no se "pega" a equipos que ya no aplican).
   ════════════════════════════════════════ */

function groupMatchResult(mid, preds){
  const v = preds[mid];
  if(!v || !Number.isInteger(v.h) || !Number.isInteger(v.a) || v.h<0 || v.a<0) return null;
  return v;
}
function allGroupsComplete(preds){
  return GROUP_MATCHES.every(m=>groupMatchResult(m.id, preds));
}

function rankGroup(g, preds){
  const matches = GROUP_MATCHES.filter(m=>m.g===g);
  const teamSet = new Set();
  matches.forEach(m=>{ teamSet.add(m.a); teamSet.add(m.b); });
  const teams = [...teamSet].sort((a,b)=>a.localeCompare(b,'es')); // base alfabética determinista
  const table = {};
  teams.forEach(t=> table[t] = {team:t, pts:0, gf:0, ga:0, gd:0, pj:0});
  matches.forEach(m=>{
    const r = groupMatchResult(m.id, preds);
    if(!r) return;
    const A = table[m.a], B = table[m.b];
    A.pj++; B.pj++;
    A.gf += r.h; A.ga += r.a;
    B.gf += r.a; B.ga += r.h;
    if(r.h > r.a) A.pts += 3;
    else if(r.a > r.h) B.pts += 3;
    else { A.pts += 1; B.pts += 1; }
  });
  teams.forEach(t=> table[t].gd = table[t].gf - table[t].ga);
  const arr = teams.map(t=>table[t]);
  arr.sort((x,y)=>{
    if(y.pts !== x.pts) return y.pts - x.pts;
    if(y.gd  !== x.gd)  return y.gd  - x.gd;
    if(y.gf  !== x.gf)  return y.gf  - x.gf;
    return 0; // empate total -> se resuelve abajo (head-to-head) o queda alfabético
  });
  // Desempate por enfrentamiento directo, solo cuando son EXACTAMENTE 2 equipos
  // empatados en puntos/DG/GF de forma consecutiva.
  let i = 0;
  while(i < arr.length){
    let j = i;
    while(j+1 < arr.length && arr[j+1].pts===arr[i].pts && arr[j+1].gd===arr[i].gd && arr[j+1].gf===arr[i].gf) j++;
    if(j === i+1){
      const A = arr[i], B = arr[j];
      const dm = matches.find(m=> (m.a===A.team && m.b===B.team) || (m.a===B.team && m.b===A.team));
      const r = dm ? groupMatchResult(dm.id, preds) : null;
      if(r){
        const aIsHome = dm.a === A.team;
        const golesA = aIsHome ? r.h : r.a;
        const golesB = aIsHome ? r.a : r.h;
        if(golesB > golesA){ arr[i]=B; arr[j]=A; }
      }
    }
    i = j+1;
  }
  return arr; // [1°, 2°, 3°, 4°]
}

function rankThirds(thirdsArr){
  const arr = thirdsArr.slice().sort((a,b)=>a.team.localeCompare(b.team,'es'));
  arr.sort((x,y)=>{
    if(y.pts !== x.pts) return y.pts - x.pts;
    if(y.gd  !== x.gd)  return y.gd  - x.gd;
    if(y.gf  !== x.gf)  return y.gf  - x.gf;
    return 0;
  });
  return arr;
}

function computeQualifiers(preds){
  const standings = {};
  GROUP_LETTERS.forEach(g=> standings[g] = rankGroup(g, preds));
  const winners    = GROUP_LETTERS.map(g=>standings[g][0]);
  const runnersUp   = GROUP_LETTERS.map(g=>standings[g][1]);
  const thirds      = GROUP_LETTERS.map(g=>standings[g][2]);
  const rankedThirds = rankThirds(thirds);
  const qualThirds  = rankedThirds.slice(0,8);
  const seeded      = [...winners, ...runnersUp, ...qualThirds].map(r=>r.team);
  return { standings, winners, runnersUp, thirds, rankedThirds, qualThirds, seeded };
}

// v2.8.2 — 'trustSlot' (solo lo usa resolveKoMatch para el cruce que
// arranca de equipos REALES, ver más abajo): ese slot corresponde SIEMPRE
// al mismo partido real (mismo pid), así que un cambio de teamA/teamB ahí
// no es "otro partido" -- es la MISMA pregunta resolviéndose (el admin
// cargó un equipo provisorio, o ESPN todavía no confirmó ambos lados) o
// simplemente refinándose. Antes esto invalidaba la predicción ya
// guardada (marcador puesto ANTES de conocerse el rival/ganador real de
// una fase anterior) apenas cambiaba el nombre del equipo -- justo el
// caso que el admin quiere habilitar: dejar cargar el marcador de un
// cruce de eliminatoria sin esperar a que terminen todas las rondas
// previas. Para cualquier otro cruce (encadenado desde la PROPIA
// predicción del participante en la ronda anterior) la huella _a/_b
// sigue siendo obligatoria: ahí sí puede tratarse de un partido distinto
// de verdad (la persona volvió atrás y cambió a quién hizo avanzar).
function koWinner(pred, teamA, teamB, trustSlot){
  if(!pred) return null;
  if(!trustSlot && (pred._a!==teamA || pred._b!==teamB)) return null; // sin datos o "huella" obsoleta
  if(!Number.isInteger(pred.h) || !Number.isInteger(pred.a) || pred.h<0 || pred.a<0) return null;
  if(pred.h > pred.a) return teamA;
  if(pred.a > pred.h) return teamB;
  if(pred.pick===teamA || pred.pick===teamB) return pred.pick;
  return null; // empate sin definir quién avanza todavía
}
function koLoser(pred, teamA, teamB, trustSlot){
  const w = koWinner(pred, teamA, teamB, trustSlot);
  if(!w) return null;
  return w===teamA ? teamB : teamA;
}

// v3.1.4 — BUG REPORTADO: para una predicción MIGRADA (_migrated:true,
// ver v6.2 más abajo), cada ronda confía en SU PROPIA huella _a/_b y
// nunca mira el resultado de la ronda anterior -- a propósito, para no
// mezclar equipos que en el bracket original de esa persona nunca se
// enfrentaron (ver la nota grande de v6.2, computeBracket). Pero eso
// también significa que si el ADMIN corrige el resultado de una ronda
// migrada (ej. cambia quién ganó una Semifinal), la ronda siguiente
// (Final/Tercer lugar), si TAMBIÉN es migrada, sigue mostrando el
// mismo equipo de siempre -- la corrección del admin no tenía ningún
// efecto río abajo.
//
// _downstreamMigratedSlots(slot) devuelve qué slot(s) consumen el
// resultado de "slot" en la ronda siguiente -- misma estructura fija
// que ya arma computeBracket() (r32 de a pares → r16, r16 de a pares →
// qf, qf de a pares → sf, sf → third [con los PERDEDORES] + final [con
// los GANADORES]).
function _downstreamMigratedSlots(slot){
  let m;
  if((m=slot.match(/^r32_(\d+)$/))) return [{slot:`r16_${Math.ceil(+m[1]/2)}`, usesLoser:false}];
  if((m=slot.match(/^r16_(\d+)$/))) return [{slot:`qf_${Math.ceil(+m[1]/2)}`, usesLoser:false}];
  if((m=slot.match(/^qf_(\d+)$/)))  return [{slot:`sf_${Math.ceil(+m[1]/2)}`, usesLoser:false}];
  if((m=slot.match(/^sf_(\d+)$/)))  return [{slot:'final', usesLoser:false}, {slot:'third', usesLoser:true}];
  return [];
}

// Reemplaza, en la ronda siguiente (si también es migrada), al equipo
// VIEJO (ganador/perdedor de "slot" ANTES del cambio que se le acaba de
// aplicar, capturado en "oldRec" por el llamador ANTES de mutar "slot")
// por el equipo NUEVO -- solo si ese equipo viejo sigue siendo uno de
// los 2 lados de la ronda siguiente. No toca marcador ni pick de la
// ronda siguiente, solo el nombre del equipo (mismo criterio que ya usa
// v2.8.2 para "conservar el marcador aunque el equipo real cambie" --
// acá el equipo cambia porque el admin corrigió QUIÉN avanzó, no porque
// ESPN lo actualizó).
function propagateMigratedKoChange(preds, slot, oldRec){
  const rec = preds[slot];
  if(!rec || !rec._migrated) return;
  const oldWinner = oldRec ? koWinner(oldRec, oldRec._a, oldRec._b, true) : null;
  const oldLoser  = oldRec ? koLoser(oldRec, oldRec._a, oldRec._b, true) : null;
  const newWinner = koWinner(rec, rec._a, rec._b, true);
  const newLoser  = koLoser(rec, rec._a, rec._b, true);
  _downstreamMigratedSlots(slot).forEach(({slot:dSlot, usesLoser})=>{
    const dRec = preds[dSlot];
    if(!dRec || !dRec._migrated) return;
    const oldTeam = usesLoser ? oldLoser : oldWinner;
    const newTeam = usesLoser ? newLoser : newWinner;
    if(!oldTeam || !newTeam || oldTeam===newTeam) return;
    if(dRec._a===oldTeam) dRec._a = newTeam;
    else if(dRec._b===oldTeam) dRec._b = newTeam;
  });
}

function computeBracket(preds){
  // v1.2 — Constructor de Torneos (fase 1). Antes esta función SIEMPRE
  // exigía la fase de grupos completa y sembraba Dieciseisavos desde los
  // marcadores que el propio participante predijo (computeQualifiers).
  // Ahora:
  //   · Si Grupos está activa (caso de SIEMPRE hasta ahora) → exactamente
  //     el mismo comportamiento de siempre, sin ningún cambio.
  //   · Si Grupos está desactivada → no hay marcadores propios de los que
  //     sembrar nada, así que la primera fase de eliminatoria ACTIVA
  //     arranca directo de los equipos REALES del torneo (resolveKoMatch
  //     ya sabe hacer esto — ver más abajo).
  const firstKo = firstActiveKoKey();
  const order = KO_PHASES.map(p=>p.key);
  const idxFirst = firstKo ? order.indexOf(firstKo) : -1;
  const gruposOn = isGruposActivaWizard();
  // r32 sigue sembrándose desde los grupos predichos SOLO si Grupos está
  // activa y, además, Dieciseisavos es la primera fase de eliminatoria
  // activa (el caso normal de siempre). Cualquier otra combinación pasa
  // por resolveKoMatch, que decide sola equipos reales vs. encadenado.
  const r32SembradoDeGrupos = gruposOn && idxFirst<=0;

  let q=null, seeded=null;
  if(r32SembradoDeGrupos){
    if(!allGroupsComplete(preds)) return { ready:false };
    q = computeQualifiers(preds);
    seeded = q.seeded; // 32 nombres en orden de semilla (1°s, 2°s, mejores 3°s)
  }

  const r32 = [];
  for(let i=0;i<16;i++){
    const slot = `r32_${i+1}`;
    const pred = preds[slot];
    if(r32SembradoDeGrupos){
      // v6.2 — Datos migrados del sistema anterior: esas llaves se llenaron
      // a mano, libremente, no con la fórmula oficial de cruces — por eso
      // casi nunca coinciden con el sembrado que calcularíamos hoy desde sus
      // propios grupos. Para esos casos confiamos en el cruce que la persona
      // realmente predijo (marcado con _migrated), en vez de exigir que
      // coincida con el sembrado "oficial". Para cualquier predicción hecha
      // por el wizard normal, _migrated no existe y el comportamiento es
      // exactamente el de siempre (cruce = sembrado oficial).
      const a = (pred && pred._migrated) ? pred._a : seeded[i];
      const b = (pred && pred._migrated) ? pred._b : seeded[31-i];
      r32.push({ slot, a, b, winner: koWinner(pred, a, b) });
    }else{
      const r = resolveKoMatch('r32', slot, preds, firstKo, null, null);
      r32.push({ slot, a:r.a, b:r.b, winner:r.winner });
    }
  }
  // v6.2 — Para una predicción migrada, cada ronda confía en SU PROPIO
  // cruce guardado (_a/_b), no en el encadenado ganador-anterior → ronda
  // siguiente. Motivo: el sistema viejo emparejaba las llaves con su
  // propio árbol (quién juega contra quién en Octavos, Cuartos, etc. no
  // necesariamente "ganador del partido 1 vs ganador del partido 2" en
  // orden, como sí asume el wizard nuevo) — encadenar created round
  // siguiendo el orden del wizard nuevo mezclaba equipos que en la
  // predicción original de esa persona nunca se enfrentaban entre sí.
  // Confiando en cada ronda por separado, la llave completa de cada
  // migrado queda igual de fiel a lo que esa persona predijo en su
  // momento, sin inventar ni mezclar cruces. (resolveKoMatch reproduce
  // esto mismo para fases posteriores a la primera activa.)
  const r16 = [];
  for(let i=0;i<8;i++){
    const slot = `r16_${i+1}`;
    const m1=r32[2*i], m2=r32[2*i+1];
    const r = resolveKoMatch('r16', slot, preds, firstKo, m1.winner, m2.winner);
    r16.push({ slot, a:r.a, b:r.b, from:[m1.slot,m2.slot], winner:r.winner });
  }
  const qf = [];
  for(let i=0;i<4;i++){
    const slot = `qf_${i+1}`;
    const m1=r16[2*i], m2=r16[2*i+1];
    const r = resolveKoMatch('qf', slot, preds, firstKo, m1.winner, m2.winner);
    qf.push({ slot, a:r.a, b:r.b, from:[m1.slot,m2.slot], winner:r.winner });
  }
  const sf = [];
  for(let i=0;i<2;i++){
    const slot = `sf_${i+1}`;
    const m1=qf[2*i], m2=qf[2*i+1];
    const r = resolveKoMatch('sf', slot, preds, firstKo, m1.winner, m2.winner);
    sf.push({ slot, a:r.a, b:r.b, from:[m1.slot,m2.slot], winner:r.winner });
  }
  const thirdFallbackA = (sf[0].a && sf[0].b) ? koLoser(preds[sf[0].slot], sf[0].a, sf[0].b, firstKo==='sf') : null;
  const thirdFallbackB = (sf[1].a && sf[1].b) ? koLoser(preds[sf[1].slot], sf[1].a, sf[1].b, firstKo==='sf') : null;
  const thirdR = resolveKoMatch('third', 'third', preds, firstKo, thirdFallbackA, thirdFallbackB);
  const third = { slot:'third', a:thirdR.a, b:thirdR.b, winner:thirdR.winner };
  const finalR = resolveKoMatch('final', 'final', preds, firstKo, sf[0].winner, sf[1].winner);
  const final = { slot:'final', a:finalR.a, b:finalR.b, winner:finalR.winner };
  // realSeedKey: qué fase (si alguna) está usando equipos REALES como
  // semilla en vez de encadenarse desde la ronda anterior — la UI del
  // wizard (buildKoStepHtml) lo usa para mostrar el aviso correcto en vez
  // de duplicar esta misma decisión.
  const realSeedKey = (!r32SembradoDeGrupos && firstKo) ? firstKo : null;
  return { ready:true, q, r32, r16, qf, sf, third, final, realSeedKey };
}

function koSlotsOf(bracket, key){
  if(key==='r32') return bracket.r32;
  if(key==='r16') return bracket.r16;
  if(key==='qf')  return bracket.qf;
  if(key==='sf')  return bracket.sf;
  if(key==='third') return [bracket.third];
  if(key==='final') return [bracket.final];
  return [];
}

// v0.6 — separado de getCompletionStatus(pid) para poder evaluarlo también
// sobre DRAFT_PREDS (en memoria, en vivo) y no solo sobre DB.predictions[pid]
// (que solo refleja el último autoguardado, con hasta ~700ms de retraso).
// Esto es lo que permite que el bloqueo de avance entre pasos sea instantáneo.
function computeCompletionFromPreds(preds){
  preds = preds || {};
  const groupsAns = GROUP_MATCHES.filter(m=>groupMatchResult(m.id, preds)).length;
  const bracket = computeBracket(preds);
  const phases = [];
  if(isGruposActivaWizard())phases.push({key:'groups', label:'Fase de grupos', done:groupsAns, total:72});
  KO_PHASES.forEach(ph=>{
    if(!isKoPhaseActive(ph.key))return; // v1.2 — fase desactivada: no existe en este torneo
    const slots = bracket.ready ? koSlotsOf(bracket, ph.key) : [];
    const done = slots.filter(m=>m.winner).length;
    phases.push({key:ph.key, label:ph.label, done, total:ph.n});
  });
  const autoSp = computeAutoSpecial(bracket);
  const visibleSpecial = activeSpecialQuestions();
  const specialAns = visibleSpecial.filter(q=>{
    if(AUTO_SPECIAL_IDS.includes(q.id)) return !!(autoSp[q.id] && String(autoSp[q.id]).trim());
    const v = preds.special && preds.special[q.id];
    if(q.type==='number') return v!==undefined && v!==null && v!=='' && Number.isInteger(Number(v)) && Number(v)>=0;
    return !!(v && String(v).trim());
  }).length;
  phases.push({key:'special', label:'Preguntas especiales', done:specialAns, total:visibleSpecial.length});
  const totalDone = phases.reduce((s,p)=>s+p.done,0);
  const totalAll  = phases.reduce((s,p)=>s+p.total,0);
  return { phases, totalDone, totalAll, bracket, complete: totalDone===totalAll };
}
function getCompletionStatus(pid){
  return computeCompletionFromPreds(DB.predictions[pid] || {});
}

// v0.6 — Bloqueo de avance: devuelve la lista de pasos anteriores a
// targetIdx que todavía están incompletos. Solo se usa para saltos hacia
// ADELANTE (volver hacia atrás siempre está permitido, sin restricción).
// "personal" se valida aparte (no son "resultados", son datos del
// formulario); "review" nunca bloquea porque es el último paso.
function getStepBlockers(targetIdx, p, personalMerged, preds){
  const blockers = [];
  const comp = computeCompletionFromPreds(preds);
  const phaseByKey = {};
  comp.phases.forEach(ph=> phaseByKey[ph.key]=ph);

  for(let i=0; i<targetIdx; i++){
    const key = WIZARD_STEPS[i].key;
    if(key==='personal'){
      const ok = !!(String(personalMerged.name||'').trim() && String(personalMerged.city||'').trim() &&
                    String(personalMerged.country||'').trim() && String(personalMerged.email||'').trim());
      if(!ok) blockers.push({idx:i, label: WIZARD_STEPS[i].label, detail:'Faltan datos personales obligatorios.'});
      continue;
    }
    if(key==='review') continue;
    const ph = phaseByKey[key];
    if(ph && ph.done < ph.total){
      blockers.push({idx:i, label: WIZARD_STEPS[i].label, detail:`Faltan ${ph.total-ph.done} de ${ph.total} resultado(s).`});
    }
  }
  return blockers;
}

/* ════════════════════════════════════════
   CAPA DE DATOS — localStorage
   v2 (alpha 0.1): se quita "contact" (mezcla email+teléfono) y el teléfono;
   se agrega país, código único de participante y los campos de sistema
   fechaCreacion / fechaEnvio / estadoQuiniela.
   v3 (alpha 0.4): "PIN" se renombra a "Clave" en todo el sistema (campo
   p.pin -> p.clave). Por ser un cambio de estructura se sube el
   identificador de almacenamiento (qbRegistroV2 -> V3): los datos de
   prueba anteriores quedan huérfanos en el navegador pero ya no se leen
   (mismo criterio que STORAGE_KEY en el proyecto principal).

   Estructura:
   { nextSeq: <contador para el código QLB-2026-XXXX, nunca se reutiliza>,
     participants:[{
       id, codigo,                          // identificadores
       name, city, country, email, clave,
       estadoQuiniela,                      // "borrador" | "enviada"
       fechaCreacion, fechaActualizacion, fechaEnvio
     }],
     predictions: { [participantId]: { [matchId]: {h,a} | "TeamName" } } }
   ════════════════════════════════════════ */
// v6.2 — La capa de datos (DB, loadData/saveData, sincronización con
// Firestore, uid/nextCode/genClave) se movió a participantes.js, que
// carga antes que este archivo y antes que app.js — ambos la comparten
// como global, igual que ya se compartía isAdmin()/toast()/openLoginModal().
// Lo único que sigue siendo específico de este módulo es resincronizar el
// borrador en memoria del wizard cuando llega un cambio remoto, y volver a
// pintar esta pestaña — por eso nos registramos como listener.
// v6.5 — FIX (autoguardado pisado): antes, CUALQUIER cambio remoto en
// Firestore (de cualquier participante, o de la config global) pisaba
// aquí mismo el DRAFT_PREDS en memoria del wizard activo y forzaba un
// render() completo del paso actual. Eso reconstruye el <input> que el
// usuario tiene con foco en ese instante (innerHTML nuevo = elemento
// nuevo), perdiendo lo que acababa de escribir — sin importar si el
// snapshot remoto tenía algo que ver con su propia quiniela. Como el
// autoguardado tiene ~700ms de debounce, había una ventana real en la que
// "escribís un marcador" podía coincidir con "llega un snapshot de otra
// persona" y el valor se borraba solo.
//
// Mientras el usuario está dentro del wizard con cambios sin confirmar
// (WIZ_DIRTY), su copia en memoria manda: no se sobreescribe DRAFT_PREDS
// ni se re-renderiza el paso. Apenas no haya nada pendiente (recién entró,
// o ya hizo flush), sí se resincroniza normalmente.
// v6.7 — Auto-reconocimiento por ownerUid: evita pedir correo+Clave en
// cada visita/refresh cuando el dispositivo YA es el dueño reconocido de
// una quiniela (mismo UID anónimo que la última vez — Firebase lo
// persiste solo en este navegador). Antes esto SOLO se chequeaba dentro
// del submit del login (p.ownerUid === currentUid) para saltarse el
// "reclamo" en Firestore, pero la persona de todas formas tenía que
// escribir correo+Clave para llegar hasta ahí. Ahora, en cuanto se sabe
// quién es el dueño de este dispositivo, se entra directo a su quiniela
// — exactamente lo mismo que ya hace enterWizardAs() en un login manual,
// solo que automático.
//
// Se intenta como máximo UNA vez por carga de página (_autoLoginDone),
// y solo cuando las dos piezas necesarias ya están listas: (1) Firestore
// ya entregó participantes+meta de verdad (_rgGotParticipants/_rgGotMeta,
// participantes.js) — si todavía no llegó, un DB.participants vacío no
// significa "no hay match", significa "no sabemos todavía"; y (2) ya
// sabemos el UID de este dispositivo (Firebase Auth, anónimo o no). Se
// llama desde dos lugares por las dudas de cuál evento llega primero:
// acá mismo (cuando llega la data) y desde wireFirebaseAuth() en app.js
// (cuando resuelve el login anónimo).
let _autoLoginDone = false;
function tryAutoLoginByOwnerUid(){
  if(_autoLoginDone) return;
  if(!_rgGotParticipants || !_rgGotMeta) return; // todavía no sabemos si hay match real
  const uid = window.__fb && window.__fb.auth && window.__fb.auth.currentUser
    ? window.__fb.auth.currentUser.uid : null;
  if(!uid) return; // todavía no sabemos QUIÉNES somos — se reintenta solo
  _autoLoginDone = true; // de aquí en más no se vuelve a intentar en esta carga, pase lo que pase
  if(DRAFT_PID) return; // alguien ya está en medio de algo (no debería pasar tan temprano, por si las moscas)
  const p = DB.participants.find(x=>x.ownerUid===uid);
  if(!p) return; // dispositivo nuevo, nunca reclamó ninguna quiniela — sigue el landing normal, sin login automático
  // v6.9 — Fase de Privacidad: p.email/p.clave ya no vienen incluidos en
  // el documento público (de donde se armó DB.participants), así que
  // hay que traerlos aparte desde registro_privado antes de entrar —
  // si no, "Mi Quiniela" mostraría el campo de correo vacío hasta el
  // primer re-render. Si la lectura falla (sin red, permiso denegado
  // por alguna razón), igual entramos -- mejor mostrar el wizard sin el
  // correo precargado que bloquear toda la pantalla por esto.
  rgHydrateOwnPrivado(p.id).finally(()=>{
    enterWizardAs(p);
    if(typeof render==='function') render();
  });
}

// v3.2.3 — BUG URGENTE REPORTADO: "ya pasó un partido y está corriendo
// otro y el ranking no actualiza la puntuación". render() (esta pantalla,
// la que ve cada participante: Mi Quiniela/Ranking) solo se disparaba acá
// abajo, en onParticipantesChange() -- que escucha cambios en la
// colección registro_participants. Pero un resultado real (ESPN Live o
// carga manual del admin) vive en un documento totalmente distinto
// (quiniela/estado, ver S.elimScores/scores) -- su listener remoto
// (wireFirestoreSync/applyRemoteState, app-live-sync.js) solo refrescaba
// el panel de ADMIN (renderRank() de app-bracket-view.js), nunca esta
// pantalla de registro.js. Un participante mirando su posición/puntos se
// quedaba con el valor viejo hasta cambiar de pestaña o que -por
// casualidad- algún OTRO participante tocara registro_participants.
// Mismos criterios de "no pisar tecleo sin guardar" que
// onParticipantesChange (WIZ_DIRTY/INICIO_DIRTY, ver ahí) -- se
// reutilizan acá tal cual, porque un cambio de resultado real es
// exactamente tan ajeno a lo que esta persona esté escribiendo como un
// cambio de otro participante.
function refreshRegistroViewFromStateChange(){
  if(DRAFT_PID && WIZ_DIRTY) return;
  if(!DRAFT_PID && (INICIO_VIEW==='crear'||INICIO_VIEW==='login') && INICIO_DIRTY) return;
  render();
}

onParticipantesChange(()=>{
  tryAutoLoginByOwnerUid();
  if(DRAFT_PID){
    // v1.9 — Ver nota junto a _lastPushedFechaActualizacion (declaración,
    // arriba): esto es el ECO de nuestro propio flushAutosave(), no un
    // cambio remoto genuino -- ya está aplicado localmente, re-renderizar
    // acá solo produce el parpadeo/pérdida de foco reportado, sin mostrar
    // nada nuevo.
    const pEcho = DB.participants.find(x=>x.id===DRAFT_PID);
    if(pEcho && pEcho.fechaActualizacion === _lastPushedFechaActualizacion) return;
  }
  if(DRAFT_PID && WIZ_DIRTY) return; // hay tecleo sin guardar: no pisar ni re-renderizar
  // v3.2.2 — mismo criterio que la línea de arriba, pero para quien
  // TODAVÍA no es participante (sin DRAFT_PID todavía): si está
  // tecleando el formulario de "Crear nueva quiniela" o el de "Ver mi
  // quiniela" (login por correo+Clave), no reconstruir ese formulario
  // bajo sus dedos solo porque llegó un cambio remoto de OTRO
  // participante -- ver la nota junto a INICIO_DIRTY.
  if(!DRAFT_PID && (INICIO_VIEW==='crear'||INICIO_VIEW==='login') && INICIO_DIRTY) return;
  if(DRAFT_PID){
    const p = DB.participants.find(x=>x.id===DRAFT_PID);
    if(p) DRAFT_PREDS = JSON.parse(JSON.stringify(DB.predictions[DRAFT_PID] || {}));
  }
  render();
  // v6.6.1 — Admin ya es una pestaña principal independiente: si está
  // visible, también se refresca con cada cambio (igual que ya hacían
  // fix/pred/bonos en app.js para sus propias pestañas admin).
  if(document.getElementById('t-admin')?.style.display==='block' && typeof renderAdminTab==='function') renderAdminTab();
});

// uid()/nextCode()/genClave() ahora viven en participantes.js (compartidos
// con la herramienta de migración de app.js). norm()/foldAccents() siguen
// aquí porque son específicos del buscador del wizard/admin.
function norm(s){ return (s||"").trim().toLowerCase().replace(/\s+/g,' '); }
// v1.0 — Solo para el buscador de país: "Panama" debe encontrar "Panamá".
// No se usa en norm() general (login/correo) para no tocar nada que ya
// funciona; acá es una mejora real de usabilidad, no solo cosmética.
function foldAccents(s){ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

// v0.9 (Fase 7) — Exportar correo+Clave de todos los participantes a un
// .csv descargable. Se construye a mano (sin SheetJS ni librerías
// externas) porque este prototipo es un único archivo HTML.
//
// v6.4 — Esta función no toca Firestore (solo lee DB.participants, ya en
// memoria del admin) así que no necesitó ningún cambio funcional con la
// nueva capa de seguridad. Vale aclarar igual: desde v6.4 la "Clave" que
// se exporta aquí ya NO es la barrera de seguridad real de la quiniela
// de nadie (eso ahora lo hace ownerUid + las reglas de Firestore) — sigue
// siendo sensible porque es lo que permite reclamar/recuperar acceso
// desde un dispositivo nuevo (ver renderLogin en este mismo archivo), así
// que el archivo exportado sigue mereciendo el mismo cuidado de siempre
// al compartirlo, solo que la razón de fondo cambió.
//
// v1.5.1 — "Exportar correos y claves" (.csv, solo correo+clave) pasó a
// ser "Exportar info de participantes" (.json, TODA la info visible en
// la tabla del panel: código, nombre, correo, ubicación, clave, creado,
// enviado, estado y avance) -- ver exportarInfoParticipantes()/
// importarInfoParticipantes() más abajo. _parseCSV() se conserva tal
// cual para poder seguir importando archivos .csv viejos.
// Parser de CSV mínimo, a mano (sin librerías, mismo criterio que el
// resto del proyecto) -- entiende exactamente el formato que generaba
// la vieja exportarCorreosClaves() (hasta v1.5), que importarInfoParticipantes()
// sigue aceptando por compatibilidad hacia atrás: campos entre comillas
// dobles, comillas internas escapadas como "" (ej. un nombre con
// comillas adentro), y filas separadas por \r\n (también acepta \n
// solo, por si alguien edita el archivo a mano en otro programa).
function _parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    if(inQuotes){
      if(ch === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; } else { inQuotes = false; }
      }else{ field += ch; }
    }else{
      if(ch === '"'){ inQuotes = true; }
      else if(ch === ','){ row.push(field); field=''; }
      else if(ch === '\r'){ /* se ignora, el \n que sigue cierra la fila */ }
      else if(ch === '\n'){ row.push(field); rows.push(row); row=[]; field=''; }
      else{ field += ch; }
    }
  }
  if(field !== '' || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r=> r.some(c=> String(c).trim() !== ''));
}

// Busca, sin importar mayúsculas/acentos exactos, en qué columna del
// header está cada dato que nos interesa -- así si el CSV se abrió y
// re-guardó en Excel/Sheets (que a veces reordenan o tocan el header)
// igual lo encuentra.
function _colIndex(header, nombres){
  const norm = (s)=> String(s||'').trim().toLowerCase();
  const headerNorm = header.map(norm);
  for(const n of nombres){
    const idx = headerNorm.indexOf(norm(n));
    if(idx !== -1) return idx;
  }
  return -1;
}

function importarInfoParticipantes(file){
  if(!file) return;
  // v6.9.3 — Chequeo temprano: si fb.PARTICIPANTS_COL/fb.PRIVADO_COL
  // todavía no están listos (Firebase no terminó de cargar, o el
  // navegador está corriendo una versión vieja en caché del index.html
  // de antes de la separación de privacidad), avisamos ANTES de pedir
  // confirmación y bajar el backup -- así no hay sorpresa de "dijo que
  // importó pero no llegó a Firestore". Si esto aparece, lo más probable
  // es que haga falta recargar la página (Ctrl+Shift+R / vaciar caché)
  // para traer la versión actual de index.html.
  const fb = window.__fb;
  if(!fb || !fb.PARTICIPANTS_COL || !fb.PRIVADO_COL){
    toast("Firebase todavía no está listo en esta pestaña (o quedó una versión vieja en caché). Recargá la página (Ctrl+Shift+R) y volvé a intentar.", true);
    return;
  }
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      // Quita el BOM que el propio exportarInfoParticipantes()/
      // exportarCorreosClaves() (versiones anteriores a v1.5.1) le
      // agrega al archivo (\uFEFF) -- si no se quita, la primera clave
      // del header no matchea por tener ese caracter invisible pegado.
      const text = String(e.target.result || '').replace(/^\uFEFF/, '').trim();

      // por codigo -> {clave, email, name, city, country, estadoQuiniela,
      // fechaCreacion, fechaEnvio}. Se matchea por CÓDIGO (ej.
      // "QLB-2026-0001"), que es lo único que tanto el archivo exportado
      // como la tabla del panel muestran y que no cambia nunca para un
      // mismo participante -- el archivo no trae el id interno.
      //
      // v1.5.1 — "nombre" viaja en el JSON exportado (es info visible en
      // la tabla), pero A PROPÓSITO no se aplica acá al importar: cambiar
      // el nombre de un participante también tiene que migrar S.hiddenPL
      // y S.adv (que lo usan como clave) -- eso solo lo hace
      // saveEditParticipant() (app-admin-tools.js, el ✏️ de la tabla), que
      // vive en otro archivo y no comparte ese cuidado con un import
      // masivo. Para renombrar, usar "Editar" en la fila del participante.
      let porCodigo = {};
      let formato = '';

      if(text[0] === '{' || text[0] === '['){
        const raw = JSON.parse(text);
        if(raw && raw.tipo === 'quinielaborracha_info_participantes' && Array.isArray(raw.participantes)){
          // v2.8.1 — Formato nuevo (el que arma exportarInfoParticipantes(),
          // ahora con "predicciones" incluidas). CAMBIO DE COMPORTAMIENTO a
          // propósito respecto al resto de esta función (CSV/json-legado,
          // más abajo, que siguen igual que siempre): este formato YA NO
          // sobreescribe a nadie que exista. Con la quiniela completa
          // adentro, tiene más sentido usarlo para MEZCLAR/RESTAURAR
          // participantes desde un backup -- se agregan como NUEVOS
          // (con su quiniela) solo los códigos que todavía no existen acá;
          // los que ya existen se dejan 100% intactos, sin tocar ni un
          // campo, para no arriesgar pisar en silencio la quiniela de
          // alguien que ya está jugando en este dispositivo. Tiene su
          // propio confirm()/backup()/guardado más abajo y corta la
          // función ahí (no cae al camino de "sobreescribir" de CSV/
          // json-legado).
          importarInfoParticipantesComoNuevos(raw.participantes);
          return;
        }else{
          // Por las dudas alguien todavía tenga a mano el backup JSON
          // automático (el que se descarga solo al migrar, o el que se
          // descarga antes de cualquier import) en vez del archivo de
          // este panel -- también se acepta, matcheando por id en ese caso.
          formato = 'json-legado';
          const participantsBackup =
            (raw.dbAntesDeLaMigracion && raw.dbAntesDeLaMigracion.participants) ||
            (raw.dbAntesDeImportar && raw.dbAntesDeImportar.participants) ||
            raw.participants ||
            (Array.isArray(raw) ? raw : null);
          if(!participantsBackup || !Array.isArray(participantsBackup)){
            throw new Error("No encontré una lista de participantes en este archivo JSON.");
          }
          const porId = {};
          participantsBackup.forEach(p=>{
            if(!p || !p.id) return;
            if(!p.clave && !p.email) return;
            porId[p.id] = { clave: p.clave||'', email: p.email||'' };
          });
          DB.participants.forEach(p=>{
            if(porId[p.id]) porCodigo[p.codigo] = porId[p.id];
          });
        }
      }else{
        // Compatibilidad con el .csv que exportaba "Exportar correos y
        // claves" en versiones anteriores a v1.5.1 (solo correo+clave).
        formato = 'csv';
        const rows = _parseCSV(text);
        if(rows.length < 2){
          throw new Error("El archivo no tiene filas de datos (¿está vacío?).");
        }
        const header = rows[0];
        const idxCodigo = _colIndex(header, ['Codigo','Código']);
        const idxClave = _colIndex(header, ['Clave']);
        const idxCorreo = _colIndex(header, ['Correo','Email','Correo electronico','Correo electrónico']);
        if(idxCodigo === -1){
          throw new Error("No encontré la columna 'Codigo' en el archivo -- ¿es un archivo exportado desde este panel?");
        }
        rows.slice(1).forEach(r=>{
          const codigo = (r[idxCodigo]||'').trim();
          if(!codigo) return;
          const clave = idxClave!==-1 ? (r[idxClave]||'').trim() : '';
          const email = idxCorreo!==-1 ? (r[idxCorreo]||'').trim() : '';
          if(!clave && !email) return;
          porCodigo[codigo] = { clave, email };
        });
      }

      const codigosConDatos = Object.keys(porCodigo);
      if(!codigosConDatos.length){
        throw new Error("El archivo no tiene datos guardados para ningún participante.");
      }

      let coincidencias = 0;
      DB.participants.forEach(p=>{ if(porCodigo[p.codigo]) coincidencias++; });
      if(!coincidencias){
        throw new Error("Ningún participante actual coincide con los códigos de este archivo -- ¿es el archivo correcto?");
      }

      if(!confirm(`Encontré datos guardados para ${coincidencias} de los ${DB.participants.length} participantes actuales en este archivo. Esto va a reemplazar su correo/ubicación/clave/estado actual (según lo que traiga el archivo) por el del archivo y los va a volver a guardar en el documento privado. Antes de aplicar nada se descarga un backup del estado actual, por si esto tampoco era lo que hacía falta. ¿Continuar?`)) return;

      // Backup del estado ACTUAL antes de aplicar el import -- mismo
      // cuidado que cualquier otra operación de este panel que
      // reescribe datos de varios participantes a la vez.
      const backupActual = {
        tipo: "backup_pre_importacion_info_participantes",
        fecha: new Date().toISOString(),
        dbAntesDeImportar: JSON.parse(JSON.stringify(DB))
      };
      const blobBk = new Blob([JSON.stringify(backupActual, null, 2)], { type: "application/json" });
      const urlBk = URL.createObjectURL(blobBk);
      const aBk = document.createElement("a");
      aBk.href = urlBk; aBk.download = `backup_antes_de_importar_${Date.now()}.json`;
      document.body.appendChild(aBk); aBk.click(); aBk.remove();
      URL.revokeObjectURL(urlBk);

      let aplicados = 0;
      DB.participants.forEach(p=>{
        const datos = porCodigo[p.codigo];
        if(!datos) return;
        if(datos.clave) p.clave = datos.clave;
        if(datos.email) p.email = datos.email;
        if(datos.city) p.city = datos.city;
        if(datos.country) p.country = datos.country;
        if(datos.estadoQuiniela) p.estadoQuiniela = datos.estadoQuiniela;
        if(datos.fechaCreacion) p.fechaCreacion = datos.fechaCreacion;
        if(datos.fechaEnvio) p.fechaEnvio = datos.fechaEnvio;
        aplicados++;
      });

      // saveData() ya separa clave/correo al documento privado y manda
      // emailHash al público -- mismo camino que cualquier guardado
      // normal, no hace falta nada especial acá.
      saveData(DB);
      render();
      toast(`✓ Se importó info para ${aplicados} participante(s) desde el archivo (${formato}). Re-sincronizando al documento privado.`);
    }catch(err){
      console.error("Error al importar info de participantes:", err);
      toast("Error al importar: " + err.message, true);
    }
  };
  reader.readAsText(file);
}

// v2.8.1 — Camino NUEVO de importación, usado SOLO por el formato actual
// de exportarInfoParticipantes() (el que trae "predicciones"). A
// diferencia del resto de importarInfoParticipantes() (CSV/json-legado,
// que parchea campos de participantes YA existentes), acá se agregan
// como participantes NUEVOS -- con su quiniela completa -- únicamente
// los códigos del archivo que todavía NO existen en este dispositivo.
// Los que ya existen se dejan 100% intactos (ni un campo se toca): así
// se puede reimportar el mismo backup las veces que haga falta sin
// arriesgar pisar en silencio la quiniela de alguien que ya está
// jugando, y sin crear duplicados de quien ya está.
//
// v3.1.2 — BUG REPORTADO: nextCode() (participantes.js) lee
// DB.nextSeq LOCAL para generar el código de un participante nuevo —
// si 2+ personas se registran casi al mismo tiempo desde dispositivos
// distintos, cada una puede leer el mismo DB.nextSeq (todavía no le
// llegó el commit de la otra) y terminar con el MISMO código (ej.
// 4 participantes reales distintos, los 4 con "QLB-2026-0001"). El
// chequeo de "repetido DENTRO del archivo" identificaba a cada
// participante SOLO por su código -- con códigos duplicados, la
// 2da/3ra/4ta persona del archivo quedaban "vistas" como si fueran la
// 1ra repetida, y se descartaban en silencio (de 4 personas reales,
// solo se importaba 1). Ahora ESE chequeo puntual usa el CORREO
// normalizado cuando está (prácticamente siempre único por persona
// real, a diferencia del código autogenerado), cayendo al código solo
// si no hay correo.
//
// El chequeo de "¿ya existe entre los participantes ACTUALES?" NO se
// toca -- sigue siendo por código nada más, a propósito: si alguien
// activamente registrado hoy comparte código con una fila del archivo
// pero el archivo trae un correo distinto (ej. un correo viejo/de
// prueba), igual se lo debe tratar como la MISMA persona y dejarlo
// intacto -- no como alguien nuevo a agregar. Cambiar este chequeo a
// correo rompería esa protección (ver test_export_import_predicciones.js).
function _identidadPorCorreo(correoOEmail, codigo){
  const correoNorm = (correoOEmail||'').trim().toLowerCase();
  return correoNorm || `codigo:${codigo}`;
}
function importarInfoParticipantesComoNuevos(participantesDelArchivo){
  const codigosExistentes = new Set(DB.participants.map(p=>p.codigo));
  const vistosEnArchivo = new Set(); // por si el archivo trae a la misma persona repetida
  const nuevos = [];
  participantesDelArchivo.forEach(p=>{
    if(!p || !p.codigo || !p.nombre) return; // sin código o sin nombre no alcanza para crear un participante de verdad
    if(codigosExistentes.has(p.codigo)) return; // ya existe -- se deja intacto
    const identidad = _identidadPorCorreo(p.correo, p.codigo);
    if(vistosEnArchivo.has(identidad)) return;
    vistosEnArchivo.add(identidad);
    nuevos.push(p);
  });

  const yaExistian = participantesDelArchivo.length - nuevos.length;
  if(!nuevos.length){
    toast(yaExistian
      ? `Los ${yaExistian} participante(s) de este archivo ya existen acá -- no se agregó ninguno nuevo.`
      : 'Este archivo no tiene participantes con código y nombre para agregar.', true);
    return;
  }

  if(!confirm(`Este archivo trae ${participantesDelArchivo.length} participante(s): ${nuevos.length} no existen todavía acá y se van a AGREGAR como nuevos (con su quiniela completa)${yaExistian?`, y ${yaExistian} ya existen y se van a dejar sin tocar`:''}. Antes de agregar nada se descarga un backup del estado actual. ¿Continuar?`)) return;

  // Mismo cuidado que el resto de este panel: backup del estado ACTUAL
  // antes de aplicar nada.
  const backupActual = {
    tipo: "backup_pre_importacion_info_participantes",
    fecha: new Date().toISOString(),
    dbAntesDeImportar: JSON.parse(JSON.stringify(DB))
  };
  const blobBk = new Blob([JSON.stringify(backupActual, null, 2)], { type: "application/json" });
  const urlBk = URL.createObjectURL(blobBk);
  const aBk = document.createElement("a");
  aBk.href = urlBk; aBk.download = `backup_antes_de_importar_${Date.now()}.json`;
  document.body.appendChild(aBk); aBk.click(); aBk.remove();
  URL.revokeObjectURL(urlBk);

  const now = Date.now();
  // v3.1.2 — el código duplicado (ver nota de arriba) ya no le impide a
  // nadie importarse, pero seguiría mostrando 2+ personas reales con el
  // MISMO "código" en la tabla del admin (confuso, y ese código deja de
  // servir para identificar a alguien puntual). Si el código que trae
  // el archivo ya está en uso -- por un participante ya existente, o por
  // otro de este mismo lote -- se le asigna uno nuevo de verdad con
  // nextCode() (participantes.js), único garantizado.
  const codigosEnUso = new Set(DB.participants.map(p=>p.codigo));
  nuevos.forEach(p=>{
    const id = uid();
    let codigo = p.codigo;
    if(codigosEnUso.has(codigo)) codigo = nextCode();
    codigosEnUso.add(codigo);
    DB.participants.push({
      id, codigo,
      name: p.nombre, city: p.ciudad||'', country: p.pais||'', countryIso: p.paisIso||'',
      email: p.correo||'', clave: p.clave||genClave(), ownerUid: null,
      estadoQuiniela: (p.estado==='enviada') ? 'enviada' : 'borrador',
      lastStep: visibleStepIndices()[0] ?? WIZARD_STEPS.findIndex(s=>s.key==='groups'),
      fechaCreacion: p.creado || now, fechaActualizacion: now, fechaEnvio: p.enviado || null,
    });
    DB.predictions[id] = JSON.parse(JSON.stringify(p.predicciones || {}));
  });

  // saveData() ya separa clave/correo al documento privado y manda
  // emailHash al público -- mismo camino que cualquier guardado normal.
  saveData(DB);
  render();
  if(typeof refreshAdminTable==='function') refreshAdminTable();
  toast(`✓ Se agregaron ${nuevos.length} participante(s) nuevo(s) con su quiniela completa${yaExistian?` (${yaExistian} ya existían y no se tocaron)`:''}.`);
}

// v1.5.1 — Exporta TODA la info que se ve en la tabla del panel Admin
// (Código, Nombre, Correo, Ubicación, Clave, Creado, Enviado, Estado,
// Avance) a un .json descargable -- antes ("Exportar correos y claves")
// solo exportaba correo+clave a un .csv. "avance" viaja como dato
// informativo (el % de la quiniela contestada al momento de exportar);
// NO es un campo real guardado en Firestore, así que
// importarInfoParticipantes() lo ignora al leer un archivo de vuelta (se
// recalcula solo, siempre, a partir de las predicciones reales de cada
// quien). "Nombre" también viaja informativo pero no se reimporta para
// alguien YA existente -- ver el comentario grande en
// importarInfoParticipantes().
//
// v2.8.1 — Ahora cada participante también trae "predicciones" (su
// quiniela completa, DB.predictions[p.id] tal cual) -- este .json pasó a
// ser un backup real y restaurable de punta a punta (datos + quiniela),
// no solo la info de la tabla. Ver importarInfoParticipantes(): con
// predicciones adentro, este archivo ahora permite RECREAR un
// participante completo si ya no existe (antes solo servía para
// parchear campos de uno que ya estaba).
function exportarInfoParticipantes(){
  if(!DB.participants.length){ toast('No hay participantes para exportar.', true); return; }
  const total = totalMatches();
  const payload = {
    tipo: "quinielaborracha_info_participantes",
    version: "2.9",
    exportedAt: new Date().toISOString(),
    participantes: DB.participants.slice()
      .sort((a,b)=> a.name.localeCompare(b.name))
      .map(p=>{
        const ans = countAnswered(p.id);
        const pct = total ? Math.round((ans/total)*100) : 0;
        return {
          codigo: p.codigo || '',
          nombre: p.name || '',
          correo: p.email || '',
          ciudad: p.city || '',
          pais: p.country || '',
          paisIso: p.countryIso || '',
          clave: p.clave || '',
          creado: p.fechaCreacion || null,
          enviado: p.fechaEnvio || null,
          estado: p.estadoQuiniela || '',
          avance: pct,
          // v2.9 — se agrega para poder detectar, en compararRespaldoOffline()
          // (app-integridad.js), si una cuenta cambió de dueño (reclamo)
          // entre el momento de este export y ahora. No es un dato sensible:
          // ya viaja público en registro_participants (ver firestore.rules).
          ownerUid: p.ownerUid || '',
          predicciones: DB.predictions[p.id] || {}
        };
      })
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {type:'application/json;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'quiniela_info_participantes.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Info de participantes exportada (${DB.participants.length} participantes).`);
}

function fmtDate(ts){
  if(!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'2-digit'}) +
    ' ' + d.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'});
}

function findByName(name){
  const n = norm(name);
  return DB.participants.find(p=>norm(p.name)===n);
}
function findByEmail(email){
  // v6.9 — Fase de Privacidad: el correo de OTROS participantes ya no
  // está en DB.participants (vive en registro_privado, de lectura
  // restringida) -- comparamos por emailHash, que sí sigue siendo
  // público (no es reversible en la práctica, solo sirve para "¿coincide
  // o no?", igual que antes servía comparar el correo en texto plano
  // para ese mismo propósito). _rgEmailHash() vive en participantes.js.
  const h = _rgEmailHash(email);
  if(!h) return undefined;
  return DB.participants.find(p=> p.emailHash ? p.emailHash===h : norm(p.email)===norm(email));
}

function totalMatches(){ return 72 + KO_SLOT_IDS.length + activeSpecialQuestions().length; } // 72+32+8 = 112 (menos las preguntas avanzadas apagadas)
function countAnswered(pid){ return getCompletionStatus(pid).totalDone; }

/* ════════════════════════════════════════
   UI helpers
   ════════════════════════════════════════ */
// v6.0 — Se eliminó el toast() local de este prototipo: ahora se reutiliza
// el toast() global de la app principal (app.js), ya cargado antes que este
// archivo. Mismo orden de parámetros (mensaje, esError), así que todas las
// llamadas existentes en este archivo siguen funcionando sin cambios.
//
// v1.5.3 — esc() se movió a utils.js (Fase 0 de seguridad): ahora es una
// utilidad global para TODOS los módulos, no solo para este archivo. Sigue
// disponible acá con el mismo nombre y comportamiento porque utils.js
// carga antes que registro.js (ver orden de <script> en index.html) — las
// 110 llamadas existentes a esc() en este archivo no necesitaron tocarse.

// Espera a que todas las <img> dentro de un contenedor terminen de cargar
// (o fallen, en cuyo caso ya disparó su propio onerror de respaldo) antes de
// continuar. html2canvas toma una "foto" del DOM tal como está en ese
// instante; si una bandera (imagen remota) todavía no cargó, saldría en
// blanco en el PDF — por eso se espera explícitamente.
function waitForImages(container, timeoutMs){
  // v6.4 — CAUSA RAÍZ del PDF que se quedaba colgado en "Generando...":
  // las banderas usan loading="lazy", y #pdfPoster vive PERMANENTEMENTE
  // fuera del viewport (left:-9999px) para que html2canvas lo capture
  // sin que se vea en pantalla. El navegador decide cuándo arrancar la
  // descarga de una imagen lazy según su distancia al viewport visible;
  // un elemento que nunca se acerca a ese viewport nunca cruza ese
  // umbral, así que la descarga JAMÁS arranca — ni load ni error se
  // disparan nunca — y este Promise.all (y por lo tanto todo
  // generarPDF) se queda esperando para siempre. Forzamos loading=eager
  // para que la descarga arranque ya mismo, sin importar la posición.
  //
  // Además, por si una bandera individual se cuelga en la red (conexión
  // lenta o intermitente), un timeout de seguridad garantiza que el PDF
  // se genere igual pasado ese tiempo, en vez de quedar bloqueado para
  // siempre por una sola imagen.
  timeoutMs = timeoutMs || 8000;
  const imgs = Array.from(container.querySelectorAll('img'));
  if(!imgs.length) return Promise.resolve();
  return Promise.all(imgs.map(img=>{
    if(img.loading === 'lazy') img.loading = 'eager';
    if(img.complete) return Promise.resolve();
    return new Promise(res=>{
      let timer;
      const done = ()=>{ clearTimeout(timer); res(); };
      img.addEventListener('load', done, {once:true});
      img.addEventListener('error', done, {once:true});
      timer = setTimeout(done, timeoutMs);
    });
  }));
}

let DRAFT_PID = null;       // participante activo en el formulario de quiniela
let DRAFT_PREDS = {};       // predicciones en edición (en memoria), sincronizadas por autoguardado
let DRAFT_PERSONAL = {};    // cambios pendientes de nombre/ciudad/país/correo (paso "Datos personales")
let WIZ_STEP = 0;           // paso actual del wizard (índice en WIZARD_STEPS)
let WIZ_DIRTY = false;      // hay cambios escritos que el autoguardado todavía no confirmó
// v3.2.2 — BUG URGENTE REPORTADO: alguien llenando el formulario de
// "Crear nueva quiniela" o el de "Ver mi quiniela" (correo+Clave para
// entrar) -- en AMBOS casos, ANTES de existir como participante, todavía
// no hay DRAFT_PID -- perdía lo que tecleaba cada vez que llegaba un
// cambio remoto de Firestore (cualquier OTRO participante registrándose
// o autoguardando, no algo relacionado con esta persona) -- mismo bug de
// fondo que WIZ_DIRTY ya resuelve para el wizard (ver la nota de
// v1.9/v6.5 más abajo), pero ese guard solo aplica "si(DRAFT_PID)" --
// acá DRAFT_PID es null, así que render() corría sin ningún freno. Con
// el torneo en curso y mucha gente registrándose/editando al mismo
// tiempo, estos cambios remotos llegan seguido -- de ahí "no he podido
// registrar a varios".
let INICIO_DIRTY = false;   // hay tecleo sin confirmar en Crear nueva quiniela o en Ver mi quiniela
let ADMIN_OVERRIDE = false; // el admin entró por el lápiz ✏️: puede editar aunque esté bloqueada
let PREVIEW_AS_PARTICIPANT = false; // el admin entró por 👁️ "Ver como participante" (vista idéntica, sin privilegios)
let AUTOSAVE_TIMER = null;
// v1.9 — BUG REPORTADO: la pantalla "parpadeaba" (re-render completo) en
// CADA autoguardado mientras se escribía en un formulario -- incluso
// editando como admin. Causa: onParticipantesChange() (más abajo) solo
// se protegía con "if(DRAFT_PID && WIZ_DIRTY) return", pero flushAutosave()
// pone WIZ_DIRTY=false ANTES de que Firestore confirme la escritura -- así
// que el eco de nuestro propio guardado (onSnapshot se dispara solo, casi
// al instante, con la escritura optimista local) llegaba con WIZ_DIRTY ya
// en false y disparaba render() igual, reemplazando todo #rg-content por
// nodos nuevos (de ahí el parpadeo/pérdida de foco en el input). Mismo
// bug de fondo que _lastPushedStateJSON ya resolvió para quiniela/estado
// (ver app-live-sync.js) -- acá basta con comparar fechaActualizacion
// (se pisa en CADA flushAutosave, cubre predicciones Y datos personales
// en un solo marcador) en vez de stringificar todo el documento.
let _lastPushedFechaActualizacion = null;
let INICIO_VIEW = 'choice'; // 'choice' | 'crear' | 'login' — sub-pantalla de la pestaña Inicio
let PREFILL_EMAIL = '';     // correo (o nombre) pre-llenado al ofrecer "¿deseas verla?" desde un duplicado
let ADMIN_SEARCH = '';      // texto del buscador administrativo (persiste entre refrescos de la tabla)
let ADMIN_FILTER = 'all';   // 'all' | 'completas' | 'incompletas' — filtro rápido (Fase 7)
let SHOW_PAPELERA = false;  // v6.1 — si la sección de Papelera está expandida o no
let DASH_TAB = 'perfil';    // v6.3 — sub-pestaña activa del Dashboard del participante (post-bloqueo)
let DASH_PRED_SUBTAB = 'grupos'; // v6.6 — sub-pestaña activa DENTRO de "Predicciones" (grupos/elim/avanzado)
let DASH_COMPARE_RIVAL = ''; // v3.5 — id del participante elegido en "⚖️ Comparar" (vacío = nadie elegido todavía)

function clearDraft(){
  DRAFT_PID = null;
  DRAFT_PREDS = {};
  DRAFT_PERSONAL = {};
  WIZ_STEP = 0;
  WIZ_DIRTY = false;
  INICIO_DIRTY = false;
  ADMIN_OVERRIDE = false;
  PREVIEW_AS_PARTICIPANT = false;
  INICIO_VIEW = 'choice';
  DASH_TAB = 'perfil';
  DASH_PRED_SUBTAB = 'grupos';
  clearTimeout(AUTOSAVE_TIMER);
}

// v6.6.1 — Admin ya no es una sub-pestaña adentro de Mi Quiniela: esto se
// llama desde la tabla de participantes (✏️ editar / 👁️ ver como
// participante) para sacar al admin de la pestaña Admin y llevarlo a la
// pestaña principal "Mi Quiniela", donde se ve el dashboard/wizard del
// participante elegido. tab('registro') ya se encarga de mostrar el div
// correcto Y de llamar a render().
function switchToInicioTab(){
  if(typeof tab==='function') tab('registro');
  else render();
}

// ---- Autoguardado (debounce) ----
// Cada cambio agenda un guardado a los ~700ms de inactividad. Al cambiar de
// paso o de pestaña se fuerza un guardado inmediato (flush). Mientras el
// guardado esté pendiente, WIZ_DIRTY queda en true y eso es lo que activa
// la advertencia al salir.
function scheduleAutosave(delay){
  WIZ_DIRTY = true;
  updateSaveIndicator('Editando…');
  clearTimeout(AUTOSAVE_TIMER);
  AUTOSAVE_TIMER = setTimeout(flushAutosave, delay||700);
}
function flushAutosave(){
  clearTimeout(AUTOSAVE_TIMER);
  if(!DRAFT_PID) return;
  const p = DB.participants.find(x=>x.id===DRAFT_PID);
  if(!p) return;
  ['name','city','country','countryIso','email'].forEach(f=>{
    if(DRAFT_PERSONAL[f] !== undefined) p[f] = DRAFT_PERSONAL[f];
  });
  const cleaned = {};
  Object.keys(DRAFT_PREDS).forEach(key=>{
    const v = DRAFT_PREDS[key];
    if(key === 'special'){ if(v && typeof v === 'object') cleaned.special = {...v}; return; }
    if(typeof v === 'string'){ cleaned[key] = v; return; }
    if(v && typeof v === 'object'){
      const obj = {};
      if(Number.isInteger(v.h)) obj.h = v.h;
      if(Number.isInteger(v.a)) obj.a = v.a;
      if(v.pick) obj.pick = v.pick;
      if(v._a) obj._a = v._a;
      if(v._b) obj._b = v._b;
      // v3.1.3 — BUG REPORTADO (desde los inicios): esta reconstrucción no
      // conservaba _migrated -- la marca que usa computeBracket() para
      // confiar en la huella _a/_b de una predicción migrada del sistema
      // viejo en vez de exigir que coincida con el sembrado "oficial"
      // recalculado de los grupos (ver resolveKoMatch/computeBracket más
      // arriba). Apenas corría UN autoguardado (con solo abrir "Editar" y
      // cambiar de paso alcanzaba), _migrated desaparecía de las 32
      // llaves de eliminatoria de un participante migrado -- y como su
      // cruce migrado casi nunca coincide con el sembrado oficial (se
      // cargó a mano, libremente, en el sistema anterior), TODOS los
      // ganadores de esa fase en adelante dejaban de resolverse (null en
      // cascada r32→r16→qf→sf→third→final), aunque el marcador y los
      // equipos (_a/_b) seguían ahí intactos. De ahí "se ven vacíos" al
      // editar y el % de avance bajando después de guardar.
      if(v._migrated) obj._migrated = v._migrated;
      if(Object.keys(obj).length) cleaned[key] = obj;
    }
  });
  // v1.9 — BUG REPORTADO: el admin editaba las llaves de un participante
  // (ya "enviada", vía ADMIN_OVERRIDE) y cambiaba el campeón resultante,
  // pero la bandera/avatar seguían mostrando el país viejo en Ranking/
  // Batallas/Estadísticas. Causa: campeon/subcampeon/tercer solo se
  // "quemaban" en preds.special UNA vez, al enviar por primera vez (ver
  // el paso 'review' más abajo) -- getDynamicSpec() (scoring.js), y por lo
  // tanto flagOfChampion()/avatarOfChampion() (app-core-data.js), leen
  // ese valor congelado, no el bracket en vivo. Fix: recalcularlos acá,
  // en CADA autoguardado (no solo al enviar), así preds.special.campeon
  // nunca queda desactualizado sin importar cuándo ni quién edite las
  // llaves. computeAutoSpecial() ya devuelve "" para los 3 campos si el
  // bracket todavía no está completo (bracket.ready===false), así que
  // esto no inventa un campeón antes de tiempo.
  const autoSpDraft = computeAutoSpecial(computeBracket(cleaned));
  cleaned.special = {...(cleaned.special||{}), ...autoSpDraft};
  DB.predictions[DRAFT_PID] = cleaned;
  DRAFT_PREDS = JSON.parse(JSON.stringify(cleaned));
  p.lastStep = WIZ_STEP;
  p.fechaActualizacion = Date.now();
  _lastPushedFechaActualizacion = p.fechaActualizacion; // ver nota junto a la declaración, arriba
  saveData(DB);
  WIZ_DIRTY = false;
  updateSaveIndicator('Guardado ✓');
}
function updateSaveIndicator(text){
  const el = document.getElementById('wiz_save_indicator');
  if(el) el.textContent = text;
}

// ---- Modal de "cambios sin guardar" (para navegación dentro de la app) ----
// Para cerrar/recargar la pestaña del navegador, los navegadores modernos
// no permiten texto ni botones personalizados — solo su aviso genérico
// (ver listener de beforeunload más abajo). Este modal sí es 100% custom,
// pero solo aplica al cambiar de tab dentro de esta misma app.
let EXIT_MODAL_CALLBACK = null;
function showExitModal(onLeave){
  EXIT_MODAL_CALLBACK = onLeave;
  document.getElementById('exitModal').style.display = 'flex';
}
function hideExitModal(){
  document.getElementById('exitModal').style.display = 'none';
  EXIT_MODAL_CALLBACK = null;
}
document.getElementById('em_continue').addEventListener('click', hideExitModal);
document.getElementById('em_save_exit').addEventListener('click', ()=>{
  flushAutosave();
  const cb = EXIT_MODAL_CALLBACK;
  hideExitModal();
  if(cb) cb();
});
document.getElementById('em_discard').addEventListener('click', ()=>{
  clearTimeout(AUTOSAVE_TIMER);
  DRAFT_PREDS = JSON.parse(JSON.stringify(DB.predictions[DRAFT_PID] || {}));
  DRAFT_PERSONAL = {};
  WIZ_DIRTY = false;
  const cb = EXIT_MODAL_CALLBACK;
  hideExitModal();
  if(cb) cb();
});

// ---- Modal de "te faltan resultados" (bloqueo de avance entre pasos) ----
let BLOCK_MODAL_TARGET_IDX = null;
function showBlockModal(blockers){
  const text = 'Para avanzar necesitas completar primero:<br><br>' +
    blockers.map(b=>`• <b>${esc(b.label)}</b> — ${esc(b.detail)}`).join('<br>');
  document.getElementById('blockModalText').innerHTML = text;
  BLOCK_MODAL_TARGET_IDX = blockers.length ? blockers[0].idx : null;
  document.getElementById('blockModal').style.display = 'flex';
}
document.getElementById('block_ok').addEventListener('click', ()=>{
  document.getElementById('blockModal').style.display = 'none';
});
document.getElementById('block_goto').addEventListener('click', ()=>{
  document.getElementById('blockModal').style.display = 'none';
  if(BLOCK_MODAL_TARGET_IDX!==null) jumpToStepUnchecked(BLOCK_MODAL_TARGET_IDX);
});

// v0.9 (Fase 7) — "Ir al pendiente": salta directo a un paso SIN pasar por
// el bloqueo de avance (tiene sentido: por construcción, el paso al que
// salta es justo el primero que está incompleto, así que todos los pasos
// anteriores a él ya están completos). Además resalta brevemente la
// primera fila sin resultado para que sea fácil encontrarla.
function jumpToStepUnchecked(idx){
  WIZ_STEP = idx;
  flushAutosave();
  render();
  setTimeout(highlightFirstPendingRow, 30);
}
function highlightFirstPendingRow(){
  const c = document.getElementById('rg-content');
  if(!c) return;
  // Primer marcador vacío (grupos o eliminatoria) o, si no hay, el primer
  // <select>/input especial vacío.
  let target = [...c.querySelectorAll('.score-input')].find(inp=> inp.value==='');
  if(!target) target = [...c.querySelectorAll('.special-input')].find(inp=> !inp.value);
  if(!target) return;
  const row = target.closest('.match-row') || target.closest('.field') || target;
  row.scrollIntoView({behavior:'smooth', block:'center'});
  row.classList.add('pending-flash');
  setTimeout(()=> row.classList.remove('pending-flash'), 1800);
}

window.addEventListener('beforeunload', e=>{
  if(DRAFT_PID && WIZ_DIRTY){
    e.preventDefault();
    e.returnValue = '';
  }
});

// v6.6.1 — El listener de '#rg-tabs' (Inicio/Admin) se quitó: ese sub-nav
// ya no existe, Admin ahora es una pestaña principal independiente (ver
// switchToInicioTab() y renderAdminTab() más abajo).

function render(){
  renderInicio();
}

// v6.6.1 — Antes esta lógica vivía adentro de render() (cuando
// CURRENT_TAB==='admin'). Ahora Admin es su propia pestaña principal
// (#t-admin/#admin-content), así que tab('admin') en app.js llama
// directamente a esta función en vez de a render().
function renderAdminTab(){
  // v6.0 — Antes el panel Admin de este prototipo no tenía autenticación
  // real ("sin autenticación (prototipo)"). Ahora reusamos el mismo
  // Firebase Auth + isAdmin() que ya protege el resto de la app principal.
  if(!isAdmin()){
    const c = document.getElementById('admin-content');
    if(c) c.innerHTML = `
      <div class="card center" style="padding:2rem 1rem">
        <div style="font-size:32px;margin-bottom:.5rem">🔒</div>
        <div class="card-title" style="justify-content:center">Acceso restringido</div>
        <div class="muted" style="margin-bottom:1rem">Esta sección es solo para el administrador de la quiniela.</div>
        <button class="rg-btn rg-btn-primary" onclick="openLoginModal()">🔑 Entrar como admin</button>
      </div>`;
    return;
  }
  renderAdmin();
}

/* ════════════════════════════════════════
   TAB: INICIO — v0.4 (Fase 2)
   Pantalla de entrada única. Si DB.configGlobal.modoConsultaHabilitado
   está activo, primero pregunta "¿Ya tienes una quiniela registrada?"
   (Ver mi quiniela / Crear nueva quiniela). Si está desactivado, entra
   directo al flujo de creación (sin pantalla de elección).
   ════════════════════════════════════════ */
// v6.5 — Defensa adicional: si CUALQUIER cosa dentro de renderInicio()
// lanza una excepción (datos inconsistentes, un elemento que no existe
// todavía, lo que sea), antes la pantalla se quedaba completamente en
// blanco y sin ningún rastro visible — el usuario veía los tabs pero
// "Mi Quiniela" mostraba un vacío total, sin pista de qué pasó. Ahora
// cualquier error queda atrapado, se muestra en consola para diagnóstico,
// y en pantalla aparece un mensaje claro con un botón para reintentar en
// vez de dejar el contenedor vacío.
function renderInicio(){
  try{
    renderInicioInner();
  }catch(err){
    console.error("Error al renderizar Mi Quiniela (renderInicio):", err);
    const c = document.getElementById('rg-content');
    if(c){
      c.innerHTML = `
        <div class="card center" style="padding:1.75rem 1rem">
          <div style="font-size:32px;margin-bottom:.5rem">⚠️</div>
          <div class="card-title" style="justify-content:center">Hubo un problema al cargar esta sección</div>
          <div class="muted" style="margin-bottom:1.1rem;font-size:13px">Intenta de nuevo. Si el problema sigue, avísale al admin con este detalle: <code style="word-break:break-all">${esc(String(err&&err.message||err))}</code></div>
          <button class="rg-btn rg-btn-primary rg-btn-block" id="ini_err_retry">🔄 Reintentar</button>
        </div>`;
      document.getElementById('ini_err_retry')?.addEventListener('click', ()=>{ render(); });
    }
  }
}
function renderInicioInner(){
  const c = document.getElementById('rg-content');
  if(DRAFT_PID){
    // v6.3 — Si la quiniela ya está bloqueada (enviada, o cerrado el plazo
    // global) y no es el admin editando por override (✏️), el participante
    // ya no aterriza en el wizard: entra directo al Dashboard post-bloqueo.
    // El admin en modo "Ver como participante" (👁️) también cae acá, porque
    // es exactamente lo que vería el participante real.
    const pDraft = DB.participants.find(x=>x.id===DRAFT_PID);
    if(pDraft && isLocked(pDraft) && !ADMIN_OVERRIDE){ renderParticipantDashboard(DRAFT_PID); return; }
    renderQuinielaForm(DRAFT_PID, 'inicio');
    return;
  }
  if(!DB.configGlobal.modoConsultaHabilitado){
    renderCrear(c);
    return;
  }
  if(INICIO_VIEW==='crear'){ renderCrear(c); return; }
  if(INICIO_VIEW==='login'){ renderLogin(c); return; }

  c.innerHTML = `
    <div class="card center" style="padding:1.75rem 1rem">
      <div style="font-size:38px;margin-bottom:.5rem">🍺</div>
      <div class="card-title" style="justify-content:center">Bienvenido a Quinielita Borracha</div>
      <div class="muted" style="margin-bottom:1.1rem;font-size:13px">Demuestra que sabes de fútbol.<br>O al menos que adivinas mejor que tus amigos.</div>
      <div class="rg-btn-row" style="flex-direction:column">
        <button class="rg-btn rg-btn-gold rg-btn-block" id="ini_ver">🔑 Ver mi quiniela</button>
        <button class="rg-btn rg-btn-ghost rg-btn-block" id="ini_crear">📝 Crear nueva quiniela</button>
      </div>
    </div>
  `;
  document.getElementById('ini_ver').addEventListener('click', ()=>{ INICIO_VIEW='login'; render(); });
  document.getElementById('ini_crear').addEventListener('click', ()=>{ INICIO_VIEW='crear'; render(); });
}

/* ---- Sub-vista: Crear nueva quiniela (antes pestaña "Registrarme") ---- */
function renderCrear(c){
  // v3.2.2 — este render reconstruye el formulario desde cero (nada
  // tecleado todavía sobrevive de todos modos), así que es el punto
  // correcto para bajar la bandera -- el guard de onParticipantesChange()
  // solo debe frenar un re-render mientras haya tecleo sin proteger.
  INICIO_DIRTY = false;
  const volverBtn = DB.configGlobal.modoConsultaHabilitado
    ? `<button class="rg-btn rg-btn-ghost" id="crear_back" style="margin-bottom:.75rem">← Volver</button>` : '';

  if(!DB.configGlobal.registroAbierto){
    c.innerHTML = `
      ${volverBtn}
      <div class="card">
        <div class="card-title">🔒 Registro cerrado</div>
        <div class="note" style="border-color:var(--qb-yellow);color:var(--qb-yellow)">El administrador cerró el registro de nuevas quinielas. Si ya te registraste antes, usa <b>Ver mi quiniela</b> para acceder con tu correo y tu Clave.</div>
      </div>
    `;
    document.getElementById('crear_back')?.addEventListener('click', ()=>{ INICIO_VIEW='choice'; render(); });
    return;
  }

  const prefill = PREFILL_EMAIL; PREFILL_EMAIL = '';
  c.innerHTML = `
    ${volverBtn}
    <div class="note">Este formulario crea un nuevo participante y de una vez te lleva a llenar tu quiniela. Si ya te registraste antes, usa <b>Ver mi quiniela</b>.</div>
    <div class="card">
      <div class="card-title">📝 Datos del participante</div>
      <div class="row2">
        <div class="field">
          <label>Nombre *</label>
          <input id="r_nombre" type="text" placeholder="Ej. Juan" autocomplete="off">
        </div>
        <div class="field">
          <label>Apellido *</label>
          <input id="r_apellido" type="text" placeholder="Ej. Pérez" autocomplete="off">
        </div>
      </div>
      ${buildCountryCityFieldsHtml('r', '', '', '')}
      <div class="row2">
        <div class="field">
          <label>Correo electrónico *</label>
          <input id="r_email" type="email" placeholder="correo@ejemplo.com" autocomplete="off" value="${esc(prefill)}">
        </div>
        <div class="field">
          <label>Confirmar correo *</label>
          <input id="r_email2" type="email" placeholder="correo@ejemplo.com" autocomplete="off">
        </div>
      </div>
      <div class="field-hint" style="margin:-6px 0 10px">Escribe el mismo correo en ambos campos; lo usaremos para identificarte.</div>
      <div class="row2">
        <div class="field">
          <label>Clave (6 dígitos) *</label>
          <input id="r_clave" type="password" inputmode="numeric" maxlength="6" placeholder="123456">
        </div>
        <div class="field">
          <label>Confirmar Clave *</label>
          <input id="r_clave2" type="password" inputmode="numeric" maxlength="6" placeholder="123456">
        </div>
      </div>
      <div class="field-hint" style="margin-top:-6px">La Clave te identifica para editar tu quiniela después. Guárdala, nadie más la verá.</div>
      <div id="r_err" class="err" style="display:none"></div>
      <div class="rg-btn-row">
        <button class="rg-btn rg-btn-primary rg-btn-block" id="r_submit">Crear mi quiniela</button>
      </div>
    </div>
  `;
  document.getElementById('crear_back')?.addEventListener('click', ()=>{ INICIO_DIRTY=false; INICIO_VIEW='choice'; render(); });
  // v3.2.2 — marca INICIO_DIRTY apenas la persona escribe algo, para que
  // onParticipantesChange() (más abajo) sepa que no debe reconstruir
  // este formulario bajo sus pies mientras tanto (ver la nota junto a
  // la declaración de INICIO_DIRTY).
  ['r_nombre','r_apellido','r_email','r_email2','r_clave','r_clave2'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input', ()=>{ INICIO_DIRTY = true; });
  });
  wireCountryCityFields('r', ()=>{ INICIO_DIRTY = true; });
  document.getElementById('r_submit').addEventListener('click', onCrearSubmit);
}

function onCrearSubmit(){
  const nombre = document.getElementById('r_nombre').value;
  const apellido = document.getElementById('r_apellido').value;
  const name = `${nombre.trim()} ${apellido.trim()}`.trim();
  const city = document.getElementById('r_city').value;
  const country = document.getElementById('r_country').value;
  const countryIso = document.getElementById('r_country_iso').value;
  const email = document.getElementById('r_email').value.trim();
  const email2 = document.getElementById('r_email2').value.trim();
  const clave = document.getElementById('r_clave').value.trim();
  const clave2 = document.getElementById('r_clave2').value.trim();
  const errEl = document.getElementById('r_err');
  const fail = (msg)=>{ errEl.textContent = msg; errEl.style.display='block'; };
  errEl.style.display='none';

  if(!nombre.trim()) return fail('El nombre es obligatorio.');
  if(!apellido.trim()) return fail('El apellido es obligatorio.');
  // v1.0 — El país debe elegirse de la lista (no texto libre), para que
  // el código ISO (y por lo tanto la bandera y las estadísticas futuras)
  // sean siempre datos limpios y consistentes.
  if(!country.trim()) return fail('El país es obligatorio.');
  if(!countryIso) return fail('Elige tu país de la lista que aparece al escribir (no quedó seleccionado).');
  if(!city.trim()) return fail('La ciudad es obligatoria.');
  if(!email) return fail('El correo electrónico es obligatorio.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('El correo electrónico no parece válido.');
  if(!email2) return fail('Debes confirmar tu correo electrónico.');
  if(email.toLowerCase() !== email2.toLowerCase()) return fail('Los dos correos electrónicos no coinciden.');
  if(!/^\d{6}$/.test(clave)) return fail('La Clave debe ser de exactamente 6 dígitos.');
  if(clave !== clave2) return fail('La Clave y su confirmación no coinciden.');

  // Identidad por correo (único) — pero desde la Fase 7 el nombre completo
  // también sirve para entrar ("login por nombre o correo"), así que el
  // nombre completo también debe ser único para que no quede ambiguo a
  // quién pertenece. Antes esto no se exigía porque solo se entraba por
  // correo (ej. los dos "Miguel" del proyecto real tienen apellidos
  // distintos, así que esto no les afecta).
  if(findByEmail(email)){
    errEl.innerHTML = 'Este correo ya tiene una quiniela registrada. ' +
      '<button type="button" class="rg-btn rg-btn-ghost" id="dup_ver_btn" style="margin-left:6px;padding:5px 11px;font-size:11px;vertical-align:middle">¿Deseas verla?</button>';
    errEl.style.display='block';
    document.getElementById('dup_ver_btn').addEventListener('click', ()=>{
      PREFILL_EMAIL = email;
      INICIO_VIEW = 'login';
      render();
    });
    return;
  }
  if(findByName(name)){
    errEl.innerHTML = 'Ya existe un participante registrado con ese nombre completo exacto. ' +
      '<button type="button" class="rg-btn rg-btn-ghost" id="dup_ver_btn2" style="margin-left:6px;padding:5px 11px;font-size:11px;vertical-align:middle">¿Deseas verla?</button> ' +
      'Si son dos personas distintas, agrega una inicial o el segundo apellido para diferenciarlos.';
    errEl.style.display='block';
    document.getElementById('dup_ver_btn2').addEventListener('click', ()=>{
      PREFILL_EMAIL = name;
      INICIO_VIEW = 'login';
      render();
    });
    return;
  }

  // v6.4 — Cada participante necesita un "dueño" (ownerUid = su sesión
  // actual de Firebase Auth Anónima) para que las reglas de Firestore
  // sepan que ESTE dispositivo puede escribir este documento de aquí en
  // adelante. wireFirebaseAuth() (en app.js) garantiza que SIEMPRE haya
  // alguna sesión activa (anónima como mínimo) antes de que el resto de
  // la app pueda interactuar, así que en la práctica este caso de "no
  // hay sesión todavía" solo pasaría si alguien logra hacer clic en
  // "Crear" en la fracción de segundo entre que carga la página y que
  // signInAnonymously() resuelve — por eso el mensaje pide reintentar en
  // vez de fallar en silencio o crear un participante "huérfano" sin
  // dueño (que las reglas de Firestore rechazarían de inmediato).
  const ownerUid = window.__fb && window.__fb.auth && window.__fb.auth.currentUser
    ? window.__fb.auth.currentUser.uid : null;
  if(!ownerUid) return fail('Todavía estamos preparando tu sesión — espera un segundo y vuelve a intentar.');

  const now = Date.now();
  const p = {
    id: uid(),
    codigo: nextCode(),
    name: name.trim(), city: city.trim(), country: country.trim(), countryIso,
    email: email,
    clave, ownerUid,
    estadoQuiniela: 'borrador',
    // v1.1 — Arranca directo en "Fase de grupos" (o, si está desactivada,
    // en la primera fase activa del torneo — v1.2): los datos personales
    // ya se llenaron arriba mismo, en este formulario, así que repetirlos
    // como primer paso del wizard es redundante. El paso "personal" sigue
    // existiendo (ver buildStepperHtml / botón "✏️ Editar mis datos" en
    // Revisión final) por si alguien necesita corregir algo después.
    lastStep: visibleStepIndices()[0] ?? WIZARD_STEPS.findIndex(s=>s.key==='groups'),
    fechaCreacion: now, fechaActualizacion: now, fechaEnvio: null
  };

  // v7.5 — BUG REPORTADO: antes esto era "optimista" -- se pusheaba a
  // DB.participants y se mostraba "¡Listo!" ANTES de saber si Firestore
  // realmente aceptó la escritura (rgCreateParticipantConfirmed, en
  // participantes.js, explica la causa raíz completa). Si el servidor
  // la rechazaba (ej. reglas de seguridad desactualizadas en Firebase
  // Console), la persona entraba tranquila al wizard, llenaba su
  // quiniela... y todo eso vivía SOLO en este dispositivo: nunca
  // llegaba a Firestore, así que jamás aparecía en el panel Admin, y al
  // volver a entrar (o con el próximo snapshot real) su registro había
  // desaparecido sin aviso -- tocaba escribir el correo de nuevo desde
  // cero. Ahora se espera la confirmación real del servidor antes de
  // decir "¡Listo!" y antes de dejar entrar al wizard; el botón se
  // deshabilita mientras tanto para evitar un doble registro si alguien
  // hace doble clic durante esa breve espera de red.
  const btnSubmit = document.getElementById('r_submit');
  const btnTextoOriginal = btnSubmit ? btnSubmit.textContent : '';
  if(btnSubmit){ btnSubmit.disabled = true; btnSubmit.textContent = 'Creando...'; }
  errEl.style.display = 'none';

  rgCreateParticipantConfirmed(p).then(()=>{
    DB.participants.push(p);
    DB.predictions[p.id] = {};
    // El batch ya se confirmó en el servidor (rgCreateParticipantConfirmed
    // ya actualizó las cachés de "último JSON conocido"); saveData()
    // acá solo hace falta para persistir nextSeq en registro/meta (el
    // código que ya cobró arriba con nextCode()) y la copia local.
    saveData(DB);
    toast(`¡Listo! Tu código es ${p.codigo}. Ahora llena tu quiniela.`);
    enterWizardAs(p);
    render();
  }).catch(err=>{
    console.error("Error al crear participante:", err);
    if(btnSubmit){ btnSubmit.disabled = false; btnSubmit.textContent = btnTextoOriginal; }
    if(err && err.code === 'permission-denied'){
      fail('No se pudo completar tu registro: el servidor lo rechazó (permiso denegado). Esto es un problema de configuración nuestro, no tuyo -- avísale a quien administra la quiniela y probá de nuevo en un momento.');
    }else{
      fail('No se pudo completar tu registro (' + (err && err.message ? err.message : 'error desconocido') + '). Revisá tu conexión y volvé a intentar.');
    }
  });
}

/* ---- Sub-vista: Ver mi quiniela (login por correo + Clave) ----
   Reemplaza la antigua búsqueda por nombre+PIN. Si la quiniela está en
   estado "enviada", entra de una vez al paso de Revisión (resumen
   completo de solo lectura + botón de PDF). Si sigue en "borrador",
   continúa el wizard exactamente en el paso donde quedó (p.lastStep). */
// v1.0 — Centraliza el "entrar al wizard como X", reutilizado por los
// distintos puntos de entrada del login (antes estaba duplicado).
function enterWizardAs(p, opts){
  opts = opts || {};
  DRAFT_PID = p.id;
  DRAFT_PREDS = JSON.parse(JSON.stringify(DB.predictions[p.id] || {}));
  DRAFT_PERSONAL = {};
  // v1.0 — isLocked(p) ya combina "enviada" Y "cerrado por fecha límite":
  // en cualquiera de los dos casos conviene aterrizar en Revisión (el
  // resumen completo + el botón de PDF), no a mitad del wizard.
  WIZ_STEP = (opts.override || !isLocked(p))
    ? nearestVisibleStepIdx(Math.min(p.lastStep||0, WIZARD_STEPS.length-1))
    : WIZARD_STEPS.length-1;
  ADMIN_OVERRIDE = !!opts.override;
  PREVIEW_AS_PARTICIPANT = !!opts.preview;
  WIZ_DIRTY = false;
}

function renderLogin(c){
  // v3.2.2 — ver la nota junto a INICIO_DIRTY: este render reconstruye
  // el formulario desde cero, es el punto correcto para bajar la bandera.
  INICIO_DIRTY = false;
  const volverBtn = DB.configGlobal.modoConsultaHabilitado
    ? `<button class="rg-btn rg-btn-ghost" id="login_back" style="margin-bottom:.75rem">← Volver</button>` : '';
  const prefill = PREFILL_EMAIL; PREFILL_EMAIL = '';
  // v1.0 — El ingreso por nombre (switch de admin) permite entrar sin
  // correo registrado. Con el switch apagado, el campo de nombre
  // desaparece del login por completo.
  const porNombre = DB.configGlobal.loginPorNombreHabilitado;
  const fieldLabel = porNombre ? 'Usuario o correo electrónico' : 'Correo electrónico';
  const fieldPlaceholder = porNombre ? 'Tu nombre completo o tu correo' : 'Con el que te registraste';

  c.innerHTML = `
    ${volverBtn}
    <div class="card">
      <div class="card-title">🔑 Ver mi quiniela</div>
      <div class="field">
        <label>${esc(fieldLabel)}</label>
        <input id="e_user" type="text" placeholder="${esc(fieldPlaceholder)}" autocomplete="off" value="${esc(prefill)}">
      </div>
      <div class="field">
        <label>Clave</label>
        <input id="e_clave" type="password" inputmode="numeric" maxlength="6" placeholder="123456">
      </div>
      <div id="e_err" class="err" style="display:none"></div>
      <div class="rg-btn-row">
        <button class="rg-btn rg-btn-primary rg-btn-block" id="e_submit">Entrar</button>
      </div>
    </div>
  `;
  document.getElementById('login_back')?.addEventListener('click', ()=>{ INICIO_DIRTY=false; INICIO_VIEW='choice'; render(); });
  ['e_user','e_clave'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input', ()=>{ INICIO_DIRTY = true; });
  });
  document.getElementById('e_submit').addEventListener('click', ()=>{
    const usuario = document.getElementById('e_user').value.trim();
    const clave = document.getElementById('e_clave').value.trim();
    const errEl = document.getElementById('e_err');
    const btn = document.getElementById('e_submit');
    const p = porNombre ? (findByEmail(usuario) || findByName(usuario)) : findByEmail(usuario);
    // v6.9 — Fase de Privacidad: ya NO podemos comparar p.clave!==clave
    // acá (la clave de OTRO participante ya no vive en memoria de este
    // navegador — ver registro_privado). La verificación real ahora la
    // hace Firestore al intentar el re-claim más abajo: si la clave
    // escrita no coincide con la guardada, esa escritura es rechazada y
    // mostramos el mismo mensaje de error que antes.
    if(!p || !clave){
      errEl.textContent = 'Usuario o Clave incorrectos.';
      errEl.style.display='block';
      return;
    }
    errEl.style.display='none';

    // v6.4 — Si esta persona ya está entrando desde el MISMO dispositivo
    // donde creó/editó su quiniela por última vez (lo normal, la inmensa
    // mayoría de las veces), su sesión anónima actual ya coincide con
    // p.ownerUid: no hace falta tocar Firestore para nada, ni siquiera
    // para verificar la clave (igual que tryAutoLoginByOwnerUid(), que
    // ya hace exactamente esto sin pedir clave en absoluto -- el UID
    // anónimo del propio dispositivo YA es la prueba de identidad en
    // ese caso).
    //
    // Si entra desde un dispositivo NUEVO (otro navegador, celular
    // distinto, borró cookies...), su sesión anónima actual es distinta
    // a la que quedó guardada como dueña — recién ahí la clave importa
    // de verdad, y se verifica intentando el re-claim (rgClaimOwnership):
    // Firestore acepta o rechaza la escritura según si la clave escrita
    // coincide con la guardada, sin que este navegador necesite leerla
    // primero.
    const currentUid = window.__fb && window.__fb.auth && window.__fb.auth.currentUser
      ? window.__fb.auth.currentUser.uid : null;

    const continuar = ()=>{
      enterWizardAs(p);
      render();
    };

    if(!currentUid){
      errEl.textContent = 'Todavía estamos preparando tu sesión — espera un segundo y vuelve a intentar.';
      errEl.style.display='block';
      return;
    }

    if(p.ownerUid === currentUid){
      btn.disabled = true; btn.textContent = 'Entrando...';
      rgHydrateOwnPrivado(p.id).finally(()=>{
        btn.disabled = false; btn.textContent = 'Entrar';
        continuar();
      });
      return;
    }

    btn.disabled = true; btn.textContent = 'Entrando...';
    rgClaimOwnership(p.id, currentUid, clave)
      .then(()=>{
        p.ownerUid = currentUid; // refleja el cambio de inmediato en memoria, sin esperar el eco de Firestore
        btn.disabled = false; btn.textContent = 'Entrar';
        continuar();
      })
      .catch((err)=>{
        btn.disabled = false; btn.textContent = 'Entrar';
        if(err && err.code === 'permission-denied'){
          errEl.textContent = 'Usuario o Clave incorrectos.';
        }else{
          errEl.textContent = 'No se pudo verificar tu acceso en este dispositivo. Revisa tu conexión e intenta de nuevo.';
        }
        errEl.style.display='block';
      });
  });
}

/* ════════════════════════════════════════
   FORMULARIO DE QUINIELA (compartido por Registro y Editar)
   ════════════════════════════════════════ */
/* ════════════════════════════════════════
   RENDER — bracket dinámico, preguntas especiales y estado de avance
   ════════════════════════════════════════ */

function renderKoRow(slot, teamA, teamB, preds, readOnly, trustSlot){
  if(!teamA || !teamB){
    return `<div class="match-row muted" style="opacity:.55">
        <div class="team"><span class="nm">${teamA?esc(teamA):'Pendiente'}</span></div>
        <span class="vs-sep">vs</span>
        <div class="team" style="justify-content:flex-end;text-align:right"><span class="nm">${teamB?esc(teamB):'Pendiente'}</span></div>
      </div>`;
  }
  const raw = preds[slot];
  // trustSlot: ver nota en koWinner() más arriba -- mismo criterio para
  // decidir si el marcador ya cargado sigue siendo válido para este slot.
  const v = trustSlot ? (raw||null) : ((raw && raw._a===teamA && raw._b===teamB) ? raw : null);
  const h = v && Number.isInteger(v.h) ? v.h : '';
  const a = v && Number.isInteger(v.a) ? v.a : '';
  const tied = v && Number.isInteger(v.h) && Number.isInteger(v.a) && v.h===v.a;
  const pick = v && v.pick;

  if(readOnly){
    const scoreTxt = (h!==''&&a!=='') ? `${h} : ${a}` : '— : —';
    const pickTxt = tied ? (pick ? `Avanza por penales: ${flagOf(pick)} ${esc(pick)}` : 'Empate sin definir quién avanza') : '';
    return `<div class="match-row">
        <div class="team"><span>${flagOf(teamA)}</span><span class="nm ro-text">${esc(teamA)}</span></div>
        <div class="ro-score">${scoreTxt}</div>
        <div class="team" style="justify-content:flex-end;text-align:right"><span class="nm ro-text">${esc(teamB)}</span><span>${flagOf(teamB)}</span></div>
      </div>${pickTxt?`<div class="field-hint" style="margin:-4px 0 8px">${pickTxt}</div>`:''}`;
  }

  let html = `<div class="match-row">
      <div class="team"><span>${flagOf(teamA)}</span><span class="nm">${esc(teamA)}</span></div>
      <input type="number" min="0" max="20" class="score-input" data-slot="${esc(slot)}" data-side="h" data-a="${esc(teamA)}" data-b="${esc(teamB)}" value="${h}">
      <span class="vs-sep">:</span>
      <input type="number" min="0" max="20" class="score-input" data-slot="${esc(slot)}" data-side="a" data-a="${esc(teamA)}" data-b="${esc(teamB)}" value="${a}">
      <div class="team" style="justify-content:flex-end;text-align:right"><span class="nm">${esc(teamB)}</span><span>${flagOf(teamB)}</span></div>
    </div>`;
  // v0.6 — el pick-row SIEMPRE se imprime en el DOM (oculto con display:none
  // si no hay empate). Así el listener de 'input' puede mostrarlo/ocultarlo
  // al instante con un simple toggle de estilo, sin re-renderizar todo el
  // paso (lo cual le haría perder el foco al campo que se está escribiendo).
  html += `<div class="pick-row" id="pickrow_${esc(slot)}" style="padding-top:0;display:${tied?'block':'none'}">
      <div class="pick-label">Empate — ¿quién avanza? (penales)</div>
      <div class="pick-btns">
        <button class="pick-btn ko-pick ${pick===teamA?'sel':''}" data-slot="${esc(slot)}" data-a="${esc(teamA)}" data-b="${esc(teamB)}" data-team="${esc(teamA)}">${flagOf(teamA)} ${esc(teamA)}</button>
        <button class="pick-btn ko-pick ${pick===teamB?'sel':''}" data-slot="${esc(slot)}" data-a="${esc(teamA)}" data-b="${esc(teamB)}" data-team="${esc(teamB)}">${flagOf(teamB)} ${esc(teamB)}</button>
      </div>
    </div>`;
  return html;
}

function groupRowHtml(m, preds, readOnly){
  const v = preds[m.id] || {};
  const h = (v.h===0||v.h>0) ? v.h : '';
  const a = (v.a===0||v.a>0) ? v.a : '';
  if(readOnly){
    const scoreTxt = (h!==''&&a!=='') ? `${h} : ${a}` : '— : —';
    return `<div class="match-row">
        <div class="team"><span>${flagOf(m.a)}</span><span class="nm ro-text">${esc(m.a)}</span></div>
        <div class="ro-score">${scoreTxt}</div>
        <div class="team" style="justify-content:flex-end;text-align:right"><span class="nm ro-text">${esc(m.b)}</span><span>${flagOf(m.b)}</span></div>
      </div>`;
  }
  return `<div class="match-row">
      <div class="team"><span>${flagOf(m.a)}</span><span class="nm">${esc(m.a)}</span></div>
      <input type="number" min="0" max="20" class="score-input" data-mid="${m.id}" data-side="h" value="${h}">
      <span class="vs-sep">:</span>
      <input type="number" min="0" max="20" class="score-input" data-mid="${m.id}" data-side="a" value="${a}">
      <div class="team" style="justify-content:flex-end;text-align:right"><span class="nm">${esc(m.b)}</span><span>${flagOf(m.b)}</span></div>
    </div>`;
}

/* ════════════════════════════════════════
   DASHBOARD DEL PARTICIPANTE (post-bloqueo) — v6.3, Fase 1
   Una vez que la quiniela queda bloqueada (enviada, o cerrado el plazo
   global — ver isLocked()), el participante ya no entra al wizard de
   edición: cae acá directo (ver el hook en renderInicio()). Reemplaza
   el viejo aterrizaje en el paso "Revisión final".

   4 sub-pestañas internas, mismo patrón visual .inner-tabs/.inner-tab
   que ya usan Predicciones/Estadísticas en el panel admin (app.js):
     - Mi Perfil      (Fase 1 — esta entrega)
     - Fase de Grupos (Fase 2 — pendiente)
     - Eliminatoria   (Fase 3 — pendiente)
     - Avanzado       (Fase 4 — pendiente; sin el bloque de resultados
                        reales que sí ve el admin en renderAdv())

   Reusa los cálculos de puntuación de app.js (calcPts/calcAdv/
   calcElimPts/calcBonos/getRank/sc/getRealElimTeams/elimPred) en vez de
   duplicarlos — son funciones globales porque app.js carga antes que
   este archivo (mismo patrón que ya se usa con toast()/isAdmin()).
   ════════════════════════════════════════ */
const DASH_TABS = [
  {key:'perfil',       label:'Mi Perfil',     icon:'👤'},
  {key:'predicciones', label:'Predicciones',  icon:'📝'},
  {key:'evolucion',    label:'Evolución',     icon:'📈'},
  {key:'comparar',     label:'Comparar',      icon:'⚖️'}, // v3.5
];

// v2.7.2 — Botón "Unirte al grupo de WhatsApp", compartido entre el
// Dashboard de Mi Quiniela (junto a "Quiero pelear") y el último paso
// del registro (junto a "Enviar mi Quiniela"). Una sola fuente de verdad
// para no dejar que las 2 versiones se desincronicen en estilo/texto.
// Vacío si no hay enlace configurado (Admin → Configuración) -- nunca
// muestra un botón roto.
function buildWhatsappBtnHtml(){
  const link = (DB.configGlobal.whatsappGroupLink||'').trim();
  if(!link) return '';
  return `<a class="rg-btn rg-btn-ghost" href="${esc(link)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;padding:6px 10px;text-decoration:none;display:inline-flex;align-items:center;gap:4px">💬 Unirte al grupo</a>`;
}

function renderParticipantDashboard(pid){
  const p = DB.participants.find(x=>x.id===pid);
  if(!p){ clearDraft(); render(); return; }
  const c = document.getElementById('rg-content');

  const previewBanner = PREVIEW_AS_PARTICIPANT
    ? `<div class="note" style="border-color:var(--qb-blue);color:var(--qb-blue);margin-bottom:.875rem">👁️ Vista previa de administrador — esto es exactamente lo que vería <b>${esc(p.name)}</b> al entrar con su correo y su Clave.</div>`
    : '';
  // v6.7 — Escape para dispositivos compartidos: el auto-reconocimiento
  // por ownerUid (ver tryAutoLoginByOwnerUid) hace que ya no haga falta
  // tipear correo+Clave en cada visita, pero eso solo tiene sentido si
  // hay una forma de decir "este dispositivo no es mío" para que otra
  // persona pueda entrar con SU correo+Clave. Solo se muestra en una
  // sesión real de participante (no en vista previa/edición de admin,
  // que ya tienen su propio botón "Volver" en la tabla de Admin).
  // v1.7 — "Quiero pelear 🥊": autopostulación a Batallas (Fase 1 del
  // roadmap de Batallas). Solo en una sesión real de participante (mismo
  // gate que switchAccountLink) -- no tiene sentido postular a alguien
  // desde una vista previa/edición de admin. Persiste en registro_privado
  // (quierePelear), visible solo para el dueño y el admin -- ver
  // _rgPrivadoFieldsOf en participantes.js.
  const postularBtn = (!PREVIEW_AS_PARTICIPANT && !ADMIN_OVERRIDE)
    ? `<button class="rg-btn ${p.quierePelear?'rg-btn-gold':'rg-btn-ghost'}" id="dash_postular_btn" style="font-size:11px;padding:6px 10px">${p.quierePelear?'🥊 Postulado · Bajarme':'🥊 Quiero pelear'}</button>`
    : '';
  const switchAccountLink = (!PREVIEW_AS_PARTICIPANT && !ADMIN_OVERRIDE)
    ? `<button class="rg-btn rg-btn-ghost" id="dash_logout_btn" style="font-size:11px;padding:6px 10px">🚪 No soy ${esc((p.name||'').split(' ')[0]||'yo')} · Salir</button>`
    : '';
  // v1.9 — Avatar de campeón siempre visible arriba a la izquierda de Mi
  // Quiniela (junto al nombre y al botón de postularse), no solo dentro de
  // la sub-pestaña Perfil -- se calcula acá directo del bracket de ESTE
  // participante (computeAutoSpecial/computeBracket, mismo criterio que ya
  // usa generarPDF() para la portada del PDF) en vez de depender de
  // PM[p.name] -- así nunca queda desactualizado por timing de sync con
  // Firestore. Sin avatar todavía para ese país, queda solo el nombre (sin
  // placeholder genérico), mismo criterio que en el resto de la app.
  const champValDash = computeAutoSpecial(computeBracket(DB.predictions[p.id]||{})).campeon;
  const champAvatarFileDash = (champValDash && typeof AVATAR_MAP!=='undefined') ? (AVATAR_MAP[champValDash]||'') : '';
  const dashIdentityHtml = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
         ${avatarImg(champAvatarFileDash, 62)}
         <span style="font-family:var(--ff-display);font-weight:800;font-size:16px;color:var(--qb-text)">${esc(p.name)}</span>
         ${postularBtn}
         ${buildWhatsappBtnHtml()}
       </div>`;
  const topActionsRow = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:.75rem;flex-wrap:wrap">
         ${dashIdentityHtml}
         <span>${switchAccountLink}</span>
       </div>`;

  const tabsHtml = DASH_TABS.map(t=>
    `<button class="inner-tab ${DASH_TAB===t.key?'on':''}" data-dtab="${t.key}">${t.icon} ${esc(t.label)}</button>`
  ).join('');

  // v1.5 — FIX: antes, si buildDashPerfilHtml/buildDashPrediccionesHtml/
  // buildDashEvolucionHtml lanzaban una excepción, el error solo quedaba
  // atrapado cuando se llegaba acá desde render()/renderInicio() (que sí
  // tiene try/catch, v6.5). Pero los clics en las sub-pestañas de ACÁ
  // ADENTRO (#dash-tabs/#dash-pred-subtabs, más abajo en esta misma
  // función) llaman a renderParticipantDashboard() directo, sin ninguna
  // red de seguridad — un error ahí rompía el render a mitad de camino
  // (pantalla corrupta) y además DASH_TAB quedaba apuntando para siempre
  // a la sub-pestaña rota (nunca se resetea al cambiar de pestaña
  // principal), así que CUALQUIER intento posterior de volver a "Mi
  // Quiniela" — inclusive por el camino que sí tiene try/catch — volvía
  // a pisar el mismo error una y otra vez. Único escape: refrescar toda
  // la página (lo único que reinicia DASH_TAB a 'perfil'). Ahora este
  // bloque atrapa cualquier error acá mismo, en el origen, Y resetea
  // DASH_TAB/DASH_PRED_SUBTAB a un estado seguro para que "Reintentar" (o
  // simplemente volver a entrar a Mi Quiniela) realmente recupere la
  // sección en vez de repetir el mismo choque en bucle.
  let bodyHtml;
  try{
    const activeLabel = (DASH_TABS.find(t=>t.key===DASH_TAB)||DASH_TABS[0]).label;
    bodyHtml = DASH_TAB==='perfil' ? buildDashPerfilHtml(p)
      : DASH_TAB==='predicciones' ? buildDashPrediccionesHtml(p)
      : DASH_TAB==='evolucion' ? buildDashEvolucionHtml(p) // v6.6 — Fase B
      : DASH_TAB==='comparar' ? buildDashCompararHtml(p) // v3.5
      : buildDashComingSoonHtml(activeLabel);
  }catch(err){
    console.error("Error al renderizar el Dashboard (pestaña "+DASH_TAB+"):", err);
    DASH_TAB = 'perfil';
    DASH_PRED_SUBTAB = 'grupos';
    bodyHtml = `
      <div class="card center" style="padding:1.75rem 1rem">
        <div style="font-size:32px;margin-bottom:.5rem">⚠️</div>
        <div class="card-title" style="justify-content:center">Hubo un problema al cargar esta sección</div>
        <div class="muted" style="margin-bottom:1.1rem;font-size:13px">Volvimos a Perfil. Si el problema sigue, avísale al admin con este detalle: <code style="word-break:break-all">${esc(String(err&&err.message||err))}</code></div>
        <button class="rg-btn rg-btn-primary rg-btn-block" id="dash_err_retry">🔄 Reintentar</button>
      </div>`;
  }

  c.innerHTML = `
    ${previewBanner}
    ${topActionsRow}
    <div class="inner-tabs" id="dash-tabs">${tabsHtml}</div>
    <div id="dash-content">${bodyHtml}</div>
  `;

  document.getElementById('dash-tabs').addEventListener('click', e=>{
    const b = e.target.closest('.inner-tab'); if(!b) return;
    DASH_TAB = b.dataset.dtab;
    renderParticipantDashboard(pid);
  });
  // v6.6 — sub-navegación interna de "Predicciones" (Fase de Grupos / Eliminatoria / Avanzado).
  // Mismo patrón que #dash-tabs: cada clic vuelve a pintar el dashboard completo.
  document.getElementById('dash-pred-subtabs')?.addEventListener('click', e=>{
    const b = e.target.closest('.inner-tab'); if(!b) return;
    DASH_PRED_SUBTAB = b.dataset.predsub;
    renderParticipantDashboard(pid);
  });
  // v3.5 — Comparador: elegir rival del dropdown vuelve a pintar el
  // dashboard completo, mismo patrón que los demás sub-tabs de acá arriba.
  document.getElementById('dash-cmp-select')?.addEventListener('change', e=>{
    DASH_COMPARE_RIVAL = e.target.value;
    renderParticipantDashboard(pid);
  });
  document.getElementById('dash_pdf_btn')?.addEventListener('click', ()=> generarPDF(p));
  document.getElementById('dash_err_retry')?.addEventListener('click', ()=> renderParticipantDashboard(pid));
  // v6.7 — "Salir" NO borra el ownerUid en Firestore (este dispositivo
  // sigue siendo el dueño reconocido), solo limpia la sesión EN MEMORIA
  // para esta carga de página — la próxima vez que alguien abra la app en
  // este mismo dispositivo, el auto-reconocimiento vuelve a entrar solo.
  // Es del estilo "cambiar de usuario", no "olvidar este dispositivo".
  document.getElementById('dash_logout_btn')?.addEventListener('click', ()=>{
    const doSalir = ()=>{ clearDraft(); render(); };
    if(DRAFT_PID && WIZ_DIRTY){ showExitModal(doSalir); return; }
    doSalir();
  });
  document.getElementById('dash_postular_btn')?.addEventListener('click', ()=>{
    p.quierePelear = !p.quierePelear;
    p.fechaActualizacion = Date.now();
    saveData(DB);
    toast(p.quierePelear ? '🥊 Te anotaste para Batallas — el admin ya te puede elegir' : 'Te bajaste de la lista de postulados');
    renderParticipantDashboard(pid);
  });
}

// ── Predicciones — agrupa Fase de Grupos / Eliminatoria / Avanzado bajo
// una sola pestaña del dashboard, con su propia sub-navegación (v6.6).
// Reusa las 3 funciones de build ya existentes, sin duplicar nada.
function buildDashPrediccionesHtml(p){
  const subtabsAll = [
    {key:'grupos',   label:'Fase de Grupos', icon:'⚽'},
    {key:'elim',     label:'Eliminatoria',   icon:'🏆'},
    {key:'avanzado', label:'Avanzado',       icon:'⭐'},
  ];
  // v1.2 — si Fase de Grupos está desactivada en este torneo, no existe
  // para el participante: ni la sub-pestaña, ni su contenido.
  const subtabs = subtabsAll.filter(t=>t.key!=='grupos' || isGruposActivaWizard());
  if(DASH_PRED_SUBTAB==='grupos' && !isGruposActivaWizard()) DASH_PRED_SUBTAB='elim';
  const tabsHtml = subtabs.map(t=>
    `<button class="inner-tab ${DASH_PRED_SUBTAB===t.key?'on':''}" data-predsub="${t.key}">${t.icon} ${esc(t.label)}</button>`
  ).join('');
  const body = DASH_PRED_SUBTAB==='elim' ? buildDashElimHtml(p)
    : DASH_PRED_SUBTAB==='avanzado' ? buildDashAvanzadoHtml(p)
    : buildDashGruposHtml(p);
  return `
    <div class="inner-tabs" id="dash-pred-subtabs" style="margin-bottom:.75rem">${tabsHtml}</div>
    <div id="dash-pred-subcontent">${body}</div>
  `;
}

// ── Copys divertidos de Mi Perfil — v6.6 ──
// Tono según posición en el ranking: top 25% ("bien"), último lugar
// exacto ("ultimo"), y todo lo demás en medio ("regular"). Si hay 2+
// frases por categoría, se elige una al azar en cada render para que no
// se sienta repetitivo. No se muestra nada si todavía no hay ranking
// (pos/outOf inválidos) — evita un mensaje sin sentido antes de que
// arranque el torneo.
const MORALE_COPYS = {
  bien: [
    { emoji:'🔥', html:'Tu quiniela está tan encendida<br>que ya le están haciendo antidoping.' },
    { emoji:'🔮', html:'Tu bola de cristal está funcionando.<br>No la actualices.' },
  ],
  regular: [
    { emoji:'🍻', html:'No vas ganando...<br>pero tampoco estás explicando que fue culpa del árbitro.' },
    { emoji:'🍻', html:'La remontada empieza con un acierto.<br>O con tres cervezas.' },
  ],
  ultimo: [
    { emoji:'🪦', html:'Las buenas noticias: todavía no te han eliminado.<br>Las malas: estás usando la tabla al revés.' },
    { emoji:'🤔', html:'Tu quiniela está explorando nuevas formas<br>de interpretar el fútbol.' },
  ],
};
function getMoraleTier(pos, outOf){
  if(!pos || !outOf || outOf<2) return null;
  if(pos===outOf) return 'ultimo';
  const topCut = Math.max(1, Math.round(outOf*0.25));
  return pos<=topCut ? 'bien' : 'regular';
}
function buildMoraleCardHtml(pos, outOf){
  const tier = getMoraleTier(pos, outOf);
  if(!tier) return '';
  const opts = MORALE_COPYS[tier];
  const pick = opts[Math.floor(Math.random()*opts.length)];
  return `
    <div class="card center" style="padding:1rem 1rem .9rem">
      <div style="font-size:26px;margin-bottom:.3rem">${pick.emoji}</div>
      <div style="font-size:13px;color:var(--qb-muted2);line-height:1.55;font-weight:600">${pick.html}</div>
    </div>`;
}

// ── Mi Perfil — estado, código, fecha, próximo partido, puntos y posición ──
function buildDashPerfilHtml(p){
  const st = getCompletionStatus(p.id);
  const pct = Math.round((st.totalDone/st.totalAll)*100);
  const missing = st.phases.filter(ph=>ph.done<ph.total).map(ph=>`${ph.label} (faltan ${ph.total-ph.done})`);

  const stats = getDashStatsInfo(p);
  const posTxt = stats.pos ? `#${stats.pos} de ${stats.outOf}` : '—';
  const moraleHtml = buildMoraleCardHtml(stats.pos, stats.outOf);

  const next = getNextPendingMatchInfo(p);
  const nextBody = next
    ? `<div class="status-row"><span>${next.live ? '🔴 En vivo ahora' : esc(fmtMatchTime(next.ts))}</span><span class="ro-text">${esc(next.lbl)}</span></div>
       <div class="status-row"><span>Tu predicción</span><span class="badge badge-muted">${esc(next.predStr)}</span></div>`
    : `<div class="muted" style="padding:.5rem 0">No quedan más partidos pendientes en el calendario.</div>`;

  return `
    ${moraleHtml}
    <div class="card">
      <div class="card-title">🏅 Tu quiniela <span class="badge badge-green">${stats.total} pts</span></div>
      <div class="status-row"><span>Posición en el ranking</span><span class="ro-text">${esc(posTxt)}</span></div>
      <div class="status-row"><span>Código de participante</span><span class="ro-text">${esc(p.codigo)}</span></div>
      <div class="status-row"><span>Última actualización</span><span class="ro-text">${esc(fmtDate(p.fechaActualizacion))}</span></div>
    </div>

    <div class="card">
      <div class="card-title">⏰ Próximo partido</div>
      ${nextBody}
    </div>

    <div class="card">
      <div class="card-title">📋 Estado de tu quiniela <span class="badge ${st.complete?'badge-green':'badge-yellow'}">${pct}%</span></div>
      ${st.phases.map(ph=>{
        const ok = ph.done===ph.total;
        return `<div class="status-row"><span>${ok?'✅':'▫️'} ${esc(ph.label)}</span><span class="badge ${ok?'badge-green':'badge-muted'}">${ph.done}/${ph.total}</span></div>`;
      }).join('')}
      ${missing.length
        ? `<div class="note" style="margin-top:.75rem">Quedó sin completar: ${esc(missing.join(' · '))}.</div>`
        : ''}
    </div>

    <div class="rg-btn-row" style="margin-top:.75rem">
      <button class="rg-btn rg-btn-gold" id="dash_pdf_btn">📄 Descargar mi quiniela (PDF)</button>
    </div>
  `;
}

function buildDashComingSoonHtml(label){
  return `<div class="card center" style="padding:2rem 1rem">
      <div style="font-size:32px;margin-bottom:.5rem">🚧</div>
      <div class="card-title" style="justify-content:center">${esc(label)}</div>
      <div class="muted">Esta sección llega en la próxima fase.</div>
    </div>`;
}

/* ════════════════════════════════════════
   EVOLUCIÓN — v6.6 (Fase B). Las 4 tarjetas se alimentan de
   getChronoMatchEvents()/buildHistoricalSnapshots()/groupSnapshotsByJornada()
   /getTendenciaStats()/getLogrosStats() (todas en scoring.js, puro
   cálculo). Acá solo se las convierte en HTML + un par de gráficos SVG
   chiquitos hechos a mano (sin librería: mismo criterio "vanilla" del
   resto del proyecto). Ver el comentario grande en scoring.js para el
   detalle de qué entra y qué NO entra en el replay histórico.
   ════════════════════════════════════════ */
function fmtShortDay(ts){
  const d = new Date(ts);
  return d.toLocaleDateString('es-VE',{day:'2-digit',month:'short'}).replace('.','');
}

// Línea + puntos. value 1 queda arriba (mejor posición), value maxValue
// queda abajo — así "subir" en el gráfico es subir en el ranking.
function buildSvgLineChart(points,opts){
  opts = opts||{};
  const W=600,H=176,padL=26,padR=10,padT=14,padB=24;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const maxValue = opts.maxValue || Math.max(1,...points.map(p=>p.value));
  const minValue = opts.minValue || 1;
  const span = Math.max(1,maxValue-minValue);
  const n = points.length;
  const x = i => n<=1 ? padL+innerW/2 : padL+(i/(n-1))*innerW;
  const y = v => padT+((v-minValue)/span)*innerH;
  const pathPts = points.map((p,i)=>`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  const linePath = n>1 ? 'M'+pathPts.join(' L') : '';
  const dots = points.map((p,i)=>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5" fill="var(--qb-gold)"><title>${esc(p.label)}: #${p.value}</title></circle>`
  ).join('');
  const labelEvery = Math.max(1,Math.ceil(n/6));
  const labels = points.map((p,i)=> (i%labelEvery===0||i===n-1)
    ? `<text x="${x(i).toFixed(1)}" y="${H-6}" font-size="9" fill="var(--qb-muted)" text-anchor="middle">${esc(p.label)}</text>` : ''
  ).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:visible">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="var(--qb-border)" stroke-width="1"/>
    <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--qb-border)" stroke-width="1"/>
    <text x="${padL-4}" y="${padT+4}" font-size="9" fill="var(--qb-muted)" text-anchor="end">#1</text>
    <text x="${padL-4}" y="${H-padB}" font-size="9" fill="var(--qb-muted)" text-anchor="end">#${Math.round(maxValue)}</text>
    ${linePath?`<path d="${linePath}" fill="none" stroke="var(--qb-gold)" stroke-width="2"/>`:''}
    ${dots}
    ${labels}
  </svg>`;
}

// Barras (siempre ≥0 — los puntos nunca se restan). Cada barra lleva un
// <title> con la fecha real, aunque la etiqueta visible sea "J1, J2...".
function buildSvgBarChart(points){
  const W=600,H=164,padL=26,padR=10,padT=18,padB=24;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const n = points.length;
  const maxVal = Math.max(1,...points.map(p=>p.value));
  const slotW = innerW/n;
  const barW = Math.max(4,slotW-8);
  const barX = i => padL+i*slotW+(slotW-barW)/2;
  const barH = v => Math.max(2,(v/maxVal)*innerH);
  const barY = v => padT+innerH-barH(v);
  const bars = points.map((p,i)=>
    `<rect x="${barX(i).toFixed(1)}" y="${barY(p.value).toFixed(1)}" width="${barW.toFixed(1)}" height="${barH(p.value).toFixed(1)}" rx="3" fill="var(--qb-gold)"><title>${esc(p.title||p.label)}: ${p.value} pts</title></rect>`+
    `<text x="${(barX(i)+barW/2).toFixed(1)}" y="${(barY(p.value)-4).toFixed(1)}" font-size="9" fill="var(--qb-muted2)" text-anchor="middle">${p.value}</text>`
  ).join('');
  const labelEvery = Math.max(1,Math.ceil(n/8));
  const labels = points.map((p,i)=> (i%labelEvery===0||i===n-1)
    ? `<text x="${(barX(i)+barW/2).toFixed(1)}" y="${H-8}" font-size="9" fill="var(--qb-muted)" text-anchor="middle">${esc(p.label)}</text>` : ''
  ).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:visible">
    <line x1="${padL}" y1="${padT+innerH}" x2="${W-padR}" y2="${padT+innerH}" stroke="var(--qb-border)" stroke-width="1"/>
    ${bars}
    ${labels}
  </svg>`;
}

function buildEvolucionRankingCardHtml(name,days,rankNow,outOf){
  const posInicio = days.length ? days[0].ranks[name] : rankNow;
  const diff = (posInicio||rankNow) - rankNow; // positivo = subió (mejoró)
  const chartPoints = days.map(d=>({label:fmtShortDay(d.ts),value:d.ranks[name]||outOf}))
    .concat([{label:'Hoy',value:rankNow}]);
  const chart = days.length
    ? buildSvgLineChart(chartPoints,{maxValue:outOf,minValue:1})
    : `<div class="muted" style="padding:.75rem 0;text-align:center;font-size:12.5px">📉 Un solo punto no hace un gráfico. Volvé cuando haya más partidos jugados.</div>`;
  const diffTxt = !posInicio ? ''
    : diff>0 ? `Has subido <b style="color:var(--qb-green)">${diff}</b> posición${diff===1?'':'es'} desde el inicio del torneo.`
    : diff<0 ? `Has bajado <b style="color:#ef4444">${Math.abs(diff)}</b> posición${Math.abs(diff)===1?'':'es'} desde el inicio del torneo.`
    : `Te mantienes en la misma posición desde el inicio del torneo.`;
  return `
    <div class="card">
      <div class="card-title">📊 Evolución en el Ranking</div>
      <div class="muted" style="font-size:12px;margin-bottom:.5rem">Posición histórica durante el torneo.</div>
      ${chart}
      ${diffTxt?`<div style="font-size:13px;margin-top:.6rem">${diffTxt}</div>`:''}
    </div>`;
}

function buildEvolucionTendenciaCardHtml(t){
  if(!t.available){
    return `
      <div class="card">
        <div class="card-title">📈 Tendencia</div>
        <div class="muted" style="font-size:13px">Necesitás más partidos jugados (vas en ${t.totalPlayed}) para calcular una tendencia confiable. Esto se activa solo más adelante en el torneo.</div>
      </div>`;
  }
  const e = t.trend==='mejorando' ? '🟢' : t.trend==='empeorando' ? '🔴' : '🟡';
  const l = t.trend==='mejorando' ? 'Mejorando' : t.trend==='empeorando' ? 'Empeorando' : 'Estable';
  return `
    <div class="card">
      <div class="card-title">📈 Tendencia</div>
      <div class="muted" style="font-size:12px;margin-bottom:.4rem">Últimos ${t.winSize} partidos:</div>
      <div style="font-size:15px;font-weight:800;margin-bottom:.4rem">${e} ${l}</div>
      <div class="status-row"><span>Precisión</span><span class="ro-text">${t.precAntes}% → ${t.precAhora}%</span></div>
      <div class="status-row" style="border-bottom:none"><span>Ranking</span><span class="ro-text">#${t.rankAntes} → #${t.rankNow}</span></div>
    </div>`;
}

function buildEvolucionJornadaCardHtml(name,days){
  if(!days.length){
    return `
      <div class="card">
        <div class="card-title">🎖️ Puntos por Jornada</div>
        <div class="muted" style="font-size:13px">😴 Ni una jornada jugada todavía. Esto se llena solo, no hace falta que recargues la página cada 5 minutos.</div>
      </div>`;
  }
  const points = days.map((d,i)=>({
    label:`J${i+1}`, title:fmtShortDay(d.ts),
    value: (d.endCum[name]||0)-(d.startCum[name]||0)
  }));
  return `
    <div class="card">
      <div class="card-title">🎖️ Puntos por Jornada</div>
      <div class="muted" style="font-size:12px;margin-bottom:.5rem">Cuánto sumaste cada fecha del Mundial.</div>
      ${buildSvgBarChart(points)}
    </div>`;
}

function buildEvolucionLogrosCardHtml(logros){
  const unlocked = [];
  if(logros.exactoAlguna) unlocked.push('🎯 Primer marcador exacto');
  logros.unlockedTiers.forEach(t=>unlocked.push(`🏆 Top ${t} en el ranking`));
  if(logros.racha10) unlocked.push('🔥 10 aciertos consecutivos');

  const locked = [];
  if(!logros.exactoAlguna) locked.push('🎯 Primer marcador exacto');
  if(logros.nextTier) locked.push(`🏆 Top ${logros.nextTier} en el ranking`);
  if(!logros.racha10) locked.push('🔥 10 aciertos consecutivos');

  const itemsHtml = unlocked.length
    ? unlocked.map(t=>`<div style="padding:7px 0;border-bottom:1px solid var(--qb-border);font-size:13.5px">✓ ${esc(t)}</div>`).join('')
    : `<div class="muted" style="font-size:13px;padding:4px 0">Todavía no desbloqueaste ningún logro — ¡arrancá a acertar!</div>`;
  const nextHtml = locked.length
    ? `<div style="padding:7px 0 0;font-size:13.5px;opacity:.55">🔒 Próximo: ${esc(locked[0])}</div>`
    : (unlocked.length ? `<div style="padding:7px 0 0;font-size:13px;color:var(--qb-green)">🎉 ¡Desbloqueaste todos los logros!</div>` : '');
  return `
    <div class="card">
      <div class="card-title">🎯 Logros</div>
      ${itemsHtml}
      ${nextHtml}
    </div>`;
}

// v6.6 (Fase B) — Todo el cálculo (replay cronológico, tendencia, logros)
// vive en scoring.js; acá solo se arma el HTML. Si nunca se jugó ni un
// partido, se muestra un estado vacío amigable en vez de 4 tarjetas todas
// vacías.
function buildDashEvolucionHtml(p){
  const name = p.name;
  const events = getChronoMatchEvents();
  if(!events.length){
    return `
      <div class="card center" style="padding:2rem 1rem">
        <div style="font-size:32px;margin-bottom:.5rem">🍿</div>
        <div class="card-title" style="justify-content:center">Evolución</div>
        <div class="muted">Pipocas listas, pero todavía no arrancó ni un partido. Esto se va llenando solo, fecha a fecha.</div>
      </div>`;
  }
  const stats = getDashStatsInfo(p);
  const rankNow = stats.pos || stats.outOf;
  const outOf = stats.outOf || PL.length;
  const snapshots = buildHistoricalSnapshots(events);
  const days = groupSnapshotsByJornada(snapshots);
  const tendencia = getTendenciaStats(name,events,snapshots,rankNow);
  const logros = getLogrosStats(name,events,days,rankNow);

  return `
    <div style="margin-bottom:.25rem">
      <div class="card-title">📈 Evolución</div>
      <div class="muted" style="font-size:13px;margin-bottom:.75rem">Mira cómo has mejorado durante el Mundial y compárate con otros participantes.</div>
    </div>
    ${buildEvolucionRankingCardHtml(name,days,rankNow,outOf)}
    ${buildEvolucionTendenciaCardHtml(tendencia)}
    ${buildEvolucionJornadaCardHtml(name,days)}
    ${buildEvolucionLogrosCardHtml(logros)}
  `;
}

// ── Fase de Grupos (graded) — v6.3, Fase 2 ──
// Mismo markup/clases que renderPred() en app.js (.pc/.pg2/.pm/.pmn, son
// clases globales, no scoped a #t-pred) para que se vea "igual" a lo que
// ve el admin — pero fijo a este participante (sin selector psel) y sin
// nada editable. Única diferencia a propósito: si falta una predicción
// (caso Miguel) NO se oculta la tarjeta como hace renderPred() — se
// muestra explícitamente "Sin predicción" en vez de desaparecer, para
// que sea obvio qué quedó incompleto.
function buildDashGruposHtml(p){
  const name = p.name;
  const pts = calcPts(name);

  const cards = MIDS.map(mid=>{
    const lbl = MD[mid]?.lbl || `Partido ${mid}`;
    const partes = lbl.split(' vs ');
    const hS = (partes[0]||'').trim();
    const aS = (partes[1]||'').trim();
    const pBadge = `<span style="font-size:8px;padding:1px 4px;border-radius:4px;background:var(--qb-surface);border:1px solid var(--qb-border);color:var(--qb-muted)">P${mid}</span>`;
    const pred = MD[mid]?.preds?.[name];
    const s = sc(mid);
    const played = !!s;

    if(!pred){
      return `<div class="pm" style="border:1px dashed var(--qb-border2);opacity:.75">
        <div class="pmn">${esc(hS)} vs ${esc(aS)} ${pBadge}</div>
        <div style="font-size:11px;color:var(--qb-muted)">Sin predicción${played?` · real ${s.h}–${s.a}`:''}</div>
      </div>`;
    }

    let pts2=0, hit=false;
    if(played){
      const rR = s.h>s.a?'H':s.h<s.a?'A':'D';
      const pR = pred.h>pred.a?'H':pred.h<pred.a?'A':'D';
      if(rR===pR){ pts2 += rR==='D'?3:2; hit=true; if(pred.h===s.h && pred.a===s.a) pts2+=3; }
    }
    const bdr = played ? (hit?'border:1px solid rgba(0,200,83,.5)':'border:1px solid rgba(212,0,26,.5)') : '';

    return `<div class="pm" style="${bdr}">
      <div class="pmn">${esc(hS)} vs ${esc(aS)} ${pBadge}${played?`<span style="float:right;font-family:var(--ff-display);font-size:10px;font-weight:700;color:${hit?'#4dde8c':'#ff8080'}">${pts2>0?'+'+pts2:''}</span>`:''}</div>
      <div style="display:flex;align-items:center;gap:4px">
        <span style="font-family:var(--ff-display);font-size:16px;font-weight:800;color:var(--qb-text);background:var(--qb-surface2);border:1px solid var(--qb-border2);border-radius:4px;padding:2px 7px;min-width:26px;text-align:center">${pred.h}</span>
        <span style="font-size:10px;color:var(--qb-muted)">–</span>
        <span style="font-family:var(--ff-display);font-size:16px;font-weight:800;color:var(--qb-text);background:var(--qb-surface2);border:1px solid var(--qb-border2);border-radius:4px;padding:2px 7px;min-width:26px;text-align:center">${pred.a}</span>
        ${played?`<span style="font-family:var(--ff-display);font-size:10px;font-weight:700;color:var(--qb-muted2);margin-left:3px;padding:2px 5px;border-radius:3px;background:var(--qb-surface3);border:1px solid var(--qb-border)">${s.h}–${s.a}</span>`:''}
      </div>
    </div>`;
  }).join('');

  return `
    <div class="ib" style="margin-bottom:.75rem">Verde = acertaste · Rojo = fallaste · Número = puntos del partido</div>
    <div class="pc">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem">
        <span style="font-weight:700;font-size:13px;color:var(--qb-text)">⚽ Fase de Grupos</span>
        <span class="pill pb">${pts} pts</span>
      </div>
      <div class="pg2">${cards}</div>
    </div>`;
}

// ── Eliminatoria (graded) — v6.3, Fase 3 ──
// Mismo markup y mismos cálculos que renderBracket() en app.js
// (.brkt-summary/.bsum-item/.brkt-round/.brkt-round-title son clases
// globales, no scoped a #t-pred), fijo a este participante, sin selector
// (bsel) ni nada editable. La llave/cruce SIEMPRE se muestra con lo que
// el participante predijo (predTeams/predScore vía getElimTeams/elimPred),
// igual que en el admin — si su bracket se desvió de la realidad, abajo
// aparece el bloque "Real: ..." comparando contra lo que pasó de verdad.
function buildDashElimHtml(p){
  const name = p.name;

  let llaveOk=0, llaveTot=0, totalPts=0, partJugados=0, cruceOk=0;
  for(let pid=73; pid<=104; pid++){
    const phase=phaseForPid(pid); if(phase&&!isFaseActiva(phase.key))continue; // v1.2
    const scE = S.elimScores[pid]; if(!scE) continue;
    partJugados++; llaveTot++;
    if(isLlaveCorrecta(name,pid)) llaveOk++;
    else if(findCruceValido(name,pid)) cruceOk++;
    totalPts += calcElimMatchPts(name,pid);
  }
  const llavePtsTotal = (llaveOk+cruceOk)*2;
  let classifiedTotal = 0;
  getActivePhases().forEach(ph=>{ if(ph.elimPhase) classifiedTotal += calcClassifiedPtsForPhase(name,ph); });
  const activeElimMidsTotal = getActivePhases().filter(ph=>ph.elimPhase).reduce((s,ph)=>s+ph.mids.length,0);

  let html = `<div class="brkt-summary">
    <div class="bsum-item"><div class="bsum-val">${totalPts}</div><div class="bsum-lbl">pts resultado</div></div>
    <div class="bsum-item"><div class="bsum-val" style="color:#6ab8f7">${llavePtsTotal}</div><div class="bsum-lbl">pts llaves</div></div>
    <div class="bsum-item"><div class="bsum-val" style="color:#4dde8c">${classifiedTotal}</div><div class="bsum-lbl">pts clasif.</div></div>
    <div class="bsum-item"><div class="bsum-val">${llaveOk}/${llaveTot}${cruceOk?` <span style="color:#6ab8f7;font-size:10px">(+${cruceOk} 🔀)</span>`:""}</div><div class="bsum-lbl">llaves ✓</div></div>
    <div class="bsum-item"><div class="bsum-val">${partJugados}/${activeElimMidsTotal}</div><div class="bsum-lbl">jugados</div></div>
  </div>`;

  html += `<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:10px;color:var(--qb-muted);margin-bottom:.625rem;padding:5px 9px;background:var(--qb-surface);border:1px solid var(--qb-border);border-radius:6px">
    <span><span style="display:inline-block;width:10px;height:10px;background:rgba(0,200,83,.1);border:1px solid rgba(0,200,83,.4);border-radius:2px;margin-right:3px"></span>Llave + resultado ✓</span>
    <span><span style="display:inline-block;width:10px;height:10px;background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.4);border-radius:2px;margin-right:3px"></span>Llave ✓ resultado ✗</span>
    <span><span style="display:inline-block;width:10px;height:10px;background:rgba(106,184,247,.1);border:1px solid rgba(106,184,247,.4);border-radius:2px;margin-right:3px"></span>🔀 Cruce válido (mismo cruce, otra llave de la ronda)</span>
    <span><span style="display:inline-block;width:10px;height:10px;background:rgba(212,0,26,.1);border:1px solid rgba(212,0,26,.4);border-radius:2px;margin-right:3px"></span>Llave ✗</span>
    <span>⭐ = puntos de clasificado (en vivo, al cerrar la fase previa)</span>
  </div>`;

  getActiveElimRounds().forEach(round=>{
    html += `<div class="brkt-round"><div class="brkt-round-title">${round.lbl}</div>`;
    round.ids.forEach(pid=>{
      const predTeams = getElimTeams(name,pid);
      const predScore = elimPred(name,pid);
      const realTeams = getRealElimTeams(pid);
      const scE = S.elimScores[pid];

      const played = !!scE;
      const llave = isLlaveCorrecta(name,pid);
      const pts = calcElimMatchPts(name,pid);
      const cruce = !llave ? findCruceValido(name,pid) : null;
      const breakdown = calcElimMatchBreakdown(name,pid);

      // v3.2 — BUG DE SEGURIDAD REPORTADO: mismo caso que
      // app-bracket-view.js/renderBracket() -- pH/pA/rH/rA/clsBadge.team
      // vienen de la huella _a/_b de la predicción (un campo que
      // firestore.rules deja escribir con cualquier contenido, ver la
      // nota completa allá). Esta función también la usa el ADMIN (👁️
      // "Ver como participante" / ✏️ "Editar") con su sesión ya
      // autenticada, así que necesita el mismo esc() en todo lo que sale
      // de estas variables.
      const pH = predTeams ? predTeams.h : "⏳ Por resolver";
      const pA = predTeams ? predTeams.a : "⏳ Por resolver";
      const pScoreStr = predScore ? `${predScore.h}–${predScore.a}` : "?–?";

      const rH = realTeams ? realTeams.h : null;
      const rA = realTeams ? realTeams.a : null;
      const rScoreStr = scE ? `${scE.h}–${scE.a}` : null;

      let rowBg, borderCol;
      if(!played){ rowBg="var(--qb-surface)"; borderCol="var(--qb-border)"; }
      else if(llave && pts>0){ rowBg="rgba(0,200,83,.07)"; borderCol="rgba(0,200,83,.4)"; }
      else if(llave && pts===0){ rowBg="rgba(245,166,35,.07)"; borderCol="rgba(245,166,35,.4)"; }
      else if(cruce && pts>0){ rowBg="rgba(106,184,247,.08)"; borderCol="rgba(106,184,247,.45)"; }
      else{ rowBg="rgba(212,0,26,.07)"; borderCol="rgba(212,0,26,.4)"; }

      let badge;
      if(!played && !realTeams){ badge=`<span style="font-size:9px;color:var(--qb-muted)">⏳</span>`; }
      else if(!played && realTeams){ badge=`<span style="font-size:9px;color:var(--qb-yellow)">📅 sin result.</span>`; }
      else if(cruce){
        const tip=`Cruce válido: ${esc(pH)} vs ${esc(pA)} se enfrentaron realmente en P${cruce.pidReal} (misma ronda). Se reconoce el acierto aunque no quedó en tu llave exacta.`;
        badge=`<span title="${tip}" style="font-size:9px;color:#6ab8f7;font-weight:700;cursor:help">🔀 Cruce ${pts>0?`+${pts}pts`:""}</span>`;
      }
      else if(!llave){ badge=`<span style="font-size:9px;color:#ff8080;font-weight:600">✗ llave</span>`; }
      else if(pts>0){ badge=`<span style="font-size:9px;color:#4dde8c;font-weight:700">+${pts}pts</span>`; }
      else{ badge=`<span style="font-size:9px;color:var(--qb-yellow);font-weight:600">llave ✓</span>`; }

      let realBlock="";
      if(realTeams && (!predTeams || n(predTeams.h)!==n(realTeams.h) || n(predTeams.a)!==n(realTeams.a))){
        realBlock=`<div style="font-size:9px;color:var(--qb-muted);margin-top:2px;padding-top:2px;border-top:1px dashed var(--qb-border)">
          Real: <span style="color:var(--qb-text)">${esc(rH)}</span> vs <span style="color:var(--qb-text)">${esc(rA)}</span>
          ${rScoreStr?`· <strong style="color:var(--qb-text)">${rScoreStr}</strong>`:""}
        </div>`;
      } else if(realTeams && rScoreStr){
        realBlock=`<div style="font-size:9px;color:var(--qb-muted);margin-top:2px">Resultado real: <strong style="color:var(--qb-text)">${rScoreStr}</strong></div>`;
      }

      let breakdownBlock="";
      if(breakdown.length){
        const parts=breakdown.map(it=>`${it.pts}pts ${it.label}`).join(" + ");
        breakdownBlock=`<div style="font-size:9px;color:var(--qb-muted2);margin-top:2px">${parts} = <strong style="color:var(--qb-text)">+${pts}pts</strong></div>`;
      }

      const clsBadge = getClassifiedBadgeForPid(name,pid);
      let clsBlock="";
      if(clsBadge){
        const nextRoundName = {
          "r16":"Octavos","r8":"Cuartos","qf":"Semifinales","sf":"Final","final":"Campeón","third":"3er lugar"
        }[phaseForPid(pid)?.key] || "siguiente ronda";
        if(clsBadge.advanced){
          clsBlock=`<div style="display:flex;align-items:center;gap:5px;margin-top:5px;padding:4px 7px;background:rgba(0,200,83,.08);border:1px solid rgba(0,200,83,.3);border-radius:6px">
            <span style="font-size:13px">${clsBadge.flag}</span>
            <div style="flex:1;min-width:0">
              <span style="font-size:10px;font-weight:700;color:var(--qb-text)">${esc(clsBadge.team)}</span>
              <span style="font-size:9px;color:#4dde8c;margin-left:3px">clasificó a ${nextRoundName} ✓</span>
            </div>
            <span style="font-size:11px;font-weight:800;color:#4dde8c;white-space:nowrap">+${clsBadge.pts}pts</span>
          </div>`;
        } else {
          clsBlock=`<div style="display:flex;align-items:center;gap:5px;margin-top:5px;padding:4px 7px;background:rgba(212,0,26,.06);border:1px solid rgba(212,0,26,.2);border-radius:6px">
            <span style="font-size:13px">${clsBadge.flag}</span>
            <div style="flex:1;min-width:0">
              <span style="font-size:10px;font-weight:700;color:var(--qb-text)">${esc(clsBadge.team)}</span>
              <span style="font-size:9px;color:#ff8080;margin-left:3px">no clasificó ✗</span>
            </div>
            <span style="font-size:11px;font-weight:800;color:#ff8080;white-space:nowrap">0pts</span>
          </div>`;
        }
      }

      html += `<div style="display:grid;grid-template-columns:1fr auto;align-items:start;gap:6px;padding:7px 9px;border:1px solid ${borderCol};border-radius:8px;margin-bottom:5px;background:${rowBg}">
        <div>
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:1px">
            <span style="font-size:11px;font-weight:600;color:var(--qb-text)">${esc(pH)}</span>
            <span style="font-size:10px;color:var(--qb-muted)">vs</span>
            <span style="font-size:11px;font-weight:600;color:var(--qb-text)">${esc(pA)}</span>
          </div>
          <div style="font-size:10px;color:var(--qb-muted)">Predicción: <strong style="color:var(--qb-muted2)">${pScoreStr}</strong> · P${pid}</div>
          ${realBlock}
          ${breakdownBlock}
          ${clsBlock}
        </div>
        <div style="font-size:10px;color:var(--qb-muted);text-align:center;padding-top:2px">${badge}</div>
      </div>`;
    });
    html += "</div>";
  });

  return html;
}

// ── Avanzado (graded, SIN el bloque de resultados reales) — v6.3, Fase 4 ──
// Mismo cálculo y mismo markup de specItems/specHtml que renderAdv() en
// app.js, reusando calcAdv()/getDynamicSpec() tal cual (cero lógica de
// puntuación duplicada) — pero a propósito SIN el bloque "ri" (resultados
// reales del torneo, editable: campeón/goleador/etc.) que sí ve el admin.
// Acá el participante solo ve SUS predicciones y cuánto le rindieron.
function buildDashAvanzadoHtml(p){
  const name = p.name;
  const r = S.reality;
  const ap = calcAdv(name);
  const spec = getDynamicSpec(name) || {};

  const scorerMatch = n(spec.scorer||'') && n(r.topScorer) && n(spec.scorer)===n(r.topScorer);
  const countryMatch = n(spec.topCountry||'') && n(r.topCountry) && n(spec.topCountry)===n(r.topCountry);

  const specItems = [
    {l:"🥇 Campeón",                       val:spec.champ,          pts:15, real:r.champ,            locked:false},
    {l:"🥈 Subcampeón",                     val:spec.runner,         pts:10, real:r.runner,           locked:false},
    {l:"🥉 3er lugar",                      val:spec.third,          pts:8,  real:r.third,            locked:false},
    {l:"⚽ Goleador del torneo",             val:spec.scorer,         pts:12, real:r.topScorer,        locked:false},
    {l:"⚽ Goles del goleador",              val:spec.scorerGoals,    pts:8,  real:r.topScorerGoals,   locked:!scorerMatch,  lockReason:"requiere acertar el goleador"},
    {l:"🌍 País más goleador",              val:spec.topCountry,     pts:8,  real:r.topCountry,       locked:false},
    {l:"🌍 Goles de ese país",              val:spec.topCountryGoals,pts:10, real:r.topCountryGoals,  locked:!countryMatch, lockReason:"requiere acertar el país"},
    {l:"😬 País más goleado (1 juego)",      val:spec.mostConceded,   pts:8,  real:r.mostConceded,     locked:false},
  ];

  const specHtml = specItems.map(it=>{
    const matched = !it.locked && it.real && n(String(it.val||'')) === n(String(it.real));
    const hasReal = !!it.real;
    let bg, bc;
    if(it.locked && hasReal){ bg="var(--qb-surface2)"; bc="var(--qb-border)"; }
    else if(hasReal && matched){ bg="rgba(0,200,83,.07)"; bc="rgba(0,200,83,.4)"; }
    else if(hasReal && !matched){ bg="rgba(212,0,26,.07)"; bc="rgba(212,0,26,.4)"; }
    else{ bg="var(--qb-surface2)"; bc="var(--qb-border)"; }
    let badge;
    if(it.locked && hasReal){
      badge = `<span style="font-size:9px;color:var(--qb-muted);font-style:italic">🔒 ${it.lockReason}</span>`;
    } else if(hasReal){
      badge = matched
        ? `<span style="color:#4dde8c;font-weight:700;font-size:10px">+${it.pts}pts</span>`
        : `<span style="color:#ff8080;font-size:10px">✗ ${esc(String(it.real))}</span>`;
    } else {
      badge = `<span style="color:var(--qb-muted);font-size:10px">⏳</span>`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 9px;border:1px solid ${bc};border-radius:8px;margin-bottom:3px;background:${bg}${it.locked?'opacity:.7;':''}">
      <div style="flex:1;font-size:11px;color:${it.locked?'var(--qb-muted)':'var(--qb-text)'}">${it.l}</div>
      <div style="font-family:var(--ff-display);font-size:14px;font-weight:800;color:${it.locked?'var(--qb-muted)':'var(--qb-text)'}">${esc(String(it.val||'—'))}</div>
      <div style="font-size:10px;min-width:50px;text-align:right">${badge}</div>
    </div>`;
  }).join('');

  return `<div style="border:1px solid var(--qb-border);border-radius:12px;padding:.75rem .875rem;background:var(--qb-surface)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem">
      <span style="font-weight:700;font-size:13px;color:var(--qb-text)">⭐ Avanzado</span>
      <span class="pill pg">${ap} pts</span>
    </div>
    <div style="margin-bottom:.5rem;font-size:10px;color:var(--qb-muted);letter-spacing:.04em;text-transform:uppercase;font-family:var(--ff-display);font-weight:700">Tus predicciones especiales</div>
    ${specHtml}
  </div>`;
}

// ── Comparador de quinielas — v3.5 ──────────────────────────────────
// Cara a cara contra otro participante elegido en el dropdown
// (DASH_COMPARE_RIVAL, un id — no un nombre, para no chocar si dos
// participantes comparten nombre). No reimplementa NADA del motor de
// puntaje: reusa exactamente las mismas funciones que ya usan
// Predicciones/Ranking/Batallas (calcPts/calcAdv/calcElimPts/calcBonos,
// getDynamicSpec, getElimTeams/getPredWinner, getActiveElimRounds,
// groupPickResult) — acá solo se comparan los resultados de esas
// funciones entre dos personas, no se recalcula puntaje de cero.
function buildDashCompararHtml(p){
  const others = DB.participants.filter(x=>x.id!==p.id).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const optionsHtml = others.map(o=>`<option value="${esc(o.id)}" ${DASH_COMPARE_RIVAL===o.id?'selected':''}>${esc(o.name)}</option>`).join('');
  const pickerHtml = `
    <div class="pc">
      <div class="field" style="margin-bottom:0">
        <label>Comparar con</label>
        ${others.length
          ? `<select id="dash-cmp-select"><option value="">Elegí un participante…</option>${optionsHtml}</select>`
          : `<div class="muted" style="font-size:12px">No hay nadie más registrado todavía.</div>`}
      </div>
    </div>`;

  const rival = others.find(o=>o.id===DASH_COMPARE_RIVAL);
  if(!rival) return pickerHtml + `<div class="ib" style="margin-top:.625rem">Elegí a alguien de la lista para ver la comparación.</div>`;

  const meName=p.name, rivalName=rival.name, rivalFirst=esc((rival.name||'').split(' ')[0]||rival.name);
  const nn=s=>(s||'').trim().toLowerCase();
  const myTotal = getDashStatsInfo(p).total;
  const rivalTotal = getDashStatsInfo(rival).total;

  // ── Avanzado: comparar pick contra pick (no contra la realidad — eso
  // ya lo muestra buildDashAvanzadoHtml de cada uno por separado) ──
  const mySpec = getDynamicSpec(meName)||{}, rivalSpec = getDynamicSpec(rivalName)||{};
  const AVANZADO_FIELDS = [
    {key:'champ',  label:'Campeón'},
    {key:'runner', label:'Subcampeón'},
    {key:'third',  label:'Tercer lugar'},
    {key:'scorer', label:'Goleador'},
  ];
  let avanzadoMatches=0, avanzadoTotal=0;
  const avanzadoRows = AVANZADO_FIELDS.map(f=>{
    const mv=mySpec[f.key], rv=rivalSpec[f.key];
    if(!mv && !rv) return '';
    avanzadoTotal++;
    const same = mv && rv && nn(mv)===nn(rv);
    if(same) avanzadoMatches++;
    const pillHtml = (!mv||!rv)
      ? `<span class="pill" style="background:var(--qb-surface2);color:var(--qb-muted)">— falta</span>`
      : same
        ? `<span class="pill" style="background:var(--qb-green-dim);color:var(--qb-green)">✓ coinciden</span>`
        : `<span class="pill" style="background:var(--qb-surface2);color:var(--qb-muted2)">✗ distinto</span>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--qb-border)">
      <div style="flex:1;text-align:right;font-size:12px;font-weight:600">${esc(mv||'—')}</div>
      <div style="flex-shrink:0">${pillHtml}</div>
      <div style="flex:1;font-size:12px;font-weight:600">${esc(rv||'—')}</div>
    </div>
    <div style="font-size:9.5px;color:var(--qb-muted);text-transform:uppercase;letter-spacing:.04em;text-align:center;margin:-2px 0 4px">${esc(f.label)}</div>`;
  }).join('');

  // ── Eliminatoria: por ronda, ¿a quién eligieron para avanzar? ──
  let elimMatches=0, elimTotal=0, elimRoundsHtml='';
  (typeof getActiveElimRounds==='function'?getActiveElimRounds():[]).forEach(round=>{
    let roundOk=0, roundTot=0, detailLines='';
    round.ids.forEach(pid=>{
      const myTeams=getElimTeams(meName,pid), rivalTeams=getElimTeams(rivalName,pid);
      if(!myTeams && !rivalTeams) return;
      roundTot++;
      const myWinner=getPredWinner(meName,pid), rivalWinner=getPredWinner(rivalName,pid);
      const same = myWinner && rivalWinner && nn(myWinner)===nn(rivalWinner);
      if(same) roundOk++;
      detailLines += `<div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-top:1px dotted var(--qb-border2);color:var(--qb-muted2)">
        <span>Vos: <b style="color:var(--qb-text)">${esc(myWinner||'⏳ sin cargar')}</b></span>
        <span>${same?'✓':(myWinner&&rivalWinner?'✗':'')}</span>
        <span>${esc(rivalFirst)}: <b style="color:var(--qb-text)">${esc(rivalWinner||'⏳ sin cargar')}</b></span>
      </div>`;
    });
    if(roundTot===0) return;
    elimMatches+=roundOk; elimTotal+=roundTot;
    const pct = Math.round(roundOk/roundTot*100);
    elimRoundsHtml += `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--qb-border)">
        <span style="font-size:12px;font-weight:700;min-width:100px">${esc(round.lbl)}</span>
        <span style="flex:1;height:5px;background:var(--qb-border2);border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:${pct}%;background:var(--qb-gold);border-radius:4px"></span></span>
        <span style="font-size:11px;color:var(--qb-muted2);min-width:32px;text-align:right">${roundOk}/${roundTot}</span>
      </div>
      <details style="margin-bottom:4px"><summary style="cursor:pointer;font-size:10.5px;color:var(--qb-blue);padding:4px 0">Ver cruces de ${esc(round.lbl)}</summary>${detailLines}</details>`;
  });

  // ── Grupos: resumen (no 72 filas) + detalle opcional ──
  let sameExact=0, sameResult=0, gruposComparados=0, gruposDetail='';
  (typeof MIDS!=='undefined'?MIDS:[]).forEach(mid=>{
    const myP = MD[mid]?.preds?.[meName], rivalP = MD[mid]?.preds?.[rivalName];
    if(!myP || !rivalP) return;
    gruposComparados++;
    const exact = myP.h===rivalP.h && myP.a===rivalP.a;
    if(exact) sameExact++;
    const myRes=groupPickResult(mid,meName), rivalRes=groupPickResult(mid,rivalName);
    if(myRes && rivalRes && myRes===rivalRes) sameResult++;
    gruposDetail += `<div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-top:1px dotted var(--qb-border2);color:var(--qb-muted2)">
      <span>${esc(MD[mid]?.lbl||`Partido ${mid}`)}</span>
      <span>Vos <b style="color:var(--qb-text)">${myP.h}-${myP.a}</b> · ${esc(rivalFirst)} <b style="color:var(--qb-text)">${rivalP.h}-${rivalP.a}</b> ${exact?'✓':''}</span>
    </div>`;
  });

  const totalItems = avanzadoTotal + elimTotal + gruposComparados;
  const totalMatches = avanzadoMatches + elimMatches + sameResult;
  const afinidad = totalItems ? Math.round(totalMatches/totalItems*100) : null;

  return pickerHtml + `
    <div class="pc" style="margin-top:.75rem">
      <div style="display:flex;align-items:center;justify-content:space-around;text-align:center">
        <div><div style="font-family:var(--ff-display);font-size:24px;font-weight:800;color:var(--qb-gold)">${myTotal}</div><div style="font-size:9.5px;color:var(--qb-muted);text-transform:uppercase">Vos</div></div>
        <div style="font-family:var(--ff-display);font-weight:800;color:var(--qb-muted);font-size:13px">VS</div>
        <div><div style="font-family:var(--ff-display);font-size:24px;font-weight:800;color:var(--qb-text)">${rivalTotal}</div><div style="font-size:9.5px;color:var(--qb-muted);text-transform:uppercase">${rivalFirst}</div></div>
      </div>
      ${afinidad!==null ? `<div style="text-align:center;margin-top:.625rem;padding-top:.625rem;border-top:1px dashed var(--qb-border2);font-size:11.5px;color:var(--qb-muted2)">🔥 Afinidad de picks: <b style="color:var(--qb-yellow)">${afinidad}%</b></div>` : ''}
    </div>
    ${avanzadoRows ? `<div class="pc" style="margin-top:.625rem"><div style="font-weight:700;font-size:13px;margin-bottom:.5rem">🏆 Avanzado</div>${avanzadoRows}</div>` : ''}
    ${elimRoundsHtml ? `<div class="pc" style="margin-top:.625rem"><div style="font-weight:700;font-size:13px;margin-bottom:.5rem">🎯 Eliminatoria</div>${elimRoundsHtml}</div>` : ''}
    ${gruposComparados ? `<div class="pc" style="margin-top:.625rem">
        <div style="font-weight:700;font-size:13px;margin-bottom:.5rem">⚽ Fase de Grupos</div>
        <div style="display:flex;gap:8px">
          <div style="flex:1;text-align:center;background:var(--qb-surface2);border-radius:8px;padding:9px"><div style="font-family:var(--ff-display);font-size:19px;font-weight:800;color:var(--qb-gold)">${sameExact}<span style="font-size:11px;color:var(--qb-muted2)">/${gruposComparados}</span></div><div style="font-size:9px;color:var(--qb-muted2)">Mismo marcador exacto</div></div>
          <div style="flex:1;text-align:center;background:var(--qb-surface2);border-radius:8px;padding:9px"><div style="font-family:var(--ff-display);font-size:19px;font-weight:800">${sameResult}<span style="font-size:11px;color:var(--qb-muted2)">/${gruposComparados}</span></div><div style="font-size:9px;color:var(--qb-muted2)">Mismo resultado (G/E/P)</div></div>
        </div>
        <details style="margin-top:.5rem"><summary style="cursor:pointer;font-size:10.5px;color:var(--qb-blue);padding:4px 0">Ver los ${gruposComparados} partidos en detalle</summary>${gruposDetail}</details>
      </div>` : `<div class="ib" style="margin-top:.625rem">Todavía no hay partidos de Grupos cargados por los dos para comparar.</div>`}
  `;
}

// Puntos totales + posición en el ranking público (excluye ocultos, igual
// que ya hace renderRank() para quien no es admin). Si el propio
// participante está oculto (S.hiddenPL), no aparece en esa lista — se
// muestra el total igual, pero sin posición.
function getDashStatsInfo(p){
  const name = p.name;
  const total = calcPts(name) + calcAdv(name) + calcElimPts(name) + calcBonos(name);
  const visibles = getRank().filter(r=>!r.hidden);
  const idx = visibles.findIndex(r=>r.name===name);
  return { total, pos: idx>=0 ? idx+1 : null, outOf: visibles.length };
}

// Siguiente partido REAL (grupos o eliminatoria) que todavía no terminó,
// junto con la predicción que este participante hizo para ese cruce.
// "No terminó" = sin resultado real guardado, o resultado marcado como
// "live" (partido en curso, cuenta como el destacado actual). Si no hay
// ningún partido con hora programada que cumpla esto, devuelve null
// (torneo sin fixture cargado todavía, o ya terminado por completo).
function getNextPendingMatchInfo(p){
  const name = p.name;
  let best = null;

  if(isGruposActivaWizard()){
    MIDS.forEach(mid=>{
      const t = S.matchTimes && S.matchTimes[mid]; if(!t) return;
      const ts = new Date(t).getTime(); if(isNaN(ts)) return;
      const real = sc(mid);
      if(real && !real.live) return; // ya jugado y terminado
      if(best && ts >= best.ts) return;
      const pred = MD[mid]?.preds?.[name];
      best = {
        ts, live: !!(real && real.live),
        lbl: MD[mid]?.lbl || `Partido ${mid}`,
        predStr: pred ? `${pred.h}-${pred.a}` : 'Sin predicción'
      };
    });
  }

  for(let pid=73; pid<=104; pid++){
    const phase = phaseForPid(pid); if(phase && !isFaseActiva(phase.key)) continue; // v1.2
    const t = S.elimTimes && S.elimTimes[pid]; if(!t) continue;
    const ts = new Date(t).getTime(); if(isNaN(ts)) continue;
    const real = S.elimScores[pid] || S.elimScores[String(pid)];
    if(real && !real.live) continue;
    if(best && ts >= best.ts) continue;
    const teams = getRealElimTeams(pid);
    const pred = elimPred(name, pid);
    best = {
      ts, live: !!(real && real.live),
      lbl: teams ? `${teams.h} vs ${teams.a}` : `Eliminatoria #${pid}`,
      predStr: pred ? `${pred.h}-${pred.a}` : 'Sin predicción'
    };
  }
  return best;
}

function fmtMatchTime(ts){
  const d = new Date(ts);
  const dia = d.toLocaleDateString('es',{weekday:'short',day:'2-digit',month:'short'}).replace(/\./g,'');
  const hora = d.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});
  return `${dia} · ${hora}`;
}

/* ════════════════════════════════════════
   PASOS DEL WIZARD — cada uno tiene variante editable y solo-lectura
   ════════════════════════════════════════ */
// v1.0 — Campos País (buscador con bandera) + Ciudad (sugerencias que
// dependen del país elegido). idPrefix permite reusar este mismo widget
// en el registro inicial ("r") y al editar el paso "Datos personales"
// más adelante ("pp"), sin que choquen los ids.
function buildCountryCityFieldsHtml(idPrefix, country, countryIso, city){
  const cid = `${idPrefix}_country`, ctyid = `${idPrefix}_city`;
  return `
    <div class="row2">
      <div class="field">
        <label>País donde vives</label>
        <div class="combo-wrap">
          <input type="text" id="${cid}" autocomplete="off" placeholder="Escribe para buscar tu país..." value="${esc(country||'')}">
          <input type="hidden" id="${cid}_iso" value="${esc(countryIso||'')}">
          <div class="combo-dropdown" id="${cid}_dd" style="display:none"></div>
        </div>
      </div>
      <div class="field">
        <label>Ciudad donde vives</label>
        <input type="text" id="${ctyid}" list="${ctyid}_list" autocomplete="off" placeholder="Escribe tu ciudad..." value="${esc(city||'')}">
        <datalist id="${ctyid}_list"></datalist>
      </div>
    </div>`;
}

function wireCountryCityFields(idPrefix, onChange){
  const cid = `${idPrefix}_country`, ctyid = `${idPrefix}_city`;
  const input = document.getElementById(cid);
  const isoInput = document.getElementById(`${cid}_iso`);
  const dd = document.getElementById(`${cid}_dd`);
  const cityInput = document.getElementById(ctyid);
  const cityList = document.getElementById(`${ctyid}_list`);

  function refreshCityOptions(){
    cityList.innerHTML = getCityOptionsForCountry(isoInput.value).map(c=>`<option value="${esc(c)}"></option>`).join('');
  }
  refreshCityOptions();

  function renderDropdown(){
    const q = foldAccents(norm(input.value));
    const matches = (q ? COUNTRY_LIST.filter(c=>foldAccents(norm(c.name)).includes(q)) : COUNTRY_LIST).slice(0,8);
    dd.innerHTML = matches.length
      ? matches.map(c=>`<div class="combo-option" data-iso="${c.iso}" data-name="${esc(c.name)}">${flagImgByIso(c.iso,13)}<span>${esc(c.name)}</span></div>`).join('')
      : `<div class="combo-empty">No se encontraron países.</div>`;
    dd.style.display = 'block';
    dd.querySelectorAll('.combo-option').forEach(opt=>{
      // mousedown (no click): se dispara ANTES del blur del input, así el
      // dropdown no se cierra solo antes de registrar la elección.
      opt.addEventListener('mousedown', (e)=>{
        e.preventDefault();
        input.value = opt.dataset.name;
        isoInput.value = opt.dataset.iso;
        dd.style.display = 'none';
        refreshCityOptions();
        if(onChange) onChange();
      });
    });
  }

  input.addEventListener('focus', renderDropdown);
  input.addEventListener('input', ()=>{
    isoInput.value = ''; // el ISO queda inválido hasta que se elija de nuevo de la lista
    renderDropdown();
    if(onChange) onChange();
  });
  input.addEventListener('blur', ()=>{ setTimeout(()=>{ dd.style.display='none'; }, 120); });
  cityInput.addEventListener('input', ()=>{ if(onChange) onChange(); });
}

function buildPersonalStepHtml(p, readOnly){
  const {nombre, apellido} = splitName(p.name);
  if(readOnly){
    return `
      <div class="row2">
        <div class="field"><label>Nombre</label><div class="ro-text">${esc(nombre)}</div></div>
        <div class="field"><label>Apellido</label><div class="ro-text">${esc(apellido)}</div></div>
      </div>
      <div class="row2">
        <div class="field"><label>País</label><div class="ro-text" style="display:flex;align-items:center;gap:6px">${flagImgByIso(p.countryIso,14)}<span>${esc(p.country)}</span></div></div>
        <div class="field"><label>Ciudad donde vives</label><div class="ro-text">${esc(p.city)}</div></div>
      </div>
      <div class="field"><label>Correo electrónico</label><div class="ro-text">${esc(p.email)}</div></div>
      <div class="field-hint">Código: <b>${esc(p.codigo)}</b></div>`;
  }
  return `
    <div class="row2">
      <div class="field"><label>Nombre</label><input type="text" class="wiz-input" data-field="nombre" value="${esc(nombre)}"></div>
      <div class="field"><label>Apellido</label><input type="text" class="wiz-input" data-field="apellido" value="${esc(apellido)}"></div>
    </div>
    ${buildCountryCityFieldsHtml('pp', p.country, p.countryIso, p.city)}
    <div class="field"><label>Correo electrónico</label><input type="email" class="wiz-input" data-field="email" value="${esc(p.email)}"></div>
    <div class="field-hint">Tu código <b>${esc(p.codigo)}</b> y tu Clave no se cambian aquí.</div>`;
}

function buildGroupsStepHtml(preds, readOnly){
  const groups = {};
  GROUP_MATCHES.forEach(m=>{ (groups[m.g]=groups[m.g]||[]).push(m); });
  return Object.keys(groups).sort().map(g=>{
    const rows = groups[g].map(m=>groupRowHtml(m, preds, readOnly)).join('');
    return `<div class="group-head">Grupo ${g}</div>${rows}`;
  }).join('');
}

function buildKoStepHtml(key, bracket, preds, readOnly){
  if(!bracket.ready){
    const groupsAnswered = GROUP_MATCHES.filter(m=>groupMatchResult(m.id,preds)).length;
    return `<div class="note">Los cruces se calculan automáticamente cuando termines la Fase de grupos. Te faltan <b>${72-groupsAnswered}</b> partido(s) de grupos.</div>`;
  }
  const slots = koSlotsOf(bracket, key);
  let extra = '';
  // v1.2 — Las "Clasificados" + el badge "cruce simplificado" solo tienen
  // sentido cuando r32 se sembró de los grupos predichos (bracket.q
  // existe). Si esta fase arrancó con equipos REALES (bracket.realSeedKey
  // === key — torneo que empieza directo en esta fase), se avisa eso en
  // su lugar en vez de mostrar un sembrado que no existió.
  if(key==='r32' && bracket.q){
    extra = `<div class="note" style="margin-bottom:.75rem">🏅 <b>Clasificados</b> (24 directos + 8 mejores terceros, calculados de tus resultados de grupo):<br><br>` +
      bracket.q.seeded.map(t=>`${flagOf(t)} ${esc(t)}`).join(' &nbsp;·&nbsp; ') + `</div>`;
  }
  let tag = (key==='r32' && bracket.q) ? `<div class="note" style="margin-top:-.4rem;margin-bottom:.75rem"><span class="badge badge-yellow">cruce simplificado</span> no es el draw oficial de FIFA.</div>` : '';
  if(bracket.realSeedKey===key){
    const someTeamsMissing = slots.some(m=>!m.a||!m.b);
    tag = `<div class="note" style="margin-bottom:.75rem">⚽ Estos son los equipos <b>reales</b> de esta fase del torneo (los carga el organizador). ${someTeamsMissing?'Todavía faltan algunos por confirmar — vuelve más tarde si ves "Pendiente".':'Adivina el resultado de cada cruce.'}</div>`;
  }
  const trustSlot = bracket.realSeedKey===key;
  return tag + extra + slots.map(m=>renderKoRow(m.slot, m.a, m.b, preds, readOnly, trustSlot)).join('');
}

function buildSpecialStepHtml(preds, readOnly, bracket){
  const sp = preds.special || {};
  const auto = computeAutoSpecial(bracket);
  const visible = activeSpecialQuestions();
  if(!visible.length) return `<div class="note">El administrador desactivó todas las preguntas avanzadas de este torneo.</div>`;
  return visible.map(q=>{
    const isAuto = AUTO_SPECIAL_IDS.includes(q.id);

    if(isAuto){
      // v0.7 (Fase 4): "quemado" — siempre de solo lectura, en todos los
      // casos (editable o no), porque el valor sale del bracket, no de una
      // elección del usuario. Nunca se imprime un <select> para estos 3.
      const val = auto[q.id] || '';
      const hint = q.id==='tercer'
        ? 'Se completa solo, según tu resultado del partido por el Tercer lugar.'
        : 'Se completa solo, según tu resultado de la Final.';
      const tag = `<span class="badge badge-muted" style="margin-left:6px;font-size:9px">auto</span>`;
      if(val){
        return `<div class="field">
            <label>${esc(q.label)}${tag}</label>
            <div class="ro-text" style="display:flex;align-items:center;gap:6px">${flagOf(val)}<span>${esc(val)}</span></div>
            <div class="field-hint">${hint}</div>
          </div>`;
      }
      return `<div class="field">
          <label>${esc(q.label)}${tag}</label>
          <div class="ro-text muted">Pendiente</div>
          <div class="field-hint">${hint}</div>
        </div>`;
    }

    const val = sp[q.id] !== undefined ? sp[q.id] : '';
    if(readOnly){
      if(q.type==='team' && val){
        return `<div class="field"><label>${esc(q.label)}</label><div class="ro-text" style="display:flex;align-items:center;gap:6px">${flagOf(val)}<span>${esc(val)}</span></div></div>`;
      }
      const shown = val;
      return `<div class="field"><label>${esc(q.label)}</label><div class="ro-text">${shown!==''?esc(String(shown)):'—'}</div></div>`;
    }
    if(q.type==='team'){
      // Nota: un <option> nativo solo admite texto (no puede contener <img>),
      // así que aquí se muestra el nombre del equipo sin bandera. La bandera
      // sí aparece en todas las filas visuales (grupos, llaves, PDF, resumen).
      const opts = `<option value="">— elegir equipo —</option>` +
        ALL_TEAMS.map(t=>`<option value="${esc(t)}" ${val===t?'selected':''}>${esc(t)}</option>`).join('');
      return `<div class="field"><label>${esc(q.label)}</label><select class="special-input" data-qid="${q.id}">${opts}</select></div>`;
    }
    if(q.type==='number'){
      return `<div class="field"><label>${esc(q.label)}</label><input type="number" min="0" max="99" class="special-input score-input" style="width:100%;text-align:left" data-qid="${q.id}" value="${val===''?'':val}"></div>`;
    }
    return `<div class="field"><label>${esc(q.label)}</label><input type="text" class="special-input" data-qid="${q.id}" value="${esc(String(val))}" placeholder="${esc(q.placeholder||'')}"></div>`;
  }).join('');
}

function buildReviewSummaryHtml(p, preds, bracket, readOnly){
  // v6.5 — Antes esta tarjeta repetía, partido por partido, toda la fase
  // de grupos + eliminatoria + preguntas especiales (con sus bullets y
  // "pendiente, vuelve a revisar"). Quedó como una lista enorme justo antes
  // de enviar, que no aportaba nada nuevo (ya se revisó paso a paso en el
  // wizard) y solo generaba fricción. Ahora la confirmación se limita a los
  // datos del participante; buildStatusCard() (arriba) ya resume el avance
  // por fase con su botón "Ir al pendiente" si algo falta.
  return `<div class="card">
      <div class="card-title">👤 Participante</div>
      <div class="status-row"><span>Nombre</span><span class="ro-text">${esc(p.name)}</span></div>
      <div class="status-row"><span>Código</span><span class="ro-text">${esc(p.codigo)}</span></div>
      <div class="status-row"><span>Ciudad / País</span><span class="ro-text">${esc(p.city)}, ${esc(p.country)}</span></div>
      <div class="status-row"><span>Correo</span><span class="ro-text">${esc(p.email)}</span></div>
      ${!readOnly ? `<div class="rg-btn-row" style="margin-top:.6rem"><button class="rg-btn rg-btn-ghost" id="btn_edit_personal" style="font-size:11.5px;padding:6px 12px">✏️ Editar mis datos</button></div>` : ''}
    </div>`;
}

function buildReviewStepHtml(pid, p, preds, bracket, readOnly){
  const status = getCompletionStatus(pid);
  let html = buildReviewSummaryHtml(p, preds, bracket, readOnly);

  if(p.estadoQuiniela==='enviada'){
    // v1.0 — Una vez enviada, el botón cambia para siempre a "generar
    // copia": ya no envía ni modifica nada, solo abre el PDF de nuevo.
    html += `<div class="locked-banner">✅ <b>Quiniela enviada</b> el ${fmtDate(p.fechaEnvio)}. Quedó bloqueada para edición. Si necesitas corregir algo, contacta al administrador para que la reabra.</div>
      <div class="rg-btn-row"><button class="rg-btn rg-btn-gold rg-btn-block" id="btn_pdf_copy">📄 Generar copia en PDF de mi Quiniela</button></div>`;
  }else if(readOnly){
    // Cerrado por fecha límite (isGloballyClosed), pero nunca llegó a
    // enviarse oficialmente — distinto del caso "enviada" de arriba.
    html += `<div class="locked-banner" style="border-color:var(--qb-yellow);color:var(--qb-yellow);background:var(--qb-gold-dim)">🔒 Las inscripciones y modificaciones han sido cerradas. Ya no es posible enviar esta quiniela.</div>
      <div class="rg-btn-row"><button class="rg-btn rg-btn-ghost rg-btn-block" id="btn_pdf_copy">📄 Generar PDF de mi Quiniela (sin enviar)</button></div>`;
  }else{
    // v1.0 — Un solo botón principal: "Enviar mi Quiniela y Generar PDF".
    // Antes existían dos botones separados (Enviar / Generar PDF) y eso
    // generaba confusión sobre cuál de los dos "contaba" como el envío
    // real; ahora es una sola acción atómica.
    // v3.1.1 — el aviso de "100% completa" (antes en su propia tarjeta,
    // buildStatusCard(), ya eliminada) se fusiona acá mismo, al lado del
    // aviso de "todo listo" -- misma información (ambos dependen de
    // status.complete), una sola tarjeta en vez de dos.
    const missing = status.phases.filter(ph=>ph.done<ph.total).map(ph=>`${ph.label} (faltan ${ph.total-ph.done})`);
    html += `<div class="card">
        <div class="card-title">📨 Enviar mi quiniela</div>
        ${missing.length
          ? `<div class="note">Aún falta: ${esc(missing.join(' · '))}.</div>`
          : `<div class="note" style="border-color:var(--qb-green);color:var(--qb-green)">¡Todo listo para enviar tu quiniela está 100% completa!</div>`}
        <label class="confirm-check">
          <input type="checkbox" id="confirm_check" ${status.complete?'':'disabled'}>
          <span>Confirmo que mis predicciones son correctas y deseo enviarlas.</span>
        </label>
        <button class="rg-btn rg-btn-primary rg-btn-block" id="btn_submit" disabled>📨 Enviar mi Quiniela y Generar PDF</button>
      </div>`;
  }
  // v2.7.2 — Botón de WhatsApp al final del último paso, sin importar el
  // estado (enviada/cerrada/pendiente) -- unirse al grupo tiene sentido
  // en cualquiera de los 3 casos. Vacío si no hay enlace configurado.
  const whatsappBtn = buildWhatsappBtnHtml();
  if(whatsappBtn) html += `<div class="rg-btn-row" style="margin-top:.75rem;justify-content:center">${whatsappBtn}</div>`;
  return html;
}

function buildStepperHtml(idx){
  // v1.1 — "Datos personales" ya no se cuenta como paso visible (se llena
  // en el formulario de creación, no aquí), pero sigue existiendo en
  // WIZARD_STEPS para no romper el lastStep guardado de quinielas viejas.
  // Solo se llega a él por el botón "✏️ Editar mis datos" en Revisión final.
  const visible = WIZARD_STEPS.filter(s=>s.key!=='personal' && isStepActive(s.key));
  const dots = visible.map(s=>{
    const realIdx = WIZARD_STEPS.indexOf(s);
    const cls = realIdx===idx ? 'on' : (realIdx<idx ? 'done' : '');
    return `<div class="step-dot ${cls}" data-step="${realIdx}" title="${esc(s.label)}">${visible.indexOf(s)+1}</div>`;
  }).join('<div class="step-line"></div>');
  const current = WIZARD_STEPS[idx];
  const label = current.key==='personal'
    ? `<div class="stepper-label">✏️ Editando: <b>${current.icon} ${esc(current.label)}</b></div>`
    : `<div class="stepper-label">Paso ${visible.indexOf(current)+1} de ${visible.length}: <b>${current.icon} ${esc(current.label)}</b></div>`;
  return `<div class="stepper">${dots}</div>${label}`;
}

/* ════════════════════════════════════════
   CONTROLADOR DEL WIZARD (sustituye al formulario plano de v0.2)
   ════════════════════════════════════════ */
function renderQuinielaForm(pid, originTab){
  const p = DB.participants.find(x=>x.id===pid);
  if(!p){ clearDraft(); render(); return; }
  const c = document.getElementById('rg-content');
  const readOnly = isLocked(p) && !ADMIN_OVERRIDE;
  const step = WIZARD_STEPS[WIZ_STEP];
  const bracket = computeBracket(DRAFT_PREDS);

  let bodyHtml;
  if(step.key==='personal') bodyHtml = buildPersonalStepHtml({...p, ...DRAFT_PERSONAL}, readOnly);
  else if(step.key==='groups') bodyHtml = buildGroupsStepHtml(DRAFT_PREDS, readOnly);
  else if(step.key==='special') bodyHtml = buildSpecialStepHtml(DRAFT_PREDS, readOnly, bracket);
  else if(step.key==='review') bodyHtml = buildReviewStepHtml(pid, p, DRAFT_PREDS, bracket, readOnly);
  else bodyHtml = buildKoStepHtml(step.key, bracket, DRAFT_PREDS, readOnly);

  const visIdx = visibleStepIndices();
  const isFirst = step.key==='personal' || WIZ_STEP===visIdx[0], isLast = WIZ_STEP===visIdx[visIdx.length-1];
  // v0.9 (Fase 7) — Los 3 botones de navegación van en una sola fila con
  // grid de 3 columnas (1fr / auto / 1fr): "Guardar y continuar después"
  // siempre cae en la columna del medio (centrada), y Anterior/Siguiente
  // se estiran en sus columnas laterales — se usa un <span> vacío cuando
  // alguno de los tres no aplica (primer paso, último paso, o solo
  // lectura), así el del medio nunca se descentra.
  const leftBtn  = !isFirst ? `<button class="rg-btn rg-btn-ghost" id="wiz_prev">← Anterior</button>` : `<span></span>`;
  const midBtn   = !readOnly ? `<button class="rg-btn rg-btn-ghost" id="wiz_save_exit" style="font-size:11.5px;padding:7px 14px;white-space:nowrap">💾 Guardar</button>` : `<span></span>`;
  const rightBtn = !isLast ? `<button class="rg-btn rg-btn-primary" id="wiz_next">Siguiente →</button>` : `<span></span>`;
  const navHtml = `
    <div class="wiz-nav-row" style="position:sticky;bottom:0;background:var(--qb-black);padding:.75rem 0">
      ${leftBtn}${midBtn}${rightBtn}
    </div>`;

  const adminBanner = (ADMIN_OVERRIDE && isLocked(p)) ? `<div class="note" style="border-color:var(--qb-yellow);color:var(--qb-yellow)">Estás editando como administrador (override): esta quiniela está enviada, pero puedes corregirla igual.</div>` : '';
  const previewBanner = PREVIEW_AS_PARTICIPANT ? `<div class="note" style="border-color:var(--qb-blue);color:var(--qb-blue)">👁️ Vista previa de administrador — esto es exactamente lo que vería <b>${esc(p.name)}</b> al entrar con su correo y su Clave.</div>` : '';
  const closedByDeadline = isGloballyClosed() && p.estadoQuiniela!=='enviada';
  const lockedTopBanner = (readOnly && step.key!=='review')
    ? (closedByDeadline
        ? `<div class="locked-banner" style="border-color:var(--qb-yellow);color:var(--qb-yellow);background:var(--qb-gold-dim)">🔒 Las inscripciones y modificaciones han sido cerradas.</div>`
        : `<div class="locked-banner">✅ Quiniela enviada el ${fmtDate(p.fechaEnvio)} — solo lectura.</div>`)
    : '';

  // v1.6 — Saludo + cuenta regresiva (arriba a la izquierda): solo tiene
  // sentido mostrarlo mientras la quiniela sigue editable y hay un cierre
  // configurado -- una vez enviada o cerrado el plazo, ya está el
  // lockedTopBanner de arriba diciendo justamente eso, así que no se
  // pisan. El texto en sí (id="wiz_countdown_text") lo actualiza
  // tickWizCountdown() cada segundo SIN re-renderizar todo el wizard
  // (evita perder el foco de quien esté tecleando un marcador).
  const cierreTs = getCierreTimestamp();
  const showCountdown = !readOnly && cierreTs!==null && !closedByDeadline;
  const firstName = (p.name||'').trim().split(/\s+/)[0] || p.name || '';
  const greetingHtml = showCountdown
    ? `<div class="wiz-greeting">👋 Hola, <b>${esc(firstName)}</b> — tienes <b id="wiz_countdown_text">${esc(formatCountdown(cierreTs-Date.now()))}</b> para completar tu registro</div>`
    : `<span></span>`;
  const exitBtnHtml = `<button class="rg-btn rg-btn-ghost wiz-exit-btn" id="wiz_exit_btn" title="Salir">✕ Salir</button>`;
  const topBarHtml = `<div class="wiz-topbar">${greetingHtml}${exitBtnHtml}</div>`;

  c.innerHTML = `
    ${topBarHtml}
    <div class="card">
      ${buildStepperHtml(WIZ_STEP)}
      <div id="wiz_save_indicator" class="save-indicator">&nbsp;</div>
      ${adminBanner}
      ${previewBanner}
      ${lockedTopBanner}
      <div class="card-title">${step.icon} ${esc(step.label)}</div>
      ${bodyHtml}
    </div>
    ${navHtml}
    ${(!readOnly && step.key==='personal') ? `<div class="rg-btn-row"><button class="rg-btn rg-btn-danger" id="q_delete">Eliminar mi registro</button></div>` : ''}
  `;

  // v1.6 — Botón "Salir": mismo patrón exacto que "dash_logout_btn" del
  // Dashboard post-bloqueo (no duplica un criterio nuevo de "hay cambios
  // sin guardar" -- reusa WIZ_DIRTY + showExitModal ya existentes). No
  // borra nada en Firestore ni el ownerUid de este dispositivo, solo
  // cierra el wizard y vuelve a la pantalla de inicio de "Mi Quiniela".
  document.getElementById('wiz_exit_btn')?.addEventListener('click', ()=>{
    const doSalir = ()=>{ clearDraft(); render(); };
    if(DRAFT_PID && WIZ_DIRTY){ showExitModal(doSalir); return; }
    doSalir();
  });

  if(!readOnly){
    if(step.key==='personal'){
      c.querySelectorAll('.wiz-input').forEach(inp=>{
        inp.addEventListener('input', ()=>{
          if(inp.dataset.field==='nombre' || inp.dataset.field==='apellido'){
            // v1.1 — Nombre y Apellido se editan por separado, pero el resto
            // del sistema (ranking, login, scoring) sigue identificando al
            // participante por un solo "name" combinado — se recombinan acá
            // en cada tecla, igual que al crear la quiniela.
            const nombreVal = c.querySelector('.wiz-input[data-field="nombre"]').value;
            const apellidoVal = c.querySelector('.wiz-input[data-field="apellido"]').value;
            DRAFT_PERSONAL.name = `${nombreVal.trim()} ${apellidoVal.trim()}`.trim();
          }else{
            DRAFT_PERSONAL[inp.dataset.field] = inp.value;
          }
          scheduleAutosave();
        });
      });
      wireCountryCityFields('pp', ()=>{
        DRAFT_PERSONAL.country = document.getElementById('pp_country').value;
        DRAFT_PERSONAL.countryIso = document.getElementById('pp_country_iso').value;
        DRAFT_PERSONAL.city = document.getElementById('pp_city').value;
        scheduleAutosave();
      });
    }
    if(step.key==='groups'){
      c.querySelectorAll('.score-input[data-mid]').forEach(inp=>{
        inp.addEventListener('input', ()=>{
          const mid = inp.dataset.mid, side = inp.dataset.side;
          const val = inp.value === '' ? null : Math.max(0, Math.min(20, parseInt(inp.value,10)||0));
          DRAFT_PREDS[mid] = DRAFT_PREDS[mid] || {};
          DRAFT_PREDS[mid][side] = val;
          scheduleAutosave();
        });
      });
    }
    if(['r32','r16','qf','sf','third','final'].includes(step.key)){
      c.querySelectorAll('.score-input[data-slot]').forEach(inp=>{
        inp.addEventListener('input', ()=>{
          const slot=inp.dataset.slot, side=inp.dataset.side, ta=inp.dataset.a, tb=inp.dataset.b;
          const val = inp.value==='' ? null : Math.max(0, Math.min(20, parseInt(inp.value,10)||0));
          const oldRec = DRAFT_PREDS[slot] ? {...DRAFT_PREDS[slot]} : null; // v3.1.4 — foto de ANTES, para propagar el cambio de ganador
          DRAFT_PREDS[slot] = DRAFT_PREDS[slot] || {};
          DRAFT_PREDS[slot][side] = val;
          DRAFT_PREDS[slot]._a = ta; DRAFT_PREDS[slot]._b = tb;
          propagateMigratedKoChange(DRAFT_PREDS, slot, oldRec); // v3.1.4
          scheduleAutosave();

          // Reactivo: aparece/desaparece al instante, sin esperar a cambiar
          // de paso y sin perder el foco (no se re-renderiza el paso entero).
          const pr = DRAFT_PREDS[slot];
          const tiedNow = Number.isInteger(pr.h) && Number.isInteger(pr.a) && pr.h===pr.a;
          const pickRow = document.getElementById('pickrow_'+slot);
          if(pickRow) pickRow.style.display = tiedNow ? 'block' : 'none';
          if(!tiedNow && pr.pick){ delete pr.pick; } // ya no aplica el penal elegido para el empate anterior
        });
      });
      c.querySelectorAll('.ko-pick').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const slot=btn.dataset.slot, ta=btn.dataset.a, tb=btn.dataset.b, team=btn.dataset.team;
          const oldRec = DRAFT_PREDS[slot] ? {...DRAFT_PREDS[slot]} : null; // v3.1.4
          DRAFT_PREDS[slot] = DRAFT_PREDS[slot] || {};
          DRAFT_PREDS[slot].pick = team; DRAFT_PREDS[slot]._a=ta; DRAFT_PREDS[slot]._b=tb;
          propagateMigratedKoChange(DRAFT_PREDS, slot, oldRec); // v3.1.4
          c.querySelectorAll(`.ko-pick[data-slot="${slot}"]`).forEach(x=>x.classList.toggle('sel', x===btn));
          scheduleAutosave(50);
        });
      });
    }
    if(step.key==='special'){
      c.querySelectorAll('.special-input').forEach(inp=>{
        const handler = ()=>{
          const qid = inp.dataset.qid;
          DRAFT_PREDS.special = DRAFT_PREDS.special || {};
          if(inp.tagName==='SELECT' || inp.type==='text'){
            DRAFT_PREDS.special[qid] = inp.value;
          }else{
            DRAFT_PREDS.special[qid] = inp.value==='' ? '' : Math.max(0, Math.min(99, parseInt(inp.value,10)||0));
          }
          scheduleAutosave();
        };
        inp.addEventListener('input', handler);
        inp.addEventListener('change', handler);
      });
    }
    if(step.key==='review'){
      document.getElementById('btn_edit_personal')?.addEventListener('click', ()=> goToStep(WIZARD_STEPS.findIndex(s=>s.key==='personal')));
      const chk = document.getElementById('confirm_check');
      const btn = document.getElementById('btn_submit');
      if(chk && btn) chk.addEventListener('change', ()=>{ btn.disabled = !chk.checked; });
      if(btn) btn.addEventListener('click', ()=>{
        flushAutosave();
        const st = getCompletionStatus(pid);
        if(!st.complete){ toast('Faltan elementos por completar.', true); return; }
        // v6.4 — Antes de marcar como enviada, "quemamos" campeón/subcampeón/
        // 3er lugar dentro de preds.special. computeAutoSpecial() ya los
        // calculaba para mostrarlos en pantalla (Especiales y Revisión), pero
        // nunca se persistían — scoring.js (calcAdv) los necesita ahí adentro
        // para otorgar los 15+10+8 pts. Sin esto, todo participante que entra
        // por el wizard (no migrado del sistema legacy) pierde esos puntos
        // silenciosamente. Ver backfillAutoSpecialForAll() para los que ya
        // enviaron su quiniela antes de este fix.
        const finalBracket = computeBracket(DRAFT_PREDS);
        const autoSp = computeAutoSpecial(finalBracket);
        DRAFT_PREDS.special = {...(DRAFT_PREDS.special||{}), ...autoSp};
        flushAutosave();

        // v2.7.4 — BUG REPORTADO: "a veces descarga la quiniela pero no la
        // envía". Antes esto era optimista igual que la creación de
        // participante lo era hasta la v7.5 (ver rgSubmitParticipantConfirmed,
        // participantes.js, para la causa raíz completa): se marcaba
        // 'enviada', se mostraba el toast de éxito y se disparaba el PDF
        // ANTES de saber si Firestore aceptó la escritura de verdad. Ahora
        // se espera la confirmación real del servidor primero; el botón se
        // deshabilita mientras tanto para evitar un doble envío.
        const preds = DB.predictions[p.id] || {};
        const pEnviada = { ...p, estadoQuiniela:'enviada', fechaEnvio: Date.now(), fechaActualizacion: Date.now() };
        const btnTextoOriginal = btn.textContent;
        btn.disabled = true; btn.textContent = 'Enviando...';

        rgSubmitParticipantConfirmed(pEnviada, preds).then(()=>{
          p.estadoQuiniela = pEnviada.estadoQuiniela;
          p.fechaEnvio = pEnviada.fechaEnvio;
          p.fechaActualizacion = pEnviada.fechaActualizacion;
          saveData(DB); // el documento público ya se confirmó arriba; esto solo persiste meta/nextSeq y la copia local
          toast('Tu quiniela fue enviada correctamente.');
          render();
          generarPDF(p); // se dispara después de pintar el nuevo estado "enviada"
        }).catch(err=>{
          console.error("Error al enviar la quiniela:", err);
          btn.disabled = false; btn.textContent = btnTextoOriginal;
          if(err && err.code === 'permission-denied'){
            toast('No se pudo enviar tu quiniela: el servidor lo rechazó (permiso denegado). Avisale a quien administra la quiniela y probá de nuevo en un momento.', true);
          }else{
            toast('No se pudo enviar tu quiniela (' + (err && err.message ? err.message : 'error desconocido') + '). Revisá tu conexión e intentá de nuevo.', true);
          }
        });
      });
    }
  }

  const goToStep = (idx)=>{
    if(idx > WIZ_STEP && !ADMIN_OVERRIDE){
      const personalMerged = {...p, ...DRAFT_PERSONAL};
      const blockers = getStepBlockers(idx, p, personalMerged, DRAFT_PREDS);
      if(blockers.length){ showBlockModal(blockers); return; }
    }
    // v2.7.2 — Recordatorio (snack) al ENTRAR al último paso, no en cada
    // re-render de ese mismo paso (ej. el eco del autoguardado) -- por
    // eso se compara "idx" contra el WIZ_STEP VIEJO, antes de pisarlo.
    // Nada que recordar si ya está enviada o si el registro está
    // bloqueado (ahí el paso muestra otro mensaje, no el de "enviar").
    const entrandoARevisar = idx!==WIZ_STEP && WIZARD_STEPS[idx]?.key==='review'
      && p.estadoQuiniela!=='enviada' && !isLocked(p);
    WIZ_STEP = idx; flushAutosave(); render();
    if(entrandoARevisar) toast('📝 ¡Ya casi! Revisá todo y no olvides tocar "Enviar mi Quiniela" para que cuente.');
  };
  document.getElementById('wiz_prev')?.addEventListener('click', ()=> goToStep(adjacentVisibleStepIdx(WIZ_STEP,-1)));
  document.getElementById('wiz_next')?.addEventListener('click', ()=> goToStep(adjacentVisibleStepIdx(WIZ_STEP,+1)));
  c.querySelectorAll('.step-dot').forEach(dot=>{
    dot.addEventListener('click', ()=> goToStep(parseInt(dot.dataset.step,10)));
  });

  // v1.0 — "Generar copia en PDF" se muestra tanto si ya está enviada
  // como si quedó cerrada por fecha límite sin enviar (ambos casos son
  // readOnly), así que se conecta FUERA del bloque if(!readOnly) de arriba.
  document.getElementById('btn_pdf_copy')?.addEventListener('click', ()=> generarPDF(p));

  document.getElementById('wiz_save_exit')?.addEventListener('click', ()=>{
    flushAutosave();
    toast('Guardado.');
  });

  document.getElementById('q_delete')?.addEventListener('click', ()=>{
    if(!confirm(`¿Seguro que quieres eliminar el registro de "${p.name}"? Esto borra también su quiniela y no se puede deshacer.`)) return;
    DB.participants = DB.participants.filter(x=>x.id!==p.id);
    delete DB.predictions[p.id];
    // v6.4 — saveData(DB) por sí solo nunca borra documentos en Firestore
    // (el diff genérico solo agrega/actualiza lo que sigue en la lista),
    // así que el documento de ESTE participante necesita su propio
    // borrado explícito — permitido por la regla de Firestore porque
    // quien ejecuta esto es su propio dueño (ownerUid coincide).
    rgDeleteParticipantDoc(p.id);
    clearDraft();
    toast('Registro eliminado.');
    render();
  });
}

/* ════════════════════════════════════════
   FUNCIONES AUXILIARES DEL PANEL ADMIN — v0.8 (Fase 5)
   Separadas de renderAdmin() para poder refrescar solo la tabla de
   participantes (buscador, regenerar clave, cambiar estado, eliminar) sin
   re-renderizar TODA la pestaña — así el campo de búsqueda nunca pierde
   el foco mientras se escribe.
   ════════════════════════════════════════ */
function buildStatsHtml(){
  const total = totalMatches();
  const totalP = DB.participants.length;
  const enviadas = DB.participants.filter(p=>p.estadoQuiniela==='enviada').length;
  const borradores = totalP - enviadas;
  const completas = DB.participants.filter(p=> countAnswered(p.id)===total).length;
  const incompletas = totalP - completas;
  const stats = [
    ['Total participantes', totalP],
    ['Quinielas enviadas', enviadas],
    ['Quinielas en borrador', borradores],
    ['Quinielas completadas', completas],
    ['Quinielas incompletas', incompletas]
  ];
  return `<div class="stat-grid">` + stats.map(([label,val])=>`
    <div class="stat-box">
      <div class="stat-num">${val}</div>
      <div class="stat-label">${label}</div>
    </div>`).join('') + `</div>`;
}

// Buscador: por nombre, correo, código de participante o Clave (todo
// insensible a mayúsculas/acentos básicos, vía la misma norm() del login).
function matchesAdminSearch(p, q){
  if(!q || !q.trim()) return true;
  const needle = norm(q);
  return norm(p.name).includes(needle) ||
    norm(p.email||'').includes(needle) ||
    norm(p.codigo||'').includes(needle) ||
    norm(p.clave||'').includes(needle);
}

// v0.9 (Fase 7) — Filtro rápido por estado de avance, combinado (AND) con
// el texto del buscador.
function matchesAdminFilter(p, mode, total){
  if(mode==='completas') return countAnswered(p.id)===total;
  if(mode==='incompletas') return countAnswered(p.id)<total;
  return true; // 'all'
}

function buildParticipantsRowsHtml(filterText, filterMode){
  const total = totalMatches();
  const list = DB.participants
    .filter(p=>matchesAdminSearch(p, filterText) && matchesAdminFilter(p, filterMode||'all', total))
    .slice()
    .sort((a,b)=> a.name.localeCompare(b.name));

  if(!list.length){
    const icon = DB.participants.length ? '🔍' : '👻';
    const msg = DB.participants.length
      ? 'Buscaste tan específico que ni vos aparecerías. Probá con menos filtro.'
      : 'Ni un alma registrada todavía. ¿Mandaste el link o lo tenés guardado "para después"?';
    return `<div class="muted center" style="padding:1.5rem 0">
      <div style="font-size:32px;margin-bottom:.5rem">${icon}</div>
      <div>${msg}</div>
    </div>`;
  }

  const rows = list.map(p=>{
    const ans = countAnswered(p.id);
    const pct = Math.round((ans/total)*100);
    const cls = pct===100 ? 'badge-green' : (pct>0 ? 'badge-yellow' : 'badge-muted');
    const estadoCls = p.estadoQuiniela==='enviada' ? 'badge-green' : 'badge-muted';
    const hasNota = p.notaAdmin && p.notaAdmin.trim();
    return `
      <tr>
        <td class="muted">${esc(p.codigo||'—')}</td>
        <td class="admin-name-cell">${esc(p.name)}</td>
        <td class="muted">${esc(p.email||'—')}</td>
        <td class="muted">${esc(p.city)}, ${esc(p.country)}</td>
        <td class="muted">${esc(p.clave||'—')}</td>
        <td class="muted">${fmtDate(p.fechaCreacion)}</td>
        <td class="muted">${fmtDate(p.fechaEnvio)}</td>
        <td><span class="badge ${estadoCls}" data-act="toggle-estado" data-id="${p.id}" style="cursor:pointer" title="Click para reabrir (si está enviada) o marcar como enviada (si está en borrador)">${esc(p.estadoQuiniela)}</span></td>
        <td><span class="badge ${cls}">${pct}%</span></td>
        <td style="white-space:nowrap">
          <button class="icon-btn" data-act="edit" data-id="${p.id}" title="Editar (modo administrador)" aria-label="Editar (modo administrador)">✏️</button>
          <button class="icon-btn" data-act="preview" data-id="${p.id}" title="Ver como participante" aria-label="Ver como participante">👁️</button>
          <button class="icon-btn" data-act="pdf" data-id="${p.id}" title="Generar PDF" aria-label="Generar PDF">📄</button>
          <button class="icon-btn" data-act="regen-clave" data-id="${p.id}" title="Regenerar clave" aria-label="Regenerar clave">🔑</button>
          <button class="icon-btn ${hasNota?'icon-btn-has-note':''}" data-act="nota" data-id="${p.id}" title="${hasNota?esc(p.notaAdmin):'Agregar nota interna'}" aria-label="${hasNota?'Editar nota interna':'Agregar nota interna'}">${hasNota?'🗒️':'📝'}</button>
          <button class="icon-btn" data-act="dup" data-id="${p.id}" title="Duplicar (para pruebas)" aria-label="Duplicar participante para pruebas">📋</button>
          <button class="icon-btn" data-act="del" data-id="${p.id}" title="Eliminar" aria-label="Eliminar participante">🗑️</button>
        </td>
      </tr>`;
  }).join('');

  return `<div style="overflow-x:auto">
      <table class="admin">
        <thead><tr>
          <th>Código</th><th>Nombre</th><th>Correo</th><th>Ubicación</th><th>Clave</th>
          <th>Creado</th><th>Enviado</th><th>Estado</th><th>Avance</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// Refresca solo la tabla + estadísticas + contador del título (no toda la
// pestaña Admin), para no perder el foco del buscador mientras se escribe.
function refreshAdminTable(){
  const tableWrap = document.getElementById('admin_table_wrap');
  if(tableWrap){ tableWrap.innerHTML = buildParticipantsRowsHtml(ADMIN_SEARCH, ADMIN_FILTER); wireParticipantsTable(); }
  const statsWrap = document.getElementById('admin_stats_wrap');
  if(statsWrap) statsWrap.innerHTML = buildStatsHtml();
  const badge = document.getElementById('admin_total_badge');
  if(badge) badge.textContent = DB.participants.length;
}

function wireParticipantsTable(){
  document.getElementById('admin_table_wrap').querySelectorAll('[data-act]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const id = el.dataset.id;
      const p = DB.participants.find(x=>x.id===id);
      if(!p) return;

      if(el.dataset.act==='edit'){
        DRAFT_PID = id;
        ADMIN_OVERRIDE = true;
        PREVIEW_AS_PARTICIPANT = false;
        DRAFT_PREDS = JSON.parse(JSON.stringify(DB.predictions[id] || {}));
        DRAFT_PERSONAL = {};
        WIZ_STEP = 0;
        WIZ_DIRTY = false;
        switchToInicioTab();

      }else if(el.dataset.act==='preview'){
        // "Ver como participante" — exactamente la misma vista que vería el
        // jugador al entrar con su correo y su Clave (sin privilegios de
        // administrador: respeta el bloqueo de avance y el solo-lectura si
        // ya está enviada o si el cierre automático ya pasó).
        enterWizardAs(p, {preview:true});
        switchToInicioTab();

      }else if(el.dataset.act==='pdf'){
        generarPDF(p);

      }else if(el.dataset.act==='regen-clave'){
        if(!confirm(`¿Regenerar la clave de "${p.name}"? La clave anterior dejará de funcionar de inmediato.`)) return;
        const nueva = genClave();
        p.clave = nueva;
        p.fechaActualizacion = Date.now();
        saveData(DB);
        toast(`Nueva clave de ${p.name}: ${nueva}`);
        refreshAdminTable();

      }else if(el.dataset.act==='nota'){
        // v0.9 (Fase 7) — Nota interna, NUNCA visible para el participante.
        const actual = p.notaAdmin || '';
        const nueva = prompt(`Nota interna sobre "${p.name}" (solo la ve el administrador):`, actual);
        if(nueva===null) return; // canceló
        p.notaAdmin = nueva.trim();
        p.fechaActualizacion = Date.now();
        saveData(DB);
        toast(p.notaAdmin ? 'Nota guardada.' : 'Nota eliminada.');
        refreshAdminTable();

      }else if(el.dataset.act==='dup'){
        // v1.7 — Duplicar participante (con toda su quiniela) para poder
        // probar el Ranking/Estadísticas/Bracket con varios participantes
        // sin llenar el wizard a mano cada vez. La copia es un
        // participante 100% independiente (id/código/clave propios): se
        // arma igual que un alta real, solo que a mano y con las
        // predicciones ya clonadas. Se limpian correo y clave (email en
        // blanco, clave regenerada) para que nunca choque con el
        // buscador de correo duplicado ni permita "reclamar" la copia con
        // la clave del original.
        const clone = JSON.parse(JSON.stringify(p));
        const baseName = `${p.name} (copia)`;
        let name = baseName, n = 2;
        while(DB.participants.some(x=>norm(x.name)===norm(name))){ name = `${baseName} ${n}`; n++; }
        clone.id = uid();
        clone.codigo = nextCode();
        clone.name = name;
        clone.email = '';
        clone.clave = genClave();
        clone.ownerUid = null;
        clone.notaAdmin = '';
        clone.fechaCreacion = Date.now();
        clone.fechaActualizacion = Date.now();
        DB.participants.push(clone);
        DB.predictions[clone.id] = JSON.parse(JSON.stringify(DB.predictions[id] || {}));
        saveData(DB);
        toast(`"${name}" creado como copia de "${p.name}".`);
        refreshAdminTable();

      }else if(el.dataset.act==='del'){
        if(!confirm(`¿Eliminar a "${p.name}" y toda su quiniela? (queda en la Papelera, se puede restaurar después)`)) return;
        DB.papelera = DB.papelera || [];
        DB.papelera.push({
          participant: JSON.parse(JSON.stringify(p)),
          predictions: JSON.parse(JSON.stringify(DB.predictions[id] || {})),
          fechaEliminado: Date.now()
        });
        DB.participants = DB.participants.filter(x=>x.id!==id);
        delete DB.predictions[id];
        // v6.4 — La papelera ahora vive en su propio documento de
        // solo-admin (rgSavePapelera), separado de los participantes
        // activos. Además, el documento público de ESTE participante en
        // registro_participants tiene que desaparecer de verdad
        // (rgDeleteParticipantDoc) para que ya no aparezca en el Ranking
        // — saveData(DB) por sí solo nunca borra documentos, solo agrega
        // o actualiza los que siguen en DB.participants.
        rgSavePapelera(DB.papelera);
        rgDeleteParticipantDoc(id);
        toast('Participante movido a la papelera.');
        refreshAdminTable();
        refreshPapeleraTable();

      }else if(el.dataset.act==='toggle-estado'){
        if(p.estadoQuiniela==='enviada'){
          p.estadoQuiniela = 'borrador';
          p.fechaEnvio = null;
        }else{
          p.estadoQuiniela = 'enviada';
          p.fechaEnvio = Date.now();
        }
        p.fechaActualizacion = Date.now();
        saveData(DB);
        refreshAdminTable();
      }
    });
  });
}

/* ════════════════════════════════════════
   PAPELERA — v6.1
   Quien se elimina desde la tabla de participantes no se borra de
   verdad: queda guardado acá completo (perfil + predicciones) hasta que
   el admin decida Restaurar o Eliminar definitivamente. Misma idea que
   ya existe en el tab Integridad de la app principal (no perder datos
   por error), aplicada también a Mi Quiniela.
   ════════════════════════════════════════ */
function buildPapeleraRowsHtml(){
  if(!DB.papelera || !DB.papelera.length){
    return `<div class="muted center" style="padding:1.5rem 0">La papelera está vacía.</div>`;
  }
  const rows = DB.papelera.slice().sort((a,b)=>b.fechaEliminado-a.fechaEliminado).map(entry=>{
    const p = entry.participant;
    return `
      <tr>
        <td class="muted">${esc(p.codigo||'—')}</td>
        <td class="admin-name-cell">${esc(p.name)}</td>
        <td class="muted">${esc(p.email||'—')}</td>
        <td class="muted">${esc(p.city)}, ${esc(p.country)}</td>
        <td class="muted">${fmtDate(entry.fechaEliminado)}</td>
        <td style="white-space:nowrap">
          <button class="icon-btn" data-pact="restore" data-pid="${p.id}" title="Restaurar" aria-label="Restaurar participante">♻️</button>
          <button class="icon-btn" data-pact="purge" data-pid="${p.id}" title="Eliminar para siempre" aria-label="Eliminar participante para siempre">🗑️</button>
        </td>
      </tr>`;
  }).join('');
  return `<div style="overflow-x:auto">
      <table class="admin">
        <thead><tr><th>Código</th><th>Nombre</th><th>Correo</th><th>Ubicación</th><th>Eliminado</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function wirePapeleraTable(){
  const wrap = document.getElementById('papelera_wrap');
  if(!wrap) return;
  wrap.querySelectorAll('[data-pact]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const pid = el.dataset.pid;
      const idx = (DB.papelera||[]).findIndex(e=>e.participant.id===pid);
      if(idx===-1) return;
      const entry = DB.papelera[idx];

      if(el.dataset.pact==='restore'){
        const correoEnUso = entry.participant.email && DB.participants.some(x=>norm(x.email||'')===norm(entry.participant.email));
        if(correoEnUso && !confirm(`Ya hay un participante activo con el correo "${entry.participant.email}". ¿Restaurar igual? (quedarían dos con el mismo correo)`)) return;
        DB.participants.push(entry.participant);
        DB.predictions[entry.participant.id] = entry.predictions || {};
        DB.papelera.splice(idx,1);
        // v6.4 — saveData(DB) sí vuelve a crear el documento del
        // participante restaurado (porque ahora aparece de nuevo en
        // DB.participants), usando el camino de admin de la regla de
        // Firestore (este participante restaurado puede no tener
        // ownerUid, o tener uno de un dispositivo viejo). La papelera
        // (que ya no lo incluye) se guarda aparte con rgSavePapelera.
        saveData(DB);
        rgSavePapelera(DB.papelera);
        toast(`"${entry.participant.name}" restaurado.`);
        refreshAdminTable();
        refreshPapeleraTable();

      }else if(el.dataset.pact==='purge'){
        if(!confirm(`¿Eliminar definitivamente a "${entry.participant.name}"? Esto ya no se puede deshacer ni restaurar.`)) return;
        DB.papelera.splice(idx,1);
        rgSavePapelera(DB.papelera);
        toast('Eliminado definitivamente.');
        refreshPapeleraTable();
      }
    });
  });
}


// Refresca solo la sección de papelera (tabla + contador del botón que la
// abre/cierra), sin tocar el resto del panel Admin.
function refreshPapeleraTable(){
  const wrap = document.getElementById('papelera_wrap');
  if(wrap){ wrap.innerHTML = buildPapeleraRowsHtml(); wirePapeleraTable(); }
  const toggleBtn = document.getElementById('a_toggle_papelera');
  if(toggleBtn) toggleBtn.textContent = `🗑️ Papelera (${(DB.papelera||[]).length})`;
}

/* ════════════════════════════════════════
   TAB: ADMIN
   Nota: sin autenticación en este prototipo. Al integrar con el proyecto
   principal, esta vista se protege igual que el resto del panel admin
   (Firebase Auth + email fijo de administrador).
   ════════════════════════════════════════ */
function renderAdmin(){
  const c = document.getElementById('admin-content');
  const ct = getCierreTimestamp();
  const cierreStatusText = !ct
    ? 'Sin fecha de cierre configurada — las inscripciones quedan abiertas indefinidamente.'
    : (isGloballyClosed()
        ? `🔒 <b>Cerrado</b> desde el ${fmtDate(ct)}.`
        : `Se cerrará el ${fmtDate(ct)}.`);

  c.innerHTML = `
    <div class="note">Panel administrativo sin autenticación (prototipo). El badge de <b>Estado</b> reabre una quiniela enviada (vuelve a borrador, habilita edición) o la marca como enviada manualmente. El lápiz ✏️ edita en modo administrador; el ojo 👁️ muestra exactamente la vista del participante (sin privilegios).</div>

    <div class="card" id="maint_mode_card" style="border:1px solid var(--qb-red)">
      <div class="card-title">🚧 Modo Mantenimiento</div>
      <div class="switch-row">
        <div>
          <div style="font-weight:700">${DB.configGlobal.mantenimientoActivo ? '🔴 Activo — el sitio está cerrado al público' : '🟢 Apagado — el sitio funciona normal'}</div>
          <div class="muted" style="font-size:11.5px">Mientras está activo, cualquiera que no sea admin ve solo la pantalla de mantenimiento (sin Ranking, sin Mi Quiniela, sin poder registrarse ni guardar predicciones). Vos, como admin, seguís viendo la app entera siempre — nunca te vas a poder bloquear a vos mismo con este switch.</div>
        </div>
        <div class="switch ${DB.configGlobal.mantenimientoActivo?'on':''}" id="a_switch_mantenimiento"><div class="switch-knob"></div></div>
      </div>
      <div class="field" style="margin-top:.6rem"><label>Título</label><input type="text" id="a_maint_titulo" maxlength="120" value="${esc(DB.configGlobal.mantenimientoTitulo||'')}"></div>
      <div class="field"><label>Mensaje</label><input type="text" id="a_maint_mensaje" maxlength="300" value="${esc(DB.configGlobal.mantenimientoMensaje||'')}"></div>
      <div class="rg-btn-row">
        <button class="rg-btn rg-btn-primary" id="a_guardar_maint">Guardar</button>
      </div>
    </div>

    <div class="card" id="test_mode_card" style="border:1px solid var(--qb-yellow)">
      <div class="card-title">🧪 Modo Prueba</div>
      ${TEST_MODE ? `
        <div class="note">Estás <b>adentro</b> del Modo Prueba (<code>?test=1</code>). Todo lo que cargues acá (resultados, Bonos, Batallas) se guarda en <code>quiniela/estado-test</code>, un documento completamente separado del real — <b>nadie más lo ve</b>: los 27 participantes siguen viendo siempre el sitio real, sin este parámetro en su link. Las predicciones que se usan para calcular los puntos sí son las reales de los 27.</div>
        <div class="rg-btn-row">
          <button class="rg-btn rg-btn-primary" id="a_test_seed">🔄 Cargar/actualizar datos reales</button>
          <button class="rg-btn rg-btn-ghost" id="a_test_exit">↩️ Abrir sitio real (otra pestaña)</button>
        </div>
      ` : `
        <div class="note">Modo experimental para probar resultados/puntajes hipotéticos sin tocar el sitio real ni lo que ven los 27 participantes. Usa las predicciones reales, pero los resultados que cargues ahí viven en un documento separado (<code>quiniela/estado-test</code>) que el Ranking real nunca lee.</div>
        <div class="rg-btn-row">
          <button class="rg-btn rg-btn-ghost" id="a_test_enter">🧪 Abrir Modo Prueba (otra pestaña)</button>
        </div>
      `}
    </div>

    <div class="card">
      <div class="card-title">⚙️ Configuración</div>
      <div class="switch-row">
        <div>
          <div style="font-weight:700">Modo consulta ("¿Ya tienes una quiniela?")</div>
          <div class="muted" style="font-size:11.5px">${DB.configGlobal.modoConsultaHabilitado ? 'Inicio muestra la pantalla de elección (Ver mi quiniela / Crear nueva).' : 'Inicio entra directo al formulario de creación, sin pantalla de elección.'}</div>
        </div>
        <div class="switch ${DB.configGlobal.modoConsultaHabilitado?'on':''}" id="a_switch_consulta"><div class="switch-knob"></div></div>
      </div>
      <div class="switch-row">
        <div>
          <div style="font-weight:700">Registro de nuevas quinielas</div>
          <div class="muted" style="font-size:11.5px">${DB.configGlobal.registroAbierto ? 'Cualquiera puede crear un nuevo participante.' : 'Cerrado — solo se puede editar quinielas ya existentes.'}</div>
        </div>
        <div class="switch ${DB.configGlobal.registroAbierto?'on':''}" id="a_switch_registro"><div class="switch-knob"></div></div>
      </div>
      <div class="switch-row">
        <div>
          <div style="font-weight:700">Permitir ingreso utilizando nombre</div>
          <div class="muted" style="font-size:11.5px">${DB.configGlobal.loginPorNombreHabilitado ? 'Quien no tenga correo registrado puede entrar igual con su nombre completo + Clave.' : 'Desactivado — solo se puede entrar con correo + Clave. El campo de nombre ya no aparece en el login.'}</div>
        </div>
        <div class="switch ${DB.configGlobal.loginPorNombreHabilitado?'on':''}" id="a_switch_nombre"><div class="switch-knob"></div></div>
      </div>
      <div class="switch-row">
        <div>
          <div style="font-weight:700">🏠 Usar "Mi Quiniela" como página inicial</div>
          <div class="muted" style="font-size:11.5px">${DB.configGlobal.usarMiQuinielaComoInicio ? 'La app abre directo en "Mi Quiniela" en vez de en el Ranking.' : 'La app abre en el Ranking, como siempre.'}</div>
        </div>
        <div class="switch ${DB.configGlobal.usarMiQuinielaComoInicio?'on':''}" id="a_switch_inicio_mq"><div class="switch-knob"></div></div>
      </div>
      <div class="switch-row" style="border-bottom:none;align-items:flex-start">
        <div style="width:100%">
          <div style="font-weight:700;margin-bottom:4px">⏰ Cierre automático de inscripciones</div>
          <div class="muted" style="font-size:11.5px;margin-bottom:10px">${cierreStatusText}</div>
          <div class="note" style="font-size:11px;margin-bottom:10px">⚠️ La hora se interpreta en <b>UTC</b> (no en tu hora local) -- es la que de verdad hace cumplir el servidor. Ej.: si querés que cierre a las 6pm hora de Panamá (UTC-5), cargá <b>23:00</b> acá.</div>
          <div class="row2">
            <div class="field"><label>Fecha de cierre</label><input type="date" id="a_fecha_cierre" value="${esc(DB.configGlobal.fechaCierre||'')}"></div>
            <div class="field"><label>Hora de cierre (UTC)</label><input type="time" id="a_hora_cierre" value="${esc(DB.configGlobal.horaCierre||'23:59')}"></div>
          </div>
          <div class="rg-btn-row">
            <button class="rg-btn rg-btn-primary" id="a_guardar_cierre">Guardar cierre</button>
            <button class="rg-btn rg-btn-ghost" id="a_quitar_cierre">Quitar cierre</button>
          </div>
        </div>
      </div>
      <div class="switch-row" style="border-bottom:none;align-items:flex-start">
        <div style="width:100%">
          <div style="font-weight:700;margin-bottom:4px">💬 Grupo de WhatsApp</div>
          <div class="muted" style="font-size:11.5px;margin-bottom:10px">Enlace de invitación al grupo. Mientras esté vacío, el botón "💬 Unirte al grupo" no aparece en ningún lado (Mi Quiniela ni el último paso del registro).</div>
          <div class="field"><label>Enlace (ej. https://chat.whatsapp.com/XXXXXXXX)</label><input type="url" id="a_whatsapp_link" placeholder="https://chat.whatsapp.com/..." value="${esc(DB.configGlobal.whatsappGroupLink||'')}"></div>
          <div class="rg-btn-row">
            <button class="rg-btn rg-btn-primary" id="a_guardar_whatsapp">Guardar enlace</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📊 Estadísticas rápidas</div>

      <div id="admin_stats_wrap">${buildStatsHtml()}</div>
    </div>

    <div class="card">
      <div class="card-title">📋 Participantes registrados <span class="badge badge-muted" id="admin_total_badge">${DB.participants.length}</span></div>
      <div class="field" style="margin-bottom:.6rem">
        <label>🔍 Buscar</label>
        <input id="admin_search" type="text" placeholder="Nombre, correo, código o clave..." value="${esc(ADMIN_SEARCH)}" autocomplete="off">
      </div>
      <div class="filter-chips" style="margin-bottom:.85rem">
        <button class="filter-chip ${ADMIN_FILTER==='all'?'on':''}" data-filter="all">Todas</button>
        <button class="filter-chip ${ADMIN_FILTER==='completas'?'on':''}" data-filter="completas">✅ Completas</button>
        <button class="filter-chip ${ADMIN_FILTER==='incompletas'?'on':''}" data-filter="incompletas">▫️ Incompletas</button>
      </div>
      <div id="admin_table_wrap">${buildParticipantsRowsHtml(ADMIN_SEARCH, ADMIN_FILTER)}</div>
      <div class="rg-btn-row" style="margin-top:.75rem">
        <button class="rg-btn rg-btn-ghost" id="a_gen_claves" title="Genera una clave nueva solo a quien no tenga ninguna">🔑 Generar claves faltantes</button>
        <button class="rg-btn rg-btn-ghost" id="a_export_info" title="Descarga un .json con código, nombre, correo, ubicación, clave, creado, enviado, estado, avance Y la quiniela completa (predicciones) de todos">⬇️ Exportar info de participantes</button>
        <button class="rg-btn rg-btn-ghost" id="a_import_info" title="Agrega como NUEVOS (con su quiniela completa) solo los participantes del .json que todavía no existen acá -- a los que ya existen no los toca ni los duplica. (También acepta el .csv de versiones anteriores y el backup .json de la migración, para esos sí parchea correo/ubicación/clave/estado de quien ya existe, como siempre)">⬆️ Importar info de participantes</button>
        <input id="import_info_file" type="file" accept=".json,.csv" style="display:none">
        <button class="rg-btn rg-btn-ghost" id="a_toggle_papelera">🗑️ Papelera (${(DB.papelera||[]).length})</button>
        <button class="rg-btn rg-btn-danger" id="a_del_participantes" title="Borra a todos los participantes y sus predicciones (y vacía la Papelera) -- la configuración del torneo (fases activas, reglas, fecha de cierre, etc.) NO se toca">Borrar datos de participantes</button>
        <button class="rg-btn rg-btn-danger" id="a_reset" title="Borra participantes+predicciones Y restaura la configuración del torneo a los valores originales">Restaurar configuración original</button>
      </div>
    </div>

    <div class="card" id="papelera_card" style="display:${SHOW_PAPELERA?'block':'none'}">
      <div class="card-title">🗑️ Papelera</div>
      <div class="note">Los participantes eliminados quedan acá con toda su quiniela hasta que los restaures o los borres para siempre — eliminar desde la tabla de arriba ya no es instantáneo ni definitivo.</div>
      <div id="papelera_wrap">${buildPapeleraRowsHtml()}</div>
    </div>
  `;

  // v7.2 — Modo Prueba: wiring de la tarjeta nueva. Los botones cambian
  // según si ya estoy adentro (TEST_MODE) o no, ver el HTML armado arriba.
  if(TEST_MODE){
    document.getElementById('a_test_seed').addEventListener('click', ()=>{
      if(!confirm('Esto va a SOBRESCRIBIR los resultados/Bonos/Batallas que tengas ahora en Modo Prueba con una copia exacta de los datos reales de producción (quiniela/estado). ¿Continuar?')) return;
      seedTestStateFromProduction(false);
    });
    document.getElementById('a_test_exit').addEventListener('click', ()=>{
      window.open(location.pathname, '_blank');
    });
  } else {
    document.getElementById('a_test_enter').addEventListener('click', ()=>{
      window.open(location.pathname + '?test=1', '_blank');
    });
  }

  wireParticipantsTable();

  document.getElementById('admin_search').addEventListener('input', (e)=>{
    ADMIN_SEARCH = e.target.value;
    const tableWrap = document.getElementById('admin_table_wrap');
    tableWrap.innerHTML = buildParticipantsRowsHtml(ADMIN_SEARCH, ADMIN_FILTER);
    wireParticipantsTable();
  });

  document.querySelectorAll('.filter-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      ADMIN_FILTER = chip.dataset.filter;
      document.querySelectorAll('.filter-chip').forEach(c=>c.classList.toggle('on', c===chip));
      const tableWrap = document.getElementById('admin_table_wrap');
      tableWrap.innerHTML = buildParticipantsRowsHtml(ADMIN_SEARCH, ADMIN_FILTER);
      wireParticipantsTable();
    });
  });

  document.getElementById('a_export_info').addEventListener('click', exportarInfoParticipantes);
  document.getElementById('a_import_info').addEventListener('click', ()=>{
    document.getElementById('import_info_file').click();
  });
  document.getElementById('import_info_file').addEventListener('change', (ev)=>{
    const file = ev.target.files[0];
    importarInfoParticipantes(file);
    ev.target.value = ""; // permite volver a elegir el mismo archivo si hace falta repetir
  });

  document.getElementById('a_toggle_papelera').addEventListener('click', ()=>{
    SHOW_PAPELERA = !SHOW_PAPELERA;
    const card = document.getElementById('papelera_card');
    if(card) card.style.display = SHOW_PAPELERA ? 'block' : 'none';
  });
  wirePapeleraTable();

  document.getElementById('a_gen_claves').addEventListener('click', ()=>{
    let count = 0;
    DB.participants.forEach(p=>{
      if(!p.clave || !String(p.clave).trim()){
        p.clave = genClave();
        p.fechaActualizacion = Date.now();
        count++;
      }
    });
    if(count===0){ toast('Todos los participantes ya tienen una Clave. No se sobrescribió ninguna.'); return; }
    saveData(DB);
    toast(`Se generaron ${count} clave(s) nueva(s). Las que ya existían no se tocaron.`);
    refreshAdminTable();
  });

  document.getElementById('a_switch_consulta').addEventListener('click', ()=>{
    DB.configGlobal.modoConsultaHabilitado = !DB.configGlobal.modoConsultaHabilitado;
    saveData(DB);
    toast(`Modo consulta ${DB.configGlobal.modoConsultaHabilitado?'activado':'desactivado'}.`);
    renderAdminTab();
  });
  document.getElementById('a_switch_registro').addEventListener('click', ()=>{
    DB.configGlobal.registroAbierto = !DB.configGlobal.registroAbierto;
    saveData(DB);
    toast(`Registro de nuevas quinielas ${DB.configGlobal.registroAbierto?'abierto':'cerrado'}.`);
    renderAdminTab();
  });
  document.getElementById('a_switch_nombre').addEventListener('click', ()=>{
    DB.configGlobal.loginPorNombreHabilitado = !DB.configGlobal.loginPorNombreHabilitado;
    saveData(DB);
    toast(`Ingreso por nombre ${DB.configGlobal.loginPorNombreHabilitado?'activado':'desactivado'}.`);
    renderAdminTab();
  });
  document.getElementById('a_switch_inicio_mq').addEventListener('click', ()=>{
    DB.configGlobal.usarMiQuinielaComoInicio = !DB.configGlobal.usarMiQuinielaComoInicio;
    saveData(DB);
    toast(`Página inicial: ${DB.configGlobal.usarMiQuinielaComoInicio?'Mi Quiniela':'Ranking'}.`);
    renderAdminTab();
  });
  document.getElementById('a_switch_mantenimiento').addEventListener('click', ()=>{
    DB.configGlobal.mantenimientoActivo = !DB.configGlobal.mantenimientoActivo;
    saveData(DB);
    toast(DB.configGlobal.mantenimientoActivo
      ? '🚧 Modo Mantenimiento ACTIVADO — el sitio ya está cerrado al público.'
      : '✅ Modo Mantenimiento desactivado — todos vuelven a entrar normal.');
    renderAdminTab();
  });
  document.getElementById('a_guardar_maint').addEventListener('click', ()=>{
    const titulo = document.getElementById('a_maint_titulo').value.trim();
    const mensaje = document.getElementById('a_maint_mensaje').value.trim();
    DB.configGlobal.mantenimientoTitulo = titulo || RG_DEFAULT_CONFIG.mantenimientoTitulo;
    DB.configGlobal.mantenimientoMensaje = mensaje || RG_DEFAULT_CONFIG.mantenimientoMensaje;
    saveData(DB);
    toast('✓ Título y mensaje de Mantenimiento guardados.');
    renderAdminTab();
  });
  document.getElementById('a_guardar_cierre').addEventListener('click', ()=>{
    const fecha = document.getElementById('a_fecha_cierre').value;
    const hora = document.getElementById('a_hora_cierre').value || '23:59';
    if(!fecha){ toast('Elegí una fecha de cierre primero.', true); return; }
    DB.configGlobal.fechaCierre = fecha;
    DB.configGlobal.horaCierre = hora;
    saveData(DB);
    toast(`Cierre automático configurado: ${fecha} ${hora}.`);
    renderAdminTab();
  });
  document.getElementById('a_quitar_cierre').addEventListener('click', ()=>{
    DB.configGlobal.fechaCierre = '';
    saveData(DB);
    toast('Cierre automático quitado — las inscripciones quedan abiertas.');
    renderAdminTab();
  });
  document.getElementById('a_guardar_whatsapp').addEventListener('click', ()=>{
    const link = document.getElementById('a_whatsapp_link').value.trim();
    DB.configGlobal.whatsappGroupLink = link;
    saveData(DB);
    toast(link ? '✓ Enlace de WhatsApp guardado.' : 'Enlace de WhatsApp quitado — el botón deja de mostrarse.');
    renderAdminTab();
  });

  // v3.1.4 — "Borrar datos de participantes": mismo borrado destructivo
  // que "Restaurar configuración original" de abajo, pero SIN tocar
  // configGlobal (fasesActivas, reglas, fechaCierre, registroAbierto,
  // etc.) -- para cuando lo que hace falta es limpiar participantes de
  // prueba sin perder cómo quedó configurado el torneo. Ver
  // rgDeleteAllParticipants() (participantes.js) para la contraparte de
  // rgResetAll() que no resetea meta.configGlobal.
  document.getElementById('a_del_participantes').addEventListener('click', ()=>{
    if(!confirm('⚠️ Esto borra a TODOS los participantes y sus predicciones (para todos, vía Firestore), incluyendo la Papelera. La configuración del torneo (fases activas, reglas, fecha de cierre, etc.) NO se toca. ¿Continuar?')) return;
    if(!confirm('Última confirmación: se perderán todas las quinielas registradas hasta ahora, sin posibilidad de restaurar nada. ¿Seguro?')) return;
    DB.participants = [];
    DB.predictions = {};
    DB.papelera = [];
    DB.nextSeq = 1;
    ADMIN_SEARCH = '';
    ADMIN_FILTER = 'all';
    SHOW_PAPELERA = false;
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }catch(e){}
    rgDeleteAllParticipants();
    toast('Participantes borrados (en todos los dispositivos). La configuración del torneo se conservó.');
    renderAdminTab();
  });

  document.getElementById('a_reset').addEventListener('click', ()=>{
    // v6.0 — ¡OJO! Ya no es un reset solo-local: esto sobreescribe el doc
    // compartido registro/estado en Firestore, afectando a TODOS los
    // dispositivos conectados (no solo este navegador). Doble confirmación
    // a propósito por ser ahora una acción realmente destructiva y compartida.
    if(!confirm('⚠️ Esto borra TODOS los participantes y predicciones de Mi Quiniela para TODOS (no solo en este navegador — se sincroniza por Firestore), incluyendo la Papelera, Y restaura la configuración del torneo (fases activas, reglas, fecha de cierre, etc.) a los valores originales. ¿Continuar?')) return;
    if(!confirm('Última confirmación: se perderán todas las quinielas registradas hasta ahora Y la configuración del torneo, sin posibilidad de restaurar nada. ¿Seguro?')) return;
    DB = {participants:[], predictions:{}, papelera:[], nextSeq:1, configGlobal:{modoConsultaHabilitado:true, registroAbierto:true, loginPorNombreHabilitado:true, fechaCierre:'', horaCierre:'23:59', usarMiQuinielaComoInicio:false}};
    ADMIN_SEARCH = '';
    ADMIN_FILTER = 'all';
    SHOW_PAPELERA = false;
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }catch(e){}
    // v6.4 — saveData(DB) ya no basta: con la colección por-participante,
    // vaciar DB.participants en memoria nunca borra los documentos que ya
    // existían en Firestore (el diff genérico solo agrega/actualiza lo
    // que sigue en la lista). rgResetAll() borra de verdad cada documento
    // de la colección, resetea meta y vacía la papelera en el servidor.
    rgResetAll();
    toast('Datos de Mi Quiniela borrados y configuración restaurada (en todos los dispositivos).');
    renderAdminTab();
  });
}


/* ════════════════════════════════════════
   GENERAR PDF — html2canvas + jsPDF
   ════════════════════════════════════════ */
/* ════════════════════════════════════════
   GENERAR PDF — html2canvas + jsPDF
   v0.8 (Fase 6) — Rediseño completo: paleta LIGHT, 2 columnas (grupos a la
   izquierda en 2 sub-columnas de 6 grupos; eliminatoria a la derecha en
   6 bloques apilados), preguntas especiales en una franja horizontal
   abajo, y página fijada a tamaño Oficio horizontal real (330 x 216mm —
   la medida de "Oficio" varía algo según el país; si en la impresora real
   queda corrido, era un ajuste de una sola línea — ver nota v1.1 abajo).
   v1.1 — Cambiado a Carta horizontal (279.4 x 215.9mm / 11x8.5in): Oficio
   dejaba mucho espacio en blanco a los lados porque el contenido nunca
   necesitó los 330mm de ancho. Carta tiene el mismo alto (~216mm) y solo
   recorta el ancho — no se tocó ningún font-size, el contenido se ve
   exactamente igual, solo con menos margen vacío. La franja de preguntas
   especiales también se movió: ahora va arriba, sobre las 2 columnas de
   grupos/eliminatoria (antes iba abajo, después de las columnas).
   ════════════════════════════════════════ */
const CARTA_MM = { w: 279.4, h: 215.9 }; // Carta horizontal (11x8.5in)

function buildPosterGroupsHtml(preds){
  const groups = {};
  GROUP_MATCHES.forEach(m=>{ (groups[m.g]=groups[m.g]||[]).push(m); });
  const letters = Object.keys(groups).sort();
  const mid = Math.ceil(letters.length/2);
  const subcols = [letters.slice(0,mid), letters.slice(mid)];

  const rowHtml = (m)=>{
    const v = preds[m.id];
    const h = v && Number.isInteger(v.h) ? v.h : '-';
    const a = v && Number.isInteger(v.a) ? v.a : '-';
    return `<div class="pp-match-row">
        <span class="pp-team">${flagOf(m.a,11)}<span>${esc(m.a)}</span></span>
        <span class="pp-score">${h}:${a}</span>
        <span class="pp-team pp-team-r"><span>${esc(m.b)}</span>${flagOf(m.b,11)}</span>
      </div>`;
  };
  const boxHtml = (g)=> `<div class="pp-group-box">
      <div class="pp-group-name">Grupo ${esc(g)}</div>
      ${groups[g].map(rowHtml).join('')}
    </div>`;

  return `<div class="pp-groups-grid">` +
    subcols.map(ls=>`<div class="pp-groups-subcol">${ls.map(boxHtml).join('')}</div>`).join('') +
    `</div>`;
}

function buildPosterElimHtml(preds, bracket){
  if(!bracket.ready){
    return `<div class="pp-phase-block">
        <div class="pp-phase-name">Pendiente</div>
        <div class="pp-match-row"><span class="pp-team">Completa la fase de grupos para ver los cruces.</span></div>
      </div>`;
  }
  return KO_PHASES.filter(ph=>isKoPhaseActive(ph.key)).map(ph=>{
    const slots = koSlotsOf(bracket, ph.key);
    const trustSlot = bracket.realSeedKey===ph.key;
    const rows = slots.map(m=>{
      if(!m.a || !m.b){
        return `<div class="pp-match-row"><span class="pp-team">Pendiente</span></div>`;
      }
      const raw = preds[m.slot];
      const v = trustSlot ? (raw||null) : ((raw && raw._a===m.a && raw._b===m.b) ? raw : null);
      const h = v && Number.isInteger(v.h) ? v.h : '-';
      const a = v && Number.isInteger(v.a) ? v.a : '-';
      return `<div class="pp-match-row">
          <span class="pp-team">${flagOf(m.a,11)}<span>${esc(m.a)}</span></span>
          <span class="pp-score">${h}:${a}</span>
          <span class="pp-team pp-team-r"><span>${esc(m.b)}</span>${flagOf(m.b,11)}</span>
        </div>`;
    }).join('');
    return `<div class="pp-phase-block">
        <div class="pp-phase-name">${esc(ph.label)}</div>
        ${rows}
      </div>`;
  }).join('');
}

function buildPosterSpecialHtml(preds, bracket){
  const autoSp = computeAutoSpecial(bracket);
  const sp = preds.special || {};
  return activeSpecialQuestions().map(q=>{
    const isAuto = AUTO_SPECIAL_IDS.includes(q.id);
    const raw = isAuto ? autoSp[q.id] : sp[q.id];
    const val = (raw!==undefined && raw!=='') ? raw : '—';
    return `<div class="pp-special-item">
        <div class="pp-special-label">${esc(q.label)}</div>
        <div class="pp-special-val">${esc(String(val))}</div>
      </div>`;
  }).join('');
}

function generarPDF(p){
  // v6.3 — Antes, si window.jspdf no existía (ej. la librería no cargó),
  // el código explotaba en silencio DESPUÉS de que html2canvas terminaba
  // de capturar la imagen, dejando el toast "Generando PDF..." pegado
  // para siempre sin avisar nada. Esta validación corta ANTES de
  // arrancar y avisa con un mensaje claro.
  if(typeof html2canvas !== 'function' || !window.jspdf || !window.jspdf.jsPDF){
    toast('No se pudo cargar el generador de PDF — revisa tu conexión e intenta de nuevo.', true);
    return;
  }
  const preds = DB.predictions[p.id] || {};
  const bracket = computeBracket(preds);
  const estadoLabel = p.estadoQuiniela==='enviada' ? 'Enviada' : 'Borrador';

  // v1.8 — Avatar de campeón en la portada del PDF: mismo campeón que se
  // imprime más abajo en "Preguntas especiales" (computeAutoSpecial(bracket)
  // -- Campeón/Subcampeón/3er lugar SIEMPRE se calculan del bracket, nunca
  // se leen de preds.special directo, ver nota AUTO_SPECIAL_IDS arriba) y
  // mismo AVATAR_MAP que ya usa avatarOfChampion() (app-core-data.js) para
  // el resto de la app. Todavía no hay avatar para todos los países -- sin
  // uno, champAvatarFile queda "" y no se imprime nada (mismo criterio que
  // en el resto de la app: mejor vacío que un avatar que no corresponde).
  const champVal = computeAutoSpecial(bracket).campeon;
  const champAvatarFile = (champVal && typeof AVATAR_MAP!=='undefined') ? (AVATAR_MAP[champVal]||'') : '';
  const posterAvatarHtml = champAvatarFile
    ? `<img class="pp-avatar" src="${AVATAR_DIR}${encodeURIComponent(champAvatarFile)}" alt="" crossorigin="anonymous">`
    : '';

  const poster = document.getElementById('pdfPoster');
  poster.innerHTML = `
    <div class="pp-header">
      <div style="display:flex;align-items:center;gap:14px">
        ${posterAvatarHtml}
        <div>
          <div class="pp-title">⚔️ Quinielita Borracha</div>
          <div class="pp-subtitle">${esc(p.name)}</div>
        </div>
      </div>
      <div class="pp-meta-grid">
        <div><span class="pp-meta-label">Ciudad</span><span class="pp-meta-val">${esc(p.city)}</span></div>
        <div><span class="pp-meta-label">País</span><span class="pp-meta-val">${esc(p.country)}</span></div>
        <div><span class="pp-meta-label">Código</span><span class="pp-meta-val">${esc(p.codigo||'—')}</span></div>
        <div><span class="pp-meta-label">Creado</span><span class="pp-meta-val">${fmtDate(p.fechaCreacion)}</span></div>
        <div><span class="pp-meta-label">Enviado</span><span class="pp-meta-val">${p.fechaEnvio?fmtDate(p.fechaEnvio):'—'}</span></div>
        <div><span class="pp-meta-label">Estado</span><span class="pp-meta-val pp-estado-${p.estadoQuiniela}">${esc(estadoLabel)}</span></div>
      </div>
    </div>
    <div class="pp-special">
      <div class="pp-col-title">Preguntas especiales</div>
      <div class="pp-special-grid">${buildPosterSpecialHtml(preds, bracket)}</div>
    </div>
    <div class="pp-body">
      ${isGruposActivaWizard()?`<div class="pp-col-groups">
        <div class="pp-col-title">Fase de grupos</div>
        ${buildPosterGroupsHtml(preds)}
      </div>`:''}
      <div class="pp-col-elim">
        <div class="pp-col-title">Fase eliminatoria</div>
        ${buildPosterElimHtml(preds, bracket)}
      </div>
    </div>
    <div class="pp-footer">Quinielita Borracha &middot; Código ${esc(p.codigo||'—')} &middot; Generado el ${new Date().toLocaleDateString('es-VE')}</div>
  `;

  toast('Generando PDF...');
  waitForImages(poster).then(()=>{
    return html2canvas(poster, {scale:2, backgroundColor:'#FFFFFF', useCORS:true});
  }).then(canvas=>{
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    // Página fijada a Carta horizontal real (no al tamaño del canvas): si el
    // contenido terminó un poco más alto/bajo de lo calculado, la imagen se
    // estira para llenar igual la hoja completa, en vez de cortarse.
    const pdf = new jsPDF({ orientation:'l', unit:'mm', format:[CARTA_MM.w, CARTA_MM.h] });
    pdf.addImage(imgData, 'PNG', 0, 0, CARTA_MM.w, CARTA_MM.h);
    const safeName = (p.name||'quiniela').toLowerCase().replace(/[^a-z0-9]+/g,'_');
    pdf.save(`quiniela_${safeName}.pdf`);
    toast('PDF descargado.');
  }).catch(()=>{
    toast('No se pudo generar el PDF.', true);
  });
}

// v1.0 — Revisa cada 30s si el cierre automático recién se cumplió
// mientras la página está abierta (para no depender de que alguien
// recargue). Solo re-renderiza en el INSTANTE en que el estado realmente
// cambia (no en cada chequeo), para no interrumpir a alguien que esté
// escribiendo en pleno — exactamente lo que se busca: el bloqueo se nota
// justo cuando ocurre, ni antes ni después.
let LAST_KNOWN_CLOSED = isGloballyClosed();
setInterval(()=>{
  const nowClosed = isGloballyClosed();
  if(nowClosed !== LAST_KNOWN_CLOSED){
    LAST_KNOWN_CLOSED = nowClosed;
    if(DRAFT_PID) render();
  }
}, 30000);

// v1.6 — Tick de 1s para el contador regresivo "tienes hasta..." arriba
// del wizard. A propósito NO llama a render(): solo toca el textContent
// del <b id="wiz_countdown_text"> si está presente en el DOM en este
// instante (nada que hacer si el wizard no está abierto, o si está en un
// paso/vista donde ese elemento no existe). Así el reloj tickea sin
// robarle el foco a quien esté escribiendo un marcador al mismo tiempo —
// el cierre automático en sí lo sigue decidiendo el interval de 30s de
// arriba, este solo actualiza el texto que la persona está viendo.
setInterval(()=>{
  const el = document.getElementById('wiz_countdown_text');
  if(!el) return;
  const t = getCierreTimestamp();
  if(t===null) return;
  el.textContent = formatCountdown(t - Date.now());
}, 1000);

render();

// v6.2 — La conexión a Firestore (rgWireFirestoreSync) ahora la dispara
// participantes.js, que carga antes que este archivo y es compartida con
// app.js. No hace falta repetirla aquí.

/* ════════════════════════════════════════
   NOTA DE SEGURIDAD (v6.0, Fase 1) — LEER ANTES DE USAR EN PRODUCCIÓN
   ════════════════════════════════════════
   Este módulo escribe en Firestore en el documento registro/estado SIN
   pasar por Firebase Auth (a diferencia de quiniela/estado, que solo
   escribe el admin autenticado). Esto es necesario para que cualquier
   participante pueda registrar/editar su propia quiniela sin tener que
   iniciar sesión como admin.

   Para que esto funcione, las reglas de seguridad de Firestore deben
   permitir escritura pública en esa ruta específica, por ejemplo:

     match /registro/estado {
       allow read: if true;
       allow write: if true;
     }

   (mientras que quiniela/estado sigue restringido solo al admin, como ya
   está hoy). Mientras esa regla no se agregue en la consola de Firebase,
   los intentos de escritura fallarán con "permission-denied": el formulario
   seguirá funcionando con la caché local (localStorage) de cada navegador,
   pero NO se sincronizará entre dispositivos hasta que se actualice la regla.

   Esto es un nivel de seguridad equivalente al que ya tenía el prototipo
   original (panel admin "sin autenticación"), solo que ahora el panel
   Admin SÍ exige isAdmin() en la interfaz. La protección a nivel de datos
   (que solo el dueño real de una quiniela pueda editarla) requeriría
   Firebase Auth por participante o Cloud Functions de validación — fuera
   de alcance de esta Fase 1, documentado como pendiente para Fase 2.
   ════════════════════════════════════════ */

// v6.6.1 — Estas dos SÍ se exponen a window a propósito (excepción puntual
// a la regla del comentario de cabecera de "no exponer nada"): app.js
// vive FUERA de este IIFE, y su función tab() necesita poder llamar a
// render() (pestaña Mi Quiniela) y renderAdminTab() (pestaña Admin, antes
// vivía adentro de Mi Quiniela) cada vez que el usuario hace clic. Sin
// este export, typeof render/renderAdminTab en app.js da "undefined" y
// esos clics no repintan nada — esto ya pasaba desde v6.5 con Mi Quiniela
// (bug latente, nunca se notó porque el primer render() del load inicial
// disimulaba el problema); con Admin como pestaña nueva sin ese primer
// render automático, el bug se volvía inmediatamente visible.
window.render = render;
window.renderAdminTab = renderAdminTab;
window.tryAutoLoginByOwnerUid = tryAutoLoginByOwnerUid;
// v3.2.3 — igual que las 3 líneas de arriba: sin esto, app-live-sync.js
// (fuera de esta IIFE) nunca ve esta función -- su `typeof
// refreshRegistroViewFromStateChange==="function"` da false en silencio
// y el fix entero queda sin efecto, sin ningún error visible.
window.refreshRegistroViewFromStateChange = refreshRegistroViewFromStateChange;
})();
