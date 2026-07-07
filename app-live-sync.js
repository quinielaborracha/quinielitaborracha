/* ════════════════════════════════════════════════════════════
   app-live-sync.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Mapeo ESPN gameId → pid de eliminatoria, sincronización en vivo con Firestore (onSnapshot), Modo Prueba (?test=1), y el guardado de resultados con validación (Capa 1) + checksum (Capa 2).

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): MAPA ESPN gameId → pid de eliminatoria; SINCRONIZACIÓN EN VIVO; MODO PRUEBA; GUARDAR RESULTADO CON VALIDACIÓN + CHECKSUM

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
// MAPA ESPN gameId → pid de eliminatoria (P73-P104) — v7.0
// ══════════════════════════════════════════════════════════════
// Estos IDs son FIJOS por el calendario oficial del torneo (cada cruce
// del bracket tiene su gameId asignado desde el sorteo de fechas, sin
// importar qué selección termine cayendo ahí) — confirmado contra el
// cuadro real de ESPN (espndeportes.espn.com/futbol/cuadro) el 25/06/2026.
// Esto reemplaza el matching anterior por nombre de equipo/orden
// cronológico (ELIM_DATES), que no podía detectar un cruce si los
// equipos guardados en S.elimTeams todavía no existían o estaban mal
// generados por generarLlavesDieciseisavos() — con el ID exacto no hace
// falta adivinar: sabemos qué pid es cada partido sin importar qué
// equipos tenga cargados hoy.
const ESPN_GAMEID_TO_PID={
  "760486":73,"760489":74,"760488":75,"760487":76,
  "760492":77,"760490":78,"760491":79,"760495":80,
  "760494":81,"760493":82,"760496":83,"760497":84,
  "760498":85,"760500":86,"760501":87,"760499":88,
  "760503":89,"760502":90,"760504":91,"760505":92,
  "760506":93,"760507":94,"760509":95,"760508":96,
  "760510":97,"760511":98,"760512":99,"760513":100,
  "760514":101,"760515":102,"760516":103,"760517":104,
};

// v7.2 — Modo Prueba (?test=1): se calcula directo desde la URL (no
// depende de window.__fb ni de su orden de carga) para que esté disponible
// de inmediato, incluso en código que corre antes de que el script-módulo
// de Firebase en index.html termine de inicializar.
const TEST_MODE=new URLSearchParams(location.search).get("test")==="1";

// v7.2 — Caché local separada en Modo Prueba (sufijo "_test"): si no,
// guardar acá pisaría la misma clave que usa la pestaña de producción,
// y al volver a esa pestaña/recargar podría mostrar por un instante datos
// de prueba antes de que llegue la sincronización real de Firestore.
const STORAGE_KEY="wb26v552"+(TEST_MODE?"_test":"");

function load(){
  try{
    // Migración desde versiones anteriores (últimas 3 versiones) — solo
    // tiene sentido en modo real. En Modo Prueba la caché es 100%
    // independiente y nunca debe heredar nada de producción.
    let raw=localStorage.getItem(STORAGE_KEY);
    if(!TEST_MODE){
      if(!raw) raw=localStorage.getItem("wb26v54");
      if(!raw) raw=localStorage.getItem("wb26v53");
      if(!raw) raw=localStorage.getItem("wb26v52");
    }
    if(raw){
      const p=JSON.parse(raw);
      S.scores=p.scores||{};
      S.checksums=p.checksums||{};
      S.elimScores=p.elimScores||{};
      S.elimTeams=p.elimTeams||{};
      S.scorers=p.scorers||[];
      S.matchTimes=p.matchTimes||{};
      S.elimTimes=p.elimTimes||{};
      if(p.bonos)S.bonos=p.bonos;
      if(p.tieBreakers)S.tieBreakers=p.tieBreakers;
      // v3.8.1 — faltaba acá (sí se restaura en applyRemoteState() y en
      // applyStatePayload(), y buildStatePayload() sí lo persiste): sin
      // esta línea, S.hiddenPL volvía al default vacío en cada recarga de
      // página hasta que llegara el primer snapshot de Firestore, y un
      // participante marcado como oculto reaparecía un instante en el
      // ranking público.
      if(p.hiddenPL){S.hiddenPL=new Set(Object.keys(p.hiddenPL).filter(k=>p.hiddenPL[k]));}
      if(p.autoClose!==undefined)S.autoClose=p.autoClose;
      if(p.snapshots)S.snapshots=p.snapshots;
      S.reality=p.reality||S.reality;
      S.adv=p.adv||p.advPreds||{};
      if(p.battles)S.battles=p.battles;
      if(p.battleHistory)S.battleHistory=p.battleHistory;
      if(p.changeLog)S.changeLog=p.changeLog;
      if(p.integrityChecks)S.integrityChecks=p.integrityChecks;
      let corrupted=0;
      Object.keys(S.scores).forEach(mid=>{
        const sc=S.scores[mid];
        if(!sc||typeof sc.h!=="number"||typeof sc.a!=="number"){
          delete S.scores[mid];delete S.checksums[mid];corrupted++;return;
        }
        if(S.checksums[mid]){
          const expected=makeChecksum(Number(mid),sc.h,sc.a);
          if(S.checksums[mid]!==expected){
            console.warn(`⚠️ Checksum inválido P${mid}: guardado=${S.checksums[mid]} calculado=${expected}`);
            delete S.scores[mid];delete S.checksums[mid];corrupted++;
          }
        }
      });
      if(corrupted>0) showBanner(`⚠️ ${corrupted} resultado(s) corrompidos descartados al cargar. Ve a 🔒 Integridad para más detalles.`,"warn");
    }
  }catch(e){console.error("Error al cargar:",e);}
}

// Construye el payload serializable del estado completo (usado para localStorage y Firestore)
function buildStatePayload(){
  const hiddenPLobj={};
  if(S.hiddenPL instanceof Set)S.hiddenPL.forEach(n=>{hiddenPLobj[n]=true;});
  else Object.assign(hiddenPLobj,S.hiddenPL||{});
  return{scores:S.scores,checksums:S.checksums,elimScores:S.elimScores,elimTeams:S.elimTeams,scorers:S.scorers,matchTimes:S.matchTimes,elimTimes:S.elimTimes,bonos:S.bonos,tieBreakers:S.tieBreakers,autoClose:S.autoClose,hiddenPL:hiddenPLobj,snapshots:S.snapshots,reality:S.reality,adv:S.adv,battles:S.battles,battleHistory:S.battleHistory,changeLog:S.changeLog,integrityChecks:S.integrityChecks,realElim:S.realElim};
}

// v1.5.1 — Contraparte de buildStatePayload(): aplica un payload completo
// (típicamente de un backup integral, ver exportBackupJSON()/
// importBackupJSON() en app-admin-tools.js) sobre S, en modo REEMPLAZO
// TOTAL -- a diferencia de applyRemoteState() (sincronización en vivo, que
// a propósito conserva lo que ya había si el payload remoto no trae una
// clave), acá cada campo se resetea a su default si el backup no lo trae,
// porque restaurar un backup significa "dejar el estado IGUAL al
// archivo", no "completar lo que falte". No llama a save() por sí sola --
// el llamador decide cuándo persistir (siempre DESPUÉS de haber bajado ya
// la copia de seguridad del estado actual, ver importBackupJSON()).
function applyStatePayload(p){
  p=p||{};
  S.scores=p.scores||{};
  S.checksums=p.checksums||{};
  S.elimScores=p.elimScores||{};
  S.elimTeams=p.elimTeams||{};
  S.scorers=p.scorers||[];
  S.matchTimes=p.matchTimes||{};
  S.elimTimes=p.elimTimes||{};
  S.bonos=p.bonos||{lastPlace:{},classified:{},llaves:{},closed:{}};
  S.tieBreakers=p.tieBreakers||{};
  S.hiddenPL=p.hiddenPL?new Set(Object.keys(p.hiddenPL).filter(k=>p.hiddenPL[k])):new Set();
  S.snapshots=p.snapshots||[];
  S.autoClose=p.autoClose!==undefined?p.autoClose:false;
  S.reality=p.reality||{champ:"",runner:"",third:"",topScorer:"",topScorerGoals:0,topCountry:"",topCountryGoals:0,mostConceded:""};
  S.adv=p.adv||{};
  S.battles=p.battles||{};
  S.battleHistory=p.battleHistory||[];
  S.changeLog=p.changeLog||[];
  S.integrityChecks=p.integrityChecks||[];
  S.realElim=p.realElim||{};
  // v3.4 — un backup restaurado reemplaza el estado entero: la línea de
  // base contra la que se compara el próximo save() (ver más abajo) queda
  // obsoleta, así que se resetea para que se re-establezca sola contra ESTE
  // estado recién restaurado, sin loguear un "cambio" fantasma comparando
  // contra lo que había antes de importar.
  _clBaselineScores=null;
  _clBaselineElim=null;
}

// ══════════════════════════════════════════════════════════════
// HISTORIAL DE CAMBIOS DE RESULTADOS (v3.4 — Admin → 🔒 Integridad)
// ══════════════════════════════════════════════════════════════
// Solo para que el propio admin pueda consultar "¿cuándo cambió este
// resultado, y de qué a qué?" -- no es un requisito de seguridad ni algo
// que vean los participantes (ver renderChangeLogCard(), app-
// integridad.js, dentro del panel Admin). Se calcula por DIFF contra una
// "foto" de S.scores/S.elimScores tomada la última vez que se pudo
// comparar -- no se engancha en cada uno de los ~4 lugares que escriben
// un resultado (carga manual, editor de llaves, ESPN Auto-Sync, ESPN
// Live), sino acá, en save(), el único cuello de botella por el que
// pasan todos antes de llegar a Firestore.
let _clBaselineScores=null;
let _clBaselineElim=null;
const CL_MAX_ENTRIES=300; // tope generoso (72 grupos + 32 elim, con margen para varias correcciones de cada uno) para no crecer sin límite dentro de quiniela/estado

function _clLabelGrupos(mid){
  return (typeof MD!=="undefined" && MD[mid] && MD[mid].lbl) || `Partido ${mid}`;
}
function _clLabelElim(pid){
  const t=S.elimTeams && S.elimTeams[pid];
  if(t && t.h && t.a && typeof abbr2name==="function"){
    return `${abbr2name(t.h)} vs ${abbr2name(t.a)}`;
  }
  return `Partido ${pid} (Eliminatoria)`;
}
function _clDiffOne(id,before,after,labelFn){
  if(!after||typeof after.h!=="number"||typeof after.a!=="number")return null;
  if(before&&before.h===after.h&&before.a===after.a)return null; // sin cambio real
  return{
    id:Number(id),
    label:labelFn(id),
    before:(before&&typeof before.h==="number")?{h:before.h,a:before.a}:null,
    after:{h:after.h,a:after.a},
    live:!!after.live
  };
}
// Compara S.scores/S.elimScores CONTRA la última foto conocida y agrega
// al historial solo lo que de verdad cambió. La primera vez que corre
// (recién cargó la página, todavía no hay foto contra qué comparar) NO
// loguea nada -- solo establece la foto inicial, para no generar un
// historial fantasma comparando contra "nada".
function _clRecordChanges(){
  if(_clBaselineScores===null||_clBaselineElim===null){
    _clBaselineScores=JSON.parse(JSON.stringify(S.scores||{}));
    _clBaselineElim=JSON.parse(JSON.stringify(S.elimScores||{}));
    return;
  }
  const ts=Date.now();
  const nuevas=[];
  Object.keys(S.scores||{}).forEach(mid=>{
    const e=_clDiffOne(mid,_clBaselineScores[mid],S.scores[mid],_clLabelGrupos);
    if(e)nuevas.push({ts,fase:"grupos",...e});
  });
  Object.keys(S.elimScores||{}).forEach(pid=>{
    const e=_clDiffOne(pid,_clBaselineElim[pid],S.elimScores[pid],_clLabelElim);
    if(e)nuevas.push({ts,fase:"elim",...e});
  });
  if(nuevas.length){
    S.changeLog=nuevas.concat(S.changeLog||[]).slice(0,CL_MAX_ENTRIES);
  }
  _clBaselineScores=JSON.parse(JSON.stringify(S.scores||{}));
  _clBaselineElim=JSON.parse(JSON.stringify(S.elimScores||{}));
}

function save(){
  try{
    Object.keys(S.scores).forEach(mid=>{
      const sc=S.scores[mid];
      if(sc&&typeof sc.h==="number"&&typeof sc.a==="number"){
        S.checksums[mid]=makeChecksum(Number(mid),sc.h,sc.a);
      }
    });
    _clRecordChanges();
    const payload=buildStatePayload();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));
    pushStateToFirestore(payload);
  }catch(e){console.error("Error al guardar:",e);}
  // v3.2.3 — mismo bug que la nota en applyRemoteState(), pero para quien
  // ESTÁ haciendo el cambio (admin cargando un resultado a mano o vía
  // ESPN Live): si esa misma pestaña/sesión también tiene abierta la
  // pantalla de Mi Quiniela/Ranking (registro.js), antes se quedaba
  // igual de desactualizada -- acá el eco de Firestore ni siquiera
  // aplica (pushStateToFirestore se suprime a sí mismo vía
  // _lastPushedStateJSON), así que sin este llamado nunca se enteraba.
  if(typeof refreshRegistroViewFromStateChange==="function"){
    try{refreshRegistroViewFromStateChange();}catch(e){}
  }
}

// ══════════════════════════════════════════════════════════════
// SINCRONIZACIÓN EN VIVO — Firestore (v5.5.5)
// ══════════════════════════════════════════════════════════════
// v1.5.6 — Fase 3 (proceso/CI): _suppressNextFirestoreEcho reemplazado por
// _lastPushedStateJSON. El diseño viejo asumía "el PRÓXIMO snapshot que
// llegue es nuestro propio eco" -- una bandera basada en ORDEN, frágil en
// un escenario real: el SDK de Firestore dispara onSnapshot DOS veces por
// cada escritura propia (una vez al toque, desde el caché local con
// hasPendingWrites:true; otra cuando el servidor confirma), y si llegaba
// una escritura genuina de otro admin justo en el medio, la bandera podía
// terminar suprimiendo el snapshot equivocado. El nuevo mecanismo compara
// CONTENIDO: guardamos el JSON exacto que acabamos de escribir, y cuando
// llega un snapshot lo comparamos contra eso -- si coincide byte a byte,
// es nuestro propio eco (sea cual sea el orden en que haya llegado, y
// sea cuál sea el disparo -- local o confirmado -- del propio SDK); si
// no coincide, es un cambio remoto genuino y se aplica normalmente.
let _lastPushedStateJSON=null;
let _firestoreSyncWired=false;
let _firestoreConnected=false;

function pushStateToFirestore(payload){
  if(!isAdmin())return; // solo el admin escribe a Firestore
  const fb=window.__fb;
  if(!fb)return;
  const json=JSON.stringify(payload);
  _lastPushedStateJSON=json;
  fb.setDoc(fb.STATE_DOC,{json,updatedAt:fb.serverTimestamp()})
    .catch(err=>{
      console.error("Error al sincronizar con Firebase:",err);
      // v3.8.1 — antes esto quedaba en silencio para el admin: veía su
      // cambio reflejado local (optimista, save() ya actualizó S antes de
      // llamar acá) y seguía cargando el próximo resultado sin enterarse
      // de que ESTA escritura puntual no llegó al servidor (corte de
      // señal, cuota, etc.) hasta que alguien notara el ranking
      // desactualizado a ojo.
      toast(err&&err.code==='permission-denied'
        ?'⚠️ No se pudo guardar (permiso denegado). Verificá tu sesión de admin.'
        :'⚠️ No se pudo guardar en el servidor. Revisá tu conexión e intentá de nuevo.',true);
    });
}

// ══════════════════════════════════════════════════════════════
// MODO PRUEBA (?test=1) — v7.2
// ══════════════════════════════════════════════════════════════
// Copia el documento real (quiniela/estado) al documento de prueba
// (quiniela/estado-test), SIN tocar nunca el real. isAuto=true es la
// llamada automática (silenciosa salvo éxito); isAuto=false es el botón
// "Cargar/actualizar datos reales" del panel Admin (con confirm() antes,
// ver registro.js::renderAdmin).
function seedTestStateFromProduction(isAuto){
  const fb=window.__fb;
  if(!fb||!fb.STATE_DOC_REAL||!fb.STATE_DOC_TEST){
    if(!isAuto)toast("Modo Prueba no está disponible todavía (Firebase no listo). Recargá la página.");
    return;
  }
  if(!isAdmin()){
    if(!isAuto)toast("Solo el admin puede copiar datos reales a Modo Prueba.");
    return;
  }
  fb.getDoc(fb.STATE_DOC_REAL).then(snap=>{
    if(!snap.exists()||!snap.data()||!snap.data().json){
      if(!isAuto)toast("Todavía no hay resultados reales cargados en producción para copiar.");
      return;
    }
    const data=snap.data();
    _lastPushedStateJSON=data.json; // este doc lo originamos nosotros mismos
    fb.setDoc(fb.STATE_DOC_TEST,{json:data.json,updatedAt:fb.serverTimestamp()})
      .then(()=>{
        toast(isAuto
          ? "🧪 Modo Prueba listo: se copiaron los datos reales para que empieces a experimentar."
          : "Datos reales copiados a Modo Prueba ✅");
      })
      .catch(err=>{
        console.error("Error al copiar datos reales a Modo Prueba:",err);
        toast("Error al copiar datos reales a Modo Prueba. Revisá la consola.");
      });
  }).catch(err=>{
    console.error("Error al leer datos reales para Modo Prueba:",err);
    if(!isAuto)toast("Error al leer datos reales. Revisá la consola.");
  });
}

// Se llama una sola vez (ver _afterAdminStatusResolved) cuando el admin
// entra con ?test=1: si estado-test todavía no existe, lo siembra solo;
// si ya existe (ya se usó Modo Prueba antes, o ya se cargó manualmente),
// no toca nada -- así nunca pisa un experimento en curso sin que el admin
// lo pida con el botón.
function maybeAutoSeedTestState(){
  const fb=window.__fb;
  if(!fb||!fb.STATE_DOC_TEST)return;
  fb.getDoc(fb.STATE_DOC_TEST).then(snap=>{
    if(!snap.exists())seedTestStateFromProduction(true);
  }).catch(err=>{console.error("Error al revisar quiniela/estado-test:",err);});
}

function setLiveBadge(connected){
  _firestoreConnected=connected;
  const el=document.getElementById("live-badge");
  if(!el)return;
  el.style.display=connected?"inline-flex":"none";
}

function applyRemoteState(p){
  if(!p)return;
  S.scores=p.scores||{};
  S.checksums=p.checksums||{};
  S.elimScores=p.elimScores||{};
  S.elimTeams=p.elimTeams||{};
  S.scorers=p.scorers||[];
  S.matchTimes=p.matchTimes||{};
  S.elimTimes=p.elimTimes||{};
  if(p.bonos)S.bonos=p.bonos;
  if(p.tieBreakers)S.tieBreakers=p.tieBreakers;
  if(p.hiddenPL){S.hiddenPL=new Set(Object.keys(p.hiddenPL).filter(k=>p.hiddenPL[k]));}
  if(p.snapshots)S.snapshots=p.snapshots;
  if(p.autoClose!==undefined)S.autoClose=p.autoClose;
  S.reality=p.reality||S.reality;
  S.adv=p.adv||{};
  if(p.battles)S.battles=p.battles;
  if(p.battleHistory)S.battleHistory=p.battleHistory;
  if(p.changeLog)S.changeLog=p.changeLog;
  if(p.integrityChecks)S.integrityChecks=p.integrityChecks;
  S.realElim=p.realElim||{};
  // v3.4 — este snapshot es la verdad confirmada por el servidor (llega
  // acá solo en la primera carga o ante un cambio remoto genuino de
  // otra sesión, ver el filtro de eco en wireFirestoreSync()) -- se
  // re-establece la foto base para el próximo _clRecordChanges() (save())
  // contra ESTE estado, no contra uno viejo.
  _clBaselineScores=JSON.parse(JSON.stringify(S.scores||{}));
  _clBaselineElim=JSON.parse(JSON.stringify(S.elimScores||{}));
  // Persistimos también localmente como caché/respaldo
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(p));}catch(e){}
  // Re-renderizamos todas las vistas relevantes
  renderRank();
  if(typeof renderSnapshotPanel==="function")renderSnapshotPanel();
  if(typeof updateGenerarBtn==="function")updateGenerarBtn();
  if(typeof updateElimBtns==="function")updateElimBtns();
  if(typeof renderBonosPanel==="function")renderBonosPanel();
  if(typeof renderChangeLogCard==="function"&&document.getElementById("admin-integ")&&document.getElementById("admin-integ").style.display!=="none"){
    renderChangeLogCard();
  }
  if(typeof renderIntegCheckHistory==="function"&&document.getElementById("admin-integ")&&document.getElementById("admin-integ").style.display!=="none"){
    renderIntegCheckHistory();
  }
  if(typeof renderBattlesPanel==="function"&&document.getElementById("t-battles")&&document.getElementById("t-battles").style.display!=="none"){
    renderBattlesPanel();
    const histWrap=document.getElementById("battles-history-wrap");
    if(histWrap&&histWrap.style.display!=="none")renderBattleHistory();
  }
  if(typeof renderMM==="function"&&document.getElementById("t-mm")&&document.getElementById("t-mm").style.display!=="none"){
    // Si la persona está mirando "En vivo", refrescamos esa vista también
    try{loadMM(false);}catch(e){}
  }
  // v2.8 — "🏆 Torneo real" (Estadísticas): si alguien la está mirando
  // ahora mismo, se repinta con el nuevo estado apenas llega -- así se ve
  // "en vivo" sin que ese visitante tenga que hacer nada ni recargar
  // (ver renderTorneoReal, app-estadisticas.js, y startTorneoRealAutoSync,
  // app-bracket-espn-sync.js, para de dónde sale este cambio remoto).
  if(typeof renderTorneoReal==="function"
    &&document.getElementById("t-stats")&&document.getElementById("t-stats").style.display!=="none"
    &&document.getElementById("stat-popular")&&document.getElementById("stat-popular").style.display!=="none"){
    try{renderTorneoReal();}catch(e){}
  }
  // v3.2.3 — BUG REPORTADO: un resultado real nuevo (ESPN Live o carga
  // manual del admin) actualizaba el panel de Admin (renderRank() arriba)
  // pero nunca la pantalla de Mi Quiniela/Ranking que ve cada participante
  // (registro.js, "rg-content") — esa solo escuchaba cambios de
  // registro_participants, un documento totalmente distinto. Ver la nota
  // junto a refreshRegistroViewFromStateChange() en registro.js.
  if(typeof refreshRegistroViewFromStateChange==="function"){
    try{refreshRegistroViewFromStateChange();}catch(e){}
  }
}

function wireFirestoreSync(){
  if(_firestoreSyncWired)return; // solo nos suscribimos una vez por carga de página
  _firestoreSyncWired=true;
  const fb=window.__fb;
  if(!fb)return;
  fb.onSnapshot(fb.STATE_DOC,(snap)=>{
    setLiveBadge(true);
    if(!snap.exists())return;
    const data=snap.data();
    if(!data||!data.json)return;
    if(data.json===_lastPushedStateJSON){
      return; // este cambio lo originamos nosotros mismos, ya está aplicado localmente
    }
    try{
      const p=JSON.parse(data.json);
      applyRemoteState(p);
    }catch(e){console.error("Error al aplicar estado remoto:",e);}
  },(err)=>{
    console.error("Error de sincronización Firestore:",err);
    setLiveBadge(false);
  });
}

function showBanner(msg,type="warn"){
  const el=document.getElementById("integ-banner");
  if(!el)return;
  const cls=type==="warn"?"sbadge warn":type==="err"?"sbadge err":"sbadge ok";
  el.innerHTML=`<span class="${cls}">${msg}</span>`;
  setTimeout(()=>{if(el)el.innerHTML="";},8000);
}

function toast(msg,err=false){const t=document.getElementById("toast");t.textContent=msg;t.style.background=err?"#dc2626":"#16a34a";t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800);}

// ══════════════════════════════════════════════════════════════
// GUARDAR RESULTADO CON VALIDACIÓN (Capa 1) + CHECKSUM (Capa 2)
// ══════════════════════════════════════════════════════════════
function saveScore(mid,h,a,opts={}){
  // CAPA 1: Validar
  const v=validateScore(mid,h,a);
  if(!v.ok){toast(`⚠️ P${mid}: ${v.err}`,true);return false;}
  // Guardar con checksum
  S.scores[mid]={h,a,live:opts.live||false};
  S.checksums[mid]=makeChecksum(mid,h,a);
  save();
  return true;
}

// ══════════════════════════════════════════════════════════════
