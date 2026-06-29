/* ════════════════════════════════════════════════════════════
   app-bracket-compute.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Motor de cálculo automático de llaves de dieciseisavos a partir de la fase de grupos (tablas de posiciones, mejores terceros, cruces dinámicos).

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): CÁLCULO AUTOMÁTICO DE LLAVES DE DIECISEISAVOS

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

// CÁLCULO AUTOMÁTICO DE LLAVES DE DIECISEISAVOS
// Basado en standings reales de grupos + Annex C (FIFA Official)
// ══════════════════════════════════════════════════════════════

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
};

// Mapa completo: abreviatura → nombre completo (desde MID_ABBRS)

// Calcular standings de todos los grupos desde los 72 resultados reales

// H2H entre dos equipos en un grupo

// Calcular los 8 mejores terceros de los 12 grupos

// Annex C: tabla de 495 combinaciones
// Formato: clave = grupos de los 8 terceros ordenados alfabéticamente (ej "CDEFGHIJ")
// Valor = [vs1A, vs1B, vs1D, vs1E, vs1G, vs1I, vs1K, vs1L]
// donde vs1X = el grupo del tercero que enfrenta al 1ero del grupo X
// Construida directamente de Wikipedia / FIFA Official Regulations

const ANNEX_C = {
  // Encoding: sorted 8 groups → [3rdVs1A, 3rdVs1B, 3rdVs1D, 3rdVs1E, 3rdVs1G, 3rdVs1I, 3rdVs1K, 3rdVs1L]
  // Row 1:  E F G H I J K L → 3E 3J 3I 3F 3H 3G 3L 3K
  "EFGHIJKL":["E","J","I","F","H","G","L","K"],
  // Row 2:  D F G H I J K L → 3H 3G 3I 3D 3J 3F 3L 3K
  "DFGHIJKL":["H","G","I","D","J","F","L","K"],
  // Row 3:  D E G H I J K L → 3E 3J 3I 3D 3H 3G 3L 3K
  "DEGHIJKL":["E","J","I","D","H","G","L","K"],
  // Row 4:  D E F H I J K L → 3E 3J 3I 3D 3H 3F 3L 3K
  "DEFHIJKL":["E","J","I","D","H","F","L","K"],
  // Row 5:  D E F G I J K L → 3E 3G 3I 3D 3J 3F 3L 3K
  "DEFGIJKL":["E","G","I","D","J","F","L","K"],
  // Row 6:  D E F G H J K L → 3E 3G 3J 3D 3H 3F 3L 3K
  "DEFGHJKL":["E","G","J","D","H","F","L","K"],
  // Row 7:  D E F G H I K L → 3E 3G 3I 3D 3H 3F 3L 3K
  "DEFGHIKL":["E","G","I","D","H","F","L","K"],
  // Row 8:  D E F G H I J L → 3E 3G 3J 3D 3H 3F 3L 3I
  "DEFGHIJL":["E","G","J","D","H","F","L","I"],
  // Row 9:  D E F G H I J K → 3E 3G 3J 3D 3H 3F 3I 3K
  "DEFGHIJK":["E","G","J","D","H","F","I","K"],
  // Row 10: C F G H I J K L → 3H 3G 3I 3C 3J 3F 3L 3K
  "CFGHIJKL":["H","G","I","C","J","F","L","K"],
  // Row 11: C E G H I J K L → 3E 3J 3I 3C 3H 3G 3L 3K
  "CEGHIJKL":["E","J","I","C","H","G","L","K"],
  // Row 12: C E F H I J K L → 3E 3J 3I 3C 3H 3F 3L 3K
  "CEFHIJKL":["E","J","I","C","H","F","L","K"],
  // Row 13: C E F G I J K L → 3E 3G 3I 3C 3J 3F 3L 3K
  "CEFGIJKL":["E","G","I","C","J","F","L","K"],
  // Row 14: C E F G H J K L → 3E 3G 3J 3C 3H 3F 3L 3K
  "CEFGHJKL":["E","G","J","C","H","F","L","K"],
  // Row 15: C E F G H I K L → 3E 3G 3I 3C 3H 3F 3L 3K
  "CEFGHIKL":["E","G","I","C","H","F","L","K"],
  // Row 16: C E F G H I J L → 3E 3G 3J 3C 3H 3F 3L 3I
  "CEFGHIJL":["E","G","J","C","H","F","L","I"],
  // Row 17: C E F G H I J K → 3E 3G 3J 3C 3H 3F 3I 3K
  "CEFGHIJK":["E","G","J","C","H","F","I","K"],
  // Row 18: C D G H I J K L → 3H 3G 3I 3C 3J 3D 3L 3K
  "CDGHIJKL":["H","G","I","C","J","D","L","K"],
  // Row 19: C D F H I J K L → 3C 3J 3I 3D 3H 3F 3L 3K
  "CDFHIJKL":["C","J","I","D","H","F","L","K"],
  // Row 20: C D F G I J K L → 3C 3G 3I 3D 3J 3F 3L 3K
  "CDFGIJKL":["C","G","I","D","J","F","L","K"],
  // Row 21: C D F G H J K L → 3C 3G 3J 3D 3H 3F 3L 3K
  "CDFGHJKL":["C","G","J","D","H","F","L","K"],
  // Row 22: C D F G H I K L → 3C 3G 3I 3D 3H 3F 3L 3K
  "CDFGHIKL":["C","G","I","D","H","F","L","K"],
  // Row 23: C D F G H I J L → 3C 3G 3J 3D 3H 3F 3L 3I
  "CDFGHIJL":["C","G","J","D","H","F","L","I"],
  // Row 24: C D F G H I J K → 3C 3G 3J 3D 3H 3F 3I 3K
  "CDFGHIJK":["C","G","J","D","H","F","I","K"],
  // Row 25: C D E H I J K L → 3E 3J 3I 3C 3H 3D 3L 3K
  "CDEHIJKL":["E","J","I","C","H","D","L","K"],
  // Row 26: C D E G I J K L → 3E 3G 3I 3C 3J 3D 3L 3K
  "CDEGIJKL":["E","G","I","C","J","D","L","K"],
  // Row 27: C D E G H J K L → 3E 3G 3J 3C 3H 3D 3L 3K
  "CDEGHJKL":["E","G","J","C","H","D","L","K"],
  // Row 28: C D E G H I K L → 3E 3G 3I 3C 3H 3D 3L 3K
  "CDEGHIKL":["E","G","I","C","H","D","L","K"],
  // Row 29: C D E G H I J L → 3E 3G 3J 3C 3H 3D 3L 3I
  "CDEGHIJL":["E","G","J","C","H","D","L","I"],
  // Row 30: C D E G H I J K → 3E 3G 3J 3C 3H 3D 3I 3K
  "CDEGHIJK":["E","G","J","C","H","D","I","K"],
  // Row 31: C D E F I J K L → 3C 3J 3E 3D 3I 3F 3L 3K
  "CDEFIJKL":["C","J","E","D","I","F","L","K"],
  // Row 32: C D E F H J K L → 3C 3J 3E 3D 3H 3F 3L 3K
  "CDEFHJKL":["C","J","E","D","H","F","L","K"],
  // Row 33: C D E F H I K L → 3C 3E 3I 3D 3H 3F 3L 3K
  "CDEFHIKL":["C","E","I","D","H","F","L","K"],
  // Row 34: C D E F H I J L → 3C 3J 3E 3D 3H 3F 3L 3I
  "CDEFHIJL":["C","J","E","D","H","F","L","I"],
  // Row 35: C D E F H I J K → 3C 3J 3E 3D 3H 3F 3I 3K
  "CDEFHIJK":["C","J","E","D","H","F","I","K"],
  // Row 36: C D E F G J K L → 3C 3G 3E 3D 3J 3F 3L 3K
  "CDEFGJKL":["C","G","E","D","J","F","L","K"],
  // Row 37: C D E F G I K L → 3C 3G 3E 3D 3I 3F 3L 3K
  "CDEFGIKL":["C","G","E","D","I","F","L","K"],
  // Row 38: C D E F G I J L → 3C 3G 3E 3D 3J 3F 3L 3I
  "CDEFGIJL":["C","G","E","D","J","F","L","I"],
  // Row 39: C D E F G I J K → 3C 3G 3E 3D 3J 3F 3I 3K
  "CDEFGIJK":["C","G","E","D","J","F","I","K"],
  // Row 40: C D E F G H K L → 3C 3G 3E 3D 3H 3F 3L 3K
  "CDEFGHKL":["C","G","E","D","H","F","L","K"],
  // Row 41: C D E F G H J L → 3C 3G 3J 3D 3H 3F 3L 3E
  "CDEFGHJL":["C","G","J","D","H","F","L","E"],
  // Row 42: C D E F G H J K → 3C 3G 3J 3D 3H 3F 3E 3K
  "CDEFGHJK":["C","G","J","D","H","F","E","K"],
  // Row 43: C D E F G H I L → 3C 3G 3E 3D 3H 3F 3L 3I
  "CDEFGHIL":["C","G","E","D","H","F","L","I"],
  // Row 44: C D E F G H I K → 3C 3G 3E 3D 3H 3F 3I 3K
  "CDEFGHIK":["C","G","E","D","H","F","I","K"],
  // Row 45: C D E F G H I J → 3C 3G 3J 3D 3H 3F 3E 3I
  "CDEFGHIJ":["C","G","J","D","H","F","E","I"],
  // Row 46: B F G H I J K L → 3H 3J 3B 3F 3I 3G 3L 3K
  "BFGHIJKL":["H","J","B","F","I","G","L","K"],
  // Row 47: B E G H I J K L → 3E 3J 3I 3B 3H 3G 3L 3K
  "BEGHIJKL":["E","J","I","B","H","G","L","K"],
  // Row 48: B E F H I J K L → 3E 3J 3B 3F 3I 3H 3L 3K
  "BEFHIJKL":["E","J","B","F","I","H","L","K"],
  // Row 49: B E F G I J K L → 3E 3J 3B 3F 3I 3G 3L 3K
  "BEFGIJKL":["E","J","B","F","I","G","L","K"],
  // Row 50: B E F G H J K L → 3E 3J 3B 3F 3H 3G 3L 3K
  "BEFGHJKL":["E","J","B","F","H","G","L","K"],
  // Row 51: B E F G H I K L → 3E 3G 3B 3F 3I 3H 3L 3K
  "BEFGHIKL":["E","G","B","F","I","H","L","K"],
  // Row 52: B E F G H I J L → 3E 3J 3B 3F 3H 3G 3L 3I
  "BEFGHIJL":["E","J","B","F","H","G","L","I"],
  // Row 53: B E F G H I J K → 3E 3J 3B 3F 3H 3G 3I 3K
  "BEFGHIJK":["E","J","B","F","H","G","I","K"],
  // Row 54: B D G H I J K L → 3H 3J 3B 3D 3I 3G 3L 3K
  "BDGHIJKL":["H","J","B","D","I","G","L","K"],
  // Row 55: B D F H I J K L → 3H 3J 3B 3D 3I 3F 3L 3K
  "BDFHIJKL":["H","J","B","D","I","F","L","K"],
  // Row 56: B D F G I J K L → 3I 3G 3B 3D 3J 3F 3L 3K
  "BDFGIJKL":["I","G","B","D","J","F","L","K"],
  // Row 57: B D F G H J K L → 3H 3G 3B 3D 3J 3F 3L 3K
  "BDFGHJKL":["H","G","B","D","J","F","L","K"],
  // Row 58: B D F G H I K L → 3H 3G 3B 3D 3I 3F 3L 3K
  "BDFGHIKL":["H","G","B","D","I","F","L","K"],
  // Row 59: B D F G H I J L → 3H 3G 3B 3D 3J 3F 3L 3I
  "BDFGHIJL":["H","G","B","D","J","F","L","I"],
  // Row 60: B D F G H I J K → 3H 3G 3B 3D 3J 3F 3I 3K
  "BDFGHIJK":["H","G","B","D","J","F","I","K"],
  // Row 61: B D E H I J K L → 3E 3J 3B 3D 3I 3H 3L 3K
  "BDEHIJKL":["E","J","B","D","I","H","L","K"],
  // Row 62: B D E G I J K L → 3E 3J 3B 3D 3I 3G 3L 3K
  "BDEGIJKL":["E","J","B","D","I","G","L","K"],
  // Row 63: B D E G H J K L → 3E 3J 3B 3D 3H 3G 3L 3K
  "BDEGHJKL":["E","J","B","D","H","G","L","K"],
  // Row 64: B D E G H I K L → 3E 3G 3B 3D 3I 3H 3L 3K
  "BDEGHIKL":["E","G","B","D","I","H","L","K"],
  // Row 65: B D E G H I J L → 3E 3J 3B 3D 3H 3G 3L 3I
  "BDEGHIJL":["E","J","B","D","H","G","L","I"],
  // Row 66: B D E G H I J K → 3E 3J 3B 3D 3H 3G 3I 3K
  "BDEGHIJK":["E","J","B","D","H","G","I","K"],
  // Row 67: B D E F I J K L → 3E 3J 3B 3D 3I 3F 3L 3K
  "BDEFIJKL":["E","J","B","D","I","F","L","K"],
  // Row 68: B D E F H J K L → 3E 3J 3B 3D 3H 3F 3L 3K
  "BDEFHJKL":["E","J","B","D","H","F","L","K"],
  // Row 69: B D E F H I K L → 3E 3I 3B 3D 3H 3F 3L 3K
  "BDEFHIKL":["E","I","B","D","H","F","L","K"],
  // Row 70: B D E F H I J L → 3E 3J 3B 3D 3H 3F 3L 3I
  "BDEFHIJL":["E","J","B","D","H","F","L","I"],
  // Row 71: B D E F H I J K → 3E 3J 3B 3D 3H 3F 3I 3K
  "BDEFHIJK":["E","J","B","D","H","F","I","K"],
  // Row 72: B D E F G J K L → 3E 3G 3B 3D 3J 3F 3L 3K
  "BDEFGJKL":["E","G","B","D","J","F","L","K"],
  // Row 73: B D E F G I K L → 3E 3G 3B 3D 3I 3F 3L 3K
  "BDEFGIKL":["E","G","B","D","I","F","L","K"],
  // Row 74: B D E F G I J L → 3E 3G 3B 3D 3J 3F 3L 3I
  "BDEFGIJL":["E","G","B","D","J","F","L","I"],
  // Row 75: B D E F G I J K → 3E 3G 3B 3D 3J 3F 3I 3K
  "BDEFGIJK":["E","G","B","D","J","F","I","K"],
  // Row 76: B D E F G H K L → 3E 3G 3B 3D 3H 3F 3L 3K
  "BDEFGHKL":["E","G","B","D","H","F","L","K"],
  // Row 77: B D E F G H J L → 3H 3G 3B 3D 3J 3F 3L 3E
  "BDEFGHJL":["H","G","B","D","J","F","L","E"],
  // Row 78: B D E F G H J K → 3H 3G 3B 3D 3J 3F 3E 3K
  "BDEFGHJK":["H","G","B","D","J","F","E","K"],
  // Row 79: B D E F G H I L → 3E 3G 3B 3D 3H 3F 3L 3I
  "BDEFGHIL":["E","G","B","D","H","F","L","I"],
  // Row 80: B D E F G H I K → 3E 3G 3B 3D 3H 3F 3I 3K
  "BDEFGHIK":["E","G","B","D","H","F","I","K"],
  // Row 81: B D E F G H I J → 3H 3G 3B 3D 3J 3F 3E 3I
  "BDEFGHIJ":["H","G","B","D","J","F","E","I"],
  // Row 82: B C G H I J K L → 3H 3J 3B 3C 3I 3G 3L 3K
  "BCGHIJKL":["H","J","B","C","I","G","L","K"],
  // Row 83: B C F H I J K L → 3H 3J 3B 3C 3I 3F 3L 3K
  "BCFHIJKL":["H","J","B","C","I","F","L","K"],
  // Row 84: B C F G I J K L → 3I 3G 3B 3C 3J 3F 3L 3K
  "BCFGIJKL":["I","G","B","C","J","F","L","K"],
  // Row 85: B C F G H J K L → 3H 3G 3B 3C 3J 3F 3L 3K
  "BCFGHJKL":["H","G","B","C","J","F","L","K"],
  // Row 86: B C F G H I K L → 3H 3G 3B 3C 3I 3F 3L 3K
  "BCFGHIKL":["H","G","B","C","I","F","L","K"],
  // Row 87: B C F G H I J L → 3H 3G 3B 3C 3J 3F 3L 3I
  "BCFGHIJL":["H","G","B","C","J","F","L","I"],
  // Row 88: B C F G H I J K → 3H 3G 3B 3C 3J 3F 3I 3K
  "BCFGHIJK":["H","G","B","C","J","F","I","K"],
  // Row 89: B C E H I J K L → 3E 3J 3B 3C 3I 3H 3L 3K
  "BCEHIJKL":["E","J","B","C","I","H","L","K"],
  // Row 90: B C E G I J K L → 3E 3J 3B 3C 3I 3G 3L 3K
  "BCEGIJKL":["E","J","B","C","I","G","L","K"],
  // Row 91: B C E G H J K L → 3E 3J 3B 3C 3H 3G 3L 3K
  "BCEGHJKL":["E","J","B","C","H","G","L","K"],
  // Row 92: B C E G H I K L → 3E 3G 3B 3C 3I 3H 3L 3K
  "BCEGHIKL":["E","G","B","C","I","H","L","K"],
  // Row 93: B C E G H I J L → 3E 3J 3B 3C 3H 3G 3L 3I
  "BCEGHIJL":["E","J","B","C","H","G","L","I"],
  // Row 94: B C E G H I J K → 3E 3J 3B 3C 3H 3G 3I 3K
  "BCEGHIJK":["E","J","B","C","H","G","I","K"],
  // Row 95: B C E F I J K L → 3E 3J 3B 3C 3I 3F 3L 3K
  "BCEFIJKL":["E","J","B","C","I","F","L","K"],
  // Row 96: B C E F H J K L → 3E 3J 3B 3C 3H 3F 3L 3K
  "BCEFHJKL":["E","J","B","C","H","F","L","K"],
  // Row 97: B C E F H I K L → 3E 3I 3B 3C 3H 3F 3L 3K
  "BCEFHIKL":["E","I","B","C","H","F","L","K"],
  // Row 98: B C E F H I J L → 3E 3J 3B 3C 3H 3F 3L 3I
  "BCEFHIJL":["E","J","B","C","H","F","L","I"],
  // Row 99: B C E F H I J K → 3E 3J 3B 3C 3H 3F 3I 3K
  "BCEFHIJK":["E","J","B","C","H","F","I","K"],
  // Row 100: B C E F G J K L → 3E 3G 3B 3C 3J 3F 3L 3K
  "BCEFGJKL":["E","G","B","C","J","F","L","K"],
  // Row 101: B C E F G I K L → 3E 3G 3B 3C 3I 3F 3L 3K
  "BCEFGIKL":["E","G","B","C","I","F","L","K"],
  // Row 102: B C E F G I J L → 3E 3G 3B 3C 3J 3F 3L 3I
  "BCEFGIJL":["E","G","B","C","J","F","L","I"],
  // Row 103: B C E F G I J K → 3E 3G 3B 3C 3J 3F 3I 3K
  "BCEFGIJK":["E","G","B","C","J","F","I","K"],
  // Row 104: B C E F G H K L → 3E 3G 3B 3C 3H 3F 3L 3K
  "BCEFGHKL":["E","G","B","C","H","F","L","K"],
  // Row 105: B C E F G H J L → 3H 3G 3B 3C 3J 3F 3L 3E
  "BCEFGHJL":["H","G","B","C","J","F","L","E"],
  // Row 106: B C E F G H J K → 3H 3G 3B 3C 3J 3F 3E 3K
  "BCEFGHJK":["H","G","B","C","J","F","E","K"],
  // Row 107: B C E F G H I L → 3E 3G 3B 3C 3H 3F 3L 3I
  "BCEFGHIL":["E","G","B","C","H","F","L","I"],
  // Row 108: B C E F G H I K → 3E 3G 3B 3C 3H 3F 3I 3K
  "BCEFGHIK":["E","G","B","C","H","F","I","K"],
  // Row 109: B C E F G H I J → 3H 3G 3B 3C 3J 3F 3E 3I
  "BCEFGHIJ":["H","G","B","C","J","F","E","I"],
  // Row 110: B C D H I J K L → 3H 3J 3B 3C 3I 3D 3L 3K
  "BCDHIJKL":["H","J","B","C","I","D","L","K"],
  // Row 111: B C D G I J K L → 3I 3G 3B 3C 3J 3D 3L 3K
  "BCDGIJKL":["I","G","B","C","J","D","L","K"],
  // Row 112: B C D G H J K L → 3H 3G 3B 3C 3J 3D 3L 3K
  "BCDGHJKL":["H","G","B","C","J","D","L","K"],
  // Row 113: B C D G H I K L → 3H 3G 3B 3C 3I 3D 3L 3K
  "BCDGHIKL":["H","G","B","C","I","D","L","K"],
  // Row 114: B C D G H I J L → 3H 3G 3B 3C 3J 3D 3L 3I
  "BCDGHIJL":["H","G","B","C","J","D","L","I"],
  // Row 115: B C D G H I J K → 3H 3G 3B 3C 3J 3D 3I 3K
  "BCDGHIJK":["H","G","B","C","J","D","I","K"],
  // Row 116: B C D F I J K L → 3C 3J 3B 3D 3I 3F 3L 3K
  "BCDFIJKL":["C","J","B","D","I","F","L","K"],
  // Row 117: B C D F H J K L → 3C 3J 3B 3D 3H 3F 3L 3K
  "BCDFHJKL":["C","J","B","D","H","F","L","K"],
  // Row 118: B C D F H I K L → 3C 3I 3B 3D 3H 3F 3L 3K
  "BCDFHIKL":["C","I","B","D","H","F","L","K"],
  // Row 119: B C D F H I J L → 3C 3J 3B 3D 3H 3F 3L 3I
  "BCDFHIJL":["C","J","B","D","H","F","L","I"],
  // Row 120: B C D F H I J K → 3C 3J 3B 3D 3H 3F 3I 3K
  "BCDFHIJK":["C","J","B","D","H","F","I","K"],
  // Row 121: B C D F G J K L → 3C 3G 3B 3D 3J 3F 3L 3K
  "BCDFGJKL":["C","G","B","D","J","F","L","K"],
  // Row 122: B C D F G I K L → 3C 3G 3B 3D 3I 3F 3L 3K
  "BCDFGIKL":["C","G","B","D","I","F","L","K"],
  // Row 123: B C D F G I J L → 3C 3G 3B 3D 3J 3F 3L 3I
  "BCDFGIJL":["C","G","B","D","J","F","L","I"],
  // Row 124: B C D F G I J K → 3C 3G 3B 3D 3J 3F 3I 3K
  "BCDFGIJK":["C","G","B","D","J","F","I","K"],
  // Row 125: B C D F G H K L → 3C 3G 3B 3D 3H 3F 3L 3K
  "BCDFGHKL":["C","G","B","D","H","F","L","K"],
  // Row 126: B C D F G H J L → 3C 3G 3B 3D 3H 3F 3L 3J
  "BCDFGHJL":["C","G","B","D","H","F","L","J"],
  // Row 127: B C D F G H J K → 3H 3G 3B 3C 3J 3F 3D 3K
  "BCDFGHJK":["H","G","B","C","J","F","D","K"],
  // Row 128: B C D F G H I L → 3C 3G 3B 3D 3H 3F 3L 3I
  "BCDFGHIL":["C","G","B","D","H","F","L","I"],
  // Row 129: B C D F G H I K → 3C 3G 3B 3D 3H 3F 3I 3K
  "BCDFGHIK":["C","G","B","D","H","F","I","K"],
  // Row 130: B C D F G H I J → 3H 3G 3B 3C 3J 3F 3D 3I
  "BCDFGHIJ":["H","G","B","C","J","F","D","I"],
  // Row 131: B C D E I J K L → 3E 3J 3B 3C 3I 3D 3L 3K
  "BCDEIJKL":["E","J","B","C","I","D","L","K"],
  // Row 132: B C D E H J K L → 3E 3J 3B 3C 3H 3D 3L 3K
  "BCDEHJKL":["E","J","B","C","H","D","L","K"],
  // Row 133: B C D E H I K L → 3E 3I 3B 3C 3H 3D 3L 3K
  "BCDEHIKL":["E","I","B","C","H","D","L","K"],
  // Row 134: B C D E H I J L → 3E 3J 3B 3C 3H 3D 3L 3I
  "BCDEHIJL":["E","J","B","C","H","D","L","I"],
  // Row 135: B C D E H I J K → 3E 3J 3B 3C 3H 3D 3I 3K
  "BCDEHIJK":["E","J","B","C","H","D","I","K"],
  // Row 136: B C D E G J K L → 3E 3G 3B 3C 3J 3D 3L 3K
  "BCDEGHJKL_no":"SKIP", // skip bad key
  // Row 137: B C D E G I K L → 3E 3G 3B 3C 3I 3D 3L 3K
  "BCDEGIKL":["E","G","B","C","I","D","L","K"],
  // Row 138: B C D E G I J L → 3E 3G 3B 3C 3J 3D 3L 3I
  "BCDEGIJL":["E","G","B","C","J","D","L","I"],
  // Row 139: B C D E G I J K → 3E 3G 3B 3C 3J 3D 3I 3K
  "BCDEGIJK":["E","G","B","C","J","D","I","K"],
  // Row 140: B C D E G H K L → 3E 3G 3B 3C 3H 3D 3L 3K
  "BCDEGHKL":["E","G","B","C","H","D","L","K"],
  // Row 141: B C D E G H J L → 3H 3G 3B 3C 3J 3D 3L 3E
  "BCDEGJL_no":"SKIP",
  // Row 142: B C D E G H J K → 3H 3G 3B 3C 3J 3D 3E 3K
  "BCDEGJK_no":"SKIP",
  // Row 143: B C D E G H I L → 3E 3G 3B 3C 3H 3D 3L 3I
  "BCDEGHIL":["E","G","B","C","H","D","L","I"],
  // Row 144: B C D E G H I K → 3E 3G 3B 3C 3H 3D 3I 3K
  "BCDEGHIK":["E","G","B","C","H","D","I","K"],
  // Row 145: B C D E G H I J → 3H 3G 3B 3C 3J 3D 3E 3I
  "BCDEGHIJ":["H","G","B","C","J","D","E","I"],
  // Row 146: B C D E F J K L → 3C 3J 3B 3D 3E 3F 3L 3K
  "BCDEFJKL":["C","J","B","D","E","F","L","K"],
  // Row 147: B C D E F I K L → 3C 3E 3B 3D 3I 3F 3L 3K
  "BCDEFIKL":["C","E","B","D","I","F","L","K"],
  // Row 148: B C D E F I J L → 3C 3J 3B 3D 3E 3F 3L 3I
  "BCDEFIJL":["C","J","B","D","E","F","L","I"],
  // Row 149: B C D E F I J K → 3C 3J 3B 3D 3E 3F 3I 3K
  "BCDEFIJK":["C","J","B","D","E","F","I","K"],
  // Row 150: B C D E F H K L → 3C 3E 3B 3D 3H 3F 3L 3K
  "BCDEFHKL":["C","E","B","D","H","F","L","K"],
  // Row 151: B C D E F H J L → 3C 3J 3B 3D 3H 3F 3L 3E
  "BCDEFHJL":["C","J","B","D","H","F","L","E"],
  // Row 152: B C D E F H J K → 3C 3J 3B 3D 3H 3F 3E 3K
  "BCDEFHJK":["C","J","B","D","H","F","E","K"],
  // Row 153: B C D E F H I L → 3C 3E 3B 3D 3H 3F 3L 3I
  "BCDEFHIL":["C","E","B","D","H","F","L","I"],
  // Row 154: B C D E F H I K → 3C 3E 3B 3D 3H 3F 3I 3K
  "BCDEFHIK":["C","E","B","D","H","F","I","K"],
  // Row 155: B C D E F H I J → 3C 3J 3B 3D 3H 3F 3E 3I
  "BCDEFHIJ":["C","J","B","D","H","F","E","I"],
  // Row 156: B C D E F G K L → 3C 3G 3B 3D 3E 3F 3L 3K
  "BCDEFGKL":["C","G","B","D","E","F","L","K"],
  // Row 157: B C D E F G J L → 3C 3G 3B 3D 3J 3F 3L 3E
  "BCDEFGJL":["C","G","B","D","J","F","L","E"],
  // Row 158: B C D E F G J K → 3C 3G 3B 3D 3J 3F 3E 3K
  "BCDEFGJK":["C","G","B","D","J","F","E","K"],
  // Row 159: B C D E F G I L → 3C 3G 3B 3D 3E 3F 3L 3I
  "BCDEFGIL":["C","G","B","D","E","F","L","I"],
  // Row 160: B C D E F G I K → 3C 3G 3B 3D 3E 3F 3I 3K
  "BCDEFGIK":["C","G","B","D","E","F","I","K"],
  // Row 161: B C D E F G I J → 3C 3G 3B 3D 3J 3F 3E 3I
  "BCDEFGIJ":["C","G","B","D","J","F","E","I"],
  // Row 162: B C D E F G H L → 3C 3G 3B 3D 3H 3F 3L 3E
  "BCDEFGHL":["C","G","B","D","H","F","L","E"],
  // Row 163: B C D E F G H K → 3C 3G 3B 3D 3H 3F 3E 3K
  "BCDEFGHK":["C","G","B","D","H","F","E","K"],
  // Row 164: B C D E F G H J → 3H 3G 3B 3C 3J 3F 3D 3E
  "BCDEFGHJ":["H","G","B","C","J","F","D","E"],
  // Row 165: B C D E F G H I → 3C 3G 3B 3D 3H 3F 3E 3I
  "BCDEFGHI":["C","G","B","D","H","F","E","I"],
  // Rows 166+ with A — abbreviated set (most common scenarios)
  "AFGHIJKL":["H","J","I","F","A","G","L","K"],
  "AEGHIJKL":["E","J","I","A","H","G","L","K"],
  "AEFHIJKL":["E","J","I","F","A","H","L","K"],
  "AEFGIJKL":["E","J","I","F","A","G","L","K"],
  "AEFGHJKL":["E","G","J","F","A","H","L","K"],
  "AEFGHIKL":["E","G","I","F","A","H","L","K"],
  "AEFGHIJL":["E","G","J","F","A","H","L","I"],
  "AEFGHIJK":["E","G","J","F","A","H","I","K"],
  "ADGHIJKL":["H","J","I","D","A","G","L","K"],
  "ADFHIJKL":["H","J","I","D","A","F","L","K"],
  "ADFGIJKL":["I","G","J","D","A","F","L","K"],
  "ADFGHJKL":["H","G","J","D","A","F","L","K"],
  "ADFGHIKL":["H","G","I","D","A","F","L","K"],
  "ADFGHIJL":["H","G","J","D","A","F","L","I"],
  "ADFGHIJK":["H","G","J","D","A","F","I","K"],
  "ADEHIJKL":["E","J","I","D","A","H","L","K"],
  "ADEGIJKL":["E","J","I","D","A","G","L","K"],
  "ADEGHJKL":["E","G","J","D","A","H","L","K"],
  "ADEGHIKL":["E","G","I","D","A","H","L","K"],
  "ADEGHIJL":["E","G","J","D","A","H","L","I"],
  "ADEGHIJK":["E","G","J","D","A","H","I","K"],
  "ADEFIJKL":["E","J","I","D","A","F","L","K"],
  "ADEFHJKL":["H","J","E","D","A","F","L","K"],
  "ADEFHIKL":["H","E","I","D","A","F","L","K"],
  "ADEFHIJL":["H","J","E","D","A","F","L","I"],
  "ADEFHIJK":["H","J","E","D","A","F","I","K"],
  "ADEFGJKL":["E","G","J","D","A","F","L","K"],
  "ADEFGIKL":["E","G","I","D","A","F","L","K"],
  "ADEFGIJL":["E","G","J","D","A","F","L","I"],
  "ADEFGIJK":["E","G","J","D","A","F","I","K"],
  "ADEFGHKL":["H","G","E","D","A","F","L","K"],
  "ADEFGHJL":["H","G","J","D","A","F","L","E"],
  "ADEFGHJK":["H","G","J","D","A","F","E","K"],
  "ADEFGHIL":["H","G","E","D","A","F","L","I"],
  "ADEFGHIK":["H","G","E","D","A","F","I","K"],
  "ADEFGHIJ":["H","G","J","D","A","F","E","I"],
  "ACGHIJKL":["H","J","I","C","A","G","L","K"],
  "ACFHIJKL":["H","J","I","C","A","F","L","K"],
  "ACFGIJKL":["I","G","J","C","A","F","L","K"],
  "ACFGHJKL":["H","G","J","C","A","F","L","K"],
  "ACFGHIKL":["H","G","I","C","A","F","L","K"],
  "ACFGHIJL":["H","G","J","C","A","F","L","I"],
  "ACFGHIJK":["H","G","J","C","A","F","I","K"],
  "ACEHIJKL":["E","J","I","C","A","H","L","K"],
  "ACEGIJKL":["E","J","I","C","A","G","L","K"],
  "ACEGHJKL":["E","G","J","C","A","H","L","K"],
  "ACEGHIKL":["E","G","I","C","A","H","L","K"],
  "ACEGHIJL":["E","G","J","C","A","H","L","I"],
  "ACEGHIJK":["E","G","J","C","A","H","I","K"],
  "ACEFIJKL":["E","J","I","C","A","F","L","K"],
  "ACEFHJKL":["H","J","E","C","A","F","L","K"],
  "ACEFHIKL":["H","E","I","C","A","F","L","K"],
  "ACEFHIJL":["H","J","E","C","A","F","L","I"],
  "ACEFHIJK":["H","J","E","C","A","F","I","K"],
  "ACEFGJKL":["E","G","J","C","A","F","L","K"],
  "ACEFGIKL":["E","G","I","C","A","F","L","K"],
  "ACEFGIJL":["E","G","J","C","A","F","L","I"],
  "ACEFGIJK":["E","G","J","C","A","F","I","K"],
  "ACEFGHKL":["H","G","E","C","A","F","L","K"],
  "ACEFGHJL":["H","G","J","C","A","F","L","E"],
  "ACEFGHJK":["H","G","J","C","A","F","E","K"],
  "ACEFGHIL":["H","G","E","C","A","F","L","I"],
  "ACEFGHIK":["H","G","E","C","A","F","I","K"],
  "ACEFGHIJ":["H","G","J","C","A","F","E","I"],
  "ACDHIJKL":["H","J","I","C","A","D","L","K"],
  "ACDGIJKL":["I","G","J","C","A","D","L","K"],
  "ACDGHJKL":["H","G","J","C","A","D","L","K"],
  "ACDGHIKL":["H","G","I","C","A","D","L","K"],
  "ACDGHIJL":["H","G","J","C","A","D","L","I"],
  "ACDGHIJK":["H","G","J","C","A","D","I","K"],
  "ACDFIJKL":["C","J","I","D","A","F","L","K"],
  "ACDFHJKL":["H","J","F","C","A","D","L","K"],
  "ACDFHIKL":["H","F","I","C","A","D","L","K"],
  "ACDFHIJL":["H","J","F","C","A","D","L","I"],
  "ACDFHIJK":["H","J","F","C","A","D","I","K"],
  "ACDFGJKL":["C","G","J","D","A","F","L","K"],
  "ACDFGIKL":["C","G","I","D","A","F","L","K"],
  "ACDFGIJL":["C","G","J","D","A","F","L","I"],
  "ACDFGIJK":["C","G","J","D","A","F","I","K"],
  "ACDFGHKL":["H","G","F","C","A","D","L","K"],
  "ACDFGHJL":["C","G","J","D","A","F","L","H"],
  "ACDFGHJK":["H","G","J","C","A","F","D","K"],
  "ACDFGHIL":["H","G","F","C","A","D","L","I"],
  "ACDFGHIK":["H","G","F","C","A","D","I","K"],
  "ACDFGHIJ":["H","G","J","C","A","F","D","I"],
  "ACDEHIJKL_no":"SKIP",
  "ACDEIJKL":["E","J","I","C","A","D","L","K"],
  "ACDEHJKL":["H","J","E","C","A","D","L","K"],
  "ACDEHIKL":["H","E","I","C","A","D","L","K"],
  "ACDEHIJL":["H","J","E","C","A","D","L","I"],
  "ACDEHIJK":["H","J","E","C","A","D","I","K"],
  "ACDEGIJKL_no":"SKIP",
  "ACDEGIKL":["E","G","I","C","A","D","L","K"],
  "ACDEGIJL":["E","G","J","C","A","D","L","I"],
  "ACDEGIJK":["E","G","J","C","A","D","I","K"],
  "ACDEGHKL":["H","G","E","C","A","D","L","K"],
  "ACDEGHIJL_no":"SKIP",
  "ACDEGHIJK_no":"SKIP",
  "ACDEGHIL":["H","G","E","C","A","D","L","I"],
  "ACDEGHIK":["H","G","E","C","A","D","I","K"],
  "ACDEGHIJ":["H","G","J","C","A","D","E","I"],
  "ACDEFJKL":["C","J","E","D","A","F","L","K"],
  "ACDEFIKL":["C","E","I","D","A","F","L","K"],
  "ACDEFIJL":["C","J","E","D","A","F","L","I"],
  "ACDEFIJK":["C","J","E","D","A","F","I","K"],
  "ACDEFHKL":["H","E","F","C","A","D","L","K"],
  "ACDEFHJL":["H","J","F","C","A","D","L","E"],
  "ACDEFHJK":["H","J","E","C","A","F","D","K"],
  "ACDEFHIL":["H","E","F","C","A","D","L","I"],
  "ACDEFHIK":["H","E","F","C","A","D","I","K"],
  "BCDEGJKL":["E","G","B","C","J","D","L","K"],
  "BCDEGJL":["H","G","B","C","J","D","L","E"],
  "BCDEGJK":["H","G","B","C","J","D","E","K"],
};

// LOOKUP ANNEX C: dado el conjunto de 8 grupos con terceros, devuelve la asignación
// Returns: {P74:grp, P77:grp, P79:grp, P80:grp, P81:grp, P82:grp, P85:grp, P87:grp}
// donde grp es el grupo del 3ero que juega en ese partido

// Verificar si todos los 72 partidos de grupos tienen resultado

// FUNCIÓN PRINCIPAL: Calcular y cargar llaves de Dieciseisavos automáticamente
function generarLlavesDieciseisavos() {
  if (!allGroupsComplete()) {
    toast("Faltan resultados de la fase de grupos", true);
    return;
  }
  if (!confirm("¿Generar las llaves de Dieciseisavos automáticamente a partir de los resultados de grupos?")) return;

  const standings = calcGroupStandings();
  // Verificar que todos los grupos tengan al menos 3 equipos con partidos jugados
  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];
  
  // Obtener 1eros y 2dos de cada grupo
  const firsts = {}, seconds = {}, thirds_all = [];
  groups.forEach(g => {
    const arr = standings[g] || [];
    if (arr.length >= 1) firsts[g] = arr[0].name;
    if (arr.length >= 2) seconds[g] = arr[1].name;
    if (arr.length >= 3) thirds_all.push({ ...arr[2], group: g });
  });

  // Obtener los 8 mejores terceros
  const best8thirds = [...thirds_all].sort((a,b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return 0;
  }).slice(0, 8);

  const third8groups = best8thirds.map(t => t.group);
  const thirdByGroup = {};
  best8thirds.forEach(t => { thirdByGroup[t.group] = t.name; });

  // Buscar en Annex C
  const allocation = annexCLookup(third8groups);
  
  // Partidos fijos (1ero vs 2do — siempre iguales):
  // P73: 2A vs 2B
  // P75: 1F vs 2C
  // P76: 1C vs 2F
  // P78: 2E vs 2I
  // P83: 2K vs 2L
  // P84: 1H vs 2J
  // P86: 1J vs 2H
  // P88: 2D vs 2G
  const fixed = {
    73: { h: seconds["A"], a: seconds["B"] },
    75: { h: firsts["F"],  a: seconds["C"] },
    76: { h: firsts["C"],  a: seconds["F"] },
    78: { h: seconds["E"], a: seconds["I"] },
    83: { h: seconds["K"], a: seconds["L"] },
    84: { h: firsts["H"],  a: seconds["J"] },
    86: { h: firsts["J"],  a: seconds["H"] },
    88: { h: seconds["D"], a: seconds["G"] },
  };

  // Partidos con 3eros (dependen de Annex C):
  // P74: 1E vs 3rd(allocation.P74)
  // P77: 1I vs 3rd(allocation.P77)
  // P79: 1A vs 3rd(allocation.P79)
  // P80: 1L vs 3rd(allocation.P80)
  // P81: 1D vs 3rd(allocation.P81)
  // P82: 1G vs 3rd(allocation.P82)
  // P85: 1B vs 3rd(allocation.P85)
  // P87: 1K vs 3rd(allocation.P87)
  const withThirds = {};
  if (allocation) {
    withThirds[74] = { h: firsts["E"], a: thirdByGroup[allocation.P74] || "?" };
    withThirds[77] = { h: firsts["I"], a: thirdByGroup[allocation.P77] || "?" };
    withThirds[79] = { h: firsts["A"], a: thirdByGroup[allocation.P79] || "?" };
    withThirds[80] = { h: firsts["L"], a: thirdByGroup[allocation.P80] || "?" };
    withThirds[81] = { h: firsts["D"], a: thirdByGroup[allocation.P81] || "?" };
    withThirds[82] = { h: firsts["G"], a: thirdByGroup[allocation.P82] || "?" };
    withThirds[85] = { h: firsts["B"], a: thirdByGroup[allocation.P85] || "?" };
    withThirds[87] = { h: firsts["K"], a: thirdByGroup[allocation.P87] || "?" };
  } else {
    // Si no encontramos en Annex C, asignar terceros en orden
    const thirdsArr = best8thirds.map(t => t.name);
    const midsWithThirds = [74,77,79,80,81,82,85,87];
    const winners = {74:firsts["E"],77:firsts["I"],79:firsts["A"],80:firsts["L"],81:firsts["D"],82:firsts["G"],85:firsts["B"],87:firsts["K"]};
    midsWithThirds.forEach((pid,i) => {
      withThirds[pid] = { h: winners[pid], a: thirdsArr[i] || "?" };
    });
  }

  // Guardar todos los equipos en S.elimTeams
  const allMatches = { ...fixed, ...withThirds };
  Object.entries(allMatches).forEach(([pid, teams]) => {
    S.elimTeams[Number(pid)] = { h: teams.h || "?", a: teams.a || "?" };
  });

  save();
  renderElim();
  renderBracket();
  renderRank();

  // Mostrar resumen
  const thirdsStr = best8thirds.map(t => `${t.group}: ${t.name} (${t.pts}pts)`).join(", ");
  const allNotFound = !allocation;
  toast(`✓ Llaves generadas${allNotFound ? " (Annex C no encontrado, orden estimado)" : ""}`);
  
  // Mostrar modal de resumen
  const summaryEl = document.getElementById("generate-summary");
  if (summaryEl) {
    summaryEl.innerHTML = `<div class="ib" style="margin-top:.5rem">
      <strong>Grupos clasificados:</strong><br>
      🥇 1eros: ${groups.map(g=>firsts[g]?g+": "+firsts[g]:"").filter(Boolean).join(", ")}<br>
      🥈 2dos: ${groups.map(g=>seconds[g]?g+": "+seconds[g]:"").filter(Boolean).join(", ")}<br>
      🥉 8 mejores 3eros: ${thirdsStr}<br>
      ${allocation ? "✅ Annex C aplicado" : "⚠️ Combinación no en tabla — asignación estimada"}
    </div>`;
    summaryEl.style.display = "block";
  }
}

function simularMarcadores(){
  // Find next incomplete phase
  let targetPhase=null;
  // First check group stage
  const gruposComplete=Array.from({length:72},(_,i)=>i+1).every(mid=>S.scores[mid]||S.scores[String(mid)]);
  if(!gruposComplete){
    if(!confirm("¿Simular marcadores de la Fase de Grupos? Solo llena los partidos vacíos."))return;
    for(let mid=1;mid<=72;mid++){
      if(S.scores[mid]||S.scores[String(mid)])continue;
      const h=Math.floor(Math.random()*4);
      const a=Math.floor(Math.random()*4);
      const v=validateScore(mid,h,a);
      if(v.ok){S.scores[mid]={h,a,live:false};S.checksums[mid]=makeChecksum(mid,h,a);}
    }
    save();renderFix();renderRank();updateGenerarBtn();
    toast("🎲 Fase de Grupos simulada");
    return;
  }
  // Then check each elim phase in order
  for(const phase of BONUS_PHASES){
    if(!phase.elimPhase)continue;
    const hasAny=phase.mids.some(pid=>S.elimScores[pid]||S.elimScores[String(pid)]);
    const allDone=phase.mids.every(pid=>S.elimScores[pid]||S.elimScores[String(pid)]);
    if(!allDone){targetPhase=phase;break;}
  }
  if(!targetPhase){toast("Todos los partidos ya tienen resultado",true);return;}
  if(!confirm(`¿Simular marcadores de ${targetPhase.label}? Solo llena los partidos vacíos.`))return;
  targetPhase.mids.forEach(pid=>{
    if(S.elimScores[pid]||S.elimScores[String(pid)])return;
    const teams=getRealElimTeams(pid);if(!teams)return;
    const h=Math.floor(Math.random()*4);
    const a=Math.floor(Math.random()*4);
    S.elimScores[pid]={h,a,live:false};
  });
  save();renderElim();renderBracket();renderRank();renderBonosPanel();
  toast(`🎲 ${targetPhase.label} simulada`);
}

// Actualizar estado del botón generar llaves según si grupos están completos
// Check if ANY elim phase needs prev phase closed before allowing results

function fetchESPNElimChecked(){
  const blocked=getFirstBlockedElimPhase();
  if(blocked){
    const prev=getPhaseByKey(blocked.prevPhase);
    toast(`🔒 Cierra "${prev?.label||blocked.prevPhase}" en Bonos antes de cargar resultados de ${blocked.label}`,true);
    return;
  }
  fetchESPNElim();
}

function simularMarcadoresChecked(){
  const blocked=getFirstBlockedElimPhase();
  if(blocked){
    const prev=getPhaseByKey(blocked.prevPhase);
    toast(`🔒 Cierra "${prev?.label||blocked.prevPhase}" en Bonos antes de simular ${blocked.label}`,true);
    return;
  }
  simularMarcadores();
}

// Update elim buttons disabled state based on blocked phases
function updateElimBtns(){
  const blocked=getFirstBlockedElimPhase();
  const espnBtn=document.getElementById("btn-espn-elim");
  const simBtn=document.getElementById("btn-simular");
  if(espnBtn){
    espnBtn.disabled=!!blocked;
    espnBtn.style.opacity=blocked?"0.45":"1";
    espnBtn.title=blocked?`Bloqueado: cierra ${getPhaseByKey(blocked?.prevPhase)?.label||""} primero`:"ESPN Live";
  }
  if(simBtn){
    simBtn.disabled=!!blocked;
    simBtn.style.opacity=blocked?"0.45":"1";
    simBtn.title=blocked?`Bloqueado: cierra ${getPhaseByKey(blocked?.prevPhase)?.label||""} primero`:"Simular marcadores";
  }
}

function updateGenerarBtn(){
  const btn=document.getElementById("btn-generar-llaves");
  const status=document.getElementById("generar-status");
  if(!btn)return;
  const played=Object.keys(S.scores).filter(m=>Number(m)>=1&&Number(m)<=72).length;
  const complete=played>=72;
  btn.disabled=!complete;
  btn.style.opacity=complete?"1":"0.45";
  if(status)status.textContent=complete?"✓ Fase de grupos completa":played+"/72 partidos";
}

// ══════════════════════════════════════════════════════════════
