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
//
// v1.7 — FIX: tabla COMPLETA y verificada (495/495 combinaciones), extraida
// directamente del PDF oficial de las Regulations del FIFA World Cup 26 (Annexe
// C, paginas 79-97) -- la version anterior solo tenia 278/495 filas (56%), 2 con
// la clave mal tipeada (le faltaba una letra) y 7 marcadas a mano como "SKIP"; el
// resto de las combinaciones (44% de los casos reales) caia en el fallback "orden
// estimado" de generarLlavesDieciseisavos(), que ignora por completo el cruce
// real de FIFA -- eso era lo que hacia que "Generar llaves" tirara emparejamientos
// incorrectos la mitad de las veces. Las 269 filas no-SKIP que SI tenia la tabla
// vieja coincidian 100% con esta (se verificaron programaticamente antes de
// reemplazar), asi que ningun torneo que ya haya generado llaves con una
// combinacion cubierta antes cambia de resultado.
const ANNEX_C = {
  // Row 1: E F G H I J K L -> 3E 3J 3I 3F 3H 3G 3L 3K
  "EFGHIJKL":["E","J","I","F","H","G","L","K"],
  // Row 2: D F G H I J K L -> 3H 3G 3I 3D 3J 3F 3L 3K
  "DFGHIJKL":["H","G","I","D","J","F","L","K"],
  // Row 3: D E G H I J K L -> 3E 3J 3I 3D 3H 3G 3L 3K
  "DEGHIJKL":["E","J","I","D","H","G","L","K"],
  // Row 4: D E F H I J K L -> 3E 3J 3I 3D 3H 3F 3L 3K
  "DEFHIJKL":["E","J","I","D","H","F","L","K"],
  // Row 5: D E F G I J K L -> 3E 3G 3I 3D 3J 3F 3L 3K
  "DEFGIJKL":["E","G","I","D","J","F","L","K"],
  // Row 6: D E F G H J K L -> 3E 3G 3J 3D 3H 3F 3L 3K
  "DEFGHJKL":["E","G","J","D","H","F","L","K"],
  // Row 7: D E F G H I K L -> 3E 3G 3I 3D 3H 3F 3L 3K
  "DEFGHIKL":["E","G","I","D","H","F","L","K"],
  // Row 8: D E F G H I J L -> 3E 3G 3J 3D 3H 3F 3L 3I
  "DEFGHIJL":["E","G","J","D","H","F","L","I"],
  // Row 9: D E F G H I J K -> 3E 3G 3J 3D 3H 3F 3I 3K
  "DEFGHIJK":["E","G","J","D","H","F","I","K"],
  // Row 10: C F G H I J K L -> 3H 3G 3I 3C 3J 3F 3L 3K
  "CFGHIJKL":["H","G","I","C","J","F","L","K"],
  // Row 11: C E G H I J K L -> 3E 3J 3I 3C 3H 3G 3L 3K
  "CEGHIJKL":["E","J","I","C","H","G","L","K"],
  // Row 12: C E F H I J K L -> 3E 3J 3I 3C 3H 3F 3L 3K
  "CEFHIJKL":["E","J","I","C","H","F","L","K"],
  // Row 13: C E F G I J K L -> 3E 3G 3I 3C 3J 3F 3L 3K
  "CEFGIJKL":["E","G","I","C","J","F","L","K"],
  // Row 14: C E F G H J K L -> 3E 3G 3J 3C 3H 3F 3L 3K
  "CEFGHJKL":["E","G","J","C","H","F","L","K"],
  // Row 15: C E F G H I K L -> 3E 3G 3I 3C 3H 3F 3L 3K
  "CEFGHIKL":["E","G","I","C","H","F","L","K"],
  // Row 16: C E F G H I J L -> 3E 3G 3J 3C 3H 3F 3L 3I
  "CEFGHIJL":["E","G","J","C","H","F","L","I"],
  // Row 17: C E F G H I J K -> 3E 3G 3J 3C 3H 3F 3I 3K
  "CEFGHIJK":["E","G","J","C","H","F","I","K"],
  // Row 18: C D G H I J K L -> 3H 3G 3I 3C 3J 3D 3L 3K
  "CDGHIJKL":["H","G","I","C","J","D","L","K"],
  // Row 19: C D F H I J K L -> 3C 3J 3I 3D 3H 3F 3L 3K
  "CDFHIJKL":["C","J","I","D","H","F","L","K"],
  // Row 20: C D F G I J K L -> 3C 3G 3I 3D 3J 3F 3L 3K
  "CDFGIJKL":["C","G","I","D","J","F","L","K"],
  // Row 21: C D F G H J K L -> 3C 3G 3J 3D 3H 3F 3L 3K
  "CDFGHJKL":["C","G","J","D","H","F","L","K"],
  // Row 22: C D F G H I K L -> 3C 3G 3I 3D 3H 3F 3L 3K
  "CDFGHIKL":["C","G","I","D","H","F","L","K"],
  // Row 23: C D F G H I J L -> 3C 3G 3J 3D 3H 3F 3L 3I
  "CDFGHIJL":["C","G","J","D","H","F","L","I"],
  // Row 24: C D F G H I J K -> 3C 3G 3J 3D 3H 3F 3I 3K
  "CDFGHIJK":["C","G","J","D","H","F","I","K"],
  // Row 25: C D E H I J K L -> 3E 3J 3I 3C 3H 3D 3L 3K
  "CDEHIJKL":["E","J","I","C","H","D","L","K"],
  // Row 26: C D E G I J K L -> 3E 3G 3I 3C 3J 3D 3L 3K
  "CDEGIJKL":["E","G","I","C","J","D","L","K"],
  // Row 27: C D E G H J K L -> 3E 3G 3J 3C 3H 3D 3L 3K
  "CDEGHJKL":["E","G","J","C","H","D","L","K"],
  // Row 28: C D E G H I K L -> 3E 3G 3I 3C 3H 3D 3L 3K
  "CDEGHIKL":["E","G","I","C","H","D","L","K"],
  // Row 29: C D E G H I J L -> 3E 3G 3J 3C 3H 3D 3L 3I
  "CDEGHIJL":["E","G","J","C","H","D","L","I"],
  // Row 30: C D E G H I J K -> 3E 3G 3J 3C 3H 3D 3I 3K
  "CDEGHIJK":["E","G","J","C","H","D","I","K"],
  // Row 31: C D E F I J K L -> 3C 3J 3E 3D 3I 3F 3L 3K
  "CDEFIJKL":["C","J","E","D","I","F","L","K"],
  // Row 32: C D E F H J K L -> 3C 3J 3E 3D 3H 3F 3L 3K
  "CDEFHJKL":["C","J","E","D","H","F","L","K"],
  // Row 33: C D E F H I K L -> 3C 3E 3I 3D 3H 3F 3L 3K
  "CDEFHIKL":["C","E","I","D","H","F","L","K"],
  // Row 34: C D E F H I J L -> 3C 3J 3E 3D 3H 3F 3L 3I
  "CDEFHIJL":["C","J","E","D","H","F","L","I"],
  // Row 35: C D E F H I J K -> 3C 3J 3E 3D 3H 3F 3I 3K
  "CDEFHIJK":["C","J","E","D","H","F","I","K"],
  // Row 36: C D E F G J K L -> 3C 3G 3E 3D 3J 3F 3L 3K
  "CDEFGJKL":["C","G","E","D","J","F","L","K"],
  // Row 37: C D E F G I K L -> 3C 3G 3E 3D 3I 3F 3L 3K
  "CDEFGIKL":["C","G","E","D","I","F","L","K"],
  // Row 38: C D E F G I J L -> 3C 3G 3E 3D 3J 3F 3L 3I
  "CDEFGIJL":["C","G","E","D","J","F","L","I"],
  // Row 39: C D E F G I J K -> 3C 3G 3E 3D 3J 3F 3I 3K
  "CDEFGIJK":["C","G","E","D","J","F","I","K"],
  // Row 40: C D E F G H K L -> 3C 3G 3E 3D 3H 3F 3L 3K
  "CDEFGHKL":["C","G","E","D","H","F","L","K"],
  // Row 41: C D E F G H J L -> 3C 3G 3J 3D 3H 3F 3L 3E
  "CDEFGHJL":["C","G","J","D","H","F","L","E"],
  // Row 42: C D E F G H J K -> 3C 3G 3J 3D 3H 3F 3E 3K
  "CDEFGHJK":["C","G","J","D","H","F","E","K"],
  // Row 43: C D E F G H I L -> 3C 3G 3E 3D 3H 3F 3L 3I
  "CDEFGHIL":["C","G","E","D","H","F","L","I"],
  // Row 44: C D E F G H I K -> 3C 3G 3E 3D 3H 3F 3I 3K
  "CDEFGHIK":["C","G","E","D","H","F","I","K"],
  // Row 45: C D E F G H I J -> 3C 3G 3J 3D 3H 3F 3E 3I
  "CDEFGHIJ":["C","G","J","D","H","F","E","I"],
  // Row 46: B F G H I J K L -> 3H 3J 3B 3F 3I 3G 3L 3K
  "BFGHIJKL":["H","J","B","F","I","G","L","K"],
  // Row 47: B E G H I J K L -> 3E 3J 3I 3B 3H 3G 3L 3K
  "BEGHIJKL":["E","J","I","B","H","G","L","K"],
  // Row 48: B E F H I J K L -> 3E 3J 3B 3F 3I 3H 3L 3K
  "BEFHIJKL":["E","J","B","F","I","H","L","K"],
  // Row 49: B E F G I J K L -> 3E 3J 3B 3F 3I 3G 3L 3K
  "BEFGIJKL":["E","J","B","F","I","G","L","K"],
  // Row 50: B E F G H J K L -> 3E 3J 3B 3F 3H 3G 3L 3K
  "BEFGHJKL":["E","J","B","F","H","G","L","K"],
  // Row 51: B E F G H I K L -> 3E 3G 3B 3F 3I 3H 3L 3K
  "BEFGHIKL":["E","G","B","F","I","H","L","K"],
  // Row 52: B E F G H I J L -> 3E 3J 3B 3F 3H 3G 3L 3I
  "BEFGHIJL":["E","J","B","F","H","G","L","I"],
  // Row 53: B E F G H I J K -> 3E 3J 3B 3F 3H 3G 3I 3K
  "BEFGHIJK":["E","J","B","F","H","G","I","K"],
  // Row 54: B D G H I J K L -> 3H 3J 3B 3D 3I 3G 3L 3K
  "BDGHIJKL":["H","J","B","D","I","G","L","K"],
  // Row 55: B D F H I J K L -> 3H 3J 3B 3D 3I 3F 3L 3K
  "BDFHIJKL":["H","J","B","D","I","F","L","K"],
  // Row 56: B D F G I J K L -> 3I 3G 3B 3D 3J 3F 3L 3K
  "BDFGIJKL":["I","G","B","D","J","F","L","K"],
  // Row 57: B D F G H J K L -> 3H 3G 3B 3D 3J 3F 3L 3K
  "BDFGHJKL":["H","G","B","D","J","F","L","K"],
  // Row 58: B D F G H I K L -> 3H 3G 3B 3D 3I 3F 3L 3K
  "BDFGHIKL":["H","G","B","D","I","F","L","K"],
  // Row 59: B D F G H I J L -> 3H 3G 3B 3D 3J 3F 3L 3I
  "BDFGHIJL":["H","G","B","D","J","F","L","I"],
  // Row 60: B D F G H I J K -> 3H 3G 3B 3D 3J 3F 3I 3K
  "BDFGHIJK":["H","G","B","D","J","F","I","K"],
  // Row 61: B D E H I J K L -> 3E 3J 3B 3D 3I 3H 3L 3K
  "BDEHIJKL":["E","J","B","D","I","H","L","K"],
  // Row 62: B D E G I J K L -> 3E 3J 3B 3D 3I 3G 3L 3K
  "BDEGIJKL":["E","J","B","D","I","G","L","K"],
  // Row 63: B D E G H J K L -> 3E 3J 3B 3D 3H 3G 3L 3K
  "BDEGHJKL":["E","J","B","D","H","G","L","K"],
  // Row 64: B D E G H I K L -> 3E 3G 3B 3D 3I 3H 3L 3K
  "BDEGHIKL":["E","G","B","D","I","H","L","K"],
  // Row 65: B D E G H I J L -> 3E 3J 3B 3D 3H 3G 3L 3I
  "BDEGHIJL":["E","J","B","D","H","G","L","I"],
  // Row 66: B D E G H I J K -> 3E 3J 3B 3D 3H 3G 3I 3K
  "BDEGHIJK":["E","J","B","D","H","G","I","K"],
  // Row 67: B D E F I J K L -> 3E 3J 3B 3D 3I 3F 3L 3K
  "BDEFIJKL":["E","J","B","D","I","F","L","K"],
  // Row 68: B D E F H J K L -> 3E 3J 3B 3D 3H 3F 3L 3K
  "BDEFHJKL":["E","J","B","D","H","F","L","K"],
  // Row 69: B D E F H I K L -> 3E 3I 3B 3D 3H 3F 3L 3K
  "BDEFHIKL":["E","I","B","D","H","F","L","K"],
  // Row 70: B D E F H I J L -> 3E 3J 3B 3D 3H 3F 3L 3I
  "BDEFHIJL":["E","J","B","D","H","F","L","I"],
  // Row 71: B D E F H I J K -> 3E 3J 3B 3D 3H 3F 3I 3K
  "BDEFHIJK":["E","J","B","D","H","F","I","K"],
  // Row 72: B D E F G J K L -> 3E 3G 3B 3D 3J 3F 3L 3K
  "BDEFGJKL":["E","G","B","D","J","F","L","K"],
  // Row 73: B D E F G I K L -> 3E 3G 3B 3D 3I 3F 3L 3K
  "BDEFGIKL":["E","G","B","D","I","F","L","K"],
  // Row 74: B D E F G I J L -> 3E 3G 3B 3D 3J 3F 3L 3I
  "BDEFGIJL":["E","G","B","D","J","F","L","I"],
  // Row 75: B D E F G I J K -> 3E 3G 3B 3D 3J 3F 3I 3K
  "BDEFGIJK":["E","G","B","D","J","F","I","K"],
  // Row 76: B D E F G H K L -> 3E 3G 3B 3D 3H 3F 3L 3K
  "BDEFGHKL":["E","G","B","D","H","F","L","K"],
  // Row 77: B D E F G H J L -> 3H 3G 3B 3D 3J 3F 3L 3E
  "BDEFGHJL":["H","G","B","D","J","F","L","E"],
  // Row 78: B D E F G H J K -> 3H 3G 3B 3D 3J 3F 3E 3K
  "BDEFGHJK":["H","G","B","D","J","F","E","K"],
  // Row 79: B D E F G H I L -> 3E 3G 3B 3D 3H 3F 3L 3I
  "BDEFGHIL":["E","G","B","D","H","F","L","I"],
  // Row 80: B D E F G H I K -> 3E 3G 3B 3D 3H 3F 3I 3K
  "BDEFGHIK":["E","G","B","D","H","F","I","K"],
  // Row 81: B D E F G H I J -> 3H 3G 3B 3D 3J 3F 3E 3I
  "BDEFGHIJ":["H","G","B","D","J","F","E","I"],
  // Row 82: B C G H I J K L -> 3H 3J 3B 3C 3I 3G 3L 3K
  "BCGHIJKL":["H","J","B","C","I","G","L","K"],
  // Row 83: B C F H I J K L -> 3H 3J 3B 3C 3I 3F 3L 3K
  "BCFHIJKL":["H","J","B","C","I","F","L","K"],
  // Row 84: B C F G I J K L -> 3I 3G 3B 3C 3J 3F 3L 3K
  "BCFGIJKL":["I","G","B","C","J","F","L","K"],
  // Row 85: B C F G H J K L -> 3H 3G 3B 3C 3J 3F 3L 3K
  "BCFGHJKL":["H","G","B","C","J","F","L","K"],
  // Row 86: B C F G H I K L -> 3H 3G 3B 3C 3I 3F 3L 3K
  "BCFGHIKL":["H","G","B","C","I","F","L","K"],
  // Row 87: B C F G H I J L -> 3H 3G 3B 3C 3J 3F 3L 3I
  "BCFGHIJL":["H","G","B","C","J","F","L","I"],
  // Row 88: B C F G H I J K -> 3H 3G 3B 3C 3J 3F 3I 3K
  "BCFGHIJK":["H","G","B","C","J","F","I","K"],
  // Row 89: B C E H I J K L -> 3E 3J 3B 3C 3I 3H 3L 3K
  "BCEHIJKL":["E","J","B","C","I","H","L","K"],
  // Row 90: B C E G I J K L -> 3E 3J 3B 3C 3I 3G 3L 3K
  "BCEGIJKL":["E","J","B","C","I","G","L","K"],
  // Row 91: B C E G H J K L -> 3E 3J 3B 3C 3H 3G 3L 3K
  "BCEGHJKL":["E","J","B","C","H","G","L","K"],
  // Row 92: B C E G H I K L -> 3E 3G 3B 3C 3I 3H 3L 3K
  "BCEGHIKL":["E","G","B","C","I","H","L","K"],
  // Row 93: B C E G H I J L -> 3E 3J 3B 3C 3H 3G 3L 3I
  "BCEGHIJL":["E","J","B","C","H","G","L","I"],
  // Row 94: B C E G H I J K -> 3E 3J 3B 3C 3H 3G 3I 3K
  "BCEGHIJK":["E","J","B","C","H","G","I","K"],
  // Row 95: B C E F I J K L -> 3E 3J 3B 3C 3I 3F 3L 3K
  "BCEFIJKL":["E","J","B","C","I","F","L","K"],
  // Row 96: B C E F H J K L -> 3E 3J 3B 3C 3H 3F 3L 3K
  "BCEFHJKL":["E","J","B","C","H","F","L","K"],
  // Row 97: B C E F H I K L -> 3E 3I 3B 3C 3H 3F 3L 3K
  "BCEFHIKL":["E","I","B","C","H","F","L","K"],
  // Row 98: B C E F H I J L -> 3E 3J 3B 3C 3H 3F 3L 3I
  "BCEFHIJL":["E","J","B","C","H","F","L","I"],
  // Row 99: B C E F H I J K -> 3E 3J 3B 3C 3H 3F 3I 3K
  "BCEFHIJK":["E","J","B","C","H","F","I","K"],
  // Row 100: B C E F G J K L -> 3E 3G 3B 3C 3J 3F 3L 3K
  "BCEFGJKL":["E","G","B","C","J","F","L","K"],
  // Row 101: B C E F G I K L -> 3E 3G 3B 3C 3I 3F 3L 3K
  "BCEFGIKL":["E","G","B","C","I","F","L","K"],
  // Row 102: B C E F G I J L -> 3E 3G 3B 3C 3J 3F 3L 3I
  "BCEFGIJL":["E","G","B","C","J","F","L","I"],
  // Row 103: B C E F G I J K -> 3E 3G 3B 3C 3J 3F 3I 3K
  "BCEFGIJK":["E","G","B","C","J","F","I","K"],
  // Row 104: B C E F G H K L -> 3E 3G 3B 3C 3H 3F 3L 3K
  "BCEFGHKL":["E","G","B","C","H","F","L","K"],
  // Row 105: B C E F G H J L -> 3H 3G 3B 3C 3J 3F 3L 3E
  "BCEFGHJL":["H","G","B","C","J","F","L","E"],
  // Row 106: B C E F G H J K -> 3H 3G 3B 3C 3J 3F 3E 3K
  "BCEFGHJK":["H","G","B","C","J","F","E","K"],
  // Row 107: B C E F G H I L -> 3E 3G 3B 3C 3H 3F 3L 3I
  "BCEFGHIL":["E","G","B","C","H","F","L","I"],
  // Row 108: B C E F G H I K -> 3E 3G 3B 3C 3H 3F 3I 3K
  "BCEFGHIK":["E","G","B","C","H","F","I","K"],
  // Row 109: B C E F G H I J -> 3H 3G 3B 3C 3J 3F 3E 3I
  "BCEFGHIJ":["H","G","B","C","J","F","E","I"],
  // Row 110: B C D H I J K L -> 3H 3J 3B 3C 3I 3D 3L 3K
  "BCDHIJKL":["H","J","B","C","I","D","L","K"],
  // Row 111: B C D G I J K L -> 3I 3G 3B 3C 3J 3D 3L 3K
  "BCDGIJKL":["I","G","B","C","J","D","L","K"],
  // Row 112: B C D G H J K L -> 3H 3G 3B 3C 3J 3D 3L 3K
  "BCDGHJKL":["H","G","B","C","J","D","L","K"],
  // Row 113: B C D G H I K L -> 3H 3G 3B 3C 3I 3D 3L 3K
  "BCDGHIKL":["H","G","B","C","I","D","L","K"],
  // Row 114: B C D G H I J L -> 3H 3G 3B 3C 3J 3D 3L 3I
  "BCDGHIJL":["H","G","B","C","J","D","L","I"],
  // Row 115: B C D G H I J K -> 3H 3G 3B 3C 3J 3D 3I 3K
  "BCDGHIJK":["H","G","B","C","J","D","I","K"],
  // Row 116: B C D F I J K L -> 3C 3J 3B 3D 3I 3F 3L 3K
  "BCDFIJKL":["C","J","B","D","I","F","L","K"],
  // Row 117: B C D F H J K L -> 3C 3J 3B 3D 3H 3F 3L 3K
  "BCDFHJKL":["C","J","B","D","H","F","L","K"],
  // Row 118: B C D F H I K L -> 3C 3I 3B 3D 3H 3F 3L 3K
  "BCDFHIKL":["C","I","B","D","H","F","L","K"],
  // Row 119: B C D F H I J L -> 3C 3J 3B 3D 3H 3F 3L 3I
  "BCDFHIJL":["C","J","B","D","H","F","L","I"],
  // Row 120: B C D F H I J K -> 3C 3J 3B 3D 3H 3F 3I 3K
  "BCDFHIJK":["C","J","B","D","H","F","I","K"],
  // Row 121: B C D F G J K L -> 3C 3G 3B 3D 3J 3F 3L 3K
  "BCDFGJKL":["C","G","B","D","J","F","L","K"],
  // Row 122: B C D F G I K L -> 3C 3G 3B 3D 3I 3F 3L 3K
  "BCDFGIKL":["C","G","B","D","I","F","L","K"],
  // Row 123: B C D F G I J L -> 3C 3G 3B 3D 3J 3F 3L 3I
  "BCDFGIJL":["C","G","B","D","J","F","L","I"],
  // Row 124: B C D F G I J K -> 3C 3G 3B 3D 3J 3F 3I 3K
  "BCDFGIJK":["C","G","B","D","J","F","I","K"],
  // Row 125: B C D F G H K L -> 3C 3G 3B 3D 3H 3F 3L 3K
  "BCDFGHKL":["C","G","B","D","H","F","L","K"],
  // Row 126: B C D F G H J L -> 3C 3G 3B 3D 3H 3F 3L 3J
  "BCDFGHJL":["C","G","B","D","H","F","L","J"],
  // Row 127: B C D F G H J K -> 3H 3G 3B 3C 3J 3F 3D 3K
  "BCDFGHJK":["H","G","B","C","J","F","D","K"],
  // Row 128: B C D F G H I L -> 3C 3G 3B 3D 3H 3F 3L 3I
  "BCDFGHIL":["C","G","B","D","H","F","L","I"],
  // Row 129: B C D F G H I K -> 3C 3G 3B 3D 3H 3F 3I 3K
  "BCDFGHIK":["C","G","B","D","H","F","I","K"],
  // Row 130: B C D F G H I J -> 3H 3G 3B 3C 3J 3F 3D 3I
  "BCDFGHIJ":["H","G","B","C","J","F","D","I"],
  // Row 131: B C D E I J K L -> 3E 3J 3B 3C 3I 3D 3L 3K
  "BCDEIJKL":["E","J","B","C","I","D","L","K"],
  // Row 132: B C D E H J K L -> 3E 3J 3B 3C 3H 3D 3L 3K
  "BCDEHJKL":["E","J","B","C","H","D","L","K"],
  // Row 133: B C D E H I K L -> 3E 3I 3B 3C 3H 3D 3L 3K
  "BCDEHIKL":["E","I","B","C","H","D","L","K"],
  // Row 134: B C D E H I J L -> 3E 3J 3B 3C 3H 3D 3L 3I
  "BCDEHIJL":["E","J","B","C","H","D","L","I"],
  // Row 135: B C D E H I J K -> 3E 3J 3B 3C 3H 3D 3I 3K
  "BCDEHIJK":["E","J","B","C","H","D","I","K"],
  // Row 136: B C D E G J K L -> 3E 3G 3B 3C 3J 3D 3L 3K
  "BCDEGJKL":["E","G","B","C","J","D","L","K"],
  // Row 137: B C D E G I K L -> 3E 3G 3B 3C 3I 3D 3L 3K
  "BCDEGIKL":["E","G","B","C","I","D","L","K"],
  // Row 138: B C D E G I J L -> 3E 3G 3B 3C 3J 3D 3L 3I
  "BCDEGIJL":["E","G","B","C","J","D","L","I"],
  // Row 139: B C D E G I J K -> 3E 3G 3B 3C 3J 3D 3I 3K
  "BCDEGIJK":["E","G","B","C","J","D","I","K"],
  // Row 140: B C D E G H K L -> 3E 3G 3B 3C 3H 3D 3L 3K
  "BCDEGHKL":["E","G","B","C","H","D","L","K"],
  // Row 141: B C D E G H J L -> 3H 3G 3B 3C 3J 3D 3L 3E
  "BCDEGHJL":["H","G","B","C","J","D","L","E"],
  // Row 142: B C D E G H J K -> 3H 3G 3B 3C 3J 3D 3E 3K
  "BCDEGHJK":["H","G","B","C","J","D","E","K"],
  // Row 143: B C D E G H I L -> 3E 3G 3B 3C 3H 3D 3L 3I
  "BCDEGHIL":["E","G","B","C","H","D","L","I"],
  // Row 144: B C D E G H I K -> 3E 3G 3B 3C 3H 3D 3I 3K
  "BCDEGHIK":["E","G","B","C","H","D","I","K"],
  // Row 145: B C D E G H I J -> 3H 3G 3B 3C 3J 3D 3E 3I
  "BCDEGHIJ":["H","G","B","C","J","D","E","I"],
  // Row 146: B C D E F J K L -> 3C 3J 3B 3D 3E 3F 3L 3K
  "BCDEFJKL":["C","J","B","D","E","F","L","K"],
  // Row 147: B C D E F I K L -> 3C 3E 3B 3D 3I 3F 3L 3K
  "BCDEFIKL":["C","E","B","D","I","F","L","K"],
  // Row 148: B C D E F I J L -> 3C 3J 3B 3D 3E 3F 3L 3I
  "BCDEFIJL":["C","J","B","D","E","F","L","I"],
  // Row 149: B C D E F I J K -> 3C 3J 3B 3D 3E 3F 3I 3K
  "BCDEFIJK":["C","J","B","D","E","F","I","K"],
  // Row 150: B C D E F H K L -> 3C 3E 3B 3D 3H 3F 3L 3K
  "BCDEFHKL":["C","E","B","D","H","F","L","K"],
  // Row 151: B C D E F H J L -> 3C 3J 3B 3D 3H 3F 3L 3E
  "BCDEFHJL":["C","J","B","D","H","F","L","E"],
  // Row 152: B C D E F H J K -> 3C 3J 3B 3D 3H 3F 3E 3K
  "BCDEFHJK":["C","J","B","D","H","F","E","K"],
  // Row 153: B C D E F H I L -> 3C 3E 3B 3D 3H 3F 3L 3I
  "BCDEFHIL":["C","E","B","D","H","F","L","I"],
  // Row 154: B C D E F H I K -> 3C 3E 3B 3D 3H 3F 3I 3K
  "BCDEFHIK":["C","E","B","D","H","F","I","K"],
  // Row 155: B C D E F H I J -> 3C 3J 3B 3D 3H 3F 3E 3I
  "BCDEFHIJ":["C","J","B","D","H","F","E","I"],
  // Row 156: B C D E F G K L -> 3C 3G 3B 3D 3E 3F 3L 3K
  "BCDEFGKL":["C","G","B","D","E","F","L","K"],
  // Row 157: B C D E F G J L -> 3C 3G 3B 3D 3J 3F 3L 3E
  "BCDEFGJL":["C","G","B","D","J","F","L","E"],
  // Row 158: B C D E F G J K -> 3C 3G 3B 3D 3J 3F 3E 3K
  "BCDEFGJK":["C","G","B","D","J","F","E","K"],
  // Row 159: B C D E F G I L -> 3C 3G 3B 3D 3E 3F 3L 3I
  "BCDEFGIL":["C","G","B","D","E","F","L","I"],
  // Row 160: B C D E F G I K -> 3C 3G 3B 3D 3E 3F 3I 3K
  "BCDEFGIK":["C","G","B","D","E","F","I","K"],
  // Row 161: B C D E F G I J -> 3C 3G 3B 3D 3J 3F 3E 3I
  "BCDEFGIJ":["C","G","B","D","J","F","E","I"],
  // Row 162: B C D E F G H L -> 3C 3G 3B 3D 3H 3F 3L 3E
  "BCDEFGHL":["C","G","B","D","H","F","L","E"],
  // Row 163: B C D E F G H K -> 3C 3G 3B 3D 3H 3F 3E 3K
  "BCDEFGHK":["C","G","B","D","H","F","E","K"],
  // Row 164: B C D E F G H J -> 3H 3G 3B 3C 3J 3F 3D 3E
  "BCDEFGHJ":["H","G","B","C","J","F","D","E"],
  // Row 165: B C D E F G H I -> 3C 3G 3B 3D 3H 3F 3E 3I
  "BCDEFGHI":["C","G","B","D","H","F","E","I"],
  // Row 166: A F G H I J K L -> 3H 3J 3I 3F 3A 3G 3L 3K
  "AFGHIJKL":["H","J","I","F","A","G","L","K"],
  // Row 167: A E G H I J K L -> 3E 3J 3I 3A 3H 3G 3L 3K
  "AEGHIJKL":["E","J","I","A","H","G","L","K"],
  // Row 168: A E F H I J K L -> 3E 3J 3I 3F 3A 3H 3L 3K
  "AEFHIJKL":["E","J","I","F","A","H","L","K"],
  // Row 169: A E F G I J K L -> 3E 3J 3I 3F 3A 3G 3L 3K
  "AEFGIJKL":["E","J","I","F","A","G","L","K"],
  // Row 170: A E F G H J K L -> 3E 3G 3J 3F 3A 3H 3L 3K
  "AEFGHJKL":["E","G","J","F","A","H","L","K"],
  // Row 171: A E F G H I K L -> 3E 3G 3I 3F 3A 3H 3L 3K
  "AEFGHIKL":["E","G","I","F","A","H","L","K"],
  // Row 172: A E F G H I J L -> 3E 3G 3J 3F 3A 3H 3L 3I
  "AEFGHIJL":["E","G","J","F","A","H","L","I"],
  // Row 173: A E F G H I J K -> 3E 3G 3J 3F 3A 3H 3I 3K
  "AEFGHIJK":["E","G","J","F","A","H","I","K"],
  // Row 174: A D G H I J K L -> 3H 3J 3I 3D 3A 3G 3L 3K
  "ADGHIJKL":["H","J","I","D","A","G","L","K"],
  // Row 175: A D F H I J K L -> 3H 3J 3I 3D 3A 3F 3L 3K
  "ADFHIJKL":["H","J","I","D","A","F","L","K"],
  // Row 176: A D F G I J K L -> 3I 3G 3J 3D 3A 3F 3L 3K
  "ADFGIJKL":["I","G","J","D","A","F","L","K"],
  // Row 177: A D F G H J K L -> 3H 3G 3J 3D 3A 3F 3L 3K
  "ADFGHJKL":["H","G","J","D","A","F","L","K"],
  // Row 178: A D F G H I K L -> 3H 3G 3I 3D 3A 3F 3L 3K
  "ADFGHIKL":["H","G","I","D","A","F","L","K"],
  // Row 179: A D F G H I J L -> 3H 3G 3J 3D 3A 3F 3L 3I
  "ADFGHIJL":["H","G","J","D","A","F","L","I"],
  // Row 180: A D F G H I J K -> 3H 3G 3J 3D 3A 3F 3I 3K
  "ADFGHIJK":["H","G","J","D","A","F","I","K"],
  // Row 181: A D E H I J K L -> 3E 3J 3I 3D 3A 3H 3L 3K
  "ADEHIJKL":["E","J","I","D","A","H","L","K"],
  // Row 182: A D E G I J K L -> 3E 3J 3I 3D 3A 3G 3L 3K
  "ADEGIJKL":["E","J","I","D","A","G","L","K"],
  // Row 183: A D E G H J K L -> 3E 3G 3J 3D 3A 3H 3L 3K
  "ADEGHJKL":["E","G","J","D","A","H","L","K"],
  // Row 184: A D E G H I K L -> 3E 3G 3I 3D 3A 3H 3L 3K
  "ADEGHIKL":["E","G","I","D","A","H","L","K"],
  // Row 185: A D E G H I J L -> 3E 3G 3J 3D 3A 3H 3L 3I
  "ADEGHIJL":["E","G","J","D","A","H","L","I"],
  // Row 186: A D E G H I J K -> 3E 3G 3J 3D 3A 3H 3I 3K
  "ADEGHIJK":["E","G","J","D","A","H","I","K"],
  // Row 187: A D E F I J K L -> 3E 3J 3I 3D 3A 3F 3L 3K
  "ADEFIJKL":["E","J","I","D","A","F","L","K"],
  // Row 188: A D E F H J K L -> 3H 3J 3E 3D 3A 3F 3L 3K
  "ADEFHJKL":["H","J","E","D","A","F","L","K"],
  // Row 189: A D E F H I K L -> 3H 3E 3I 3D 3A 3F 3L 3K
  "ADEFHIKL":["H","E","I","D","A","F","L","K"],
  // Row 190: A D E F H I J L -> 3H 3J 3E 3D 3A 3F 3L 3I
  "ADEFHIJL":["H","J","E","D","A","F","L","I"],
  // Row 191: A D E F H I J K -> 3H 3J 3E 3D 3A 3F 3I 3K
  "ADEFHIJK":["H","J","E","D","A","F","I","K"],
  // Row 192: A D E F G J K L -> 3E 3G 3J 3D 3A 3F 3L 3K
  "ADEFGJKL":["E","G","J","D","A","F","L","K"],
  // Row 193: A D E F G I K L -> 3E 3G 3I 3D 3A 3F 3L 3K
  "ADEFGIKL":["E","G","I","D","A","F","L","K"],
  // Row 194: A D E F G I J L -> 3E 3G 3J 3D 3A 3F 3L 3I
  "ADEFGIJL":["E","G","J","D","A","F","L","I"],
  // Row 195: A D E F G I J K -> 3E 3G 3J 3D 3A 3F 3I 3K
  "ADEFGIJK":["E","G","J","D","A","F","I","K"],
  // Row 196: A D E F G H K L -> 3H 3G 3E 3D 3A 3F 3L 3K
  "ADEFGHKL":["H","G","E","D","A","F","L","K"],
  // Row 197: A D E F G H J L -> 3H 3G 3J 3D 3A 3F 3L 3E
  "ADEFGHJL":["H","G","J","D","A","F","L","E"],
  // Row 198: A D E F G H J K -> 3H 3G 3J 3D 3A 3F 3E 3K
  "ADEFGHJK":["H","G","J","D","A","F","E","K"],
  // Row 199: A D E F G H I L -> 3H 3G 3E 3D 3A 3F 3L 3I
  "ADEFGHIL":["H","G","E","D","A","F","L","I"],
  // Row 200: A D E F G H I K -> 3H 3G 3E 3D 3A 3F 3I 3K
  "ADEFGHIK":["H","G","E","D","A","F","I","K"],
  // Row 201: A D E F G H I J -> 3H 3G 3J 3D 3A 3F 3E 3I
  "ADEFGHIJ":["H","G","J","D","A","F","E","I"],
  // Row 202: A C G H I J K L -> 3H 3J 3I 3C 3A 3G 3L 3K
  "ACGHIJKL":["H","J","I","C","A","G","L","K"],
  // Row 203: A C F H I J K L -> 3H 3J 3I 3C 3A 3F 3L 3K
  "ACFHIJKL":["H","J","I","C","A","F","L","K"],
  // Row 204: A C F G I J K L -> 3I 3G 3J 3C 3A 3F 3L 3K
  "ACFGIJKL":["I","G","J","C","A","F","L","K"],
  // Row 205: A C F G H J K L -> 3H 3G 3J 3C 3A 3F 3L 3K
  "ACFGHJKL":["H","G","J","C","A","F","L","K"],
  // Row 206: A C F G H I K L -> 3H 3G 3I 3C 3A 3F 3L 3K
  "ACFGHIKL":["H","G","I","C","A","F","L","K"],
  // Row 207: A C F G H I J L -> 3H 3G 3J 3C 3A 3F 3L 3I
  "ACFGHIJL":["H","G","J","C","A","F","L","I"],
  // Row 208: A C F G H I J K -> 3H 3G 3J 3C 3A 3F 3I 3K
  "ACFGHIJK":["H","G","J","C","A","F","I","K"],
  // Row 209: A C E H I J K L -> 3E 3J 3I 3C 3A 3H 3L 3K
  "ACEHIJKL":["E","J","I","C","A","H","L","K"],
  // Row 210: A C E G I J K L -> 3E 3J 3I 3C 3A 3G 3L 3K
  "ACEGIJKL":["E","J","I","C","A","G","L","K"],
  // Row 211: A C E G H J K L -> 3E 3G 3J 3C 3A 3H 3L 3K
  "ACEGHJKL":["E","G","J","C","A","H","L","K"],
  // Row 212: A C E G H I K L -> 3E 3G 3I 3C 3A 3H 3L 3K
  "ACEGHIKL":["E","G","I","C","A","H","L","K"],
  // Row 213: A C E G H I J L -> 3E 3G 3J 3C 3A 3H 3L 3I
  "ACEGHIJL":["E","G","J","C","A","H","L","I"],
  // Row 214: A C E G H I J K -> 3E 3G 3J 3C 3A 3H 3I 3K
  "ACEGHIJK":["E","G","J","C","A","H","I","K"],
  // Row 215: A C E F I J K L -> 3E 3J 3I 3C 3A 3F 3L 3K
  "ACEFIJKL":["E","J","I","C","A","F","L","K"],
  // Row 216: A C E F H J K L -> 3H 3J 3E 3C 3A 3F 3L 3K
  "ACEFHJKL":["H","J","E","C","A","F","L","K"],
  // Row 217: A C E F H I K L -> 3H 3E 3I 3C 3A 3F 3L 3K
  "ACEFHIKL":["H","E","I","C","A","F","L","K"],
  // Row 218: A C E F H I J L -> 3H 3J 3E 3C 3A 3F 3L 3I
  "ACEFHIJL":["H","J","E","C","A","F","L","I"],
  // Row 219: A C E F H I J K -> 3H 3J 3E 3C 3A 3F 3I 3K
  "ACEFHIJK":["H","J","E","C","A","F","I","K"],
  // Row 220: A C E F G J K L -> 3E 3G 3J 3C 3A 3F 3L 3K
  "ACEFGJKL":["E","G","J","C","A","F","L","K"],
  // Row 221: A C E F G I K L -> 3E 3G 3I 3C 3A 3F 3L 3K
  "ACEFGIKL":["E","G","I","C","A","F","L","K"],
  // Row 222: A C E F G I J L -> 3E 3G 3J 3C 3A 3F 3L 3I
  "ACEFGIJL":["E","G","J","C","A","F","L","I"],
  // Row 223: A C E F G I J K -> 3E 3G 3J 3C 3A 3F 3I 3K
  "ACEFGIJK":["E","G","J","C","A","F","I","K"],
  // Row 224: A C E F G H K L -> 3H 3G 3E 3C 3A 3F 3L 3K
  "ACEFGHKL":["H","G","E","C","A","F","L","K"],
  // Row 225: A C E F G H J L -> 3H 3G 3J 3C 3A 3F 3L 3E
  "ACEFGHJL":["H","G","J","C","A","F","L","E"],
  // Row 226: A C E F G H J K -> 3H 3G 3J 3C 3A 3F 3E 3K
  "ACEFGHJK":["H","G","J","C","A","F","E","K"],
  // Row 227: A C E F G H I L -> 3H 3G 3E 3C 3A 3F 3L 3I
  "ACEFGHIL":["H","G","E","C","A","F","L","I"],
  // Row 228: A C E F G H I K -> 3H 3G 3E 3C 3A 3F 3I 3K
  "ACEFGHIK":["H","G","E","C","A","F","I","K"],
  // Row 229: A C E F G H I J -> 3H 3G 3J 3C 3A 3F 3E 3I
  "ACEFGHIJ":["H","G","J","C","A","F","E","I"],
  // Row 230: A C D H I J K L -> 3H 3J 3I 3C 3A 3D 3L 3K
  "ACDHIJKL":["H","J","I","C","A","D","L","K"],
  // Row 231: A C D G I J K L -> 3I 3G 3J 3C 3A 3D 3L 3K
  "ACDGIJKL":["I","G","J","C","A","D","L","K"],
  // Row 232: A C D G H J K L -> 3H 3G 3J 3C 3A 3D 3L 3K
  "ACDGHJKL":["H","G","J","C","A","D","L","K"],
  // Row 233: A C D G H I K L -> 3H 3G 3I 3C 3A 3D 3L 3K
  "ACDGHIKL":["H","G","I","C","A","D","L","K"],
  // Row 234: A C D G H I J L -> 3H 3G 3J 3C 3A 3D 3L 3I
  "ACDGHIJL":["H","G","J","C","A","D","L","I"],
  // Row 235: A C D G H I J K -> 3H 3G 3J 3C 3A 3D 3I 3K
  "ACDGHIJK":["H","G","J","C","A","D","I","K"],
  // Row 236: A C D F I J K L -> 3C 3J 3I 3D 3A 3F 3L 3K
  "ACDFIJKL":["C","J","I","D","A","F","L","K"],
  // Row 237: A C D F H J K L -> 3H 3J 3F 3C 3A 3D 3L 3K
  "ACDFHJKL":["H","J","F","C","A","D","L","K"],
  // Row 238: A C D F H I K L -> 3H 3F 3I 3C 3A 3D 3L 3K
  "ACDFHIKL":["H","F","I","C","A","D","L","K"],
  // Row 239: A C D F H I J L -> 3H 3J 3F 3C 3A 3D 3L 3I
  "ACDFHIJL":["H","J","F","C","A","D","L","I"],
  // Row 240: A C D F H I J K -> 3H 3J 3F 3C 3A 3D 3I 3K
  "ACDFHIJK":["H","J","F","C","A","D","I","K"],
  // Row 241: A C D F G J K L -> 3C 3G 3J 3D 3A 3F 3L 3K
  "ACDFGJKL":["C","G","J","D","A","F","L","K"],
  // Row 242: A C D F G I K L -> 3C 3G 3I 3D 3A 3F 3L 3K
  "ACDFGIKL":["C","G","I","D","A","F","L","K"],
  // Row 243: A C D F G I J L -> 3C 3G 3J 3D 3A 3F 3L 3I
  "ACDFGIJL":["C","G","J","D","A","F","L","I"],
  // Row 244: A C D F G I J K -> 3C 3G 3J 3D 3A 3F 3I 3K
  "ACDFGIJK":["C","G","J","D","A","F","I","K"],
  // Row 245: A C D F G H K L -> 3H 3G 3F 3C 3A 3D 3L 3K
  "ACDFGHKL":["H","G","F","C","A","D","L","K"],
  // Row 246: A C D F G H J L -> 3C 3G 3J 3D 3A 3F 3L 3H
  "ACDFGHJL":["C","G","J","D","A","F","L","H"],
  // Row 247: A C D F G H J K -> 3H 3G 3J 3C 3A 3F 3D 3K
  "ACDFGHJK":["H","G","J","C","A","F","D","K"],
  // Row 248: A C D F G H I L -> 3H 3G 3F 3C 3A 3D 3L 3I
  "ACDFGHIL":["H","G","F","C","A","D","L","I"],
  // Row 249: A C D F G H I K -> 3H 3G 3F 3C 3A 3D 3I 3K
  "ACDFGHIK":["H","G","F","C","A","D","I","K"],
  // Row 250: A C D F G H I J -> 3H 3G 3J 3C 3A 3F 3D 3I
  "ACDFGHIJ":["H","G","J","C","A","F","D","I"],
  // Row 251: A C D E I J K L -> 3E 3J 3I 3C 3A 3D 3L 3K
  "ACDEIJKL":["E","J","I","C","A","D","L","K"],
  // Row 252: A C D E H J K L -> 3H 3J 3E 3C 3A 3D 3L 3K
  "ACDEHJKL":["H","J","E","C","A","D","L","K"],
  // Row 253: A C D E H I K L -> 3H 3E 3I 3C 3A 3D 3L 3K
  "ACDEHIKL":["H","E","I","C","A","D","L","K"],
  // Row 254: A C D E H I J L -> 3H 3J 3E 3C 3A 3D 3L 3I
  "ACDEHIJL":["H","J","E","C","A","D","L","I"],
  // Row 255: A C D E H I J K -> 3H 3J 3E 3C 3A 3D 3I 3K
  "ACDEHIJK":["H","J","E","C","A","D","I","K"],
  // Row 256: A C D E G J K L -> 3E 3G 3J 3C 3A 3D 3L 3K
  "ACDEGJKL":["E","G","J","C","A","D","L","K"],
  // Row 257: A C D E G I K L -> 3E 3G 3I 3C 3A 3D 3L 3K
  "ACDEGIKL":["E","G","I","C","A","D","L","K"],
  // Row 258: A C D E G I J L -> 3E 3G 3J 3C 3A 3D 3L 3I
  "ACDEGIJL":["E","G","J","C","A","D","L","I"],
  // Row 259: A C D E G I J K -> 3E 3G 3J 3C 3A 3D 3I 3K
  "ACDEGIJK":["E","G","J","C","A","D","I","K"],
  // Row 260: A C D E G H K L -> 3H 3G 3E 3C 3A 3D 3L 3K
  "ACDEGHKL":["H","G","E","C","A","D","L","K"],
  // Row 261: A C D E G H J L -> 3H 3G 3J 3C 3A 3D 3L 3E
  "ACDEGHJL":["H","G","J","C","A","D","L","E"],
  // Row 262: A C D E G H J K -> 3H 3G 3J 3C 3A 3D 3E 3K
  "ACDEGHJK":["H","G","J","C","A","D","E","K"],
  // Row 263: A C D E G H I L -> 3H 3G 3E 3C 3A 3D 3L 3I
  "ACDEGHIL":["H","G","E","C","A","D","L","I"],
  // Row 264: A C D E G H I K -> 3H 3G 3E 3C 3A 3D 3I 3K
  "ACDEGHIK":["H","G","E","C","A","D","I","K"],
  // Row 265: A C D E G H I J -> 3H 3G 3J 3C 3A 3D 3E 3I
  "ACDEGHIJ":["H","G","J","C","A","D","E","I"],
  // Row 266: A C D E F J K L -> 3C 3J 3E 3D 3A 3F 3L 3K
  "ACDEFJKL":["C","J","E","D","A","F","L","K"],
  // Row 267: A C D E F I K L -> 3C 3E 3I 3D 3A 3F 3L 3K
  "ACDEFIKL":["C","E","I","D","A","F","L","K"],
  // Row 268: A C D E F I J L -> 3C 3J 3E 3D 3A 3F 3L 3I
  "ACDEFIJL":["C","J","E","D","A","F","L","I"],
  // Row 269: A C D E F I J K -> 3C 3J 3E 3D 3A 3F 3I 3K
  "ACDEFIJK":["C","J","E","D","A","F","I","K"],
  // Row 270: A C D E F H K L -> 3H 3E 3F 3C 3A 3D 3L 3K
  "ACDEFHKL":["H","E","F","C","A","D","L","K"],
  // Row 271: A C D E F H J L -> 3H 3J 3F 3C 3A 3D 3L 3E
  "ACDEFHJL":["H","J","F","C","A","D","L","E"],
  // Row 272: A C D E F H J K -> 3H 3J 3E 3C 3A 3F 3D 3K
  "ACDEFHJK":["H","J","E","C","A","F","D","K"],
  // Row 273: A C D E F H I L -> 3H 3E 3F 3C 3A 3D 3L 3I
  "ACDEFHIL":["H","E","F","C","A","D","L","I"],
  // Row 274: A C D E F H I K -> 3H 3E 3F 3C 3A 3D 3I 3K
  "ACDEFHIK":["H","E","F","C","A","D","I","K"],
  // Row 275: A C D E F H I J -> 3H 3J 3E 3C 3A 3F 3D 3I
  "ACDEFHIJ":["H","J","E","C","A","F","D","I"],
  // Row 276: A C D E F G K L -> 3C 3G 3E 3D 3A 3F 3L 3K
  "ACDEFGKL":["C","G","E","D","A","F","L","K"],
  // Row 277: A C D E F G J L -> 3C 3G 3J 3D 3A 3F 3L 3E
  "ACDEFGJL":["C","G","J","D","A","F","L","E"],
  // Row 278: A C D E F G J K -> 3C 3G 3J 3D 3A 3F 3E 3K
  "ACDEFGJK":["C","G","J","D","A","F","E","K"],
  // Row 279: A C D E F G I L -> 3C 3G 3E 3D 3A 3F 3L 3I
  "ACDEFGIL":["C","G","E","D","A","F","L","I"],
  // Row 280: A C D E F G I K -> 3C 3G 3E 3D 3A 3F 3I 3K
  "ACDEFGIK":["C","G","E","D","A","F","I","K"],
  // Row 281: A C D E F G I J -> 3C 3G 3J 3D 3A 3F 3E 3I
  "ACDEFGIJ":["C","G","J","D","A","F","E","I"],
  // Row 282: A C D E F G H L -> 3H 3G 3F 3C 3A 3D 3L 3E
  "ACDEFGHL":["H","G","F","C","A","D","L","E"],
  // Row 283: A C D E F G H K -> 3H 3G 3E 3C 3A 3F 3D 3K
  "ACDEFGHK":["H","G","E","C","A","F","D","K"],
  // Row 284: A C D E F G H J -> 3H 3G 3J 3C 3A 3F 3D 3E
  "ACDEFGHJ":["H","G","J","C","A","F","D","E"],
  // Row 285: A C D E F G H I -> 3H 3G 3E 3C 3A 3F 3D 3I
  "ACDEFGHI":["H","G","E","C","A","F","D","I"],
  // Row 286: A B G H I J K L -> 3H 3J 3B 3A 3I 3G 3L 3K
  "ABGHIJKL":["H","J","B","A","I","G","L","K"],
  // Row 287: A B F H I J K L -> 3H 3J 3B 3A 3I 3F 3L 3K
  "ABFHIJKL":["H","J","B","A","I","F","L","K"],
  // Row 288: A B F G I J K L -> 3I 3J 3B 3F 3A 3G 3L 3K
  "ABFGIJKL":["I","J","B","F","A","G","L","K"],
  // Row 289: A B F G H J K L -> 3H 3J 3B 3F 3A 3G 3L 3K
  "ABFGHJKL":["H","J","B","F","A","G","L","K"],
  // Row 290: A B F G H I K L -> 3H 3G 3B 3A 3I 3F 3L 3K
  "ABFGHIKL":["H","G","B","A","I","F","L","K"],
  // Row 291: A B F G H I J L -> 3H 3J 3B 3F 3A 3G 3L 3I
  "ABFGHIJL":["H","J","B","F","A","G","L","I"],
  // Row 292: A B F G H I J K -> 3H 3J 3B 3F 3A 3G 3I 3K
  "ABFGHIJK":["H","J","B","F","A","G","I","K"],
  // Row 293: A B E H I J K L -> 3E 3J 3B 3A 3I 3H 3L 3K
  "ABEHIJKL":["E","J","B","A","I","H","L","K"],
  // Row 294: A B E G I J K L -> 3E 3J 3B 3A 3I 3G 3L 3K
  "ABEGIJKL":["E","J","B","A","I","G","L","K"],
  // Row 295: A B E G H J K L -> 3E 3J 3B 3A 3H 3G 3L 3K
  "ABEGHJKL":["E","J","B","A","H","G","L","K"],
  // Row 296: A B E G H I K L -> 3E 3G 3B 3A 3I 3H 3L 3K
  "ABEGHIKL":["E","G","B","A","I","H","L","K"],
  // Row 297: A B E G H I J L -> 3E 3J 3B 3A 3H 3G 3L 3I
  "ABEGHIJL":["E","J","B","A","H","G","L","I"],
  // Row 298: A B E G H I J K -> 3E 3J 3B 3A 3H 3G 3I 3K
  "ABEGHIJK":["E","J","B","A","H","G","I","K"],
  // Row 299: A B E F I J K L -> 3E 3J 3B 3A 3I 3F 3L 3K
  "ABEFIJKL":["E","J","B","A","I","F","L","K"],
  // Row 300: A B E F H J K L -> 3E 3J 3B 3F 3A 3H 3L 3K
  "ABEFHJKL":["E","J","B","F","A","H","L","K"],
  // Row 301: A B E F H I K L -> 3E 3I 3B 3F 3A 3H 3L 3K
  "ABEFHIKL":["E","I","B","F","A","H","L","K"],
  // Row 302: A B E F H I J L -> 3E 3J 3B 3F 3A 3H 3L 3I
  "ABEFHIJL":["E","J","B","F","A","H","L","I"],
  // Row 303: A B E F H I J K -> 3E 3J 3B 3F 3A 3H 3I 3K
  "ABEFHIJK":["E","J","B","F","A","H","I","K"],
  // Row 304: A B E F G J K L -> 3E 3J 3B 3F 3A 3G 3L 3K
  "ABEFGJKL":["E","J","B","F","A","G","L","K"],
  // Row 305: A B E F G I K L -> 3E 3G 3B 3A 3I 3F 3L 3K
  "ABEFGIKL":["E","G","B","A","I","F","L","K"],
  // Row 306: A B E F G I J L -> 3E 3J 3B 3F 3A 3G 3L 3I
  "ABEFGIJL":["E","J","B","F","A","G","L","I"],
  // Row 307: A B E F G I J K -> 3E 3J 3B 3F 3A 3G 3I 3K
  "ABEFGIJK":["E","J","B","F","A","G","I","K"],
  // Row 308: A B E F G H K L -> 3E 3G 3B 3F 3A 3H 3L 3K
  "ABEFGHKL":["E","G","B","F","A","H","L","K"],
  // Row 309: A B E F G H J L -> 3H 3J 3B 3F 3A 3G 3L 3E
  "ABEFGHJL":["H","J","B","F","A","G","L","E"],
  // Row 310: A B E F G H J K -> 3H 3J 3B 3F 3A 3G 3E 3K
  "ABEFGHJK":["H","J","B","F","A","G","E","K"],
  // Row 311: A B E F G H I L -> 3E 3G 3B 3F 3A 3H 3L 3I
  "ABEFGHIL":["E","G","B","F","A","H","L","I"],
  // Row 312: A B E F G H I K -> 3E 3G 3B 3F 3A 3H 3I 3K
  "ABEFGHIK":["E","G","B","F","A","H","I","K"],
  // Row 313: A B E F G H I J -> 3H 3J 3B 3F 3A 3G 3E 3I
  "ABEFGHIJ":["H","J","B","F","A","G","E","I"],
  // Row 314: A B D H I J K L -> 3I 3J 3B 3D 3A 3H 3L 3K
  "ABDHIJKL":["I","J","B","D","A","H","L","K"],
  // Row 315: A B D G I J K L -> 3I 3J 3B 3D 3A 3G 3L 3K
  "ABDGIJKL":["I","J","B","D","A","G","L","K"],
  // Row 316: A B D G H J K L -> 3H 3J 3B 3D 3A 3G 3L 3K
  "ABDGHJKL":["H","J","B","D","A","G","L","K"],
  // Row 317: A B D G H I K L -> 3I 3G 3B 3D 3A 3H 3L 3K
  "ABDGHIKL":["I","G","B","D","A","H","L","K"],
  // Row 318: A B D G H I J L -> 3H 3J 3B 3D 3A 3G 3L 3I
  "ABDGHIJL":["H","J","B","D","A","G","L","I"],
  // Row 319: A B D G H I J K -> 3H 3J 3B 3D 3A 3G 3I 3K
  "ABDGHIJK":["H","J","B","D","A","G","I","K"],
  // Row 320: A B D F I J K L -> 3I 3J 3B 3D 3A 3F 3L 3K
  "ABDFIJKL":["I","J","B","D","A","F","L","K"],
  // Row 321: A B D F H J K L -> 3H 3J 3B 3D 3A 3F 3L 3K
  "ABDFHJKL":["H","J","B","D","A","F","L","K"],
  // Row 322: A B D F H I K L -> 3H 3I 3B 3D 3A 3F 3L 3K
  "ABDFHIKL":["H","I","B","D","A","F","L","K"],
  // Row 323: A B D F H I J L -> 3H 3J 3B 3D 3A 3F 3L 3I
  "ABDFHIJL":["H","J","B","D","A","F","L","I"],
  // Row 324: A B D F H I J K -> 3H 3J 3B 3D 3A 3F 3I 3K
  "ABDFHIJK":["H","J","B","D","A","F","I","K"],
  // Row 325: A B D F G J K L -> 3F 3J 3B 3D 3A 3G 3L 3K
  "ABDFGJKL":["F","J","B","D","A","G","L","K"],
  // Row 326: A B D F G I K L -> 3I 3G 3B 3D 3A 3F 3L 3K
  "ABDFGIKL":["I","G","B","D","A","F","L","K"],
  // Row 327: A B D F G I J L -> 3F 3J 3B 3D 3A 3G 3L 3I
  "ABDFGIJL":["F","J","B","D","A","G","L","I"],
  // Row 328: A B D F G I J K -> 3F 3J 3B 3D 3A 3G 3I 3K
  "ABDFGIJK":["F","J","B","D","A","G","I","K"],
  // Row 329: A B D F G H K L -> 3H 3G 3B 3D 3A 3F 3L 3K
  "ABDFGHKL":["H","G","B","D","A","F","L","K"],
  // Row 330: A B D F G H J L -> 3H 3G 3B 3D 3A 3F 3L 3J
  "ABDFGHJL":["H","G","B","D","A","F","L","J"],
  // Row 331: A B D F G H J K -> 3H 3G 3B 3D 3A 3F 3J 3K
  "ABDFGHJK":["H","G","B","D","A","F","J","K"],
  // Row 332: A B D F G H I L -> 3H 3G 3B 3D 3A 3F 3L 3I
  "ABDFGHIL":["H","G","B","D","A","F","L","I"],
  // Row 333: A B D F G H I K -> 3H 3G 3B 3D 3A 3F 3I 3K
  "ABDFGHIK":["H","G","B","D","A","F","I","K"],
  // Row 334: A B D F G H I J -> 3H 3G 3B 3D 3A 3F 3I 3J
  "ABDFGHIJ":["H","G","B","D","A","F","I","J"],
  // Row 335: A B D E I J K L -> 3E 3J 3B 3A 3I 3D 3L 3K
  "ABDEIJKL":["E","J","B","A","I","D","L","K"],
  // Row 336: A B D E H J K L -> 3E 3J 3B 3D 3A 3H 3L 3K
  "ABDEHJKL":["E","J","B","D","A","H","L","K"],
  // Row 337: A B D E H I K L -> 3E 3I 3B 3D 3A 3H 3L 3K
  "ABDEHIKL":["E","I","B","D","A","H","L","K"],
  // Row 338: A B D E H I J L -> 3E 3J 3B 3D 3A 3H 3L 3I
  "ABDEHIJL":["E","J","B","D","A","H","L","I"],
  // Row 339: A B D E H I J K -> 3E 3J 3B 3D 3A 3H 3I 3K
  "ABDEHIJK":["E","J","B","D","A","H","I","K"],
  // Row 340: A B D E G J K L -> 3E 3J 3B 3D 3A 3G 3L 3K
  "ABDEGJKL":["E","J","B","D","A","G","L","K"],
  // Row 341: A B D E G I K L -> 3E 3G 3B 3A 3I 3D 3L 3K
  "ABDEGIKL":["E","G","B","A","I","D","L","K"],
  // Row 342: A B D E G I J L -> 3E 3J 3B 3D 3A 3G 3L 3I
  "ABDEGIJL":["E","J","B","D","A","G","L","I"],
  // Row 343: A B D E G I J K -> 3E 3J 3B 3D 3A 3G 3I 3K
  "ABDEGIJK":["E","J","B","D","A","G","I","K"],
  // Row 344: A B D E G H K L -> 3E 3G 3B 3D 3A 3H 3L 3K
  "ABDEGHKL":["E","G","B","D","A","H","L","K"],
  // Row 345: A B D E G H J L -> 3H 3J 3B 3D 3A 3G 3L 3E
  "ABDEGHJL":["H","J","B","D","A","G","L","E"],
  // Row 346: A B D E G H J K -> 3H 3J 3B 3D 3A 3G 3E 3K
  "ABDEGHJK":["H","J","B","D","A","G","E","K"],
  // Row 347: A B D E G H I L -> 3E 3G 3B 3D 3A 3H 3L 3I
  "ABDEGHIL":["E","G","B","D","A","H","L","I"],
  // Row 348: A B D E G H I K -> 3E 3G 3B 3D 3A 3H 3I 3K
  "ABDEGHIK":["E","G","B","D","A","H","I","K"],
  // Row 349: A B D E G H I J -> 3H 3J 3B 3D 3A 3G 3E 3I
  "ABDEGHIJ":["H","J","B","D","A","G","E","I"],
  // Row 350: A B D E F J K L -> 3E 3J 3B 3D 3A 3F 3L 3K
  "ABDEFJKL":["E","J","B","D","A","F","L","K"],
  // Row 351: A B D E F I K L -> 3E 3I 3B 3D 3A 3F 3L 3K
  "ABDEFIKL":["E","I","B","D","A","F","L","K"],
  // Row 352: A B D E F I J L -> 3E 3J 3B 3D 3A 3F 3L 3I
  "ABDEFIJL":["E","J","B","D","A","F","L","I"],
  // Row 353: A B D E F I J K -> 3E 3J 3B 3D 3A 3F 3I 3K
  "ABDEFIJK":["E","J","B","D","A","F","I","K"],
  // Row 354: A B D E F H K L -> 3H 3E 3B 3D 3A 3F 3L 3K
  "ABDEFHKL":["H","E","B","D","A","F","L","K"],
  // Row 355: A B D E F H J L -> 3H 3J 3B 3D 3A 3F 3L 3E
  "ABDEFHJL":["H","J","B","D","A","F","L","E"],
  // Row 356: A B D E F H J K -> 3H 3J 3B 3D 3A 3F 3E 3K
  "ABDEFHJK":["H","J","B","D","A","F","E","K"],
  // Row 357: A B D E F H I L -> 3H 3E 3B 3D 3A 3F 3L 3I
  "ABDEFHIL":["H","E","B","D","A","F","L","I"],
  // Row 358: A B D E F H I K -> 3H 3E 3B 3D 3A 3F 3I 3K
  "ABDEFHIK":["H","E","B","D","A","F","I","K"],
  // Row 359: A B D E F H I J -> 3H 3J 3B 3D 3A 3F 3E 3I
  "ABDEFHIJ":["H","J","B","D","A","F","E","I"],
  // Row 360: A B D E F G K L -> 3E 3G 3B 3D 3A 3F 3L 3K
  "ABDEFGKL":["E","G","B","D","A","F","L","K"],
  // Row 361: A B D E F G J L -> 3E 3G 3B 3D 3A 3F 3L 3J
  "ABDEFGJL":["E","G","B","D","A","F","L","J"],
  // Row 362: A B D E F G J K -> 3E 3G 3B 3D 3A 3F 3J 3K
  "ABDEFGJK":["E","G","B","D","A","F","J","K"],
  // Row 363: A B D E F G I L -> 3E 3G 3B 3D 3A 3F 3L 3I
  "ABDEFGIL":["E","G","B","D","A","F","L","I"],
  // Row 364: A B D E F G I K -> 3E 3G 3B 3D 3A 3F 3I 3K
  "ABDEFGIK":["E","G","B","D","A","F","I","K"],
  // Row 365: A B D E F G I J -> 3E 3G 3B 3D 3A 3F 3I 3J
  "ABDEFGIJ":["E","G","B","D","A","F","I","J"],
  // Row 366: A B D E F G H L -> 3H 3G 3B 3D 3A 3F 3L 3E
  "ABDEFGHL":["H","G","B","D","A","F","L","E"],
  // Row 367: A B D E F G H K -> 3H 3G 3B 3D 3A 3F 3E 3K
  "ABDEFGHK":["H","G","B","D","A","F","E","K"],
  // Row 368: A B D E F G H J -> 3H 3G 3B 3D 3A 3F 3E 3J
  "ABDEFGHJ":["H","G","B","D","A","F","E","J"],
  // Row 369: A B D E F G H I -> 3H 3G 3B 3D 3A 3F 3E 3I
  "ABDEFGHI":["H","G","B","D","A","F","E","I"],
  // Row 370: A B C H I J K L -> 3I 3J 3B 3C 3A 3H 3L 3K
  "ABCHIJKL":["I","J","B","C","A","H","L","K"],
  // Row 371: A B C G I J K L -> 3I 3J 3B 3C 3A 3G 3L 3K
  "ABCGIJKL":["I","J","B","C","A","G","L","K"],
  // Row 372: A B C G H J K L -> 3H 3J 3B 3C 3A 3G 3L 3K
  "ABCGHJKL":["H","J","B","C","A","G","L","K"],
  // Row 373: A B C G H I K L -> 3I 3G 3B 3C 3A 3H 3L 3K
  "ABCGHIKL":["I","G","B","C","A","H","L","K"],
  // Row 374: A B C G H I J L -> 3H 3J 3B 3C 3A 3G 3L 3I
  "ABCGHIJL":["H","J","B","C","A","G","L","I"],
  // Row 375: A B C G H I J K -> 3H 3J 3B 3C 3A 3G 3I 3K
  "ABCGHIJK":["H","J","B","C","A","G","I","K"],
  // Row 376: A B C F I J K L -> 3I 3J 3B 3C 3A 3F 3L 3K
  "ABCFIJKL":["I","J","B","C","A","F","L","K"],
  // Row 377: A B C F H J K L -> 3H 3J 3B 3C 3A 3F 3L 3K
  "ABCFHJKL":["H","J","B","C","A","F","L","K"],
  // Row 378: A B C F H I K L -> 3H 3I 3B 3C 3A 3F 3L 3K
  "ABCFHIKL":["H","I","B","C","A","F","L","K"],
  // Row 379: A B C F H I J L -> 3H 3J 3B 3C 3A 3F 3L 3I
  "ABCFHIJL":["H","J","B","C","A","F","L","I"],
  // Row 380: A B C F H I J K -> 3H 3J 3B 3C 3A 3F 3I 3K
  "ABCFHIJK":["H","J","B","C","A","F","I","K"],
  // Row 381: A B C F G J K L -> 3C 3J 3B 3F 3A 3G 3L 3K
  "ABCFGJKL":["C","J","B","F","A","G","L","K"],
  // Row 382: A B C F G I K L -> 3I 3G 3B 3C 3A 3F 3L 3K
  "ABCFGIKL":["I","G","B","C","A","F","L","K"],
  // Row 383: A B C F G I J L -> 3C 3J 3B 3F 3A 3G 3L 3I
  "ABCFGIJL":["C","J","B","F","A","G","L","I"],
  // Row 384: A B C F G I J K -> 3C 3J 3B 3F 3A 3G 3I 3K
  "ABCFGIJK":["C","J","B","F","A","G","I","K"],
  // Row 385: A B C F G H K L -> 3H 3G 3B 3C 3A 3F 3L 3K
  "ABCFGHKL":["H","G","B","C","A","F","L","K"],
  // Row 386: A B C F G H J L -> 3H 3G 3B 3C 3A 3F 3L 3J
  "ABCFGHJL":["H","G","B","C","A","F","L","J"],
  // Row 387: A B C F G H J K -> 3H 3G 3B 3C 3A 3F 3J 3K
  "ABCFGHJK":["H","G","B","C","A","F","J","K"],
  // Row 388: A B C F G H I L -> 3H 3G 3B 3C 3A 3F 3L 3I
  "ABCFGHIL":["H","G","B","C","A","F","L","I"],
  // Row 389: A B C F G H I K -> 3H 3G 3B 3C 3A 3F 3I 3K
  "ABCFGHIK":["H","G","B","C","A","F","I","K"],
  // Row 390: A B C F G H I J -> 3H 3G 3B 3C 3A 3F 3I 3J
  "ABCFGHIJ":["H","G","B","C","A","F","I","J"],
  // Row 391: A B C E I J K L -> 3E 3J 3B 3A 3I 3C 3L 3K
  "ABCEIJKL":["E","J","B","A","I","C","L","K"],
  // Row 392: A B C E H J K L -> 3E 3J 3B 3C 3A 3H 3L 3K
  "ABCEHJKL":["E","J","B","C","A","H","L","K"],
  // Row 393: A B C E H I K L -> 3E 3I 3B 3C 3A 3H 3L 3K
  "ABCEHIKL":["E","I","B","C","A","H","L","K"],
  // Row 394: A B C E H I J L -> 3E 3J 3B 3C 3A 3H 3L 3I
  "ABCEHIJL":["E","J","B","C","A","H","L","I"],
  // Row 395: A B C E H I J K -> 3E 3J 3B 3C 3A 3H 3I 3K
  "ABCEHIJK":["E","J","B","C","A","H","I","K"],
  // Row 396: A B C E G J K L -> 3E 3J 3B 3C 3A 3G 3L 3K
  "ABCEGJKL":["E","J","B","C","A","G","L","K"],
  // Row 397: A B C E G I K L -> 3E 3G 3B 3A 3I 3C 3L 3K
  "ABCEGIKL":["E","G","B","A","I","C","L","K"],
  // Row 398: A B C E G I J L -> 3E 3J 3B 3C 3A 3G 3L 3I
  "ABCEGIJL":["E","J","B","C","A","G","L","I"],
  // Row 399: A B C E G I J K -> 3E 3J 3B 3C 3A 3G 3I 3K
  "ABCEGIJK":["E","J","B","C","A","G","I","K"],
  // Row 400: A B C E G H K L -> 3E 3G 3B 3C 3A 3H 3L 3K
  "ABCEGHKL":["E","G","B","C","A","H","L","K"],
  // Row 401: A B C E G H J L -> 3H 3J 3B 3C 3A 3G 3L 3E
  "ABCEGHJL":["H","J","B","C","A","G","L","E"],
  // Row 402: A B C E G H J K -> 3H 3J 3B 3C 3A 3G 3E 3K
  "ABCEGHJK":["H","J","B","C","A","G","E","K"],
  // Row 403: A B C E G H I L -> 3E 3G 3B 3C 3A 3H 3L 3I
  "ABCEGHIL":["E","G","B","C","A","H","L","I"],
  // Row 404: A B C E G H I K -> 3E 3G 3B 3C 3A 3H 3I 3K
  "ABCEGHIK":["E","G","B","C","A","H","I","K"],
  // Row 405: A B C E G H I J -> 3H 3J 3B 3C 3A 3G 3E 3I
  "ABCEGHIJ":["H","J","B","C","A","G","E","I"],
  // Row 406: A B C E F J K L -> 3E 3J 3B 3C 3A 3F 3L 3K
  "ABCEFJKL":["E","J","B","C","A","F","L","K"],
  // Row 407: A B C E F I K L -> 3E 3I 3B 3C 3A 3F 3L 3K
  "ABCEFIKL":["E","I","B","C","A","F","L","K"],
  // Row 408: A B C E F I J L -> 3E 3J 3B 3C 3A 3F 3L 3I
  "ABCEFIJL":["E","J","B","C","A","F","L","I"],
  // Row 409: A B C E F I J K -> 3E 3J 3B 3C 3A 3F 3I 3K
  "ABCEFIJK":["E","J","B","C","A","F","I","K"],
  // Row 410: A B C E F H K L -> 3H 3E 3B 3C 3A 3F 3L 3K
  "ABCEFHKL":["H","E","B","C","A","F","L","K"],
  // Row 411: A B C E F H J L -> 3H 3J 3B 3C 3A 3F 3L 3E
  "ABCEFHJL":["H","J","B","C","A","F","L","E"],
  // Row 412: A B C E F H J K -> 3H 3J 3B 3C 3A 3F 3E 3K
  "ABCEFHJK":["H","J","B","C","A","F","E","K"],
  // Row 413: A B C E F H I L -> 3H 3E 3B 3C 3A 3F 3L 3I
  "ABCEFHIL":["H","E","B","C","A","F","L","I"],
  // Row 414: A B C E F H I K -> 3H 3E 3B 3C 3A 3F 3I 3K
  "ABCEFHIK":["H","E","B","C","A","F","I","K"],
  // Row 415: A B C E F H I J -> 3H 3J 3B 3C 3A 3F 3E 3I
  "ABCEFHIJ":["H","J","B","C","A","F","E","I"],
  // Row 416: A B C E F G K L -> 3E 3G 3B 3C 3A 3F 3L 3K
  "ABCEFGKL":["E","G","B","C","A","F","L","K"],
  // Row 417: A B C E F G J L -> 3E 3G 3B 3C 3A 3F 3L 3J
  "ABCEFGJL":["E","G","B","C","A","F","L","J"],
  // Row 418: A B C E F G J K -> 3E 3G 3B 3C 3A 3F 3J 3K
  "ABCEFGJK":["E","G","B","C","A","F","J","K"],
  // Row 419: A B C E F G I L -> 3E 3G 3B 3C 3A 3F 3L 3I
  "ABCEFGIL":["E","G","B","C","A","F","L","I"],
  // Row 420: A B C E F G I K -> 3E 3G 3B 3C 3A 3F 3I 3K
  "ABCEFGIK":["E","G","B","C","A","F","I","K"],
  // Row 421: A B C E F G I J -> 3E 3G 3B 3C 3A 3F 3I 3J
  "ABCEFGIJ":["E","G","B","C","A","F","I","J"],
  // Row 422: A B C E F G H L -> 3H 3G 3B 3C 3A 3F 3L 3E
  "ABCEFGHL":["H","G","B","C","A","F","L","E"],
  // Row 423: A B C E F G H K -> 3H 3G 3B 3C 3A 3F 3E 3K
  "ABCEFGHK":["H","G","B","C","A","F","E","K"],
  // Row 424: A B C E F G H J -> 3H 3G 3B 3C 3A 3F 3E 3J
  "ABCEFGHJ":["H","G","B","C","A","F","E","J"],
  // Row 425: A B C E F G H I -> 3H 3G 3B 3C 3A 3F 3E 3I
  "ABCEFGHI":["H","G","B","C","A","F","E","I"],
  // Row 426: A B C D I J K L -> 3I 3J 3B 3C 3A 3D 3L 3K
  "ABCDIJKL":["I","J","B","C","A","D","L","K"],
  // Row 427: A B C D H J K L -> 3H 3J 3B 3C 3A 3D 3L 3K
  "ABCDHJKL":["H","J","B","C","A","D","L","K"],
  // Row 428: A B C D H I K L -> 3H 3I 3B 3C 3A 3D 3L 3K
  "ABCDHIKL":["H","I","B","C","A","D","L","K"],
  // Row 429: A B C D H I J L -> 3H 3J 3B 3C 3A 3D 3L 3I
  "ABCDHIJL":["H","J","B","C","A","D","L","I"],
  // Row 430: A B C D H I J K -> 3H 3J 3B 3C 3A 3D 3I 3K
  "ABCDHIJK":["H","J","B","C","A","D","I","K"],
  // Row 431: A B C D G J K L -> 3C 3J 3B 3D 3A 3G 3L 3K
  "ABCDGJKL":["C","J","B","D","A","G","L","K"],
  // Row 432: A B C D G I K L -> 3I 3G 3B 3C 3A 3D 3L 3K
  "ABCDGIKL":["I","G","B","C","A","D","L","K"],
  // Row 433: A B C D G I J L -> 3C 3J 3B 3D 3A 3G 3L 3I
  "ABCDGIJL":["C","J","B","D","A","G","L","I"],
  // Row 434: A B C D G I J K -> 3C 3J 3B 3D 3A 3G 3I 3K
  "ABCDGIJK":["C","J","B","D","A","G","I","K"],
  // Row 435: A B C D G H K L -> 3H 3G 3B 3C 3A 3D 3L 3K
  "ABCDGHKL":["H","G","B","C","A","D","L","K"],
  // Row 436: A B C D G H J L -> 3H 3G 3B 3C 3A 3D 3L 3J
  "ABCDGHJL":["H","G","B","C","A","D","L","J"],
  // Row 437: A B C D G H J K -> 3H 3G 3B 3C 3A 3D 3J 3K
  "ABCDGHJK":["H","G","B","C","A","D","J","K"],
  // Row 438: A B C D G H I L -> 3H 3G 3B 3C 3A 3D 3L 3I
  "ABCDGHIL":["H","G","B","C","A","D","L","I"],
  // Row 439: A B C D G H I K -> 3H 3G 3B 3C 3A 3D 3I 3K
  "ABCDGHIK":["H","G","B","C","A","D","I","K"],
  // Row 440: A B C D G H I J -> 3H 3G 3B 3C 3A 3D 3I 3J
  "ABCDGHIJ":["H","G","B","C","A","D","I","J"],
  // Row 441: A B C D F J K L -> 3C 3J 3B 3D 3A 3F 3L 3K
  "ABCDFJKL":["C","J","B","D","A","F","L","K"],
  // Row 442: A B C D F I K L -> 3C 3I 3B 3D 3A 3F 3L 3K
  "ABCDFIKL":["C","I","B","D","A","F","L","K"],
  // Row 443: A B C D F I J L -> 3C 3J 3B 3D 3A 3F 3L 3I
  "ABCDFIJL":["C","J","B","D","A","F","L","I"],
  // Row 444: A B C D F I J K -> 3C 3J 3B 3D 3A 3F 3I 3K
  "ABCDFIJK":["C","J","B","D","A","F","I","K"],
  // Row 445: A B C D F H K L -> 3H 3F 3B 3C 3A 3D 3L 3K
  "ABCDFHKL":["H","F","B","C","A","D","L","K"],
  // Row 446: A B C D F H J L -> 3C 3J 3B 3D 3A 3F 3L 3H
  "ABCDFHJL":["C","J","B","D","A","F","L","H"],
  // Row 447: A B C D F H J K -> 3H 3J 3B 3C 3A 3F 3D 3K
  "ABCDFHJK":["H","J","B","C","A","F","D","K"],
  // Row 448: A B C D F H I L -> 3H 3F 3B 3C 3A 3D 3L 3I
  "ABCDFHIL":["H","F","B","C","A","D","L","I"],
  // Row 449: A B C D F H I K -> 3H 3F 3B 3C 3A 3D 3I 3K
  "ABCDFHIK":["H","F","B","C","A","D","I","K"],
  // Row 450: A B C D F H I J -> 3H 3J 3B 3C 3A 3F 3D 3I
  "ABCDFHIJ":["H","J","B","C","A","F","D","I"],
  // Row 451: A B C D F G K L -> 3C 3G 3B 3D 3A 3F 3L 3K
  "ABCDFGKL":["C","G","B","D","A","F","L","K"],
  // Row 452: A B C D F G J L -> 3C 3G 3B 3D 3A 3F 3L 3J
  "ABCDFGJL":["C","G","B","D","A","F","L","J"],
  // Row 453: A B C D F G J K -> 3C 3G 3B 3D 3A 3F 3J 3K
  "ABCDFGJK":["C","G","B","D","A","F","J","K"],
  // Row 454: A B C D F G I L -> 3C 3G 3B 3D 3A 3F 3L 3I
  "ABCDFGIL":["C","G","B","D","A","F","L","I"],
  // Row 455: A B C D F G I K -> 3C 3G 3B 3D 3A 3F 3I 3K
  "ABCDFGIK":["C","G","B","D","A","F","I","K"],
  // Row 456: A B C D F G I J -> 3C 3G 3B 3D 3A 3F 3I 3J
  "ABCDFGIJ":["C","G","B","D","A","F","I","J"],
  // Row 457: A B C D F G H L -> 3C 3G 3B 3D 3A 3F 3L 3H
  "ABCDFGHL":["C","G","B","D","A","F","L","H"],
  // Row 458: A B C D F G H K -> 3H 3G 3B 3C 3A 3F 3D 3K
  "ABCDFGHK":["H","G","B","C","A","F","D","K"],
  // Row 459: A B C D F G H J -> 3H 3G 3B 3C 3A 3F 3D 3J
  "ABCDFGHJ":["H","G","B","C","A","F","D","J"],
  // Row 460: A B C D F G H I -> 3H 3G 3B 3C 3A 3F 3D 3I
  "ABCDFGHI":["H","G","B","C","A","F","D","I"],
  // Row 461: A B C D E J K L -> 3E 3J 3B 3C 3A 3D 3L 3K
  "ABCDEJKL":["E","J","B","C","A","D","L","K"],
  // Row 462: A B C D E I K L -> 3E 3I 3B 3C 3A 3D 3L 3K
  "ABCDEIKL":["E","I","B","C","A","D","L","K"],
  // Row 463: A B C D E I J L -> 3E 3J 3B 3C 3A 3D 3L 3I
  "ABCDEIJL":["E","J","B","C","A","D","L","I"],
  // Row 464: A B C D E I J K -> 3E 3J 3B 3C 3A 3D 3I 3K
  "ABCDEIJK":["E","J","B","C","A","D","I","K"],
  // Row 465: A B C D E H K L -> 3H 3E 3B 3C 3A 3D 3L 3K
  "ABCDEHKL":["H","E","B","C","A","D","L","K"],
  // Row 466: A B C D E H J L -> 3H 3J 3B 3C 3A 3D 3L 3E
  "ABCDEHJL":["H","J","B","C","A","D","L","E"],
  // Row 467: A B C D E H J K -> 3H 3J 3B 3C 3A 3D 3E 3K
  "ABCDEHJK":["H","J","B","C","A","D","E","K"],
  // Row 468: A B C D E H I L -> 3H 3E 3B 3C 3A 3D 3L 3I
  "ABCDEHIL":["H","E","B","C","A","D","L","I"],
  // Row 469: A B C D E H I K -> 3H 3E 3B 3C 3A 3D 3I 3K
  "ABCDEHIK":["H","E","B","C","A","D","I","K"],
  // Row 470: A B C D E H I J -> 3H 3J 3B 3C 3A 3D 3E 3I
  "ABCDEHIJ":["H","J","B","C","A","D","E","I"],
  // Row 471: A B C D E G K L -> 3E 3G 3B 3C 3A 3D 3L 3K
  "ABCDEGKL":["E","G","B","C","A","D","L","K"],
  // Row 472: A B C D E G J L -> 3E 3G 3B 3C 3A 3D 3L 3J
  "ABCDEGJL":["E","G","B","C","A","D","L","J"],
  // Row 473: A B C D E G J K -> 3E 3G 3B 3C 3A 3D 3J 3K
  "ABCDEGJK":["E","G","B","C","A","D","J","K"],
  // Row 474: A B C D E G I L -> 3E 3G 3B 3C 3A 3D 3L 3I
  "ABCDEGIL":["E","G","B","C","A","D","L","I"],
  // Row 475: A B C D E G I K -> 3E 3G 3B 3C 3A 3D 3I 3K
  "ABCDEGIK":["E","G","B","C","A","D","I","K"],
  // Row 476: A B C D E G I J -> 3E 3G 3B 3C 3A 3D 3I 3J
  "ABCDEGIJ":["E","G","B","C","A","D","I","J"],
  // Row 477: A B C D E G H L -> 3H 3G 3B 3C 3A 3D 3L 3E
  "ABCDEGHL":["H","G","B","C","A","D","L","E"],
  // Row 478: A B C D E G H K -> 3H 3G 3B 3C 3A 3D 3E 3K
  "ABCDEGHK":["H","G","B","C","A","D","E","K"],
  // Row 479: A B C D E G H J -> 3H 3G 3B 3C 3A 3D 3E 3J
  "ABCDEGHJ":["H","G","B","C","A","D","E","J"],
  // Row 480: A B C D E G H I -> 3H 3G 3B 3C 3A 3D 3E 3I
  "ABCDEGHI":["H","G","B","C","A","D","E","I"],
  // Row 481: A B C D E F K L -> 3C 3E 3B 3D 3A 3F 3L 3K
  "ABCDEFKL":["C","E","B","D","A","F","L","K"],
  // Row 482: A B C D E F J L -> 3C 3J 3B 3D 3A 3F 3L 3E
  "ABCDEFJL":["C","J","B","D","A","F","L","E"],
  // Row 483: A B C D E F J K -> 3C 3J 3B 3D 3A 3F 3E 3K
  "ABCDEFJK":["C","J","B","D","A","F","E","K"],
  // Row 484: A B C D E F I L -> 3C 3E 3B 3D 3A 3F 3L 3I
  "ABCDEFIL":["C","E","B","D","A","F","L","I"],
  // Row 485: A B C D E F I K -> 3C 3E 3B 3D 3A 3F 3I 3K
  "ABCDEFIK":["C","E","B","D","A","F","I","K"],
  // Row 486: A B C D E F I J -> 3C 3J 3B 3D 3A 3F 3E 3I
  "ABCDEFIJ":["C","J","B","D","A","F","E","I"],
  // Row 487: A B C D E F H L -> 3H 3F 3B 3C 3A 3D 3L 3E
  "ABCDEFHL":["H","F","B","C","A","D","L","E"],
  // Row 488: A B C D E F H K -> 3H 3E 3B 3C 3A 3F 3D 3K
  "ABCDEFHK":["H","E","B","C","A","F","D","K"],
  // Row 489: A B C D E F H J -> 3H 3J 3B 3C 3A 3F 3D 3E
  "ABCDEFHJ":["H","J","B","C","A","F","D","E"],
  // Row 490: A B C D E F H I -> 3H 3E 3B 3C 3A 3F 3D 3I
  "ABCDEFHI":["H","E","B","C","A","F","D","I"],
  // Row 491: A B C D E F G L -> 3C 3G 3B 3D 3A 3F 3L 3E
  "ABCDEFGL":["C","G","B","D","A","F","L","E"],
  // Row 492: A B C D E F G K -> 3C 3G 3B 3D 3A 3F 3E 3K
  "ABCDEFGK":["C","G","B","D","A","F","E","K"],
  // Row 493: A B C D E F G J -> 3C 3G 3B 3D 3A 3F 3E 3J
  "ABCDEFGJ":["C","G","B","D","A","F","E","J"],
  // Row 494: A B C D E F G I -> 3C 3G 3B 3D 3A 3F 3E 3I
  "ABCDEFGI":["C","G","B","D","A","F","E","I"],
  // Row 495: A B C D E F G H -> 3H 3G 3B 3C 3A 3F 3D 3E
  "ABCDEFGH":["H","G","B","C","A","F","D","E"],
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
    // v1.7 — Con ANNEX_C completa (495/495 combinaciones posibles de 8
    // grupos entre 12), este camino ya no debería dispararse nunca en un
    // torneo real: se deja solo como red de seguridad por si
    // best8thirds trae menos de 8 grupos (datos de grupos incompletos).
    // Si esto llega a mostrarse, es señal de un bug — no de una
    // combinación real faltante en la tabla.
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
