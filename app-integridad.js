/* ════════════════════════════════════════════════════════════
   app-integridad.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Panel de integridad: validación de checksums y de rangos de resultados guardados, limpieza de datos corrompidos.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): PANEL DE INTEGRIDAD

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

// PANEL DE INTEGRIDAD
// ══════════════════════════════════════════════════════════════
function renderIntegPanel(){
  document.getElementById("integ-results").innerHTML=`<div class="ib">Usa los botones de arriba para verificar la integridad de los datos guardados.</div>`;
  renderChangeLogCard();
  renderIntegCheckHistory();
}

// v3.4 — Historial de cambios de resultados: solo lectura, solo para
// consulta del propio admin (ver _clRecordChanges(), app-live-sync.js,
// que arma cada entrada comparando el resultado guardado antes/después
// dentro de save()). No hay botón para editarlo/borrarlo a propósito --
// sería contradictorio con el propósito del historial (poder confiar en
// que lo que dice ahí de verdad pasó).
function renderChangeLogCard(){
  const el=document.getElementById("integ-changelog");
  if(!el)return;
  const log=S.changeLog||[];
  if(!log.length){
    el.innerHTML=`<div class="ib">Todavía no se registró ningún cambio de resultado.</div>`;
    return;
  }
  let html="";
  log.forEach(entry=>{
    const despues=`${entry.after.h}-${entry.after.a}`;
    const tipo=entry.before?"✏️ Corregido":"🆕 Cargado";
    const antes=entry.before?`${entry.before.h}-${entry.before.a} → `:"";
    const origen=entry.live?" · ⚡ en vivo":"";
    const fecha=new Date(entry.ts).toLocaleString("es",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
    html+=`<div class="integ-row" style="font-size:11px">${tipo} — <b>${esc(entry.label)}</b>: ${antes}<b>${despues}</b><span style="color:var(--qb-muted)"> — ${fecha}${origen}</span></div>`;
  });
  el.innerHTML=html;
}

// v2.6 — BUG REPORTADO: "Verificar checksums" y "Validar resultados"
// solo recorrían S.scores (los 72 partidos de Grupos) -- la Eliminatoria
// (P73-P104, S.elimScores) quedaba completamente afuera de ambos
// chequeos, aunque el título del panel no lo aclaraba. Ahora los dos
// recorren TODOS los resultados guardados, de Grupos y Eliminatoria.
// Aclaración importante que no es un bug sino una diferencia real de
// diseño: la Eliminatoria NUNCA tuvo checksum (Capa 2) -- ese mecanismo
// depende de MID_ABBRS/MD, que solo existen para los 72 partidos de
// grupos (ver makeChecksum()/validateScore() en utils.js); onESC()/ESPN
// Live guardan S.elimScores directo, sin calcular ningún checksum. Por
// eso "Verificar checksums" clasifica a TODA la Eliminatoria como "sin
// checksum" (no como corrupta -- es sin checksum a propósito, mismo
// balde que ya existía para resultados importados de versiones viejas);
// la validación de RANGO/TIPO sí aplica igual de a fondo a ambas fases,
// vía validateElimScore() (utils.js, paralela a validateScore() pero sin
// la dependencia de MID_ABBRS/MD que no existe para eliminatoria).

// Verificar todos los checksums guardados
function runChecksumVerify(){
  const el=document.getElementById("integ-results");
  let html=`<div style="font-family:var(--ff-display);font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);margin-bottom:.625rem;text-transform:uppercase">Verificación de checksums (Grupos + Eliminatoria)</div>`;
  const savedGroups=Object.keys(S.scores);
  const savedElim=Object.keys(S.elimScores);
  if(!savedGroups.length&&!savedElim.length){el.innerHTML=`<div class="ib ok">No hay resultados guardados. Nada que verificar.</div>`;return;}
  let ok=0,bad=0,missing=0;
  const badList=[];
  savedGroups.forEach(mid=>{
    const sc=S.scores[mid];const saved_cs=S.checksums[mid];
    if(!saved_cs){missing++;badList.push({lbl:MD[mid]?.lbl||`P${mid}`,issue:"Sin checksum"});return;}
    const expected=makeChecksum(Number(mid),sc.h,sc.a);
    if(saved_cs!==expected){bad++;badList.push({lbl:MD[mid]?.lbl||`P${mid}`,issue:`Esperado ${expected}, guardado ${saved_cs}`});}
    else ok++;
  });
  // La Eliminatoria no tiene Capa 2 (checksum) -- ver nota arriba. Se
  // cuenta aparte, no mezclada con "missing" de Grupos, para no dar a
  // entender que son partidos importados de una versión vieja.
  const elimSinChecksum=savedElim.length;
  html+=`<div class="integ-row integ-ok">✅ ${ok} resultados de Grupos con checksum válido</div>`;
  if(missing)html+=`<div class="integ-row integ-warn">⚠️ ${missing} de Grupos sin checksum (importados de versión anterior)</div>`;
  if(bad)html+=`<div class="integ-row integ-err">❌ ${bad} de Grupos con checksum inválido — posible corrupción</div>`;
  if(elimSinChecksum)html+=`<div class="integ-row" style="color:var(--qb-muted)">ℹ️ ${elimSinChecksum} de Eliminatoria cargados — sin checksum (Capa 2 solo aplica a Grupos por diseño; ver "Validar resultados" para su chequeo de rango/tipo)</div>`;
  if(badList.length){
    html+=`<div style="margin-top:.75rem;font-family:var(--ff-display);font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);text-transform:uppercase;margin-bottom:4px">Detalle de problemas</div>`;
    badList.forEach(({lbl,issue})=>{
      html+=`<div class="integ-row integ-warn" style="font-size:10px">${lbl} — ${issue}</div>`;
    });
  }
  if(bad===0&&missing===0)html+=`<div class="ib ok" style="margin-top:.625rem">🔒 Todos los checksums de Grupos son válidos. Los datos están íntegros.</div>`;
  el.innerHTML=html;
}

// Validar rangos de todos los resultados (Grupos + Eliminatoria)
function runScoreValidation(){
  const el=document.getElementById("integ-results");
  let html=`<div style="font-family:var(--ff-display);font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);margin-bottom:.625rem;text-transform:uppercase">Validación de resultados (Grupos + Eliminatoria)</div>`;
  const savedGroups=Object.keys(S.scores);
  const savedElim=Object.keys(S.elimScores);
  if(!savedGroups.length&&!savedElim.length){el.innerHTML=`<div class="ib ok">No hay resultados guardados.</div>`;return;}
  let ok=0;const issues=[];
  savedGroups.forEach(mid=>{
    const sc=S.scores[mid];
    const vr=validateScore(Number(mid),sc.h,sc.a);
    if(vr.ok)ok++;
    else issues.push({lbl:MD[mid]?.lbl||`P${mid}`,issue:vr.err,score:`${sc.h}-${sc.a}`});
  });
  savedElim.forEach(pid=>{
    const sc=S.elimScores[pid];
    const vr=validateElimScore(Number(pid),sc.h,sc.a);
    if(vr.ok)ok++;
    else issues.push({lbl:`Eliminatoria P${pid}`,issue:vr.err,score:`${sc.h}-${sc.a}`});
  });
  html+=`<div class="integ-row integ-ok">✅ ${ok} resultados válidos</div>`;
  if(issues.length){
    html+=`<div class="integ-row integ-err">❌ ${issues.length} resultado(s) con problemas</div>`;
    issues.forEach(({lbl,issue,score})=>{
      html+=`<div class="integ-row integ-err" style="font-size:10px">${lbl} (${score}) — ${issue}</div>`;
    });
  }
  if(!issues.length)html+=`<div class="ib ok" style="margin-top:.625rem">✅ Todos los resultados (Grupos + Eliminatoria) pasaron la validación.</div>`;
  el.innerHTML=html;
}

// Limpiar datos corrompidos (Grupos + Eliminatoria)
function clearCorrupted(){
  let removed=0;
  Object.keys(S.scores).forEach(mid=>{
    const sc=S.scores[mid];
    const vr=validateScore(Number(mid),sc?.h,sc?.a);
    const cs=S.checksums[mid];
    const csOk=cs&&cs===makeChecksum(Number(mid),sc?.h,sc?.a);
    if(!vr.ok||!csOk){delete S.scores[mid];delete S.checksums[mid];removed++;}
  });
  // Eliminatoria: nunca tuvo checksum (ver nota arriba), así que acá solo
  // se limpia por rango/tipo inválido -- NO por "csOk", que siempre daría
  // false para eliminatoria y borraría resultados perfectamente buenos.
  Object.keys(S.elimScores).forEach(pid=>{
    const sc=S.elimScores[pid];
    const vr=validateElimScore(Number(pid),sc?.h,sc?.a);
    if(!vr.ok){delete S.elimScores[pid];removed++;}
  });
  if(removed>0){save();renderFix();if(typeof renderElim==="function")renderElim();renderRank();toast(`✓ ${removed} entrada(s) corrompidas eliminadas`);}
  else toast("✓ No hay datos corrompidos");
  runChecksumVerify();
}

// ══════════════════════════════════════════════════════════════
// COMPARAR CON RESPALDO OFFLINE (v3.6 — Panel de Integridad)
// ══════════════════════════════════════════════════════════════
// Motivación real: ya pasó que resultados/predicciones de participantes
// aparecieron cambiados sin que el admin lo pidiera. Este card deja
// cargar un archivo "Info de participantes" (exportarInfoParticipantes(),
// registro.js -- el mismo que ya se usa como backup manual) que el admin
// guarda offline cuando está SEGURO de que los datos son correctos, y lo
// compara contra lo que hay en línea AHORA MISMO, campo por campo de
// cada predicción (partidos de grupos, llaves de eliminatoria, Reglas
// Avanzadas). Es de solo lectura -- nunca escribe sobre las predicciones,
// solo informa diferencias.
const IC_MAX_ENTRIES=100; // corridas manuales, mucho menos frecuentes que CL_MAX_ENTRIES (app-live-sync.js)

const IC_ROUND_LABELS={r32:'Dieciseisavos',r16:'Octavos',qf:'Cuartos de final',sf:'Semifinal',third:'Tercer puesto',final:'Final'};
// Mismas claves que SPECIAL_FIELD_MAP_V62 (app-tabs.js), en español legible.
const IC_SPECIAL_LABELS={
  campeon:'Campeón',subcampeon:'Subcampeón',tercer:'Tercer lugar',
  goleador:'Goleador',goles_goleador:'Goles del goleador',
  pais_goleador:'País del goleador',goles_pais:'Goles del país goleador',
  pais_goleado:'País más goleado'
};

function _icLabelSlot(key,predA,predB){
  const prefix=key.split('_')[0];
  const round=IC_ROUND_LABELS[prefix]||IC_ROUND_LABELS[key]||key;
  const teams=(predA&&predA._a&&predA._b)?predA:predB;
  return (teams&&teams._a&&teams._b) ? `${round}: ${teams._a} vs ${teams._b}` : round;
}

function _icFmtValue(val){
  if(val===null||val===undefined)return '—';
  if(typeof val==="object"){
    if(typeof val.h==="number"&&typeof val.a==="number")return `${val.h}-${val.a}`;
    if(val.pick)return `Ganador: ${val.pick}`;
    return JSON.stringify(val);
  }
  return String(val);
}

// Compara las predicciones de UN participante (respaldo vs en línea).
// Devuelve solo lo que de verdad difiere -- mismo criterio de comparación
// "por valor" (JSON.stringify) que ya usa _clDiffOne() para resultados.
function _icDiffPredicciones(backupPred,livePred){
  backupPred=backupPred||{};livePred=livePred||{};
  const cambios=[];
  const keys=new Set([...Object.keys(backupPred),...Object.keys(livePred)]);
  keys.forEach(key=>{
    if(key==="special"){
      const a=backupPred.special||{},b=livePred.special||{};
      const sk=new Set([...Object.keys(a),...Object.keys(b)]);
      sk.forEach(f=>{
        const av=a[f]??null,bv=b[f]??null;
        if(JSON.stringify(av)!==JSON.stringify(bv)){
          cambios.push({label:IC_SPECIAL_LABELS[f]||f,antes:_icFmtValue(av),despues:_icFmtValue(bv)});
        }
      });
      return;
    }
    const a=backupPred[key],b=livePred[key];
    if(JSON.stringify(a??null)===JSON.stringify(b??null))return;
    const label=(typeof MD!=="undefined"&&MD[key]&&MD[key].lbl)?MD[key].lbl:_icLabelSlot(key,a,b);
    cambios.push({label,antes:_icFmtValue(a),despues:_icFmtValue(b)});
  });
  return cambios;
}

// Empareja por "codigo" (el identificador estable que ve el propio
// participante) -- el archivo exportado no trae el id interno de
// Firestore, así que no puede emparejarse por otra cosa.
function _icCompararConLive(backupParticipantes){
  const porCodigo=new Map(DB.participants.map(p=>[p.codigo,p]));
  const codigosBackup=new Set();
  const conCambios=[];
  const faltantes=[];
  backupParticipantes.forEach(bp=>{
    codigosBackup.add(bp.codigo);
    const live=porCodigo.get(bp.codigo);
    if(!live){faltantes.push({codigo:bp.codigo,nombre:bp.nombre});return;}
    const cambios=_icDiffPredicciones(bp.predicciones,DB.predictions[live.id]);
    if(bp.estado&&live.estadoQuiniela&&bp.estado!==live.estadoQuiniela){
      cambios.unshift({label:"Estado de la quiniela",antes:bp.estado,despues:live.estadoQuiniela});
    }
    // v2.9 — solo se puede chequear si el respaldo ya trae ownerUid (los
    // exportados antes de esa versión no lo tienen, y eso NO es un
    // reclamo real -- ver exportarInfoParticipantes(), registro.js).
    if(bp.ownerUid&&live.ownerUid&&bp.ownerUid!==live.ownerUid){
      cambios.unshift({label:"⚠️ Dueño de la cuenta",antes:"(sin cambios)",despues:"CAMBIÓ desde el respaldo — posible reclamo de cuenta"});
    }
    if(cambios.length)conCambios.push({codigo:bp.codigo,nombre:bp.nombre,cambios});
  });
  const nuevos=DB.participants.filter(p=>!codigosBackup.has(p.codigo)).map(p=>({codigo:p.codigo,nombre:p.name}));
  return{totalComparados:backupParticipantes.length,conCambios,faltantes,nuevos};
}

function _icRenderResultado(r,nombreArchivo){
  const el=document.getElementById("integ-compare-result");
  if(!el)return;
  const fecha=new Date().toLocaleString("es",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
  let html=`<div style="font-size:11px;color:var(--qb-muted);margin-bottom:.5rem">Comparado contra <b>${esc(nombreArchivo)}</b> — ${fecha}</div>`;
  if(!r.conCambios.length){
    html+=`<div class="ib ok">✅ Ningún participante tiene diferencias contra el respaldo (${r.totalComparados} comparados).</div>`;
  }else{
    html+=`<div class="integ-row integ-err">❌ ${r.conCambios.length} de ${r.totalComparados} participante(s) con predicciones distintas al respaldo</div>`;
    r.conCambios.forEach(p=>{
      html+=`<div style="margin-top:.5rem;padding:.5rem;border-left:3px solid #c0392b;background:rgba(192,57,43,.06)">
        <div style="font-weight:700;font-size:12px">${esc(p.nombre)} <span style="color:var(--qb-muted);font-weight:400">(${esc(p.codigo)})</span></div>`;
      p.cambios.forEach(c=>{
        html+=`<div class="integ-row" style="font-size:10px">${esc(c.label)}: <b>${esc(c.antes)}</b> → <b>${esc(c.despues)}</b></div>`;
      });
      html+=`</div>`;
    });
  }
  if(r.faltantes.length){
    html+=`<div class="integ-row integ-warn" style="margin-top:.5rem">⚠️ ${r.faltantes.length} participante(s) del respaldo ya no existen en línea: ${r.faltantes.map(f=>esc(f.nombre)).join(', ')}</div>`;
  }
  if(r.nuevos.length){
    html+=`<div class="integ-row" style="margin-top:.5rem;color:var(--qb-muted)">ℹ️ ${r.nuevos.length} participante(s) en línea no estaban en el respaldo (probablemente se registraron después): ${r.nuevos.map(n=>esc(n.nombre)).join(', ')}</div>`;
  }
  el.innerHTML=html;
}

// Solo persiste un RESUMEN de la corrida (ver comentario en app-state.js
// junto a S.integrityChecks) -- el detalle campo por campo se ve en
// pantalla en el momento, no queda guardado.
function _icGuardarEnHistorial(r,nombreArchivo){
  const entry={
    ts:Date.now(),
    archivo:nombreArchivo,
    totalComparados:r.totalComparados,
    numConCambios:r.conCambios.length,
    numFaltantes:r.faltantes.length,
    numNuevos:r.nuevos.length,
    afectados:r.conCambios.map(p=>({codigo:p.codigo,nombre:p.nombre,numCambios:p.cambios.length}))
  };
  S.integrityChecks=[entry].concat(S.integrityChecks||[]).slice(0,IC_MAX_ENTRIES);
  save();
  renderIntegCheckHistory();
}

function renderIntegCheckHistory(){
  const el=document.getElementById("integ-compare-history");
  if(!el)return;
  const log=S.integrityChecks||[];
  if(!log.length){
    el.innerHTML=`<div class="ib">Todavía no corriste ninguna comparación contra un respaldo.</div>`;
    return;
  }
  let html="";
  log.forEach(entry=>{
    const fecha=new Date(entry.ts).toLocaleString("es",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
    const estado=entry.numConCambios?`❌ ${entry.numConCambios} con diferencias`:`✅ sin diferencias`;
    html+=`<div class="integ-row" style="font-size:10px">${fecha} — ${esc(entry.archivo)} — ${estado} de ${entry.totalComparados} comparados</div>`;
  });
  el.innerHTML=html;
}

// Handler del <input type=file> del botón "Cargar respaldo y comparar".
function compararRespaldoOffline(input){
  const file=input.files&&input.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=(e)=>{
    let raw;
    try{raw=JSON.parse(e.target.result);}
    catch(err){toast("El archivo no es un JSON válido.",true);input.value="";return;}
    if(raw.tipo!=="quinielaborracha_info_participantes"){
      toast('Ese archivo no es un export de "Info de participantes" (Mi Quiniela → Admin).',true);
      input.value="";return;
    }
    const resultado=_icCompararConLive(raw.participantes||[]);
    _icRenderResultado(resultado,file.name);
    _icGuardarEnHistorial(resultado,file.name);
    input.value="";
  };
  reader.onerror=()=>{toast("No se pudo leer el archivo.",true);input.value="";};
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════════
