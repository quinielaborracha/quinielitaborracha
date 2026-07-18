/* ════════════════════════════════════════════════════════════
   app-estadisticas.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Exportar imagen del ranking, snapshots (seguimiento de movimiento en el ranking) y panel de Estadísticas.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): EXPORT IMAGEN; SNAPSHOTS — ranking movement tracking; ESTADÍSTICAS

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

// EXPORT IMAGEN
// ══════════════════════════════════════════════════════════════
function buildExp(){
  const ranked=getRank();const now=new Date().toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"});const played=Object.keys(S.scores).length;const elimPlayed=Object.keys(S.elimScores).length;const rki=["🥇","🥈","🥉"];
  // v3.9.3 — mismo fix que renderRank() (app-bracket-view.js): penúltimo/
  // último calculados sobre el largo real, no hardcodeados a 25/26.
  const penultimo=ranked.length-2, ultimo=ranked.length-1;
  const rows=ranked.map((p,i)=>{let rk;if(i<3)rk=`<div style="width:34px;text-align:center;font-size:20px;line-height:1">${rki[i]}</div>`;else if(i===9)rk=`<div style="width:34px;text-align:center;font-size:20px">⚽</div>`;else if(i===penultimo)rk=`<div style="width:34px;text-align:center;font-size:20px">🚑</div>`;else if(i===ultimo)rk=`<div style="width:34px;text-align:center;font-size:20px">👸</div>`;else rk=`<div style="width:34px;text-align:center;font-size:14px;font-weight:800;color:#6ab8f7">${i+1}</div>`;
  const snap=getActiveSnapshot();
  return`<div style="display:flex;align-items:center;padding:8px 14px;background:${i%2===0?"#13161D":"#0A0C10"};border-bottom:1px solid #252A38;border-left:3px solid #D4001A">${rk}${(()=>{const prev=snap?.positions?.[p.name];const diff=prev?(prev-(i+1)):0;if(!prev||diff===0)return`<div style="width:22px;text-align:center;font-size:10px;color:#6B7384">—</div>`;return diff>0?`<div style="width:22px;text-align:center;font-size:10px;font-weight:800;color:#4dde8c">↑${diff}</div>`:`<div style="width:22px;text-align:center;font-size:10px;font-weight:800;color:#ff6b6b">↓${Math.abs(diff)}</div>`;})()}<div style="width:34px;text-align:center;font-size:22px;margin:0 6px;flex-shrink:0">${flagEmoji(p.champFlag,22)}</div><div style="flex:1;min-width:0;padding-right:6px"><div style="font-size:12px;font-weight:800;color:#F0F2F7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div><div style="font-size:9px;color:#6B7384;margin-top:1px">${esc(cityCountry(p))}</div></div><div style="display:flex;gap:5px;align-items:center;flex-shrink:0"><span style="font-size:10px;font-weight:800;color:#6ab8f7;background:rgba(20,120,200,.18);border:1px solid rgba(20,120,200,.35);padding:2px 8px;border-radius:20px;min-width:26px;text-align:center">${p.b}</span><span style="font-size:10px;font-weight:800;color:#4dde8c;background:rgba(0,200,83,.14);border:1px solid rgba(0,200,83,.35);padding:2px 8px;border-radius:20px;min-width:26px;text-align:center">${p.av}</span><span style="font-size:10px;font-weight:800;color:#c4b5fd;background:rgba(124,58,237,.18);border:1px solid rgba(124,58,237,.35);padding:2px 8px;border-radius:20px;min-width:26px;text-align:center">${p.elim}</span>${p.bon>0?`<span style="font-size:10px;font-weight:800;color:#f5c842;background:rgba(245,166,35,.14);border:1px solid rgba(245,166,35,.35);padding:2px 8px;border-radius:20px;min-width:26px;text-align:center">${p.bon}</span>`:""}<span style="font-size:19px;font-weight:800;color:#F0F2F7;min-width:30px;text-align:right">${p.total}</span></div></div>`;}).join("");
  return`<div id="exp-capture" style="font-family:'Helvetica Neue',Arial,sans-serif;background:#0A0C10;border-radius:8px;overflow:hidden"><div style="background:linear-gradient(135deg,#1a0005 0%,#0f0f17 50%,#0A0C10 100%);padding:18px 16px 10px;border-bottom:2px solid #D4001A"><div style="display:flex;align-items:center"><img src="${BORRACHI_SRC}" style="width:96px;height:96px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 10px rgba(0,0,0,.4))"><div style="flex:1;text-align:center;padding:0 4px"><div style="font-size:21px;font-weight:900;color:#fff">Quinielita Borracha</div><div style="font-size:11px;color:#9a9aa5;margin-top:3px">EE.UU. / Canadá / México · 11 Jun – 19 Jul 2026</div><div style="display:inline-block;background:#D4001A;color:#fff;font-weight:900;font-size:14px;padding:4px 28px;border-radius:7px;margin-top:8px;letter-spacing:.04em">ASÍ VAN</div></div><img src="${LOGO_SIMPLE_SRC}" style="width:96px;height:96px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 8px rgba(212,0,26,.4))"></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.15)"><span style="font-size:10px;color:rgba(255,255,255,.75)">${now}</span><span style="font-size:10px;color:rgba(255,255,255,.4)">·</span><span style="font-size:10px;color:rgba(255,255,255,.75)">${played}/72 grupos · ${elimPlayed}/32 elim</span>${getActiveSnapshot()?`<span style="font-size:10px;color:rgba(255,255,255,.4)">·</span><span style="font-size:10px;color:rgba(255,215,0,.9)">📸 vs "${esc(getActiveSnapshot().label)}"</span>`:""}</div></div><div style="background:#1C2030;display:flex;align-items:center;padding:7px 14px;border-bottom:1px solid #252A38"><div style="width:34px"></div><div style="width:52px"></div><div style="flex:1;font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase">PARTICIPANTE</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:38px;text-align:center">GRP</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:38px;text-align:center">ADV</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:38px;text-align:center">ELIM</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:38px;text-align:center">BON</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:28px;text-align:right">TOT</div></div>${rows}<div style="background:#000;padding:10px;text-align:center;font-size:9px;color:#6B7384">⚽ XXIII FIFA World Cup · USA / México / Canadá 2026 · Quinielita Borracha v1.0</div></div>`;
}
function exportImage(){document.getElementById("exp-preview-wrap").innerHTML=buildExp();document.getElementById("exp-status").textContent="";document.getElementById("prog-wrap").style.display="none";document.getElementById("prog").style.width="0%";document.getElementById("btn-dl").disabled=false;document.getElementById("btn-dl").textContent="⬇️ Descargar PNG";document.getElementById("btn-cp").disabled=false;document.getElementById("btn-cp").textContent="📋 Copiar imagen";document.getElementById("exp-modal").style.display="flex";}
function closeExp(){document.getElementById("exp-modal").style.display="none";}
async function downloadImg(){const btn=document.getElementById("btn-dl");btn.disabled=true;btn.textContent="⏳ Generando...";document.getElementById("prog-wrap").style.display="block";document.getElementById("prog").style.width="20%";try{const el=document.getElementById("exp-capture");document.getElementById("prog").style.width="55%";const canvas=await html2canvas(el,{backgroundColor:"#0A0C10",scale:2.5,useCORS:true,logging:false,allowTaint:true});document.getElementById("prog").style.width="95%";const a=document.createElement("a");a.download=`quinielita-borracha-${new Date().toISOString().slice(0,10)}.png`;a.href=canvas.toDataURL("image/png");a.click();document.getElementById("prog").style.width="100%";document.getElementById("exp-status").textContent="✓ Descargado";toast("✓ Imagen descargada");}catch(e){document.getElementById("exp-status").textContent="Error: "+e.message;toast("Error al generar",true);}btn.disabled=false;btn.textContent="⬇️ Descargar PNG";}
async function copyImg(){const btn=document.getElementById("btn-cp");btn.disabled=true;btn.textContent="⏳ Copiando...";try{const canvas=await html2canvas(document.getElementById("exp-capture"),{backgroundColor:"#0A0C10",scale:2.5,useCORS:true,logging:false,allowTaint:true});canvas.toBlob(async blob=>{try{await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);document.getElementById("exp-status").textContent="✓ Copiada — pega en WhatsApp";toast("✓ Copiada");}catch(e){document.getElementById("exp-status").textContent="⚠️ Usa Descargar PNG";}btn.disabled=false;btn.textContent="📋 Copiar imagen";});}catch(e){document.getElementById("exp-status").textContent="Error: "+e.message;btn.disabled=false;btn.textContent="📋 Copiar imagen";}}

// ══════════════════════════════════════════════════════════════
// SNAPSHOTS — ranking movement tracking
// ══════════════════════════════════════════════════════════════
function takeSnapshot(){
  const label=document.getElementById("snap-label")?.value?.trim();
  if(!label){toast("Escribe un nombre para el snapshot",true);return;}
  const ranked=getRank();
  const positions={};
  ranked.forEach((p,i)=>positions[p.name]=i+1);
  const snap={id:Date.now(),label,ts:new Date().toLocaleString("es",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}),positions};
  if(!S.snapshots)S.snapshots=[];
  S.snapshots.push(snap);
  if(document.getElementById("snap-label"))document.getElementById("snap-label").value="";
  save();renderSnapshotPanel();renderRank();
  toast(`📸 Snapshot "${label}" guardado`);
}

function deleteSnapshot(id){
  if(!confirm("¿Eliminar este snapshot?"))return;
  S.snapshots=(S.snapshots||[]).filter(s=>s.id!==id);
  save();renderSnapshotPanel();renderRank();
}

function getActiveSnapshot(){
  if(!S.snapshots||!S.snapshots.length)return null;
  return S.snapshots[S.snapshots.length-1]; // el más reciente
}

function renderSnapshotPanel(){
  const el=document.getElementById("snap-list");if(!el)return;
  const snaps=(S.snapshots||[]).slice().reverse();
  if(!snaps.length){el.innerHTML=`<div style="font-size:11px;color:var(--qb-muted);padding:.5rem 0">Sin snapshots aún.</div>`;return;}
  el.innerHTML=snaps.map(s=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--qb-border)">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;color:var(--qb-text)">${esc(s.label)}</div>
        <div style="font-size:10px;color:var(--qb-muted)">${s.ts}</div>
      </div>
      ${s===snaps[0]?`<span class="sbadge ok" style="font-size:9px">activo</span>`:""}
      <button class="btn btn-red btn-sm" onclick="deleteSnapshot(${s.id})" title="Borrar snapshot" aria-label="Borrar snapshot ${esc(s.label)}">✕</button>
    </div>`).join("");
}

// ══════════════════════════════════════════════════════════════
// ESTADÍSTICAS v5.5.5
// ══════════════════════════════════════════════════════════════

function statTab(id){
  ["cards","popular","goal","hof"].forEach(x=>{
    document.getElementById("stat-"+x).style.display=x===id?"block":"none";
    document.getElementById("stab-"+x)?.classList.toggle("on",x===id);
  });
  if(id==="cards")renderStatCards();
  if(id==="popular")renderTorneoReal();
  if(id==="goal")goalTab("players"); // v4.3 — Goleadores ahora tiene sub-tabs Jugadores/Países, ver goalTab()
  if(id==="hof")openHOF();
}

// ── TARJETAS DE JUGADOR ──
function renderStatCards(){
  const el=document.getElementById("stat-cards");if(!el)return;
  const pidx=window._selStat||0;window._selStat=pidx;

  const sel=`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:.875rem">${PL.map((name,i)=>{
    const m=PM[name]||{};
    return`<button onclick="window._selStat=${i};renderStatCards()" class="btn btn-sm ${i===pidx?"btn-blue":""}">${flagEmoji(m.champFlag,13)} ${esc(sn(name))}</button>`;
  }).join("")}</div>`;

  const name=PL[pidx];if(!name){el.innerHTML=sel;return;}
  const m=PM[name]||{};

  // Calculate stats
  let wins=0,draws=0,exact=0,played=0,totalPts=0,bestMatchPts=0,bestMatchLbl="";
  let streak=0,bestStreak=0,curStreak=0;
  const ptsByGroup={};

  MIDS.forEach(mid=>{
    const s=sc(mid);if(!s)return;
    const p=MD[mid]?.preds[name];if(!p)return;
    played++;
    const rR=s.h>s.a?"H":s.h<s.a?"A":"D";
    const pR=p.h>p.a?"H":p.h<p.a?"A":"D";
    const g=MGMAP[mid]||"?";
    if(!ptsByGroup[g])ptsByGroup[g]={pts:0,played:0};
    ptsByGroup[g].played++;
    let mp=0;
    if(rR===pR){
      mp+=rR==="D"?3:2;
      if(rR==="D")draws++;else wins++;
      curStreak++;
      if(curStreak>bestStreak)bestStreak=curStreak;
      if(p.h===s.h&&p.a===s.a){mp+=3;exact++;}
    }else{curStreak=0;}
    totalPts+=mp;
    ptsByGroup[g].pts+=mp;
    if(mp>bestMatchPts){bestMatchPts=mp;bestMatchLbl=MD[mid]?.lbl||`P${mid}`;}
  });

  // v3.15.2 — BUG REPORTADO: las tarjetas de estadísticas (Ganadores ✓,
  // Empates ✓, Marcador exacto, % de aciertos, Partidos jugados, Mejor
  // racha, Mejor partido) solo recorrían MIDS (grupos, P1-P72) -- una vez
  // arrancada la eliminatoria, ningún partido de Dieciseisavos en adelante
  // (P73-P104) sumaba a estos contadores, aunque "Pts eliminatoria" (arriba,
  // rankRow.elim) sí los incluye vía getRank()/calcElimPts(). Mismo criterio
  // de acierto que ya usa calcElimMatchBreakdown()/buildChronologicalResults
  // (scoring.js): llave exacta o cruce válido (isLlaveCorrecta/
  // findCruceValido) para poder comparar H/A/D contra el resultado real; sin
  // eso, el partido igual cuenta como "jugado" (participó) pero no como
  // acierto. No se suma a ptsByGroup (eso es un concepto de Fase de Grupos:
  // "Mejor grupo" no debe mezclarse con eliminatoria) pero sí a
  // bestMatchPts/bestMatchLbl ("Mejor partido" es el mejor partido de
  // cualquier fase).
  for(let pid=73;pid<=104;pid++){
    const phase=(typeof phaseForPid==="function")?phaseForPid(pid):null;
    if(phase&&!isFaseActiva(phase.key))continue;
    const s2=S.elimScores[pid]||S.elimScores[String(pid)];if(!s2||s2.live)continue;
    const pred=elimPred(name,pid);if(!pred)continue;
    played++;
    let rR=null,pR=null,exactMatch=false;
    if(isLlaveCorrecta(name,pid)){
      rR=s2.h>s2.a?"H":s2.h<s2.a?"A":"D";
      pR=pred.h>pred.a?"H":pred.h<pred.a?"A":"D";
      exactMatch=(pred.h===s2.h&&pred.a===s2.a);
    }else{
      const cruce=findCruceValido(name,pid);
      if(cruce){
        const realH=cruce.swapped?cruce.real.a:cruce.real.h;
        const realA=cruce.swapped?cruce.real.h:cruce.real.a;
        rR=realH>realA?"H":realH<realA?"A":"D";
        pR=pred.h>pred.a?"H":pred.h<pred.a?"A":"D";
        exactMatch=(pred.h===realH&&pred.a===realA);
      }
    }
    if(rR!==null&&rR===pR){
      if(rR==="D")draws++;else wins++;
      curStreak++;
      if(curStreak>bestStreak)bestStreak=curStreak;
      if(exactMatch)exact++;
    }else{
      curStreak=0;
    }
    const mp=calcElimMatchPts(name,pid);
    totalPts+=mp;
    if(mp>bestMatchPts){bestMatchPts=mp;bestMatchLbl=phase?`${phase.label} P${pid}`:`P${pid}`;}
  }

  const pct=played>0?Math.round((wins+draws+exact>0?wins+draws:0)/played*100):0;
  const hitPct=played>0?Math.round((wins+draws)/played*100):0;
  const exactPct=played>0?Math.round(exact/played*100):0;

  // Best group
  const bestGrp=Object.entries(ptsByGroup).sort((a,b)=>b[1].pts-a[1].pts)[0];

  // Rank position
  const ranked=getRank();
  const pos=ranked.findIndex(r=>r.name===name)+1;
  const rankRow=ranked.find(r=>r.name===name);

  // Batallas (duelos 1v1)
  const battleWins=(computeBattleRecord()[name]||{}).wins||0;
  const battlePts=calcBattleWinBonos(name);

  // Stars / badges
  const badges=[];
  if(exact>=5)badges.push({ico:"🎯",lbl:"Francotirador",desc:`${exact} exactos`});
  if(bestStreak>=5)badges.push({ico:"🔥",lbl:"En racha",desc:`${bestStreak} seguidos`});
  if(pos===1)badges.push({ico:"👑",lbl:"Líder",desc:"#1 del ranking"});
  if(pos===ranked.length)badges.push({ico:"🚑",lbl:"Aguante",desc:"Último lugar"}); // v3.9.3 — antes hardcodeado a pos===27
  if(hitPct>=60)badges.push({ico:"⚡",lbl:"Certero",desc:`${hitPct}% de aciertos`});

  const badgeHtml=badges.map(b=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 9px;background:var(--qb-surface2);border:1px solid var(--qb-border2);border-radius:8px">
    <span style="font-size:18px">${b.ico}</span><div><div style="font-size:11px;font-weight:700;color:var(--qb-text)">${b.lbl}</div><div style="font-size:9px;color:var(--qb-muted)">${b.desc}</div></div>
  </div>`).join("");

  el.innerHTML=sel+`
  <div style="border:1px solid var(--qb-border);border-radius:14px;overflow:hidden;background:var(--qb-surface)">
    <!-- Header card -->
    <div style="background:linear-gradient(135deg,var(--qb-surface2),var(--qb-surface3));padding:1rem;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--qb-border)">
      <div style="font-size:48px">${m.champAvatar?avatarImg(m.champAvatar,90):flagEmoji(m.champFlag,48)}</div>
      <div style="flex:1">
        <div style="font-family:var(--ff-display);font-size:18px;font-weight:900;color:var(--qb-text);text-transform:uppercase;letter-spacing:.03em">${esc(name)}</div>
        <div style="font-size:11px;color:var(--qb-muted);margin-top:2px">${esc(cityCountry(m))}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:var(--ff-display);font-size:36px;font-weight:900;color:var(--qb-gold)">#${pos}</div>
        <div style="font-size:10px;color:var(--qb-muted)">de ${ranked.length}</div>
      </div>
    </div>
    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--qb-border)">
      ${[
        {v:rankRow?.total||0,l:"Puntos totales",c:"var(--qb-blue)"},
        {v:rankRow?.b||0,l:"Pts grupos",c:"var(--qb-text)"},
        {v:rankRow?.elim||0,l:"Pts eliminatoria",c:"#c4b5fd"},
        {v:played,l:"Partidos jugados",c:"var(--qb-text)"},
        {v:hitPct+"%",l:"% de aciertos",c:"#4dde8c"},
        {v:exactPct+"%",l:"Exactos",c:"var(--qb-gold)"},
        {v:wins,l:"Ganadores ✓",c:"#4dde8c"},
        {v:draws,l:"Empates ✓",c:"#6ab8f7"},
        {v:exact,l:"Marcador exacto",c:"var(--qb-gold)"},
        {v:rankRow?.bon||0,l:"Pts de bonos",c:"#f5c842"},
        {v:battleWins,l:"Batallas ganadas",c:"#4dde8c"},
        {v:battlePts,l:"Pts de batallas",c:"#f5c842"},
      ].map(s=>`<div style="padding:.625rem;background:var(--qb-surface);text-align:center">
        <div style="font-family:var(--ff-display);font-size:22px;font-weight:900;color:${s.c}">${s.v}</div>
        <div style="font-size:9px;color:var(--qb-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.04em">${s.l}</div>
      </div>`).join("")}
    </div>
    <!-- Extra stats -->
    <div style="padding:.75rem;display:flex;flex-wrap:wrap;gap:8px;border-top:1px solid var(--qb-border)">
      <div style="flex:1;min-width:140px;padding:.5rem .75rem;background:var(--qb-surface2);border-radius:8px;border:1px solid var(--qb-border)">
        <div style="font-size:9px;color:var(--qb-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Mejor racha</div>
        <div style="font-family:var(--ff-display);font-size:20px;font-weight:800;color:var(--qb-text)">${bestStreak} <span style="font-size:12px;color:var(--qb-muted)">seguidos</span></div>
      </div>
      <div style="flex:1;min-width:140px;padding:.5rem .75rem;background:var(--qb-surface2);border-radius:8px;border:1px solid var(--qb-border)">
        <div style="font-size:9px;color:var(--qb-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Mejor partido</div>
        <div style="font-family:var(--ff-display);font-size:16px;font-weight:800;color:var(--qb-gold)">${bestMatchPts>0?"+"+bestMatchPts+"pts":"—"}</div>
        ${bestMatchLbl?`<div style="font-size:9px;color:var(--qb-muted)">${bestMatchLbl}</div>`:""}
      </div>
      ${bestGrp?`<div style="flex:1;min-width:140px;padding:.5rem .75rem;background:var(--qb-surface2);border-radius:8px;border:1px solid var(--qb-border)">
        <div style="font-size:9px;color:var(--qb-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Mejor grupo</div>
        <div style="font-family:var(--ff-display);font-size:20px;font-weight:800;color:var(--qb-text)">Grupo ${bestGrp[0]} <span style="font-size:12px;color:var(--qb-muted)">${bestGrp[1].pts}pts</span></div>
      </div>`:""}
    </div>
    ${badges.length?`<div style="padding:.75rem;display:flex;flex-wrap:wrap;gap:6px;border-top:1px solid var(--qb-border)">${badgeHtml}</div>`:""}
  </div>`;
}

// ── TORNEO REAL (v2.8) ──
// Antes esta sub-pestaña ("🗳 Predicciones") mostraba consenso/divergencia
// de las predicciones de los 27 sobre partidos de GRUPOS ya jugados. Ahora
// ("🏆 Torneo real") muestra el bracket de ELIMINATORIA real del Mundial
// (P73-P104), sin nada de predicciones de nadie -- pura realidad del
// torneo: equipos, marcador, en vivo o no. getRealElimTeams()/S.elimScores
// (scoring.js/app-state.js) YA son la única fuente de verdad de "qué pasó
// de verdad" que usa el resto de la app (renderBracket admin, Batallas,
// etc.) -- acá solo se pinta esa misma verdad, sin comparar contra ningún
// participante.
//
// "Se actualiza sola, en vivo": dos mecanismos, sin Cloud Functions (plan
// Spark) ni polling desde cada visitante:
//   1) Cualquier admin con la app abierta re-sincroniza con ESPN sola cada
//      minuto en segundo plano (startTorneoRealAutoSync, app-bracket-espn-
//      sync.js) y empuja el resultado a Firestore -- la única escritura
//      real que puede haber (las reglas de Firestore rechazan cualquier
//      escritura de un participante no-admin).
//   2) TODOS los que están mirando esta pestaña reciben ese cambio al
//      instante vía el mismo onSnapshot que ya sincroniza todo lo demás
//      (applyRemoteState, app-live-sync.js) -- sin recargar la página.
// v3.9.4 — BUG REPORTADO: "Torneo Real" mostraba un equipo (Sudáfrica vs
// Bosnia-Herzegovina) que la vida real ya había desmentido hace más de
// una semana (el partido real, según ESPN, era Sudáfrica vs Canadá, ya
// finalizado). Causa raíz: esta pantalla leía getRealElimTeams(pid) +
// S.elimScores/S.elimTimes -- el MISMO estado que usa el motor de
// predicciones/puntaje para armar el bracket de cada participante. Ese
// estado se arma una vez con "⚡ Generar llaves de Dieciseisavos" a
// partir de la tabla de posiciones de grupos EN ESE MOMENTO, y no se
// recalcula solo después -- si esa foto se tomó con datos de grupo
// todavía incompletos, queda mal para siempre hasta que alguien la
// corrija a mano en el editor de llaves, y "Torneo Real" heredaba el
// mismo error aunque no tiene nada que ver con la predicción de nadie.
//
// Ahora esta pantalla es una sección independiente de ese sistema: lee
// exclusivamente S.realElim (app-state.js), que fetchESPNElim()
// (app-bracket-espn-sync.js) llena SIEMPRE con lo último que diga ESPN
// para el gameId real de cada uno de los 32 cruces -- sin pasar por
// ninguna lógica de "no pisar una predicción ya hecha". Así, aunque el
// bracket de predicciones quede mal armado, esta pantalla sigue
// mostrando exactamente lo que pasó en la vida real.
function renderTorneoReal(){
  const el=document.getElementById("stat-popular");if(!el)return;
  const rounds=(typeof ELIM_ROUNDS!=="undefined")?ELIM_ROUNDS:[];
  if(!rounds.length){el.innerHTML=`<div class="ib">Sin datos de eliminatoria todavía.</div>`;return;}

  const fmtDT=(t)=>{
    if(!t)return"";
    const d=new Date(t);
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    return d.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit",timeZone:tz})+" · "+d.toLocaleDateString("es",{weekday:"short",day:"numeric",month:"short",timeZone:tz});
  };

  const cardFor=(pid)=>{
    const real=(S.realElim&&S.realElim[pid])||null;
    if(!real||!real.h||!real.a){
      return`<div class="live-card" style="opacity:.5">
        <div class="live-hdr"><span style="font-size:10px;color:var(--qb-muted)">P${pid} · por definir</span></div>
      </div>`;
    }
    const hF=getFlag(null,real.h),aF=getFlag(null,real.a);
    const live=real.state==="in";
    const played=real.state==="post";
    if(live){
      return`<div class="live-card is-live">
        <div class="live-hdr"><div style="display:flex;align-items:center;gap:6px"><span class="ldot"></span><span style="font-family:var(--ff-display);font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--qb-red);text-transform:uppercase">EN VIVO</span></div><span style="font-size:10px;color:var(--qb-muted)">P${pid}</span></div>
        <div class="scoreboard"><div class="live-team"><span class="live-team-flag">${hF}</span><span class="live-team-name">${esc(real.h)}</span></div><div class="live-score red">${real.hs} – ${real.as}</div><div class="live-team"><span class="live-team-flag">${aF}</span><span class="live-team-name">${esc(real.a)}</span></div></div>
      </div>`;
    }
    const scoreHtml=played
      ?`<div class="live-score" style="font-family:var(--ff-display);font-size:22px;font-weight:900;color:var(--qb-text)">${real.hs} – ${real.as}</div>`
      :`<div class="live-score" style="font-family:var(--ff-display);font-size:18px;font-weight:900;color:var(--qb-muted)">VS</div>`;
    const timeHtml=(!played&&real.ts)?`<span style="font-size:10px;color:var(--qb-muted)">⏱ ${fmtDT(real.ts)}</span>`:"";
    return`<div class="live-card">
      <div class="live-hdr"><span style="font-size:10px;color:var(--qb-muted)">P${pid}${played?" · finalizado":""}</span>${timeHtml}</div>
      <div class="scoreboard" style="padding:10px 14px"><div class="live-team"><span class="live-team-flag">${hF}</span><span class="live-team-name">${esc(real.h)}</span></div>${scoreHtml}<div class="live-team"><span class="live-team-flag">${aF}</span><span class="live-team-name">${esc(real.a)}</span></div></div>
    </div>`;
  };

  const roundsHtml=rounds.map(round=>`
    <div style="margin-bottom:1.125rem">
      <div style="font-family:var(--ff-display);font-size:12px;font-weight:800;color:var(--qb-text);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">${esc(round.lbl)}</div>
      <div style="display:grid;gap:.5rem">${round.ids.map(cardFor).join("")}</div>
    </div>`).join("");

  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:.875rem;flex-wrap:wrap">
      <span class="sbadge ok">📡 Datos oficiales de ESPN</span>
      <span style="font-size:10px;color:var(--qb-muted)">Se actualiza solo — no hace falta recargar la página</span>
    </div>` + roundsHtml;
}

// ══════════════════════════════════════════════════════════════
// HALL DE LA FAMA — campeones de ediciones anteriores, v4.2
// ══════════════════════════════════════════════════════════════
// Vive en S.hallOfFame ([{id,name,year,photo,addedAt}], ver app-state.js),
// mismo mecanismo de persistencia que el resto de S (save()/Firestore).
// A diferencia de S.reality (que clearReality() borra entre torneos), acá
// no hay ningún flujo que lo limpie: son los campeones de ediciones
// pasadas, un registro permanente. `photo` es un dataURL JPEG comprimido
// en el cliente (ver hofReadPhoto() más abajo) -- no hay Firebase Storage
// en este proyecto (plan Spark), y al ser pocas entradas (una foto por
// edición, cargada una sola vez cada tanto) comprimir fuerte alcanza sin
// arriesgar el límite de 1MiB de quiniela/estado.
const HOF_INTRO_MS=2400; // ≈ un loop de trophy-intro.svg (dur="2.367s")
let _hofPendingPhoto=null; // dataURL de la foto recién elegida, antes de "+ Agregar"

// Abre la pestaña: pinta la grilla y dispara la animación de intro. Se
// llama SOLO desde statTab('hof') -- un cambio remoto mientras la
// pestaña ya está abierta usa renderHOF() directo (ver applyRemoteState(),
// app-live-sync.js) para no reiniciar la animación en cada sync ajeno.
function openHOF(){
  renderHOF();
  const overlay=document.getElementById("hof-intro");
  const obj=document.getElementById("hof-intro-obj");
  if(!overlay)return;
  overlay.classList.remove("fade-out");
  overlay.style.display="flex";
  if(obj){
    // Reasignar el mismo "data" no reinicia el SMIL del <object> -- hay
    // que sacarlo y volverlo a poner para que el trofeo se redibuje desde
    // cero cada vez que se entra a la pestaña.
    const src=obj.getAttribute("data");
    obj.setAttribute("data","");
    requestAnimationFrame(()=>obj.setAttribute("data",src));
  }
  clearTimeout(window._hofIntroTimer);
  window._hofIntroTimer=setTimeout(()=>{overlay.classList.add("fade-out");},HOF_INTRO_MS);
}

function renderHOF(){
  const grid=document.getElementById("hof-grid");if(!grid)return;
  const list=[...(S.hallOfFame||[])].sort((a,b)=>(b.year-a.year)||(b.addedAt-a.addedAt));
  if(!list.length){
    // grid-column:1/-1 -- #hof-grid es un CSS grid de varias columnas; sin
    // esto, este único item hereda el ancho de UNA columna (~110px) y el
    // texto queda angosto, una palabra por línea, en vez de ocupar todo el
    // ancho disponible como el resto de los estados vacíos ".es" del resto
    // de la app (que viven en contenedores normales, no en un grid).
    grid.innerHTML=`<div class="es" style="grid-column:1/-1">Todavía no hay campeones cargados en el Hall de la fama 🏆</div>`;
    return;
  }
  grid.innerHTML=list.map(h=>{
    const photoHtml=h.photo
      ?`<img class="hof-photo" src="${esc(h.photo)}" alt="Foto de ${esc(h.name)}">`
      :`<div class="hof-photo hof-photo-empty">🏆</div>`;
    const rmBtn=isAdmin()?`<button class="btn btn-red btn-sm hof-rm" onclick="rmHOF(${h.id})" title="Quitar" aria-label="Quitar a ${esc(h.name)} del Hall de la fama">✕</button>`:"";
    return`<div class="hof-card">${rmBtn}${photoHtml}<div class="hof-name">${esc(h.name)}</div><div class="hof-year">${esc(String(h.year))}</div></div>`;
  }).join("");
}

// Lee el archivo elegido, lo recorta a cuadrado y lo comprime a un dataURL
// chico (240x240, JPEG ~70%) antes de guardarlo en memoria -- recién se
// persiste si el admin confirma con "+ Agregar" (addHOF()).
function hofReadPhoto(input){
  const file=input.files&&input.files[0];
  if(!file)return;
  if(!file.type.startsWith("image/")){toast("Elegí un archivo de imagen",true);input.value="";return;}
  if(file.size>10*1024*1024){toast("Imagen demasiado pesada (máx. 10MB)",true);input.value="";return;}
  const reader=new FileReader();
  reader.onload=(ev)=>{
    const img=new Image();
    img.onload=()=>{
      const SIZE=240;
      const canvas=document.createElement("canvas");
      canvas.width=SIZE;canvas.height=SIZE;
      const ctx=canvas.getContext("2d");
      const side=Math.min(img.width,img.height);
      const sx=(img.width-side)/2,sy=(img.height-side)/2;
      ctx.drawImage(img,sx,sy,side,side,0,0,SIZE,SIZE);
      _hofPendingPhoto=canvas.toDataURL("image/jpeg",0.72);
      const upload=document.getElementById("hof-upload");
      if(upload)upload.innerHTML=`<img src="${_hofPendingPhoto}" alt="Vista previa">`;
    };
    img.onerror=()=>toast("No se pudo leer la imagen",true);
    img.src=ev.target.result;
  };
  reader.onerror=()=>toast("No se pudo leer el archivo",true);
  reader.readAsDataURL(file);
}

function addHOF(){
  if(!isAdmin())return;
  const nameEl=document.getElementById("hof-name"),yearEl=document.getElementById("hof-year");
  const name=nameEl.value.trim(),year=parseInt(yearEl.value)||0;
  if(!name){toast("Escribe el nombre del campeón",true);return;}
  if(!year){toast("Escribe el año del torneo",true);return;}
  if(!S.hallOfFame)S.hallOfFame=[];
  S.hallOfFame.push({id:Date.now(),name,year,photo:_hofPendingPhoto||"",addedAt:Date.now()});
  _hofPendingPhoto=null;
  nameEl.value="";yearEl.value="";
  const fileEl=document.getElementById("hof-file");if(fileEl)fileEl.value="";
  const upload=document.getElementById("hof-upload");if(upload)upload.innerHTML=`<span id="hof-upload-ico">📷</span>`;
  save();renderHOF();
  toast(`🏆 ${name} agregado al Hall de la fama`);
}

function rmHOF(id){
  if(!isAdmin())return;
  if(!confirm("¿Quitar este campeón del Hall de la fama?"))return;
  S.hallOfFame=(S.hallOfFame||[]).filter(h=>h.id!==id);
  save();renderHOF();
}

// ══════════════════════════════════════════════════════════════
