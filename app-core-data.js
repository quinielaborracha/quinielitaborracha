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
function avatarOfChampion(name){
  try{
    const spec = (typeof getDynamicSpec==='function') ? getDynamicSpec(name) : null;
    const champ = spec && spec.champ ? spec.champ : '';
    return (champ && typeof AVATAR_MAP!=='undefined' && AVATAR_MAP[champ]) || '';
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
// v2.10 — RENOMBRE DE LLAVES MANUALES → PREDICCIONES GUARDADAS
// ══════════════════════════════════════════════════════════════
// Cuando el torneo arranca directo en una fase de eliminatoria (Grupos
// y/o Dieciseisavos desactivados — Constructor de Torneos), los equipos
// de esa primera fase los carga el admin (✏️ Editar llaves / ⚡ ESPN) y
// suelen empezar como texto provisional ("Ganador de Argentina vs Cabo
// Verde") hasta que la ronda previa real se resuelve. El participante
// predice SOLO el marcador (v2.8.2, trustSlot en registro.js), pero su
// predicción guardada lleva la "huella" _a/_b con el nombre vigente al
// momento de teclear — y esa huella es lo que isLlaveCorrecta() y el
// bracket de Predicciones comparan después. Sin esta propagación, al
// renombrar el texto provisional por el país real TODAS las quinielas ya
// guardadas quedaban apuntando al texto viejo: llave ✗ para todo el
// mundo, cruces encadenados de rondas siguientes invalidados, y campeón/
// subcampeón/tercer "quemados" con el texto provisional.
//
// propagateElimTeamRenames() reescribe cada renombre (nombre viejo →
// nuevo) en las predicciones guardadas de TODOS los participantes
// (incluidas las ya enviadas): _a/_b/pick de los 32 slots de
// eliminatoria + campeón/subcampeón/tercer de preds.special. Solo corre
// si TODAS estas condiciones se cumplen:
//   · Sesión de admin: las reglas de Firestore solo le permiten a él
//     escribir documentos ajenos de registro_participants.
//   · NO es Modo Prueba (?test=1): ahí las llaves editadas viven en
//     quiniela/estado-test, pero las predicciones de los participantes
//     son las REALES — propagar desde una simulación las corrompería.
//   · El registro sigue ABIERTO (isGloballyClosed(), registro.js —
//     expuesta a window para esto): después del cierre las predicciones
//     de los participantes quedan CONGELADAS y nadie (ni este
//     mecanismo) las vuelve a tocar. Pedido explícito del admin: un
//     renombre tardío ya no se refleja en ninguna quiniela.
//   · La primera fase de eliminatoria del wizard se siembra de equipos
//     REALES (bracket.realSeedKey, registro.js): en un torneo con
//     Grupos + Dieciseisavos activos cada participante siembra su
//     bracket desde sus PROPIOS resultados de grupo, y esos nombres son
//     SU predicción — renombrarlos sería corromperla.

// Foto actual de los equipos cargados en los pids manuales (los que
// edita el admin) — se toma ANTES de una edición para poder diffear.
function snapshotManualElimTeams(){
  const snap={};
  getManualTeamPids().forEach(pid=>{
    const t=S.elimTeams[pid];
    if(t&&t.h&&t.a)snap[pid]={h:t.h,a:t.a};
  });
  return snap;
}

// Diff entre dos fotos: qué nombres desaparecieron y por cuál llegó cada
// uno. Un intercambio local/visitante de los MISMOS 2 equipos no es
// renombre (ambos nombres siguen vivos, solo cambió la orientación) y un
// pid recién cargado de cero tampoco (no hay nombre viejo que reemplazar).
function elimRenamesFromTeamsDiff(before,after){
  const renames=[];
  Object.keys(after).forEach(pid=>{
    const nu=after[pid];const old=before[pid];
    if(!nu||!old)return;
    const oldSet=new Set([n(old.h),n(old.a)]);
    const newSet=new Set([n(nu.h),n(nu.a)]);
    const oldOnly=[old.h,old.a].filter(t=>!newSet.has(n(t)));
    const newOnly=[nu.h,nu.a].filter(t=>!oldSet.has(n(t)));
    // 1 nombre cambió → renombre directo; los 2 cambiaron → posicional
    // (local viejo → local nuevo, visita vieja → visita nueva).
    if(oldOnly.length===1&&newOnly.length===1)renames.push({from:oldOnly[0],to:newOnly[0]});
    else if(oldOnly.length===2&&newOnly.length===2){
      renames.push({from:oldOnly[0],to:newOnly[0]});
      renames.push({from:oldOnly[1],to:newOnly[1]});
    }
  });
  return renames.filter(r=>n(r.from)!==n(r.to));
}

function propagateElimTeamRenames(renames){
  if(!renames||!renames.length)return 0;
  if(typeof isAdmin==="function"&&!isAdmin())return 0;
  if(typeof TEST_MODE!=="undefined"&&TEST_MODE)return 0;
  if(typeof window!=="undefined"&&typeof window.isGloballyClosed==="function"&&window.isGloballyClosed())return 0;
  const primeraElim=getFirstActiveElimPhase();
  // 'r16' en BONUS_PHASES es Dieciseisavos (ver KO_TO_BONUS_KEY,
  // registro.js). Grupos + Dieciseisavos activos = el caso de siempre,
  // sembrado desde los grupos de cada quien → no tocar nada.
  const sembradoDeGrupos=isFaseActiva('grupos')&&(!primeraElim||primeraElim.key==='r16');
  if(sembradoDeGrupos)return 0;
  const byOld={};renames.forEach(r=>{byOld[n(r.from)]=r.to;});
  let touched=0;
  (DB.participants||[]).forEach(p=>{
    const preds=DB.predictions[p.id];
    if(!preds)return;
    let changed=false;
    KO_SLOT_IDS_V62.forEach(slot=>{
      const rec=preds[slot];
      if(!rec||typeof rec!=="object")return;
      ["_a","_b","pick"].forEach(k=>{
        if(rec[k]&&byOld[n(rec[k])]!==undefined){rec[k]=byOld[n(rec[k])];changed=true;}
      });
    });
    const sp=preds.special;
    if(sp&&typeof sp==="object"){
      ["campeon","subcampeon","tercer"].forEach(qid=>{
        if(sp[qid]&&byOld[n(sp[qid])]!==undefined){sp[qid]=byOld[n(sp[qid])];changed=true;}
      });
    }
    if(changed){p.fechaActualizacion=Date.now();touched++;}
  });
  if(touched){
    saveData(DB);
    notifyParticipantesChange();
  }
  return touched;
}

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
