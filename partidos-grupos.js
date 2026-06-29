// ══════════════════════════════════════════════════════════════
// PARTIDOS — Fase de grupos, Mundial 2026 (Quinielita Borracha)
// ══════════════════════════════════════════════════════════════
// Reemplaza a legacy-migracion.js (que existía en el proyecto original
// "Quiniela Borracha 2026" para migrar a 27 participantes de un sistema
// anterior por Excel/PDF). Esta instancia ("Quinielita Borracha") arranca
// limpia, sin participantes precargados ni datos de migración -- por eso
// este archivo SOLO contiene el nombre de cada uno de los 72 partidos de
// fase de grupos (dato público del fixture del Mundial, no de ningún
// participante), que app.js usa para mostrar el nombre del partido
// ("México vs Sudáfrica") en vez de un genérico "Partido 1".
//
// Se carga ANTES de app.js en index.html (mismo lugar que ocupaba
// legacy-migracion.js), porque rebuildDynamicData() en app.js depende de
// MATCH_LABELS para armar MD (el mapa de partidos con sus predicciones).
const MATCH_LABELS={1:"México vs Sudáfrica",2:"Corea del Sur vs República Checa",3:"Canadá vs Bosnia y Herzegovina",4:"Estados Unidos vs Paraguay",5:"Haití vs Escocia",6:"Australia vs Turquía",7:"Brasil vs Marruecos",8:"Catar vs Suiza",9:"Costa de Marfil vs Ecuador",10:"Alemania vs Curazao",11:"Países Bajos vs Japón",12:"Suecia vs Túnez",13:"Arabia Saudita vs Uruguay",14:"España vs Cabo Verde",15:"Irán vs Nueva Zelanda",16:"Bélgica vs Egipto",17:"Francia vs Senegal",18:"Irak vs Noruega",19:"Argentina vs Argelia",20:"Austria vs Jordania",21:"Ghana vs Panamá",22:"Inglaterra vs Croacia",23:"Portugal vs RD Congo",24:"Uzbekistán vs Colombia",25:"República Checa vs Sudáfrica",26:"Suiza vs Bosnia y Herzegovina",27:"Canadá vs Catar",28:"México vs Corea del Sur",29:"Brasil vs Haití",30:"Escocia vs Marruecos",31:"Turquía vs Paraguay",32:"Estados Unidos vs Australia",33:"Alemania vs Costa de Marfil",34:"Ecuador vs Curazao",35:"Países Bajos vs Suecia",36:"Túnez vs Japón",37:"Uruguay vs Cabo Verde",38:"España vs Arabia Saudita",39:"Bélgica vs Irán",40:"Nueva Zelanda vs Egipto",41:"Noruega vs Senegal",42:"Francia vs Irak",43:"Argentina vs Austria",44:"Jordania vs Argelia",45:"Inglaterra vs Ghana",46:"Panamá vs Croacia",47:"Portugal vs Uzbekistán",48:"Colombia vs RD Congo",49:"Escocia vs Brasil",50:"Marruecos vs Haití",51:"Suiza vs Canadá",52:"Bosnia y Herzegovina vs Catar",53:"República Checa vs México",54:"Sudáfrica vs Corea del Sur",55:"Curazao vs Costa de Marfil",56:"Ecuador vs Alemania",57:"Japón vs Suecia",58:"Túnez vs Países Bajos",59:"Turquía vs Estados Unidos",60:"Paraguay vs Australia",61:"Noruega vs Francia",62:"Senegal vs Irak",63:"Egipto vs Irán",64:"Nueva Zelanda vs Bélgica",65:"Cabo Verde vs Arabia Saudita",66:"Uruguay vs España",67:"Panamá vs Inglaterra",68:"Croacia vs Ghana",69:"Argelia vs Austria",70:"Jordania vs Argentina",71:"Colombia vs Portugal",72:"RD Congo vs Uzbekistán"};
