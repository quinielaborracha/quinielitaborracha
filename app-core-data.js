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

// v1.7 — ESPN_ABBR_MAP/MID_ABBRS se movieron a app-static-data.js
// (carga antes que este archivo) -- son datos de referencia puros.
// Mismos globals, cero cambio de comportamiento.

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

// v1.8 — Avatar del participante: la ilustración de AVATAR_MAP para el país
// que predijo como campeón (misma fuente que flagOfChampion(), getDynamicSpec
// vía SPECIAL_FIELD_MAP_V62 o S.adv[name].champ para migrados legacy). A
// diferencia de flagOfChampion(), NO tiene fallback a la bandera de
// residencia: si el país elegido todavía no tiene avatar en AVATAR_MAP (la
// mayoría, por ahora -- ver app-static-data.js), devuelve "" a propósito,
// para que quien lo consuma no muestre nada en vez de un avatar que no
// corresponde. Mismo try/catch que flagOfChampion() y mismo motivo: esta
// función se llama desde rebuildDynamicData() en su invocación top-level,
// antes de que getDynamicSpec()/AVATAR_MAP terminen de existir.
// v3.10 — AVATAR_MAP[champ] ahora es un array de variantes (antes un solo
// archivo por país -- ver la nota completa en app-static-data.js). La
// selección determinística (crc32(name), no Math.random()) vive en
// pickAvatarFile() (utils.js) -- mismo helper que usan las otras 2
// pantallas que necesitan esto (registro.js), para que un mismo
// participante vea siempre el mismo avatar en toda la app.
function avatarOfChampion(name){
  try{
    const spec = (typeof getDynamicSpec==='function') ? getDynamicSpec(name) : null;
    const champ = spec && spec.champ ? spec.champ : '';
    return pickAvatarFile(champ,name);
  }catch(e){
    return '';
  }
}

function rebuildDynamicData(){
  PL = (DB.participants||[]).map(p=>p.name).filter(Boolean);
  PM = {};
  (DB.participants||[]).forEach(p=>{
    PM[p.name] = {city:p.city, country:p.country, champFlag: flagOfChampion(p.name, p.country), champAvatar: avatarOfChampion(p.name)};
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

// v1.7 — MGMAP/GES/ALL_FLAGS/FLAGS2/ABBR/BGCOL/ARULES se movieron a
// app-static-data.js (carga antes que este archivo) -- son datos de
// referencia puros, sin relación con rebuildDynamicData()/
// flagOfChampion() (la lógica real de este archivo). Mismos globals,
// cero cambio de comportamiento.

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
