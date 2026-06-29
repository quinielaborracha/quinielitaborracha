/* ════════════════════════════════════════════════════════════
   app-bracket-view.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Render del bracket completo, vista por participante.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): RENDER BRACKET — vista por participante

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

// RENDER BRACKET — vista por participante
// ══════════════════════════════════════════════════════════════
// Get set of real teams that advanced FROM a given phase (winners of that phase's matches)

// For a given pid, what classified pts does predicting its winner earn?
// The classified pts come from the phase that CONTAINS this pid
// Example: pid 73 is in r16 phase → winner classified to Octavos → 3pts

function renderBracket(){
  const pidx=window._selB||0;window._selB=pidx;
  const sel=`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:.75rem">${PL.map((name,i)=>{const m=PM[name]||{};return`<button onclick="window._selB=${i};renderBracket()" class="btn btn-sm ${i===pidx?"btn-blue":""}">${flagEmoji(m.champFlag,13)} ${sn(name)}</button>`;}).join("")}</div>`;
  document.getElementById("bsel").innerHTML=sel;
  const name=PL[pidx];if(!name){document.getElementById("bracket-body").innerHTML="";return;}

  // Resumen de puntos y llaves
  let llaveOk=0,llaveTot=0,totalPts=0,partJugados=0,cruceOk=0;
  for(let pid=73;pid<=104;pid++){
    const phase=phaseForPid(pid);if(phase&&!isFaseActiva(phase.key))continue; // v1.2
    const sc=S.elimScores[pid];if(!sc)continue;
    partJugados++;llaveTot++;
    if(isLlaveCorrecta(name,pid))llaveOk++;
    else if(findCruceValido(name,pid))cruceOk++;
    totalPts+=calcElimMatchPts(name,pid);
  }
  const advPts=calcAdv(name);
  const llavePtsTotal=(llaveOk+cruceOk)*2;
  const activeElimMidsTotal=getActivePhases().filter(p=>p.elimPhase).reduce((s,p)=>s+p.mids.length,0);

  // Classified pts for this participant
  let classifiedTotal=0;
  getActivePhases().forEach(ph=>{if(ph.elimPhase)classifiedTotal+=calcClassifiedPtsForPhase(name,ph);});
  let html=`<div class="brkt-summary">
    <div class="bsum-item"><div class="bsum-val">${totalPts}</div><div class="bsum-lbl">pts resultado</div></div>
    <div class="bsum-item"><div class="bsum-val" style="color:#6ab8f7">${llavePtsTotal}</div><div class="bsum-lbl">pts llaves</div></div>
    <div class="bsum-item"><div class="bsum-val" style="color:#4dde8c">${classifiedTotal}</div><div class="bsum-lbl">pts clasif.</div></div>
    <div class="bsum-item"><div class="bsum-val">${llaveOk}/${llaveTot}${cruceOk?` <span style="color:#6ab8f7;font-size:10px">(+${cruceOk} 🔀)</span>`:""}</div><div class="bsum-lbl">llaves ✓</div></div>
    <div class="bsum-item"><div class="bsum-val">${partJugados}/${activeElimMidsTotal}</div><div class="bsum-lbl">jugados</div></div>
  </div>`;

  // Leyenda
  html+=`<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:10px;color:var(--qb-muted);margin-bottom:.625rem;padding:5px 9px;background:var(--qb-surface);border:1px solid var(--qb-border);border-radius:6px">
    <span><span style="display:inline-block;width:10px;height:10px;background:rgba(0,200,83,.1);border:1px solid rgba(0,200,83,.4);border-radius:2px;margin-right:3px"></span>Llave + resultado ✓</span>
    <span><span style="display:inline-block;width:10px;height:10px;background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.4);border-radius:2px;margin-right:3px"></span>Llave ✓ resultado ✗</span>
    <span><span style="display:inline-block;width:10px;height:10px;background:rgba(106,184,247,.1);border:1px solid rgba(106,184,247,.4);border-radius:2px;margin-right:3px"></span>🔀 Cruce válido (mismo cruce, otra llave de la ronda)</span>
    <span><span style="display:inline-block;width:10px;height:10px;background:rgba(212,0,26,.1);border:1px solid rgba(212,0,26,.4);border-radius:2px;margin-right:3px"></span>Llave ✗</span>
    <span>⭐ = puntos de clasificado (en vivo, al cerrar la fase previa)</span>
  </div>`;

  getActiveElimRounds().forEach(round=>{
    html+=`<div class="brkt-round"><div class="brkt-round-title">${round.lbl}</div>`;
    round.ids.forEach(pid=>{
      // PREDICCIÓN del participante — siempre lo que ÉL puso
      const predTeams=getElimTeams(name,pid);   // equipos que el participante predijo
      const predScore=elimPred(name,pid);        // marcador que predijo

      // REALIDAD — lo que ocurrió realmente
      const realTeams=getRealElimTeams(pid);     // equipos reales del torneo
      const sc=S.elimScores[pid];                // resultado real

      const played=!!sc;
      const llave=isLlaveCorrecta(name,pid);
      const pts=calcElimMatchPts(name,pid);
      const cruce=!llave?findCruceValido(name,pid):null;
      const breakdown=calcElimMatchBreakdown(name,pid);

      // Equipos predichos (siempre se muestran)
      const pH=predTeams?predTeams.h:"⏳ Por resolver";
      const pA=predTeams?predTeams.a:"⏳ Por resolver";
      const pScoreStr=predScore?`${predScore.h}–${predScore.a}`:"?–?";

      // Equipos reales (solo si están cargados)
      const rH=realTeams?realTeams.h:null;
      const rA=realTeams?realTeams.a:null;
      const rScoreStr=sc?`${sc.h}–${sc.a}`:null;

      // Color de fondo según resultado
      let rowBg,borderCol;
      if(!played){
        rowBg="var(--qb-surface)";borderCol="var(--qb-border)";
      } else if(llave && pts>0){
        rowBg="rgba(0,200,83,.07)";borderCol="rgba(0,200,83,.4)";      // verde
      } else if(llave && pts===0){
        rowBg="rgba(245,166,35,.07)";borderCol="rgba(245,166,35,.4)";  // amarillo
      } else if(cruce && pts>0){
        rowBg="rgba(106,184,247,.08)";borderCol="rgba(106,184,247,.45)"; // azul = cruce válido
      } else {
        rowBg="rgba(212,0,26,.07)";borderCol="rgba(212,0,26,.4)";      // rojo
      }

      // Badge de estado
      let badge;
      if(!played && !realTeams){
        badge=`<span style="font-size:9px;color:var(--qb-muted)">⏳</span>`;
      } else if(!played && realTeams){
        badge=`<span style="font-size:9px;color:var(--qb-yellow)">📅 sin result.</span>`;
      } else if(cruce){
        const tip=`Cruce válido: ${pH} vs ${pA} se enfrentaron realmente en P${cruce.pidReal} (misma ronda). Se reconoce el acierto aunque no quedó en tu llave exacta.`.replace(/"/g,"&quot;");
        badge=`<span title="${tip}" style="font-size:9px;color:#6ab8f7;font-weight:700;cursor:help">🔀 Cruce ${pts>0?`+${pts}pts`:""}</span>`;
      } else if(!llave){
        badge=`<span style="font-size:9px;color:#ff8080;font-weight:600">✗ llave</span>`;
      } else if(pts>0){
        badge=`<span style="font-size:9px;color:#4dde8c;font-weight:700">+${pts}pts</span>`;
      } else {
        badge=`<span style="font-size:9px;color:var(--qb-yellow);font-weight:600">llave ✓</span>`;
      }

      // Bloque de comparación de equipos reales (si difieren de la predicción)
      let realBlock="";
      if(realTeams && (!predTeams || n(predTeams.h)!==n(realTeams.h) || n(predTeams.a)!==n(realTeams.a))){
        realBlock=`<div style="font-size:9px;color:var(--qb-muted);margin-top:2px;padding-top:2px;border-top:1px dashed var(--qb-border)">
          Real: <span style="color:var(--qb-text)">${rH}</span> vs <span style="color:var(--qb-text)">${rA}</span>
          ${rScoreStr?`· <strong style="color:var(--qb-text)">${rScoreStr}</strong>`:""}
        </div>`;
      } else if(realTeams && rScoreStr){
        realBlock=`<div style="font-size:9px;color:var(--qb-muted);margin-top:2px">Resultado real: <strong style="color:var(--qb-text)">${rScoreStr}</strong></div>`;
      }

      // Desglose de puntos: "2pts Llave + 2pts Ganador = +4pts" — usa
      // calcElimMatchBreakdown() como única fuente de verdad (mismos
      // items que suman el total ya mostrado en el badge).
      let breakdownBlock="";
      if(breakdown.length){
        const parts=breakdown.map(it=>`${it.pts}pts ${it.label}`).join(" + ");
        breakdownBlock=`<div style="font-size:9px;color:var(--qb-muted2);margin-top:2px">${parts} = <strong style="color:var(--qb-text)">+${pts}pts</strong></div>`;
      }

      // Option B: classified pts inline — predicted winner + did they advance?
      const clsBadge=getClassifiedBadgeForPid(name,pid);
      let clsBlock="";
      if(clsBadge){
        const nextRoundName={
          "r16":"Octavos","r8":"Cuartos","qf":"Semifinales","sf":"Final","final":"Campeón","third":"3er lugar"
        }[phaseForPid(pid)?.key]||"siguiente ronda";
        if(clsBadge.advanced){
          clsBlock=`<div style="display:flex;align-items:center;gap:5px;margin-top:5px;padding:4px 7px;background:rgba(0,200,83,.08);border:1px solid rgba(0,200,83,.3);border-radius:6px">
            <span style="font-size:13px">${clsBadge.flag}</span>
            <div style="flex:1;min-width:0">
              <span style="font-size:10px;font-weight:700;color:var(--qb-text)">${clsBadge.team}</span>
              <span style="font-size:9px;color:#4dde8c;margin-left:3px">clasificó a ${nextRoundName} ✓</span>
            </div>
            <span style="font-size:11px;font-weight:800;color:#4dde8c;white-space:nowrap">+${clsBadge.pts}pts</span>
          </div>`;
        }else{
          clsBlock=`<div style="display:flex;align-items:center;gap:5px;margin-top:5px;padding:4px 7px;background:rgba(212,0,26,.06);border:1px solid rgba(212,0,26,.2);border-radius:6px">
            <span style="font-size:13px">${clsBadge.flag}</span>
            <div style="flex:1;min-width:0">
              <span style="font-size:10px;font-weight:700;color:var(--qb-text)">${clsBadge.team}</span>
              <span style="font-size:9px;color:#ff8080;margin-left:3px">no clasificó ✗</span>
            </div>
            <span style="font-size:11px;font-weight:800;color:#ff8080;white-space:nowrap">0pts</span>
          </div>`;
        }
      }

      html+=`<div style="display:grid;grid-template-columns:1fr auto;align-items:start;gap:6px;padding:7px 9px;border:1px solid ${borderCol};border-radius:8px;margin-bottom:5px;background:${rowBg}">
        <div>
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:1px">
            <span style="font-size:11px;font-weight:600;color:var(--qb-text)">${pH}</span>
            <span style="font-size:10px;color:var(--qb-muted)">vs</span>
            <span style="font-size:11px;font-weight:600;color:var(--qb-text)">${pA}</span>
          </div>
          <div style="font-size:10px;color:var(--qb-muted)">Predicción: <strong style="color:var(--qb-muted2)">${pScoreStr}</strong> · P${pid}</div>
          ${realBlock}
          ${breakdownBlock}
          ${clsBlock}
        </div>
        <div style="font-size:10px;color:var(--qb-muted);text-align:center;padding-top:2px">${badge}</div>
      </div>`;
    });
    html+="</div>";
  });

  document.getElementById("bracket-body").innerHTML=html;
}

function toggleHideParticipant(name){
  if(!S.hiddenPL)S.hiddenPL=new Set();
  if(!(S.hiddenPL instanceof Set))S.hiddenPL=new Set(Object.keys(S.hiddenPL).filter(k=>S.hiddenPL[k]));
  if(S.hiddenPL.has(name))S.hiddenPL.delete(name);
  else S.hiddenPL.add(name);
  save();renderRank();
}

// Posiciones previas para animar reordenamientos del ranking
const _prevRankPos={};

function renderRank(){
  // Revisar si hay fases nuevas cerradas antes de renderizar
  checkAndAwardBonos();
  const ranked=getRank();
  const played=Object.keys(S.scores).length;
  const elimPlayed=Object.keys(S.elimScores).length;
  document.getElementById("hstat").textContent=`${PL.length} participantes · ${played}/72 grupos · ${elimPlayed}/32 elim`;
  const masterBadge=document.getElementById("hdr-master-badge");
  if(masterBadge)masterBadge.textContent=`📂 Mi Quiniela · ${PL.length} participantes`;
  const rki=["🥇","🥈","🥉"];
  const tbody=document.getElementById("rb");

  // Snapshot de posiciones ANTES del redibujado (para saber qué filas subieron/bajaron)
  const prevPos={};
  Array.from(tbody.querySelectorAll("tr[data-rkey]")).forEach((tr,i)=>{
    prevPos[tr.dataset.rkey]=i;
  });

  tbody.innerHTML=ranked.map((p,i)=>{
    const rk=i<3?`<span style="font-size:20px">${rki[i]}</span>`:i===9?`<span style="font-size:20px">⚽</span>`:i===25?`<span style="font-size:20px">🚑</span>`:i===26?`<span style="font-size:20px">👸</span>`:`<span class="rk">${i+1}</span>`;
    const lnk=p.link?`<a href="${p.link}" target="_blank" class="lk">🔗</a>`:"—";
    const bonBadge=p.bon>0
      ?`<span class="pill" style="background:rgba(245,166,35,.15);color:#f5c842;border:1px solid rgba(245,166,35,.4)">${p.bon}</span>`
      :`<span style="color:var(--qb-muted);font-size:11px">—</span>`;
    const mv=getMovement(p.name,i+1);
    const admin=isAdmin();
    // Hidden participants show with reduced opacity in admin mode, hidden in spectator
    if(p.hidden&&!admin)return"";
    const hiddenStyle=p.hidden?"opacity:.4;":"";
    const adminActions=admin?`<td data-label="Hoja" style="display:flex;gap:3px;align-items:center">
      ${lnk}
      <button onclick="openEditParticipant('${p.name.replace(/'/g,"\'")}')" title="Editar" style="padding:2px 5px;font-size:10px;border:1px solid var(--qb-border2);border-radius:4px;background:var(--qb-surface2);color:var(--qb-muted);cursor:pointer">✏️</button>
      <button onclick="toggleHideParticipant('${p.name.replace(/'/g,"\'")}')" title="${p.hidden?"Mostrar":"Ocultar"}" style="padding:2px 5px;font-size:10px;border:1px solid var(--qb-border2);border-radius:4px;background:var(--qb-surface2);color:var(--qb-muted);cursor:pointer">${p.hidden?"👁":"🙈"}</button>
    </td>`:"";
    return`<tr data-rkey="${p.name}" style="${hiddenStyle}">
      <td data-label="#">${rk}</td>
      <td data-label="±" style="text-align:center">${mv}</td>
      <td data-label="País">${flagEmoji(p.champFlag,20)}</td>
      <td data-label="Participante"><div class="pn">${p.name}</div><div class="ps">${p.city||""}</div></td>
      <td data-label="Básicos"><span class="pill pb">${p.b}</span></td>
      <td data-label="Avanzado"><span class="pill pg">${p.av}</span></td>
      <td data-label="Elim"><span class="pill" style="background:rgba(124,58,237,.18);color:#c4b5fd;border:1px solid rgba(124,58,237,.35)">${p.elim}</span></td>
      <td data-label="Bonos">${bonBadge}</td>
      <td data-label="Total" style="text-align:right"><span class="ptb">${p.total}</span></td>
      ${adminActions}
    </tr>`;
  }).join("");

  // Animar solo las filas que cambiaron de posición respecto al render anterior
  Array.from(tbody.querySelectorAll("tr[data-rkey]")).forEach((tr,newIdx)=>{
    const key=tr.dataset.rkey;
    if(key in prevPos && prevPos[key]!==newIdx){
      const moved=newIdx<prevPos[key]?"rank-move-up":"rank-move-down";
      void tr.offsetWidth; // forzar reflow para reiniciar animación si ya tenía una
      tr.classList.add(moved);
      tr.addEventListener("animationend",()=>tr.classList.remove(moved),{once:true});
    }
  });

  if(typeof renderBattlesBanner==="function")renderBattlesBanner();
}

function renderFix(){
  const byG={};MIDS.forEach(mid=>{const g=MGMAP[mid]||"?";if(!byG[g])byG[g]=[];byG[g].push(mid);});
  const go=["A","B","C","D","E","F","G","H","I","J","K","L"];
  document.getElementById("fb").innerHTML=go.map(g=>{
    const mids=byG[g]||[];if(!mids.length)return"";
    return`<div class="gh"><span class="gl">Grupo ${g}</span></div>
    ${mids.map(mid=>{
      const m=MD[mid];if(!m)return"";
      const s=sc(mid);const played=!!s;const live=s?.live;
      const pts=m.lbl.split(" vs ");
      const hN=(pts[0]||"").trim();const aN=(pts[1]||"").trim();
      const hF=getFlag(g,hN);const aF=getFlag(g,aN);
      const mt=S.matchTimes[mid];
      let timeStr="";
      if(mt){
        const d=new Date(mt);
        const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
        timeStr=d.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit",timeZone:tz})+" · "+d.toLocaleDateString("es",{weekday:"short",day:"numeric",month:"short",timeZone:tz});
      }
      // Verificar checksum para mostrar indicador
      let checksumOk=true;
      if(s&&S.checksums[mid]){
        checksumOk=S.checksums[mid]===makeChecksum(mid,s.h,s.a);
      }
      const inpS="width:28px;text-align:center;font-size:13px;font-weight:700;padding:2px 3px;border-radius:4px;background:var(--qb-surface2);color:var(--qb-text);border:1px solid "+(played?(checksumOk?"var(--qb-green)":"var(--qb-yellow)"):"var(--qb-border2)");
      const rowS=live?"border:1px solid var(--qb-red);background:rgba(212,0,26,.07)":(!checksumOk?"border:1px solid var(--qb-yellow);background:rgba(245,166,35,.05)":"");
      return`<div class="mr" style="${rowS}">
        <div class="th"><span class="tn">${hN}</span><span style="font-size:14px">${hF}</span></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <div style="display:flex;align-items:center;gap:3px">
            <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${s?s.h:""}" placeholder="-" onchange="onSC(${mid},'h',this.value)" style="${inpS}">
            <span style="font-size:11px;color:var(--qb-muted)">:</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${s?s.a:""}" placeholder="-" onchange="onSC(${mid},'a',this.value)" style="${inpS}">
          </div>
          <div class="sd">${live?`<span class="ldot"></span><span style="font-size:9px;color:#ef4444;font-weight:500">EN VIVO</span>`:`<span class="dot ${played?(checksumOk?"on":"warn"):""}"></span><span>P${mid}</span>`}${!checksumOk&&played?`<span style="font-size:9px;color:#f59e0b;font-weight:500">⚠</span>`:""}</div>
          ${timeStr&&!played?`<div style="font-size:8px;color:var(--qb-muted);text-align:center;white-space:nowrap">⏰ ${timeStr}</div>`:""}
          ${timeStr&&played?`<div style="font-size:8px;color:var(--qb-muted);text-align:center;white-space:nowrap">${timeStr}</div>`:""}
        </div>
        <div style="display:flex;align-items:center;gap:4px"><span style="font-size:14px">${aF}</span><span class="tn">${aN}</span></div>
      </div>`;
    }).join("")}`;
  }).join("");
}

const _pb={};
function onSC(mid,side,val){
  if(!_pb[mid])_pb[mid]={};
  _pb[mid][side]=val===""?null:parseInt(val);
  const cur=sc(mid)||{};
  const h=_pb[mid].h!==undefined?_pb[mid].h:(cur.h??null);
  const a=_pb[mid].a!==undefined?_pb[mid].a:(cur.a??null);
  if(h!==null&&a!==null){
    const ok=saveScore(mid,h,a,{live:cur.live||false});
    if(ok)toast("✓ Guardado");
  } else if(val===""){
    delete S.scores[mid];delete S.checksums[mid];delete _pb[mid];save();
  }
}

function resetFix(){if(!confirm("¿Borrar todos los resultados?"))return;S.scores={};S.checksums={};save();renderFix();renderRank();setFS("");toast("✓ Borrado");}
function setFS(html){const el=document.getElementById("fix-st");if(el)el.innerHTML=html;}

function exportFixJSON(){
  const blob=new Blob([JSON.stringify({v:"2.3",date:new Date().toISOString(),scores:S.scores,checksums:S.checksums,elimScores:S.elimScores,elimTeams:S.elimTeams},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download=`quiniela-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);toast("✓ JSON exportado");
}
function importFixJSON(input){
  const file=input.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{
    try{
      const d=JSON.parse(e.target.result);const s=d.scores||d;let n=0,bad=0;
      Object.entries(s).forEach(([k,v])=>{
        if(v&&typeof v.h==="number"&&typeof v.a==="number"){
          const mid=Number(k)||k;
          const vr=validateScore(mid,v.h,v.a);
          if(vr.ok){S.scores[mid]=v;S.checksums[mid]=makeChecksum(mid,v.h,v.a);n++;}
          else bad++;
        }
      });
      save();renderFix();renderRank();
      setFS(`<span class="sbadge ok">✓ ${n} importados${bad?` · ${bad} rechazados por validación`:""}</span>`);
      toast(`✓ ${n} importados`);
    }catch(e2){toast("Error JSON",true);}
    input.value="";
  };r.readAsText(file);
}

// ══════════════════════════════════════════════════════════════
