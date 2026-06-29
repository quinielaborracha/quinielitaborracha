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
  const rows=ranked.map((p,i)=>{let rk;if(i<3)rk=`<div style="width:34px;text-align:center;font-size:20px;line-height:1">${rki[i]}</div>`;else if(i===9)rk=`<div style="width:34px;text-align:center;font-size:20px">⚽</div>`;else if(i===25)rk=`<div style="width:34px;text-align:center;font-size:20px">🚑</div>`;else if(i===26)rk=`<div style="width:34px;text-align:center;font-size:20px">👸</div>`;else rk=`<div style="width:34px;text-align:center;font-size:14px;font-weight:800;color:#6ab8f7">${i+1}</div>`;
  const snap=getActiveSnapshot();
  return`<div style="display:flex;align-items:center;padding:8px 14px;background:${i%2===0?"#13161D":"#0A0C10"};border-bottom:1px solid #252A38;border-left:3px solid #D4001A">${rk}${(()=>{const prev=snap?.positions?.[p.name];const diff=prev?(prev-(i+1)):0;if(!prev||diff===0)return`<div style="width:22px;text-align:center;font-size:10px;color:#6B7384">—</div>`;return diff>0?`<div style="width:22px;text-align:center;font-size:10px;font-weight:800;color:#4dde8c">↑${diff}</div>`:`<div style="width:22px;text-align:center;font-size:10px;font-weight:800;color:#ff6b6b">↓${Math.abs(diff)}</div>`;})()}<div style="width:34px;text-align:center;font-size:22px;margin:0 6px;flex-shrink:0">${flagEmoji(p.champFlag,22)}</div><div style="flex:1;min-width:0;padding-right:6px"><div style="font-size:12px;font-weight:800;color:#F0F2F7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div><div style="font-size:9px;color:#6B7384;margin-top:1px">${cityCountry(p)}</div></div><div style="display:flex;gap:5px;align-items:center;flex-shrink:0"><span style="font-size:10px;font-weight:800;color:#6ab8f7;background:rgba(20,120,200,.18);border:1px solid rgba(20,120,200,.35);padding:2px 8px;border-radius:20px;min-width:26px;text-align:center">${p.b}</span><span style="font-size:10px;font-weight:800;color:#4dde8c;background:rgba(0,200,83,.14);border:1px solid rgba(0,200,83,.35);padding:2px 8px;border-radius:20px;min-width:26px;text-align:center">${p.av}</span><span style="font-size:10px;font-weight:800;color:#c4b5fd;background:rgba(124,58,237,.18);border:1px solid rgba(124,58,237,.35);padding:2px 8px;border-radius:20px;min-width:26px;text-align:center">${p.elim}</span>${p.bon>0?`<span style="font-size:10px;font-weight:800;color:#f5c842;background:rgba(245,166,35,.14);border:1px solid rgba(245,166,35,.35);padding:2px 8px;border-radius:20px;min-width:26px;text-align:center">${p.bon}</span>`:""}<span style="font-size:19px;font-weight:800;color:#F0F2F7;min-width:30px;text-align:right">${p.total}</span></div></div>`;}).join("");
  return`<div id="exp-capture" style="font-family:'Helvetica Neue',Arial,sans-serif;background:#0A0C10;border-radius:8px;overflow:hidden"><div style="background:linear-gradient(135deg,#1a0005 0%,#0f0f17 50%,#0A0C10 100%);padding:18px 16px 10px;border-bottom:2px solid #D4001A"><div style="display:flex;align-items:center"><img src="${BORRACHI_SRC}" style="width:96px;height:96px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 10px rgba(0,0,0,.4))"><div style="flex:1;text-align:center;padding:0 4px"><div style="font-size:21px;font-weight:900;color:#fff">Quinielita Borracha</div><div style="font-size:11px;color:#9a9aa5;margin-top:3px">EE.UU. / Canadá / México · 11 Jun – 19 Jul 2026</div><div style="display:inline-block;background:#D4001A;color:#fff;font-weight:900;font-size:14px;padding:4px 28px;border-radius:7px;margin-top:8px;letter-spacing:.04em">ASÍ VAN</div></div><img src="${LOGO_SIMPLE_SRC}" style="width:96px;height:96px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 2px 8px rgba(212,0,26,.4))"></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.15)"><span style="font-size:10px;color:rgba(255,255,255,.75)">${now}</span><span style="font-size:10px;color:rgba(255,255,255,.4)">·</span><span style="font-size:10px;color:rgba(255,255,255,.75)">${played}/72 grupos · ${elimPlayed}/32 elim</span>${getActiveSnapshot()?`<span style="font-size:10px;color:rgba(255,255,255,.4)">·</span><span style="font-size:10px;color:rgba(255,215,0,.9)">📸 vs "${getActiveSnapshot().label}"</span>`:""}</div></div><div style="background:#1C2030;display:flex;align-items:center;padding:7px 14px;border-bottom:1px solid #252A38"><div style="width:34px"></div><div style="width:52px"></div><div style="flex:1;font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase">PARTICIPANTE</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:38px;text-align:center">GRP</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:38px;text-align:center">ADV</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:38px;text-align:center">ELIM</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:38px;text-align:center">BON</div><div style="font-size:9px;font-weight:800;color:#6B7384;text-transform:uppercase;min-width:28px;text-align:right">TOT</div></div>${rows}<div style="background:#000;padding:10px;text-align:center;font-size:9px;color:#6B7384">⚽ XXIII FIFA World Cup · USA / México / Canadá 2026 · Quinielita Borracha v1.0</div></div>`;
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
        <div style="font-size:12px;font-weight:700;color:var(--qb-text)">${s.label}</div>
        <div style="font-size:10px;color:var(--qb-muted)">${s.ts}</div>
      </div>
      ${s===snaps[0]?`<span class="sbadge ok" style="font-size:9px">activo</span>`:""}
      <button class="btn btn-red btn-sm" onclick="deleteSnapshot(${s.id})">✕</button>
    </div>`).join("");
}

// ══════════════════════════════════════════════════════════════
// ESTADÍSTICAS v5.5.5
// ══════════════════════════════════════════════════════════════

function statTab(id){
  ["cards","popular","goal"].forEach(x=>{
    document.getElementById("stat-"+x).style.display=x===id?"block":"none";
    document.getElementById("stab-"+x)?.classList.toggle("on",x===id);
  });
  if(id==="cards")renderStatCards();
  if(id==="popular")renderStatPopular();
  if(id==="goal")fetchESPNScorers();
}

// ── TARJETAS DE JUGADOR ──
function renderStatCards(){
  const el=document.getElementById("stat-cards");if(!el)return;
  const pidx=window._selStat||0;window._selStat=pidx;

  const sel=`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:.875rem">${PL.map((name,i)=>{
    const m=PM[name]||{};
    return`<button onclick="window._selStat=${i};renderStatCards()" class="btn btn-sm ${i===pidx?"btn-blue":""}">${flagEmoji(m.champFlag,13)} ${sn(name)}</button>`;
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

  const pct=played>0?Math.round((wins+draws+exact>0?wins+draws:0)/played*100):0;
  const hitPct=played>0?Math.round((wins+draws)/played*100):0;
  const exactPct=played>0?Math.round(exact/played*100):0;

  // Best group
  const bestGrp=Object.entries(ptsByGroup).sort((a,b)=>b[1].pts-a[1].pts)[0];

  // Rank position
  const ranked=getRank();
  const pos=ranked.findIndex(r=>r.name===name)+1;
  const rankRow=ranked.find(r=>r.name===name);

  // Stars / badges
  const badges=[];
  if(exact>=5)badges.push({ico:"🎯",lbl:"Francotirador",desc:`${exact} exactos`});
  if(bestStreak>=5)badges.push({ico:"🔥",lbl:"En racha",desc:`${bestStreak} seguidos`});
  if(pos===1)badges.push({ico:"👑",lbl:"Líder",desc:"#1 del ranking"});
  if(pos===27)badges.push({ico:"🚑",lbl:"Aguante",desc:"Último lugar"});
  if(hitPct>=60)badges.push({ico:"⚡",lbl:"Certero",desc:`${hitPct}% de aciertos`});

  const badgeHtml=badges.map(b=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 9px;background:var(--qb-surface2);border:1px solid var(--qb-border2);border-radius:8px">
    <span style="font-size:18px">${b.ico}</span><div><div style="font-size:11px;font-weight:700;color:var(--qb-text)">${b.lbl}</div><div style="font-size:9px;color:var(--qb-muted)">${b.desc}</div></div>
  </div>`).join("");

  el.innerHTML=sel+`
  <div style="border:1px solid var(--qb-border);border-radius:14px;overflow:hidden;background:var(--qb-surface)">
    <!-- Header card -->
    <div style="background:linear-gradient(135deg,var(--qb-surface2),var(--qb-surface3));padding:1rem;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--qb-border)">
      <div style="font-size:36px">${flagEmoji(m.champFlag,36)}</div>
      <div style="flex:1">
        <div style="font-family:var(--ff-display);font-size:18px;font-weight:900;color:var(--qb-text);text-transform:uppercase;letter-spacing:.03em">${name}</div>
        <div style="font-size:11px;color:var(--qb-muted);margin-top:2px">${cityCountry(m)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:var(--ff-display);font-size:36px;font-weight:900;color:var(--qb-gold)">#${pos}</div>
        <div style="font-size:10px;color:var(--qb-muted)">de 27</div>
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

// ── PREDICCIONES MÁS POPULARES ──
function renderStatPopular(){
  const el=document.getElementById("stat-popular");if(!el)return;
  const playedMids=MIDS.filter(mid=>sc(mid));
  if(!playedMids.length){el.innerHTML=`<div class="ib">Sin resultados aún.</div>`;return;}

  // For each played match, calculate consensus and divergence
  const matchStats=playedMids.map(mid=>{
    const s=sc(mid);
    const rR=s.h>s.a?"H":s.h<s.a?"A":"D";
    const votes={H:0,D:0,A:0};let total=0;let exact=0;
    PL.forEach(name=>{
      const p=MD[mid]?.preds[name];if(!p)return;
      total++;
      const pR=p.h>p.a?"H":p.h<p.a?"A":"D";
      votes[pR]++;
      if(p.h===s.h&&p.a===s.a)exact++;
    });
    const winner=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
    const consensus=total>0?Math.round(winner[1]/total*100):0;
    const divergence=100-consensus; // higher = more split
    const majCorrect=winner[0]===rR;
    return{mid,lbl:MD[mid]?.lbl||`P${mid}`,s,rR,votes,total,exact,consensus,divergence,majCorrect,winner:winner[0]};
  });

  // Sort by divergence (most split first)
  const sorted=[...matchStats].sort((a,b)=>b.divergence-a.divergence);
  const top20=sorted.slice(0,20);

  // Group consensus
  const allH=matchStats.filter(m=>m.votes.H===m.total).length;
  const allD=matchStats.filter(m=>m.votes.D===m.total).length;
  const allA=matchStats.filter(m=>m.votes.A===m.total).length;
  const totalExact=matchStats.reduce((s,m)=>s+m.exact,0);
  const totalHits=matchStats.reduce((s,m)=>s+(m.majCorrect?1:0),0);

  const RESULT_LBL={H:"Local",D:"Empate",A:"Visitante"};
  const pts_short=lbl=>{const p=lbl.split(" vs ");return`${(p[0]||"").trim().split(" ").slice(-1)[0]} vs ${(p[1]||"").trim().split(" ").slice(-1)[0]}`;};

  let html=`
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.5rem;margin-bottom:.875rem">
    <div style="padding:.625rem;background:var(--qb-surface);border:1px solid var(--qb-border);border-radius:8px;text-align:center">
      <div style="font-family:var(--ff-display);font-size:24px;font-weight:900;color:#4dde8c">${totalHits}/${matchStats.length}</div>
      <div style="font-size:10px;color:var(--qb-muted)">partidos donde la mayoría acertó</div>
    </div>
    <div style="padding:.625rem;background:var(--qb-surface);border:1px solid var(--qb-border);border-radius:8px;text-align:center">
      <div style="font-family:var(--ff-display);font-size:24px;font-weight:900;color:var(--qb-gold)">${totalExact}</div>
      <div style="font-size:10px;color:var(--qb-muted)">marcadores exactos en total</div>
    </div>
  </div>
  <div class="sec" style="margin-bottom:.5rem">Partidos más disputados (mayor divergencia)</div>`;

  top20.forEach(m=>{
    const lbl=pts_short(m.lbl);
    const rStr=`${m.s.h}–${m.s.a}`;
    const hPct=m.total>0?Math.round(m.votes.H/m.total*100):0;
    const dPct=m.total>0?Math.round(m.votes.D/m.total*100):0;
    const aPct=m.total>0?Math.round(m.votes.A/m.total*100):0;
    const barH=`<div style="height:8px;background:var(--qb-blue);border-radius:2px 0 0 2px;width:${hPct}%;display:inline-block;vertical-align:middle"></div>`;
    const barD=`<div style="height:8px;background:var(--qb-muted);width:${dPct}%;display:inline-block;vertical-align:middle"></div>`;
    const barA=`<div style="height:8px;background:var(--qb-red);border-radius:0 2px 2px 0;width:${aPct}%;display:inline-block;vertical-align:middle"></div>`;
    const correctColor=m.majCorrect?"#4dde8c":"#ff8080";

    html+=`<div style="padding:7px 10px;border:1px solid var(--qb-border);border-radius:8px;margin-bottom:4px;background:var(--qb-surface)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;font-weight:700;color:var(--qb-text)">${lbl}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;color:var(--qb-muted)">Real: <strong style="color:var(--qb-text)">${rStr}</strong></span>
          <span style="font-size:9px;padding:1px 6px;border-radius:4px;background:${m.majCorrect?"rgba(0,200,83,.12)":"rgba(212,0,26,.1)"};color:${correctColor};font-weight:700">${m.majCorrect?"mayoría ✓":"mayoría ✗"}</span>
        </div>
      </div>
      <div style="display:flex;gap:0;overflow:hidden;border-radius:4px;margin-bottom:4px;height:8px;background:var(--qb-surface2)">${barH}${barD}${barA}</div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--qb-muted)">
        <span style="color:var(--qb-blue)">🏠 ${m.votes.H} (${hPct}%)</span>
        <span>🤝 ${m.votes.D} (${dPct}%)</span>
        <span style="color:var(--qb-red)">✈️ ${m.votes.A} (${aPct}%)</span>
        <span style="color:var(--qb-gold)">🎯 ${m.exact} exactos</span>
      </div>
    </div>`;
  });

  el.innerHTML=html;
}

// ══════════════════════════════════════════════════════════════
