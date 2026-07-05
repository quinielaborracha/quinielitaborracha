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
