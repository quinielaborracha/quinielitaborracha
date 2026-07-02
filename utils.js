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
function flagEmoji(emoji,s=20){return`<span style="font-size:${s}px;line-height:1">${emoji||"🌐"}</span>`;}

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

function n(s){return(s||"").toLowerCase().trim();}

function abbr2name(abbr) {
  return TEAM_NAMES[abbr] || abbr;
}

function espnNameES(name){return ESPN_NAME_ES[name]||name;}

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