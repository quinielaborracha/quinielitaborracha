/* ════════════════════════════════════════════════════════════
   paises.js
   ════════════════════════════════════════════════════════════
   Datos de referencia de PAÍSES (sin funciones): nombre canónico,
   traducción de nombres ESPN (en → es), banderas y avatares de
   campeón. Nada de esto depende del torneo en curso -- un país es
   "México" tenga el fixture que tenga, por eso vive separado de
   app-static-data.js (que sí es específico del Mundial 2026: fixture,
   grupos, mapeos ESPN por partido, puntos de "Reglas avanzadas").

   Sprint 1 de la "hoja de ruta comercial" (motor de datos de torneo):
   extraído de app-static-data.js tal cual, sin cambios de contenido,
   para que un futuro segundo torneo (Copa América, Euro, etc.) pueda
   reusar esta misma base de países sin duplicarla. Carga en el mismo
   lugar donde cargaba antes (después de utils.js, antes de
   app-static-data.js) porque utils.js ya depende de TEAM_NAMES/
   ESPN_NAME_ES en abbr2name()/espnNameES().
   ════════════════════════════════════════════════════════════ */

// ── Equipos: abreviatura → nombre completo ──
// Nombre canónico de cada equipo para comparaciones
const TEAM_NAMES = {
  "MEX":"México","RSA":"Sudáfrica","KOR":"Corea del Sur","CZE":"Chequia",
  "CAN":"Canadá","BIH":"Bosnia y Herzegovina","QAT":"Catar","SUI":"Suiza",
  "BRA":"Brasil","MAR":"Marruecos","HAI":"Haití","SCO":"Escocia",
  "USA":"Estados Unidos","PAR":"Paraguay","AUS":"Australia","TUR":"Turquía",
  "GER":"Alemania","CIV":"Costa de Marfil","ECU":"Ecuador","CUR":"Curazao",
  "NED":"Países Bajos","JPN":"Japón","SWE":"Suecia","TUN":"Túnez",
  "KSA":"Arabia Saudita","URU":"Uruguay","ESP":"España","CPV":"Cabo Verde",
  "IRN":"Irán","NZL":"Nueva Zelanda","BEL":"Bélgica","EGY":"Egipto",
  "FRA":"Francia","SEN":"Senegal","IRQ":"Irak","NOR":"Noruega",
  "ARG":"Argentina","ALG":"Argelia","AUT":"Austria","JOR":"Jordania",
  "ENG":"Inglaterra","CRO":"Croacia","GHA":"Ghana","PAN":"Panamá",
  "POR":"Portugal","CGO":"RD Congo","UZB":"Uzbekistán","COL":"Colombia",
  // Sprint 4c (hoja de ruta comercial, 2026-07-23): agregados para la
  // Copa América ficticia (torneo-copaamerica.js) -- no estaban porque
  // ninguno de estos 5 países clasificó al Mundial 2026.
  "CHI":"Chile","PER":"Perú","BOL":"Bolivia","VEN":"Venezuela","CRC":"Costa Rica",
};

// ── ESPN: traducción de nombres de equipo (en → es) ──
// Traducción de nombres ESPN (en) → español para los equipos
const ESPN_NAME_ES={
  "Mexico":"México","South Korea":"Corea del Sur","Czech Republic":"República Checa","Czechia":"República Checa",
  "Bosnia and Herzegovina":"Bosnia y Herzegovina","Qatar":"Catar","Switzerland":"Suiza",
  "Brazil":"Brasil","Morocco":"Marruecos","Haiti":"Haití","Scotland":"Escocia",
  "United States":"Estados Unidos","USA":"Estados Unidos","Turkey":"Turquía","Turkiye":"Turquía","Türkiye":"Turquía",
  "Germany":"Alemania","Ivory Coast":"Costa de Marfil","Cote d'Ivoire":"Costa de Marfil","Côte d'Ivoire":"Costa de Marfil","Ecuador":"Ecuador",
  "Netherlands":"Países Bajos","Japan":"Japón","Sweden":"Suecia","Tunisia":"Túnez",
  "Saudi Arabia":"Arabia Saudita","Uruguay":"Uruguay","Spain":"España","Cape Verde":"Cabo Verde",
  "Iran":"Irán","New Zealand":"Nueva Zelanda","Belgium":"Bélgica","Egypt":"Egipto",
  "France":"Francia","Senegal":"Senegal","Iraq":"Irak","Norway":"Noruega",
  "Argentina":"Argentina","Algeria":"Argelia","Austria":"Austria","Jordan":"Jordania",
  "Portugal":"Portugal","DR Congo":"RD Congo","Congo DR":"RD Congo","Congo":"RD Congo","Uzbekistan":"Uzbekistán",
  "Colombia":"Colombia","England":"Inglaterra","Croatia":"Croacia","Ghana":"Ghana","Panama":"Panamá",
  "Paraguay":"Paraguay","Australia":"Australia","Korea Republic":"Corea del Sur","Curacao":"Curazao","Curaçao":"Curazao",
  "Canada":"Canadá","Bosnia-Herzegovina":"Bosnia y Herzegovina","South Africa":"Sudáfrica",
  "Chile":"Chile","Peru":"Perú","Perú":"Perú","Bolivia":"Bolivia","Venezuela":"Venezuela","Costa Rica":"Costa Rica",
};

// ── Banderas ──
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
  "RD Congo":"🇨🇩","R.D.Congo":"🇨🇩","DR Congo":"🇨🇩","Congo DR":"🇨🇩","Congo":"🇨🇩","República Del Congo":"🇨🇩",
  "Uzbekistán":"🇺🇿","Uzbekistan":"🇺🇿",
  "Colombia":"🇨🇴",
  "Inglaterra":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Croacia":"🇭🇷","Croatia":"🇭🇷",
  "Ghana":"🇬🇭",
  "Panamá":"🇵🇦","Panama":"🇵🇦",
  "Chile":"🇨🇱","Perú":"🇵🇪","Peru":"🇵🇪","Bolivia":"🇧🇴","Venezuela":"🇻🇪","Costa Rica":"🇨🇷",
};

// ── Avatares de campeón (v1.8; v3.10 — varias opciones por país) ──
// Carpeta avatars/ (raíz del repo, servida tal cual por GitHub Pages) con
// una o más ilustraciones por país -- todavía no hay una para cada uno de
// los 48 equipos del torneo, así que AVATAR_MAP solo tiene entrada para
// los que ya existen como archivo. Mismo criterio de clave que ALL_FLAGS/
// TEAM_NAMES (nombre completo en español, con tilde): es el mismo string
// que guarda preds.special.campeon / S.adv[name].champ, así que
// avatarOfChampion() (app-core-data.js) puede buscar por esa clave
// directo, sin normalizar. País sin avatar todavía → sin entrada acá →
// avatarOfChampion() devuelve "" y quien lo consume no muestra nada
// (a propósito: mejor vacío que un avatar genérico que no representa a
// nadie).
const AVATAR_DIR = "avatars/";
const AVATAR_MAP = {
  "México":["Campos_Mexico_2.webp","Memo2_Mexico.webp"],
  "Sudáfrica":["Tau_Sudafrica.webp"],
  "Corea del Sur":["Son_Corea_del_Sur.webp"],
  "Canadá":["Davies_Canada.webp"],
  "Brasil":["Dinho_Brasil.webp","Neymar_Brasil_3.webp","Ronaldo_Brasil_2.webp"],
  "Marruecos":["Hakimi_Marruecos.webp"],
  "Estados Unidos":["Lalas_USA.webp"],
  "Paraguay":["Almiron_Paraguay.webp"],
  "Australia":["Ryan_Australia.webp"],
  "Alemania":["Klinsmann_Alemania_2.webp","Klose_Alemania.webp"],
  "Costa de Marfil":["Haller_Costa_De_Marfil.webp"],
  "Ecuador":["Caicedo_Ecuador.webp"],
  "Países Bajos":["Cruiff_Paises_Bajos_3.webp","Davids_Paises_Bajos.webp","Gullit_Paises_Bajos_2.webp"],
  "Japón":["Kubo_Japon.webp"],
  "Arabia Saudita":["Salem_Arabia_Saudita.webp"],
  "Uruguay":["Valverde_Uruguay.webp"],
  "España":["Raul_Spain_2.webp","Sergio_Spain.webp"],
  "Cabo Verde":["Ryan_Mendes_Cabo_Verde.webp"],
  "Bélgica":["Lukaku_Belgica.webp"],
  "Egipto":["Salah_Egipto.webp"],
  "Francia":["Platini_Francia_2.webp","Thuran_Francia_3.webp","Zindane2_Francia.webp"],
  "Noruega":["Solskjaer_Noruega_2.webp","haalnad_Noruega.webp"],
  "Argentina":["LMessi_Argentina.webp","Maradona2_Argentina_2.webp"],
  "Inglaterra":["David_Inglaterra.webp"],
  "Croacia":["Modric_Croacia.webp","Suker_Croacia_2.webp"],
  "Ghana":["Mane_Ghana.webp"],
  "Panamá":["Panama.webp"],
  "Portugal":["Cristiano_Portugal.webp","Figo_Portugal_2.webp"],
  "Colombia":["Higuita_Colombia_2.webp","Pibe_Colombia.webp"],
};
