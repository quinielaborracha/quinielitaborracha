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
}

// Verificar todos los checksums guardados
function runChecksumVerify(){
  const el=document.getElementById("integ-results");
  let html=`<div style="font-family:var(--ff-display);font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);margin-bottom:.625rem;text-transform:uppercase">Verificación de checksums</div>`;
  const saved=Object.keys(S.scores);
  if(!saved.length){el.innerHTML=`<div class="ib ok">No hay resultados guardados. Nada que verificar.</div>`;return;}
  let ok=0,bad=0,missing=0;
  const badList=[];
  saved.forEach(mid=>{
    const sc=S.scores[mid];const saved_cs=S.checksums[mid];
    if(!saved_cs){missing++;badList.push({mid,issue:"Sin checksum"});return;}
    const expected=makeChecksum(Number(mid),sc.h,sc.a);
    if(saved_cs!==expected){bad++;badList.push({mid,issue:`Esperado ${expected}, guardado ${saved_cs}`});}
    else ok++;
  });
  html+=`<div class="integ-row integ-ok">✅ ${ok} resultados con checksum válido</div>`;
  if(missing)html+=`<div class="integ-row integ-warn">⚠️ ${missing} sin checksum (importados de versión anterior)</div>`;
  if(bad)html+=`<div class="integ-row integ-err">❌ ${bad} con checksum inválido — posible corrupción</div>`;
  if(badList.length){
    html+=`<div style="margin-top:.75rem;font-family:var(--ff-display);font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);text-transform:uppercase;margin-bottom:4px">Detalle de problemas</div>`;
    badList.forEach(({mid,issue})=>{
      const lbl=MD[mid]?.lbl||`P${mid}`;
      html+=`<div class="integ-row integ-warn" style="font-size:10px">P${mid} · ${lbl} — ${issue}</div>`;
    });
  }
  if(bad===0&&missing===0)html+=`<div class="ib ok" style="margin-top:.625rem">🔒 Todos los checksums son válidos. Los datos están íntegros.</div>`;
  el.innerHTML=html;
}

// Validar rangos de todos los resultados
function runScoreValidation(){
  const el=document.getElementById("integ-results");
  let html=`<div style="font-family:var(--ff-display);font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);margin-bottom:.625rem;text-transform:uppercase">Validación de resultados</div>`;
  const saved=Object.keys(S.scores);
  if(!saved.length){el.innerHTML=`<div class="ib ok">No hay resultados guardados.</div>`;return;}
  let ok=0;const issues=[];
  saved.forEach(mid=>{
    const sc=S.scores[mid];
    const vr=validateScore(Number(mid),sc.h,sc.a);
    if(vr.ok)ok++;
    else issues.push({mid,issue:vr.err,score:`${sc.h}-${sc.a}`});
  });
  html+=`<div class="integ-row integ-ok">✅ ${ok} resultados válidos</div>`;
  if(issues.length){
    html+=`<div class="integ-row integ-err">❌ ${issues.length} resultado(s) con problemas</div>`;
    issues.forEach(({mid,issue,score})=>{
      const lbl=MD[mid]?.lbl||`P${mid}`;
      html+=`<div class="integ-row integ-err" style="font-size:10px">P${mid} (${score}) · ${lbl} — ${issue}</div>`;
    });
  }
  if(!issues.length)html+=`<div class="ib ok" style="margin-top:.625rem">✅ Todos los resultados pasaron la validación.</div>`;
  el.innerHTML=html;
}

// Limpiar datos corrompidos
function clearCorrupted(){
  let removed=0;
  Object.keys(S.scores).forEach(mid=>{
    const sc=S.scores[mid];
    const vr=validateScore(Number(mid),sc?.h,sc?.a);
    const cs=S.checksums[mid];
    const csOk=cs&&cs===makeChecksum(Number(mid),sc?.h,sc?.a);
    if(!vr.ok||!csOk){delete S.scores[mid];delete S.checksums[mid];removed++;}
  });
  if(removed>0){save();renderFix();renderRank();toast(`✓ ${removed} entrada(s) corrompidas eliminadas`);}
  else toast("✓ No hay datos corrompidos");
  runChecksumVerify();
}

// ══════════════════════════════════════════════════════════════
