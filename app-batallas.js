/* ════════════════════════════════════════════════════════════
   app-batallas.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Duelos diarios 1 vs 1 (Batallas): cálculo, render y administración.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): BATALLAS

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

// BATALLAS — duelos diarios 1 vs 1 (v5.0)
// ══════════════════════════════════════════════════════════════
// S.battles = {1: {p1,p2,mids:[...],startedAt}, 2: {...}}
// Cada batalla se arma sobre los partidos (grupos + elim) cuya
// hora de INICIO cae en el día calendario de hoy (zona horaria local
// del dispositivo). Un partido que arranca 11pm y cruza medianoche
// sigue contando como "de hoy" porque se ancla a la hora de inicio.

// Puntos Básicos+Avanzado (sin Bonos) que 'name' ganó específicamente
// en los partidos de hoy — ni snapshot ni resta, suma directa.

// ¿Ya se jugaron TODOS los partidos de hoy? (criterio de cierre del duelo)
// IMPORTANTE: un resultado "live" (partido en curso) NO cuenta como terminado.
// Antes esto comparaba solo si existía el objeto de score, y como ESPN guarda
// un marcador con live:true desde que el partido ARRANCA, el duelo se marcaba
// como cerrado apenas comenzaba el último partido en vez de cuando terminaba.

function ensureBattlesState(){
  if(!S.battles)S.battles={};
}

const BATTLE_AUTO_NAMES=["Batalla del día","Duelo de titanes","Choque de gigantes","La gran rivalidad","Cara a cara"];
let _editingHistIdx=null; // índice del registro de historial de batallas en edición (null = ninguno)

function startBattle(slot){
  if(!isAdmin())return;
  ensureBattlesState();
  const p1=document.getElementById(`battle-slot${slot}-p1`).value;
  const p2=document.getElementById(`battle-slot${slot}-p2`).value;
  if(!p1||!p2||p1===p2){toast("Elige 2 participantes distintos",true);return;}
  const{groupMids,elimMids}=getTodaysMatchIds();
  if(groupMids.length===0&&elimMids.length===0){
    toast("No hay partidos programados para hoy",true);return;
  }
  const nameInput=document.getElementById(`battle-slot${slot}-name`);
  let name=(nameInput?.value||"").trim();
  if(!name)name=BATTLE_AUTO_NAMES[Math.floor(Math.random()*BATTLE_AUTO_NAMES.length)];
  S.battles[slot]={p1,p2,name,groupMids,elimMids,startedAt:Date.now(),closed:false};
  save();renderBattlesPanel();
  toast(`⚔️ Batalla ${slot} iniciada: ${p1} vs ${p2}`);
}

function resetBattle(slot){
  if(!isAdmin())return;
  ensureBattlesState();
  const b=S.battles[slot];
  if(b){
    const pts1=calcBattlePts(b.p1,b.groupMids,b.elimMids);
    const pts2=calcBattlePts(b.p2,b.groupMids,b.elimMids);
    let winner="Empate";
    if(pts1>pts2)winner=b.p1;else if(pts2>pts1)winner=b.p2;
    if(!S.battleHistory)S.battleHistory=[];
    S.battleHistory.unshift({
      name:b.name||"Batalla del día",
      p1:b.p1,p2:b.p2,pts1,pts2,winner,
      date:new Date().toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"})
    });
  }
  delete S.battles[slot];
  save();renderBattlesPanel();
  toast(`Batalla ${slot} terminada y guardada`);
}

function populateBattleSelects(){
  if(!isAdmin())return;
  const names=PL.slice().sort();
  [1,2].forEach(slot=>{
    [1,2].forEach(p=>{
      const sel=document.getElementById(`battle-slot${slot}-p${p}`);
      if(!sel)return;
      const current=sel.value;
      sel.innerHTML=`<option value="">— elegir —</option>`+names.map(n=>`<option value="${n}">${n}</option>`).join("");
      if(names.includes(current))sel.value=current;
    });
  });
}

function renderBattleCountdown(groupMids,elimMids,big){
  // Encuentra la hora de fin estimada del ÚLTIMO partido de hoy (inicio + ~2h como estimado)
  const times=[];
  groupMids.forEach(mid=>{if(S.matchTimes[mid])times.push(new Date(S.matchTimes[mid]).getTime());});
  elimMids.forEach(pid=>{if(S.elimTimes[pid])times.push(new Date(S.elimTimes[pid]).getTime());});
  if(!times.length)return"";
  const lastStart=Math.max(...times);
  const estEnd=lastStart+2*60*60*1000; // estimado: 2h de duración de partido
  const now=Date.now();
  const diff=estEnd-now;
  const fs=big?"13px":"10px";
  if(diff<=0)return`<span style="color:var(--qb-muted);font-size:${fs}">Esperando resultado del último partido del día…</span>`;
  const h=Math.floor(diff/3600000),mn=Math.floor((diff%3600000)/60000);
  const weight=big?"font-weight:800;color:var(--qb-text)":"color:var(--qb-muted)";
  return`<span style="font-size:${fs};${weight}">⏳ Cierra en ${h}h ${mn}m</span>`;
}

// Encabezado de sección: fecha de hoy + countdown más grande, una sola vez arriba de las cards
function renderBattlesSectionHeader(activeSlots){
  const today=new Date().toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase().replace(/\./g,"");
  // Usamos el countdown de la primera batalla activa que aún no haya cerrado, como referencia general del día
  let countdownHtml="";
  for(const s of activeSlots){
    const b=S.battles[s];
    if(!b)continue;
    const done=areTodaysMatchesDone(b.groupMids,b.elimMids);
    if(!done){countdownHtml=renderBattleCountdown(b.groupMids,b.elimMids,true);break;}
  }
  return`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:.75rem;padding-bottom:.625rem;border-bottom:1px solid var(--qb-border)">
    <span style="font-family:var(--ff-display);font-size:13px;font-weight:800;color:var(--qb-text)">📅 ${today}</span>
    ${countdownHtml||'<span style="font-size:11px;color:var(--qb-muted)">✓ Partidos del día cerrados</span>'}
  </div>`;
}

function renderOneBattle(slot){
  ensureBattlesState();
  const b=S.battles[slot];
  if(!b)return"";
  const{p1,p2,groupMids,elimMids,name}=b;
  const pts1=calcBattlePts(p1,groupMids,elimMids);
  const pts2=calcBattlePts(p2,groupMids,elimMids);
  const done=areTodaysMatchesDone(groupMids,elimMids);
  const total=pts1+pts2;
  const pct1=total>0?Math.round((pts1/total)*100):50;
  let winnerBadge="";
  if(done){
    if(pts1>pts2)winnerBadge=`<div style="text-align:center;font-size:13px;font-weight:800;color:#f5c842;margin-top:.5rem">👑 ${p1} GANA EL DUELO</div>`;
    else if(pts2>pts1)winnerBadge=`<div style="text-align:center;font-size:13px;font-weight:800;color:#f5c842;margin-top:.5rem">👑 ${p2} GANA EL DUELO</div>`;
    else winnerBadge=`<div style="text-align:center;font-size:13px;font-weight:800;color:var(--qb-muted);margin-top:.5rem">🤝 EMPATE</div>`;
  }
  const fmtPred=(p)=>p?`${p.h}-${p.a}`:"—";
  const cartelera=[
    ...groupMids.map(mid=>{
      const s=sc(mid);
      const pr1=MD[mid]?.preds?.[p1];
      const pr2=MD[mid]?.preds?.[p2];
      return{lbl:MD[mid]?.lbl||`Partido ${mid}`,played:!!s,real:s?`${s.h}-${s.a}`:null,pred1:fmtPred(pr1),pred2:fmtPred(pr2)};
    }),
    ...elimMids.map(pid=>{
      const es=S.elimScores[pid]||S.elimScores[String(pid)];
      const teams=S.elimTeams[pid]||S.elimTeams[String(pid)];
      return{lbl:`Eliminatoria #${pid}`,played:!!es,real:es?`${es.h}-${es.a}`:null,pred1:"—",pred2:"—"}; // bracket: predicción individual no aplica al marcador básico de la misma forma
    })
  ];
  const battleName=name||"Batalla del día";
  return`<div style="border:1px solid var(--qb-border);border-radius:12px;padding:.875rem;margin-bottom:.875rem;background:var(--qb-surface);${done?"border-color:rgba(245,166,35,.5)":""}">
    <div style="text-align:center;font-size:11px;font-weight:700;color:var(--qb-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">${battleName}</div>
    <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;text-align:center">
      <div>
        <div style="font-family:var(--ff-display);font-weight:800;font-size:14px;color:var(--qb-text)">${p1}</div>
        <div style="font-size:24px;font-weight:900;color:${pts1>=pts2?'#f5c842':'var(--qb-text)'}">${pts1}</div>
      </div>
      <div style="font-family:var(--ff-display);font-size:18px;font-weight:900;color:var(--qb-red)">VS</div>
      <div>
        <div style="font-family:var(--ff-display);font-weight:800;font-size:14px;color:var(--qb-text)">${p2}</div>
        <div style="font-size:24px;font-weight:900;color:${pts2>=pts1?'#f5c842':'var(--qb-text)'}">${pts2}</div>
      </div>
    </div>
    <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-top:.625rem;background:var(--qb-surface2)">
      <div style="width:${pct1}%;background:var(--qb-blue);transition:width .4s"></div>
      <div style="width:${100-pct1}%;background:var(--qb-red);transition:width .4s"></div>
    </div>
    ${winnerBadge}
    ${done?'<div style="margin-top:.625rem;text-align:center"><span style="font-size:10px;color:var(--qb-muted)">✓ Duelo cerrado</span></div>':""}
    <details style="margin-top:.5rem">
      <summary style="font-size:10px;color:var(--qb-muted);cursor:pointer">Cartelera de hoy (${cartelera.length} partido${cartelera.length===1?"":"s"})</summary>
      <div style="margin-top:.5rem;display:flex;flex-direction:column;gap:8px">
        ${cartelera.map(c=>`<div style="border-top:1px solid var(--qb-border);padding-top:6px">
          <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:var(--qb-text)">
            <span>${c.lbl}</span>
            <span>${c.played?`✓ ${c.real}`:"⏳ pendiente"}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--qb-muted);margin-top:2px">
            <span>${p1}: ${c.pred1}</span>
            <span>${p2}: ${c.pred2}</span>
          </div>
        </div>`).join("")}
      </div>
    </details>
  </div>`;
}

function renderBattlesPanel(){
  ensureBattlesState();
  populateBattleSelects();
  const body=document.getElementById("battles-body");
  if(!body)return;
  const slots=[1,2].filter(s=>S.battles[s]);
  if(!slots.length){
    body.innerHTML=`<div style="text-align:center;padding:2rem 1rem;color:var(--qb-muted);font-size:12px">
      ⚔️ No hay batallas activas hoy.${isAdmin()?" Armá una arriba.":""}
    </div>`;
    return;
  }
  body.innerHTML=renderBattlesSectionHeader(slots)+slots.map(s=>renderOneBattle(s)).join("");
}

function battlesTab(id){
  document.getElementById("battles-active-wrap").style.display=id==="active"?"block":"none";
  document.getElementById("battles-history-wrap").style.display=id==="history"?"block":"none";
  document.getElementById("btab-active").classList.toggle("on",id==="active");
  document.getElementById("btab-history").classList.toggle("on",id==="history");
  if(id==="history")renderBattleHistory();
}

function renderBattleHistory(){
  const wrap=document.getElementById("battles-history-wrap");
  if(!wrap)return;
  ensureBattlesState();
  const hist=S.battleHistory||[];
  if(!hist.length){
    wrap.innerHTML=`<div style="text-align:center;padding:2rem 1rem;color:var(--qb-muted);font-size:12px">📜 Todavía no hay batallas cerradas.</div>`;
    return;
  }
  wrap.innerHTML=hist.map((h,idx)=>{
    const isEditing=_editingHistIdx===idx;
    const winnerLine=h.winner==="Empate"
      ?`<span style="color:var(--qb-muted)">🤝 Empate</span>`
      :`<span style="color:#f5c842;font-weight:800">👑 ${h.winner}</span>`;
    // El ganador SIEMPRE se recalcula a partir del marcador editado (pts1 vs pts2),
    // así nunca puede quedar desincronizado del puntaje mostrado.
    const editControls=isEditing?`<div style="margin-top:.5rem;padding-top:.5rem;border-top:1px dashed var(--qb-border);display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap">
        <span style="font-size:10px;color:var(--qb-muted)">${h.p1}</span>
        <input type="number" id="hist-edit-pts1-${idx}" value="${h.pts1}" style="width:54px;font-size:12px;padding:4px;border-radius:6px;border:1px solid var(--qb-border2);background:var(--qb-surface2);color:var(--qb-text);text-align:center">
        <span style="font-size:10px;color:var(--qb-red);font-weight:800">VS</span>
        <input type="number" id="hist-edit-pts2-${idx}" value="${h.pts2}" style="width:54px;font-size:12px;padding:4px;border-radius:6px;border:1px solid var(--qb-border2);background:var(--qb-surface2);color:var(--qb-text);text-align:center">
        <span style="font-size:10px;color:var(--qb-muted)">${h.p2}</span>
        <button class="btn btn-sm btn-blue" onclick="saveEditBattleHistory(${idx})">Guardar</button>
        <button class="btn btn-sm" onclick="closeEditBattleHistory()">Cancelar</button>
      </div>`:"";
    const adminBtns=(isAdmin()&&!isEditing)?`<div style="margin-top:.5rem;display:flex;gap:6px;justify-content:center">
        <button class="btn btn-sm" onclick="openEditBattleHistory(${idx})">✏️ Editar marcador</button>
        <button class="btn btn-sm btn-red" onclick="deleteBattleHistory(${idx})">🗑️ Borrar</button>
      </div>`:"";
    return`<div style="border:1px solid var(--qb-border);border-radius:10px;padding:.75rem;margin-bottom:.625rem;background:var(--qb-surface)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.375rem">
        <span style="font-size:11px;font-weight:700;color:var(--qb-text)">${h.name}</span>
        <span style="font-size:10px;color:var(--qb-muted)">${h.date}</span>
      </div>
      <div style="display:flex;justify-content:center;align-items:center;gap:10px;font-size:13px;font-weight:800">
        <span>${h.p1}</span><span style="color:${h.pts1>=h.pts2?'#f5c842':'var(--qb-text)'}">${h.pts1}</span>
        <span style="color:var(--qb-red);font-size:11px">VS</span>
        <span style="color:${h.pts2>=h.pts1?'#f5c842':'var(--qb-text)'}">${h.pts2}</span><span>${h.p2}</span>
      </div>
      <div style="text-align:center;margin-top:.375rem;font-size:11px">${winnerLine}</div>
      ${editControls}
      ${adminBtns}
    </div>`;
  }).join("");
}

// Abre el formulario inline para corregir el marcador de un duelo ya cerrado
function openEditBattleHistory(idx){
  if(!isAdmin())return;
  _editingHistIdx=idx;
  renderBattleHistory();
}
function closeEditBattleHistory(){
  _editingHistIdx=null;
  renderBattleHistory();
}
// Guarda el marcador corregido y recalcula el ganador a partir de él
// (el ganador nunca se edita por separado, para que no pueda quedar
// desincronizado del marcador, como pasaba antes).
function saveEditBattleHistory(idx){
  if(!isAdmin())return;
  const i1=document.getElementById(`hist-edit-pts1-${idx}`);
  const i2=document.getElementById(`hist-edit-pts2-${idx}`);
  if(!i1||!i2||!S.battleHistory||!S.battleHistory[idx])return;
  const p1pts=parseInt(i1.value);const p2pts=parseInt(i2.value);
  if(isNaN(p1pts)||isNaN(p2pts)){toast("Ingresa números válidos",true);return;}
  const h=S.battleHistory[idx];
  h.pts1=p1pts;h.pts2=p2pts;
  h.winner=p1pts>p2pts?h.p1:(p2pts>p1pts?h.p2:"Empate");
  _editingHistIdx=null;
  save();renderBattleHistory();
  toast("✓ Marcador actualizado");
}
// Borra un registro del historial de batallas (ej. duelos de prueba)
function deleteBattleHistory(idx){
  if(!isAdmin())return;
  if(!S.battleHistory||!S.battleHistory[idx])return;
  if(!confirm("¿Borrar esta batalla del historial? Esta acción no se puede deshacer."))return;
  S.battleHistory.splice(idx,1);
  if(_editingHistIdx===idx)_editingHistIdx=null;
  save();renderBattleHistory();
  toast("🗑️ Batalla eliminada del historial");
}

// Banner compacto para mostrar debajo de la tabla de Ranking
function renderBattlesBanner(){
  ensureBattlesState();
  const el=document.getElementById("battles-banner");
  if(!el)return;
  const slots=[1,2].filter(s=>S.battles[s]);
  if(!slots.length){el.innerHTML="";return;}
  el.innerHTML=`<div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--qb-border)">
    <div style="font-family:var(--ff-display);font-size:11px;font-weight:700;color:var(--qb-text);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem;cursor:pointer;text-align:center" onclick="tab('battles')">⚔️ Batalla del día — ver más</div>
    ${slots.map(s=>{
      const b=S.battles[s];
      const pts1=calcBattlePts(b.p1,b.groupMids,b.elimMids);
      const pts2=calcBattlePts(b.p2,b.groupMids,b.elimMids);
      return`<div style="display:flex;align-items:center;justify-content:center;gap:10px;font-size:11px;padding:.375rem 0;cursor:pointer" onclick="tab('battles')">
        <span style="font-weight:700">${b.p1}</span><span style="font-weight:900;color:${pts1>=pts2?'#f5c842':'var(--qb-text)'}">${pts1}</span>
        <span style="color:var(--qb-red);font-weight:800">VS</span>
        <span style="font-weight:900;color:${pts2>=pts1?'#f5c842':'var(--qb-text)'}">${pts2}</span><span style="font-weight:700">${b.p2}</span>
      </div>`;
    }).join("")}
  </div>`;
}

// Verificar si una fase está completa (todos sus partidos tienen resultado)

// Calcular puntos totales al corte de foto para último lugar
// = básicos + avanzados + calcElimPts (que YA incluye partido+llave+clasificados
//   de la fase que se está cerrando ahora, porque se fueron sumando en vivo)
// + bonos de último lugar de fases previas
// La fase SIGUIENTE sigue bloqueada: closed[phaseKey] todavía no se marca acá,
// así que isPrevPhaseClosed() de la siguiente fase da false y no se filtra nada
// de esa fase futura. El bono de último lugar siempre se calcula y otorga
// ANTES de desbloquear los puntos de la fase siguiente (ver closePhase).

// Calcular clasificados: cuántos equipos predichos por 'name' avanzaron realmente
// Para clasificados a Octavos: los ganadores reales de Dieciseisavos (P73-P88)
//   son los equipos que realmente pasaron. El participante gana 3pts por cada uno que predijo avanzaría.
// La predicción del participante = el ganador que predijo en ese partido

// Calcular puntos de llaves para una fase: 2pts por llave donde ambos equipos coinciden

// ── CIERRE MANUAL DE FASE — sin modal, directo ──

// Legacy aliases (keep for any remaining refs)

// checkAndAwardBonos: delegates to auto-close if enabled

// Reapertura manual de una fase (para el panel de integridad / admin)
function toggleAutoClose(){
  S.autoClose=!S.autoClose;
  save();
  renderBonosPanel();
  // If just enabled, try to auto-close any completed phases
  if(S.autoClose) autoCloseCompletedPhases();
  toast(S.autoClose?"✓ Cierre automático activado":"Cierre automático desactivado");
}

// Auto-close: closes all complete, unclosed phases without confirmation (for auto mode)

// Forzar revisión manual (botón en panel de bonos)

// Render del panel de bonos
function renderBonosPanel(){
  const el=document.getElementById("bonos-body");if(!el)return;
  // Update toggle button + description
  const btn=document.getElementById("auto-close-btn");
  const desc=document.getElementById("bonos-mode-desc");
  if(btn){
    btn.textContent=S.autoClose?"🤖 Automático":"👤 Manual";
    btn.className=S.autoClose?"btn btn-sm btn-green":"btn btn-sm btn-blue";
  }
  if(desc){
    desc.innerHTML=S.autoClose
      ?"<strong>Modo automático:</strong> Las fases se cierran solas al completarse. El último lugar se adjudica sin confirmación."
      :"<strong>Modo manual:</strong> Cuando todos los resultados estén listos, presiona 🔒 Cerrar fase.";
  }
  let html="";

  getActivePhases().forEach(phase=>{
    const closed=!!S.bonos.closed?.[phase.key];
    const complete=isPhaseComplete(phase);
    const prevClosed=isPrevPhaseClosed(phase);
    const playedCount=phase.mids.filter(id=>phase.elimPhase
      ?!!(S.elimScores[id]||S.elimScores[String(id)])
      :!!(S.scores[id]||S.scores[String(id)])).length;

    // Status badge
    let statusBadge;
    if(closed){
      statusBadge=`<span class="sbadge ok">✓ Cerrada</span>`;
    }else if(!prevClosed){
      const prev=getPhaseByKey(phase.prevPhase);
      statusBadge=`<span class="sbadge info" style="color:var(--qb-muted)">🔒 Requiere cerrar ${prev?.label||""}</span>`;
    }else if(complete){
      statusBadge=`<span class="sbadge warn">⚠ Lista para cerrar</span>`;
    }else{
      statusBadge=`<span class="sbadge info">⏳ ${playedCount}/${phase.mids.length} partidos</span>`;
    }

    // Action button
    let actionBtn="";
    if(closed){
      actionBtn=`<button class="btn btn-red btn-sm" onclick="reopenPhase('${phase.key}')">↺ Reabrir</button>`;
    }else if(complete&&prevClosed){
      actionBtn=`<button class="btn btn-sm btn-blue" onclick="closePhase('${phase.key}')">🔒 Cerrar fase</button>`;
    }

    const ptsOn=isFaseLastPtsActiva(phase); // v1.2 (fase 2)
    html+=`<div style="border:1px solid ${closed?"rgba(0,200,83,.3)":complete&&prevClosed?"rgba(20,120,200,.3)":"var(--qb-border)"};border-radius:10px;padding:.75rem;margin-bottom:.5rem;background:var(--qb-surface)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <span style="font-family:var(--ff-display);font-size:13px;font-weight:700;color:var(--qb-text)">${phase.label}</span>
          <span style="font-size:10px;color:var(--qb-muted);margin-left:6px">${playedCount}/${phase.mids.length}</span>
          ${!ptsOn?`<span style="font-size:9px;color:var(--qb-muted);margin-left:4px">· 🔒 puntos desactivados</span>`:getFaseValor(phase,'lastPts')>0?`<span style="font-size:9px;color:var(--qb-muted);margin-left:4px">· 🚑 ${getFaseValor(phase,'lastPts')}pts último</span>`:""}
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          ${statusBadge}
          ${actionBtn}
        </div>
      </div>
      ${closed&&S.bonos.lastPlace?.[phase.key]?`
        <div style="margin-top:6px;padding:5px 9px;background:rgba(245,166,35,.1);border-radius:6px;border:1px solid rgba(245,166,35,.25);font-size:11px;color:var(--qb-yellow)">
          🚑 Último lugar: <strong>${S.bonos.lastPlace[phase.key].name}</strong>
          <span style="color:var(--qb-muted)">(${S.bonos.lastPlace[phase.key].total}pts al corte)</span>
          → +${S.bonos.lastPlace[phase.key].pts}pts
        </div>`:""}
      ${ptsOn&&prevClosed&&getFaseValor(phase,'classifiedPts')>0?`
        <div style="margin-top:4px;font-size:10px;color:var(--qb-muted)">
          ⭐ Clasificados (+${getFaseValor(phase,'classifiedPts')}pts): en vivo, activos en columna Elim
        </div>`:""}
      ${ptsOn&&prevClosed&&getFaseValor(phase,'llavePts')>0?`
        <div style="font-size:10px;color:var(--qb-muted)">
          🔑 Llaves (+${getFaseValor(phase,'llavePts')}pts): en vivo, activas en columna Elim
        </div>`:""}
    </div>`;
  });

  // Tabla resumen — solo último lugar
  const bonoPts=PL.map(name=>{
    let last=0;
    Object.values(S.bonos.lastPlace||{}).forEach(lp=>{if(lp&&lp.name===name)last+=lp.pts;});
    return{name,last};
  }).filter(x=>x.last>0).sort((a,b)=>b.last-a.last);

  if(bonoPts.length){
    html+=`<div style="margin-top:.875rem">
      <div class="sec" style="margin-bottom:.5rem">🚑 Bonos de último lugar por participante</div>
      <table class="rt"><thead><tr><th>Participante</th><th style="text-align:right">Bono acumulado</th></tr></thead><tbody>`;
    bonoPts.forEach(p=>{
      const m=PM[p.name]||{};
      html+=`<tr>
        <td><div class="pn">${flagEmoji(m.champFlag,14)} ${p.name}</div></td>
        <td style="text-align:right"><span style="font-family:var(--ff-display);font-size:18px;font-weight:800;color:var(--qb-yellow)">+${p.last}</span></td>
      </tr>`;
    });
    html+=`</tbody></table></div>`;
  }else{
    html+=`<div class="ib" style="margin-top:.5rem">Sin bonos adjudicados aún. El botón 🔒 Cerrar fase aparece cuando todos los resultados de esa fase estén completos y la fase previa esté cerrada.</div>`;
  }

  el.innerHTML=html;
}

// ══════════════════════════════════════════════════════════════
