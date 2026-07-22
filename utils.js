/* ════════════════════════════════════════════════════════════
   UTILS — helpers puros sin estado global (v6.3, Punto 2 del roadmap)
   ════════════════════════════════════════════════════════════
   12 funciones extraídas de app.js: no dependen de S/DB/MD/PL ni de
   ninguna otra variable mutable de la app — toman todo por parámetro
   y devuelven un valor. Cero acceso a document/localStorage.

   Se carga ANTES de app.js (igual que partidos-grupos.js) en index.html.
   Orden no importa respecto a scoring.js: ninguno de los dos ejecuta
   nada a nivel top-level, solo declaran funciones — el orden real que
   importa es que AMBOS carguen antes que app.js (que sí ejecuta código
   a nivel top-level al final, incluyendo renderRank() que ya depende
   de funciones de scoring.js).
   ════════════════════════════════════════════════════════════ */

// ── Escape de HTML (v1.5.3 — Fase de Seguridad) ──────────────────────
// Movida acá desde registro.js: es la única función de escape de HTML de
// todo el proyecto y debe estar disponible para TODOS los módulos, no
// solo para el de registro. utils.js se carga antes que cualquier módulo
// app-*.js (y antes que registro.js), así que esc() queda disponible
// para todos ellos.
//
// USO OBLIGATORIO: cualquier dato que pueda haber sido escrito por un
// participante (name, city, country, notas de admin, nombres de
// "batallas", goleadores, etc.) DEBE pasar por esc() antes de insertarse
// vía innerHTML/outerHTML o dentro de un atributo HTML. Los campos de
// participantes NO tienen ningún filtro de caracteres del lado del
// cliente ni del servidor (firestore.rules solo valida tipo/tamaño, a
// propósito — no es su trabajo validar contenido) — sin esc(), un
// nombre como "<img src=x onerror=...>" se ejecuta para cualquiera que
// vea el Ranking, Estadísticas, Batallas o Predicciones, admin incluido.
//
// NO hace falta escapar texto que solo se usa en confirm()/prompt()/
// alert() o en toast() (usa .textContent, no innerHTML) — esos no
// interpretan HTML nunca, escaparlos ahí sería trabajo de más (y en
// prompt()/confirm() se vería literalmente "&amp;" en vez de "&").
function esc(s){
  return (s||"").replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

function normalizeAbbr(a){
  const MAP={
    "CUW":"CUR","CW":"CUR",       // Curazao
    "GER":"GER","DEU":"GER",       // Alemania (por si acaso)
    "NED":"NED","HOL":"NED",       // Países Bajos
    "KSA":"KSA","SAU":"KSA","KSA":"KSA", // Arabia Saudita
    "CGO":"CGO","COD":"CGO","DRC":"CGO", // RD Congo
    "CPV":"CPV","CAP":"CPV",       // Cabo Verde
    "RSA":"RSA","ZAF":"RSA",       // Sudáfrica
    "IRN":"IRN","IRI":"IRN",       // Irán
    "CIV":"CIV","CTE":"CIV",       // Costa de Marfil
    "MAR":"MAR","MRC":"MAR",       // Marruecos
    "SCO":"SCO","SCP":"SCO",       // Escocia
    "BIH":"BIH","BOS":"BIH",       // Bosnia
    "UZB":"UZB","UBK":"UZB",       // Uzbekistán
    "HAI":"HAI","HTI":"HAI",       // Haití
    "QAT":"QAT","QTR":"QAT",       // Qatar
    "NOR":"NOR","NWY":"NOR",       // Noruega
    "SWE":"SWE","SWD":"SWE",       // Suecia
    "TUN":"TUN","TNS":"TUN",       // Túnez
    "ALG":"ALG","DZA":"ALG",       // Argelia
    "JOR":"JOR","JRD":"JOR",       // Jordania
    "IRQ":"IRQ","IRA":"IRQ",       // Irak
    "ECU":"ECU",                   // Ecuador
    "PAR":"PAR","PRG":"PAR",       // Paraguay
    "URU":"URU","URG":"URU",       // Uruguay
    "SEN":"SEN",                   // Senegal
    "PAN":"PAN",                   // Panamá
  };
  return MAP[a]||a;
}

function getFlag(g,name){
  // Direct lookup first
  if(ALL_FLAGS[name])return ALL_FLAGS[name];
  // Partial match
  const nl=name.toLowerCase();
  for(const[k,v] of Object.entries(ALL_FLAGS)){
    if(nl.includes(k.toLowerCase().split(" ")[0])||k.toLowerCase().includes(nl.split(" ")[0]))return v;
  }
  // Fallback to GES array
  const t=GES[g]||[];
  for(const x of t){const s=x.replace(/^\S+\s/,"").trim().toLowerCase();if(nl.includes(s.split(" ")[0])||s.includes(nl.split(" ")[0]))return x.match(/^(\S+)/)?.[1]||"⚽";}
  return"⚽";
}

function flagD(c,s=20){const f=FLAGS2[c]||"🌐";return`<span style="font-size:${s}px;line-height:1">${f}</span>`;}

// v6.5 — Igual que flagD(), pero recibe el EMOJI ya resuelto (por ejemplo
// el de flagOfChampion(), calculado contra ALL_FLAGS en vez de FLAGS2) en
// lugar de un nombre de país. Evita repetir el wrapper <span> en cada
// sitio que necesita mostrar la bandera del campeón predicho.
// v1.9 — color:var(--qb-text) explícito (antes el span no declaraba
// ninguno, solo heredaba). En Windows/Chrome, banderas sin glifo emoji de
// color (Escocia, RD Congo, etc.) caen al fallback de 2 letras que el SO
// dibuja con SU PROPIO color por defecto en vez de heredar el de la
// página -- sobre el fondo oscuro de la app, texto negro sobre negro.
// Sin garantía de que esto arregle el fallback en sí (es un glifo del
// sistema, no siempre reconfigurable por CSS), pero es lo mínimo que el
// span puede declarar para no ser la causa.
function flagEmoji(emoji,s=20){return`<span style="font-size:${s}px;line-height:1;color:var(--qb-text)">${emoji||"🌐"}</span>`;}

// v1.8 — Avatar de campeón (perfil, batallas, Royal Rumble, tarjeta de
// estadísticas): recibe el nombre de archivo ya resuelto por
// avatarOfChampion() (m.champAvatar, app-core-data.js), no el nombre del
// país -- así este helper no necesita conocer AVATAR_MAP. Sin avatar
// todavía para ese país (la mayoría, por ahora) → file es "" → no
// devuelve nada, a propósito: mejor vacío que mostrar un genérico que no
// representa a nadie (mismo criterio que avatarOfChampion()). A propósito
// NO se usa en el Ranking (rd. app-bracket-view.js) -- ahí solo va la
// bandera, como siempre.
// v3.10 — helper compartido: país de campeón -> nombre de archivo,
// eligiendo una variante ESTABLE por participante entre las disponibles
// en AVATAR_MAP (ver la nota completa en app-static-data.js, donde cada
// país pasó de tener un solo archivo a un array de variantes). Antes de
// esto, 3 lugares distintos (avatarOfChampion() en app-core-data.js, y 2
// portadas de "Mi Quiniela"/PDF en registro.js) leían AVATAR_MAP[champ]
// cada uno por su cuenta asumiendo un string suelto -- con el cambio a
// array, todos tienen que pasar por el MISMO criterio de selección, o un
// mismo participante terminaría viendo un avatar distinto según la
// pantalla. crc32(name), no Math.random(): el mismo participante ve
// siempre el mismo avatar en cada render/recarga.
function pickAvatarFile(champ,name){
  if(!champ||typeof AVATAR_MAP==='undefined'||!AVATAR_MAP[champ])return'';
  const opts=AVATAR_MAP[champ];
  if(!Array.isArray(opts))return opts||''; // por compatibilidad si algo quedara como string suelto
  if(!opts.length)return'';
  return opts[parseInt(crc32(String(name||'')),16)%opts.length];
}

function avatarImg(file,s=54){
  if(!file)return"";
  return`<img class="qb-avatar" src="${AVATAR_DIR}${encodeURIComponent(file)}" width="${s}" height="${s}" alt="" loading="lazy" style="width:${s}px;height:${s}px">`;
}

// v4.0 — Premio de Batallas: pool de avatares ALTERNATIVOS que un
// participante puede elegir mostrar en vez del automático, a medida que
// gana batallas (1v1 + Royal Rumble, ver totalBattleWins() en
// app-batallas.js). Prioridad fija: primero TODAS las variantes de su
// país CAMPEÓN predicho (AVATAR_MAP[champ]), después TODAS las de su
// país de RESIDENCIA (AVATAR_MAP[country], sin repetir si es el mismo
// país que el campeón) -- en ese orden, la victoria #1 destraba el
// primer elemento del pool, la #2 el segundo, etc. Ganar más batallas de
// las que caben en el pool no destraba nada más por ahora (v1 simple,
// acordada con el usuario -- una versión futura podría seguir hacia el
// resto de la galería).
//
// v4.0.1 — BUG REPORTADO: el automático (pickAvatarFile, elegido por
// crc32(nombre) -- no necesariamente el primero del array) podía volver
// a aparecer COMO PREMIO, mostrando el mismo avatar 2 veces en la grilla
// (ej. Josué tenía Ronaldinho como automático Y como 1er premio
// destrabado). autoFile se excluye del pool ANTES de recortar por
// victorias, para que ganar una batalla siempre destrabe algo
// REALMENTE nuevo, nunca una repetición de lo que ya tenía por default.
function unlockedAvatarPool(champ,country,wins,autoFile){
  if(typeof AVATAR_MAP==='undefined')return[];
  const champOpts=(champ&&AVATAR_MAP[champ])||[];
  const countryOpts=(country&&country!==champ&&AVATAR_MAP[country])||[];
  const pool=[...champOpts,...countryOpts].filter(f=>f&&f!==autoFile);
  return pool.slice(0,Math.max(0,wins|0));
}

// Avatar EFECTIVO a mostrar: si el participante eligió uno de los ya
// destrabados (p.avatarElegido) Y esa elección SIGUE siendo válida ahora
// (se re-valida contra el pool actual en cada llamada, nunca se confía
// en lo guardado a ciegas), se usa esa. Si no, cae al automático de
// siempre (pickAvatarFile, determinístico por país campeón) -- así, si
// el admin corrige un resultado y el participante pierde una victoria,
// una elección que ya no le entra en el pool se cae sola en el próximo
// render, sin ninguna lógica de "revocar" aparte.
function effectiveAvatarFile(champ,p,wins){
  const auto=pickAvatarFile(champ,p&&p.name);
  const elegido=p&&p.avatarElegido;
  if(elegido&&unlockedAvatarPool(champ,p&&p.country,wins,auto).includes(elegido))return elegido;
  return auto;
}

// v1.1 — Ciudad + país combinados para mostrar bajo el nombre del
// participante (ranking, export de imagen, perfil): "Maracaibo, Venezuela".
// Si falta alguno de los dos, devuelve solo el que haya (o "" si no hay nada).
function cityCountry(p){
  const city=(p&&p.city||"").trim(), country=(p&&p.country||"").trim();
  if(city&&country)return`${city}, ${country}`;
  return city||country||"";
}

// v1.1 — El dato guardado es un solo string "name" (ej. "Juan Pérez"), pero
// el paso "Editar mis datos" lo muestra en dos campos separados. Heurística:
// la primera palabra es el nombre, el resto es el apellido — es la misma
// regla con la que se combinan al guardar (ver onCrearSubmit), así que el
// viaje ida y vuelta (separar para mostrar, juntar para guardar) es estable.
function splitName(fullName){
  const parts=(fullName||"").trim().split(/\s+/).filter(Boolean);
  if(parts.length<=1)return{nombre:parts[0]||"",apellido:""};
  return{nombre:parts[0],apellido:parts.slice(1).join(" ")};
}

function sn(n){
  if(n==="VANE Y ZAIDA BALLESTEROS")return"VANE & ZAIDA";
  if(n==="EL PROFE URDANETA")return"EL PROFE";
  const p=n.split(" ");
  const firstName=p[0];
  // Si hay otro participante con el mismo primer nombre, agregar inicial del apellido
  const hasDupe=PL.some(other=>other!==n&&other.split(" ")[0]===firstName);
  if(hasDupe&&p.length>1){
    // Tomar la primera letra del segundo token (apellido) como diferenciador
    return firstName+" "+p[1][0]+".";
  }
  return p.length>2?p[0]+" "+p[1]:p[0];
}

function crc32(str){
  let crc=-1;
  for(let i=0;i<str.length;i++){
    crc^=str.charCodeAt(i);
    for(let j=0;j<8;j++) crc=(crc&1)?((crc>>>1)^0xEDB88320):(crc>>>1);
  }
  return((crc^-1)>>>0).toString(16).padStart(8,"0");
}

function makeChecksum(mid,h,a){
  const abbrs=MID_ABBRS[mid]||"";
  return crc32(`${mid}|${h}|${a}|${abbrs}`);
}

function validateScore(mid,h,a){
  if(!MD[mid]) return{ok:false,err:`matchId ${mid} no existe`};
  if(typeof h!=="number"||typeof a!=="number") return{ok:false,err:"Los goles deben ser números"};
  if(isNaN(h)||isNaN(a)) return{ok:false,err:"Valores NaN detectados"};
  if(h<0||a<0) return{ok:false,err:"Los goles no pueden ser negativos"};
  if(h>20||a>20) return{ok:false,err:`Marcador ${h}-${a} fuera de rango (máx 20)`};
  if(!Number.isInteger(h)||!Number.isInteger(a)) return{ok:false,err:"Los goles deben ser enteros"};
  // Verificar grupo: si hay abbr del matchId, el partido existe
  if(!MID_ABBRS[mid]) return{ok:false,err:`Partido P${mid} sin abreviatura definida`};
  return{ok:true};
}

// v2.6 — BUG REPORTADO: el panel de Integridad ("Verificar checksums" /
// "Validar resultados") solo recorría S.scores (los 72 partidos de
// Grupos) — la Eliminatoria (P73-P104, S.elimScores) quedaba totalmente
// afuera de ambos chequeos. validateScore() no sirve tal cual para
// eliminatoria porque exige MD[mid]/MID_ABBRS[mid], que solo existen
// para partidos de grupos (P1-P72) -- por eso esta versión paralela, sin
// esa dependencia, para poder validar rango/tipo de un resultado de
// eliminatoria igual de a fondo.
function validateElimScore(pid,h,a){
  if(pid<ELIM_MID_MIN||pid>ELIM_MID_MAX) return{ok:false,err:`P${pid} no es un partido de eliminatoria válido (rango ${ELIM_MID_MIN}-${ELIM_MID_MAX})`};
  if(typeof h!=="number"||typeof a!=="number") return{ok:false,err:"Los goles deben ser números"};
  if(isNaN(h)||isNaN(a)) return{ok:false,err:"Valores NaN detectados"};
  if(h<0||a<0) return{ok:false,err:"Los goles no pueden ser negativos"};
  if(h>20||a>20) return{ok:false,err:`Marcador ${h}-${a} fuera de rango (máx 20)`};
  if(!Number.isInteger(h)||!Number.isInteger(a)) return{ok:false,err:"Los goles deben ser enteros"};
  return{ok:true};
}

function n(s){return(s||"").toLowerCase().trim();}

function abbr2name(abbr) {
  return TEAM_NAMES[abbr] || abbr;
}

function espnNameES(name){return ESPN_NAME_ES[name]||name;}

// v3.0 — universo de los 48 países reales del Mundial (nombres en
// español, canónicos) -- se arma una sola vez, lazy (TEAM_NAMES se
// declara más abajo en app-static-data.js; igual que espnNameES() de
// arriba, esto es seguro porque el cuerpo de la función recién se
// evalúa cuando alguien la LLAMA, mucho después de que todo terminó de
// cargar -- nunca al definirla).
let _KNOWN_TEAM_NAMES_ES=null;
function isKnownTeamNameES(nameES){
  if(!nameES)return false;
  if(!_KNOWN_TEAM_NAMES_ES)_KNOWN_TEAM_NAMES_ES=new Set(Object.values(TEAM_NAMES));
  return _KNOWN_TEAM_NAMES_ES.has(nameES);
}
// ¿el nombre crudo que reporta ESPN (antes de traducir) corresponde a
// alguno de los 48 países reales, o es un placeholder de su propio
// bracket (ej. "Round of 32 14 Winner", "TBD") para un cruce cuyo rival
// depende de un partido anterior que todavía no terminó? Se resuelve
// contra el mismo universo de 48 países que ya usa todo el motor de
// puntaje (TEAM_NAMES) -- así no hace falta mantener una lista de
// patrones de texto que ESPN podría cambiar de formato sin aviso.
function isRealEspnTeamName(rawNameEN){
  return isKnownTeamNameES(espnNameES(rawNameEN));
}

function parseESPNEvent(ev){
  const comp=ev.competitions?.[0]||{};const comps=comp.competitors||[];if(comps.length<2)return null;
  const home=comps.find(c=>c.homeAway==="home")||comps[0];
  const away=comps.find(c=>c.homeAway==="away")||comps[1];
  const ha=normalizeAbbr(home.team?.abbreviation||"");const aa=normalizeAbbr(away.team?.abbreviation||"");
  const mid=ESPN_ABBR_MAP[`${ha}|${aa}`]||ESPN_ABBR_MAP[`${aa}|${ha}`]||null;
  if(!mid)return null;
  const st=ev.status||comp.status;const state=st?.type?.state||"pre";const clock=st?.displayClock||"";
  const directKey=`${ha}|${aa}`;const homeSwapped=!ESPN_ABBR_MAP[directKey];
  const hs=parseInt(home.score)||0;const as=parseInt(away.score)||0;
  return{mid,state,clock,homeScore:homeSwapped?as:hs,awayScore:homeSwapped?hs:as,homeAbbr:ha,awayAbbr:aa};
}