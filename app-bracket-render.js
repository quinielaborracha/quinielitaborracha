/* ════════════════════════════════════════════════════════════
   app-bracket-render.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Render del fixture de eliminatoria con inputs, editor manual de llaves (1/16) y carga de simulación.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): RENDER ELIMINATORIA; EDITOR DE LLAVES (1/16); SIMULACIÓN

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

// RENDER ELIMINATORIA (fixture con inputs)
// ══════════════════════════════════════════════════════════════
function setES(html){const el=document.getElementById("elim-st");if(el)el.innerHTML=html;}

function renderElim(){
  // v1.2 — antes esto era ELIM_1_16_IDS fijo (Dieciseisavos). Con
  // getManualTeamPids() se generaliza solo: si todas las fases están
  // activas es exactamente lo mismo de siempre; si Dieciseisavos (y/o
  // Grupos) están desactivados, esto pasa a ser la primera fase activa
  // (ej. Octavos), que es la que necesita carga manual/ESPN de equipos.
  const manualPids=getManualTeamPids();
  const manualPhase=getFirstActiveElimPhase();
  const manualPhaseLabel=manualPhase?manualPhase.label:"Dieciseisavos";
  const teamsLoaded=manualPids.every(pid=>{const t=S.elimTeams[pid];return t&&t.h&&t.a;});
  let html="";
  if(!teamsLoaded){
    const loaded=manualPids.filter(pid=>{const t=S.elimTeams[pid];return t&&t.h&&t.a;}).length;
    html+=`<div class="ib warn" style="margin-bottom:.75rem">⚠️ <strong>Equipos de ${manualPhaseLabel} no cargados</strong> (${loaded}/${manualPids.length}). Usa <strong>✏️ Editar llaves</strong> para ingresar los partidos manualmente, o <strong>🎲 Simular</strong> para cargar países random y probar el sistema. ${manualPhase&&manualPhase.key==="r16"?"Cuando termine la fase de grupos, ":""}<strong>⚡ ESPN Live</strong> los cargará automáticamente.</div>`;
  }
  getActiveElimRounds().forEach((round,ri)=>{
    // Check if this round is blocked (prev bonos phase not closed) — una
    // fase previa DESACTIVADA ya no bloquea (ver isPrevPhaseClosed).
    const roundPhase=BONUS_PHASES.find(bp=>bp.elimPhase&&bp.mids.includes(round.ids[0]));
    const roundBlocked=roundPhase&&!isPrevPhaseClosed(roundPhase);
    const prevPhaseName=roundBlocked?(getPhaseByKey(roundPhase.prevPhase)?.label||"fase anterior"):"";

    html+=`<div class="rnd-hdr"><span>${round.lbl}</span>`;
    const llavesOk=round.ids.filter(pid=>getRealElimTeams(pid)).length;
    if(llavesOk<round.ids.length)html+=`<span style="font-size:9px;color:var(--qb-muted);margin-left:4px">${llavesOk}/${round.ids.length} llaves</span>`;
    if(roundBlocked)html+=`<span style="font-size:9px;font-weight:700;color:var(--qb-red);margin-left:6px">🔒 BLOQUEADA</span>`;
    html+=`</div>`;
    if(roundBlocked){
      html+=`<div style="margin-bottom:.625rem;padding:8px 12px;background:rgba(212,0,26,.06);border:1px solid rgba(212,0,26,.25);border-radius:8px;display:flex;align-items:center;gap:8px">
        <span style="font-size:18px;flex-shrink:0">🔒</span>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--qb-red)">Fase bloqueada — no se pueden ingresar resultados</div>
          <div style="font-size:10px;color:var(--qb-muted);margin-top:2px">Cierra <strong style="color:var(--qb-text)">${prevPhaseName}</strong> en el panel de 🎁 Bonos primero. Esto garantiza que el bono de último lugar se adjudique antes de activar los puntos de esta fase.</div>
        </div>
      </div>`;
    }
    round.ids.forEach(pid=>{
      const sc=S.elimScores[pid];
      const played=!!sc;
      const live=sc?.live;
      const teams=getRealElimTeams(pid);
      const is116=manualPids.includes(pid);
      const teamData=S.elimTeams[pid]||{};

      // Nombre de equipos: si están cargados los mostramos, si no un placeholder
      let hN,aN;
      if(teams){hN=teams.h;aN=teams.a;}
      else if(is116){hN=teamData.h||"— Local —";aN=teamData.a||"— Visita —";}
      else{hN="⏳ Por definir";aN="⏳ Por definir";}

      const teamsReady=!!teams;
      const inpS="width:30px;text-align:center;font-size:13px;font-weight:700;padding:2px 3px;border-radius:4px;background:var(--qb-surface2);color:var(--qb-text);border:1px solid "+(played?(live?"var(--qb-red)":"var(--qb-green)"):"var(--qb-border2)");
      const rowCls=live?"elim-row live-border":played?"elim-row unlocked":"elim-row";
      const scoreInputs=teamsReady
        ?`<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${sc?sc.h:""}" placeholder="-" onchange="onESC(${pid},'h',this.value)" style="${inpS}">
           <span style="font-size:11px;color:var(--qb-muted)">:</span>
           <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${sc?sc.a:""}" placeholder="-" onchange="onESC(${pid},'a',this.value)" style="${inpS}">`
        :`<span style="font-size:10px;color:var(--qb-muted);padding:0 6px">sin llave</span>`;
      const et=S.elimTimes[pid];
      let elimTimeStr="";
      if(et){
        const d=new Date(et);
        const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
        elimTimeStr=d.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit",timeZone:tz})+" · "+d.toLocaleDateString("es",{weekday:"short",day:"numeric",month:"short",timeZone:tz});
      }
      // Tie-breaker UI: show when score is draw and teams are known
      const isDraw=sc&&sc.h===sc.a;
      const tb=S.tieBreakers[pid]; // "h" | "a" | undefined
      let tieHtml="";
      if(isDraw&&teamsReady){
        tieHtml=`<div style="display:flex;align-items:center;gap:4px;margin-top:3px;padding:3px 6px;background:var(--qb-surface3);border-radius:6px;border:1px solid var(--qb-border2)">
          <span style="font-size:9px;color:var(--qb-muted);white-space:nowrap">Penales:</span>
          <button onclick="setTB(${pid},'h')" style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;border:1px solid ${tb==='h'?'var(--qb-green)':'var(--qb-border2)'};background:${tb==='h'?'var(--qb-green-dim)':'var(--qb-surface2)'};color:${tb==='h'?'#4dde8c':'var(--qb-text)'};cursor:pointer">${hN.split(" ")[0]}</button>
          <button onclick="setTB(${pid},'a')" style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;border:1px solid ${tb==='a'?'var(--qb-green)':'var(--qb-border2)'};background:${tb==='a'?'var(--qb-green-dim)':'var(--qb-surface2)'};color:${tb==='a'?'#4dde8c':'var(--qb-text)'};cursor:pointer">${aN.split(" ")[0]}</button>
        </div>`;
      }
      // Llave pts preview
      const llavePrev=teamsReady?PL.filter(nm=>isLlaveCorrecta(nm,pid)).length:0;
      const llaveTag=teamsReady?`<span style="font-size:8px;color:var(--qb-blue);margin-top:1px">🔑 ${llavePrev}/27</span>`:"";
      html+=`<div class="${rowCls}" style="${!teamsReady?"opacity:.55":""}">
        <div class="th"><span class="tn">${hN}</span></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <div style="display:flex;align-items:center;gap:3px">${scoreInputs}</div>
          <div class="sd">${live?`<span class="ldot"></span><span style="font-size:9px;color:#ef4444;font-weight:500">EN VIVO</span>`:`<span class="dot ${played?"on":""}"></span><span>P${pid}</span>`}</div>
          ${tieHtml}
          ${llaveTag}
          ${elimTimeStr?`<div style="font-size:8px;color:var(--qb-muted);text-align:center;white-space:nowrap">⏰ ${elimTimeStr}</div>`:""}
        </div>
        <div style="display:flex;align-items:center;gap:4px"><span class="tn">${aN}</span></div>
      </div>`;
    });
  });
  document.getElementById("elim-body").innerHTML=html;
}

const _epb={};
// Check if the phase containing this pid is allowed to receive results
// Rule: previous phase must be closed in bonos before entering results
function canEnterElimResult(pid){
  const phase=phaseForPid(pid);
  if(!phase)return{ok:true}; // unknown phase, allow
  if(isPrevPhaseClosed(phase))return{ok:true};
  const prev=getPhaseByKey(phase.prevPhase);
  return{ok:false,msg:`Debes cerrar la fase de <strong>${prev?.label||phase.prevPhase}</strong> en el panel de Bonos antes de ingresar resultados de ${phase.label}.`};
}

function onESC(pid,side,val){
  // Block if previous bonos phase not closed
  const check=canEnterElimResult(pid);
  if(!check.ok){
    toast(`🔒 ${check.msg.replace(/<[^>]+>/g,"")}`,true);
    // Reset the input visually
    renderElim();
    return;
  }
  if(!_epb[pid])_epb[pid]={};
  _epb[pid][side]=val===""?null:parseInt(val);
  const cur=S.elimScores[pid]||{};
  const h=_epb[pid].h!==undefined?_epb[pid].h:(cur.h??null);
  const a=_epb[pid].a!==undefined?_epb[pid].a:(cur.a??null);
  if(h!==null&&a!==null&&!isNaN(h)&&!isNaN(a)){
    S.elimScores[pid]={h,a,live:cur.live||false};
    save();renderElim();renderRank();autoFillRealityFromElim();toast("✓ Guardado");
  } else if(val===""){
    delete S.elimScores[pid];delete _epb[pid];save();renderElim();renderRank();
  }
}

function setTB(pid,side){
  if(!S.tieBreakers)S.tieBreakers={};
  if(S.tieBreakers[pid]===side){delete S.tieBreakers[pid];}
  else{S.tieBreakers[pid]=side;}
  save();renderElim();renderRank();
}

function resetElim(){
  if(!confirm("¿Borrar todos los resultados Y equipos de eliminatoria?"))return;
  S.elimScores={};S.elimTeams={};save();renderElim();renderRank();toast("✓ Borrado");
}

// ══════════════════════════════════════════════════════════════
// EDITOR DE LLAVES (1/16) — manual
// ══════════════════════════════════════════════════════════════
function openTeamsEditor(){
  // v1.2 — antes ELIM_1_16_IDS fijo (Dieciseisavos). Ahora edita los pids
  // de la PRIMERA fase de eliminatoria activa (getManualTeamPids()) — si
  // todas las fases están activas, es exactamente Dieciseisavos de
  // siempre; si Dieciseisavos/Grupos están desactivados, edita la fase
  // por la que el torneo realmente arranca (ej. Octavos).
  const manualPids=getManualTeamPids();
  const phaseLabel=getFirstActiveElimPhase()?.label||"Dieciseisavos";
  const rows=manualPids.map(pid=>{
    const t=S.elimTeams[pid]||{};
    return`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-family:var(--ff-display);font-size:10px;font-weight:700;color:var(--qb-muted);min-width:30px">P${pid}</span>
      <input type="text" id="th${pid}" value="${t.h||""}" placeholder="Local" style="flex:1;font-size:11px">
      <span style="font-size:11px;color:var(--qb-muted)">vs</span>
      <input type="text" id="ta${pid}" value="${t.a||""}" placeholder="Visitante" style="flex:1;font-size:11px">
    </div>`;
  }).join("");
  document.getElementById("teams-editor-body").innerHTML=`<div style="margin-bottom:.5rem;font-size:11px;color:var(--qb-muted)">Equipos de <strong>${phaseLabel}</strong>. Ingresa el nombre exacto de los países (tal como aparecen en el bracket de los participantes).</div>${rows}`;
  document.getElementById("teams-modal").style.display="flex";
}

function closeTeamsEditor(){document.getElementById("teams-modal").style.display="none";}

function saveTeamsEditor(){
  let saved=0;
  getManualTeamPids().forEach(pid=>{
    const h=(document.getElementById("th"+pid)?.value||"").trim();
    const a=(document.getElementById("ta"+pid)?.value||"").trim();
    if(h&&a){S.elimTeams[pid]={h,a};saved++;}
    else if(!h&&!a){delete S.elimTeams[pid];}
  });
  save();closeTeamsEditor();renderElim();renderBracket();renderRank();
  toast(`✓ ${saved} llaves guardadas`);
}

// ══════════════════════════════════════════════════════════════
// SIMULACIÓN — carga países random para probar
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
