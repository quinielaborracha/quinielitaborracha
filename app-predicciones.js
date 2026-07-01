/* ════════════════════════════════════════════════════════════
   app-predicciones.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Vista de Predicciones / Avanzado / Reglas por participante, y goleadores (ESPN en vivo + manual).

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): PREDICCIONES / AVANZADO / GOLEADORES / REGLAS; GOLEADORES — ESPN en vivo + manual

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

// PREDICCIONES / AVANZADO / GOLEADORES / REGLAS
// ══════════════════════════════════════════════════════════════
function renderPred(){
  const sel=document.getElementById("psel"),body=document.getElementById("pb2");
  const pidx=window._selP||0;window._selP=pidx;
  sel.innerHTML=PL.map((name,i)=>{const m=PM[name]||{};return`<button onclick="window._selP=${i};renderPred()" class="btn btn-sm ${i===pidx?"btn-blue":""}">${flagEmoji(m.champFlag,14)} ${esc(sn(name))}</button>`;}).join("");
  const name=PL[pidx];if(!name){body.innerHTML="";return;}
  const m=PM[name]||{};const pts=calcPts(name)+calcAdv(name)+calcElimPts(name)+calcBonos(name); // v1.1 — antes solo calcPts(name) (grupos); ahora coincide con el total de getRank()
  body.innerHTML=`<div class="pc"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem"><span style="font-weight:700;font-size:13px;color:var(--qb-text)">${flagEmoji(m.champFlag,16)} ${esc(name)}</span><span class="pill pb">${pts} pts</span></div>
  <div class="pg2">${MIDS.map(mid=>{
    const pred=MD[mid]?.preds[name];if(!pred)return"";
    const s=sc(mid);const played=!!s;let pts2=0,hit=false;
    if(played){const rR=s.h>s.a?"H":s.h<s.a?"A":"D";const pR=pred.h>pred.a?"H":pred.h<pred.a?"A":"D";if(rR===pR){pts2+=rR==="D"?3:2;hit=true;if(pred.h===s.h&&pred.a===s.a)pts2+=3;}}
    const bdr=played?(hit?"border:1px solid rgba(0,200,83,.5)":"border:1px solid rgba(212,0,26,.5)"):"";
    const lbl=MD[mid]?.lbl||"";const pts3=lbl.split(" vs ");
    const hS=(pts3[0]||"").trim().split(" ").slice(-1)[0];const aS=(pts3[1]||"").trim().split(" ").slice(-1)[0];
    return`<div class="pm" style="${bdr}"><div class="pmn">${hS} vs ${aS} <span style="font-size:8px;padding:1px 4px;border-radius:4px;background:var(--qb-surface);border:1px solid var(--qb-border);color:var(--qb-muted)">P${mid}</span>${played?`<span style="float:right;font-family:var(--ff-display);font-size:10px;font-weight:700;color:${hit?"#4dde8c":"#ff8080"}">${pts2>0?"+"+pts2:""}</span>`:""}</div>
    <div style="display:flex;align-items:center;gap:4px">
      <span style="font-family:var(--ff-display);font-size:16px;font-weight:800;color:var(--qb-text);background:var(--qb-surface2);border:1px solid var(--qb-border2);border-radius:4px;padding:2px 7px;min-width:26px;text-align:center">${pred.h}</span>
      <span style="font-size:10px;color:var(--qb-muted)">–</span>
      <span style="font-family:var(--ff-display);font-size:16px;font-weight:800;color:var(--qb-text);background:var(--qb-surface2);border:1px solid var(--qb-border2);border-radius:4px;padding:2px 7px;min-width:26px;text-align:center">${pred.a}</span>
      ${played?`<span style="font-family:var(--ff-display);font-size:10px;font-weight:700;color:var(--qb-muted2);margin-left:3px;padding:2px 5px;border-radius:3px;background:var(--qb-surface3);border:1px solid var(--qb-border)">${s.h}–${s.a}</span>`:""}
    </div></div>`;
  }).join("")}</div></div>`;
}

function renderAdv(){
  const r=S.reality;
  const ri=`<div style="border:1px solid var(--qb-border);border-radius:12px;padding:.75rem .875rem;margin-bottom:.875rem;background:var(--qb-surface2)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
      <div class="sec" style="margin:0">Resultados reales del torneo</div>
      <button class="btn btn-sm btn-red" onclick="clearReality()">🗑 Limpiar</button>
    </div>
    <div class="ai"><label>Campeón ${r.champ&&(S.elimScores[104]||S.elimScores["104"])?"<span style=\"font-size:9px;color:var(--qb-green);margin-left:4px\">✓ auto</span>":""}</label><input type="text" value="${r.champ}" placeholder="País" style="width:130px" onchange="S.reality.champ=this.value;save()"></div>
    <div class="ai"><label>Subcampeón ${r.runner&&(S.elimScores[104]||S.elimScores["104"])?"<span style=\"font-size:9px;color:var(--qb-green);margin-left:4px\">✓ auto</span>":""}</label><input type="text" value="${r.runner}" placeholder="País" style="width:130px" onchange="S.reality.runner=this.value;save()"></div>
    <div class="ai"><label>3er lugar ${r.third&&(S.elimScores[103]||S.elimScores["103"])?"<span style=\"font-size:9px;color:var(--qb-green);margin-left:4px\">✓ auto</span>":""}</label><input type="text" value="${r.third}" placeholder="País" style="width:130px" onchange="S.reality.third=this.value;save()"></div>
    <div class="ai"><label>Goleador del torneo</label><input type="text" value="${r.topScorer}" placeholder="Jugador" style="width:145px" onchange="S.reality.topScorer=this.value;save()"></div>
    <div class="ai"><label>Goles del goleador</label><input type="number" value="${r.topScorerGoals||''}" placeholder="0" style="width:60px" onchange="S.reality.topScorerGoals=parseInt(this.value)||0;save()"></div>
    <div class="ai"><label>País más goleador</label><input type="text" value="${r.topCountry}" placeholder="País" style="width:130px" onchange="S.reality.topCountry=this.value;save()"></div>
    <div class="ai"><label>Goles de ese país</label><input type="number" value="${r.topCountryGoals||''}" placeholder="0" style="width:60px" onchange="S.reality.topCountryGoals=parseInt(this.value)||0;save()"></div>
    <div class="ai"><label>País más goleado (1 juego)</label><input type="text" value="${r.mostConceded}" placeholder="País" style="width:130px" onchange="S.reality.mostConceded=this.value;save()"></div>
  </div>`;
  const pidx=window._selA||0;window._selA=pidx;
  const sel=`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:.75rem">${PL.map((name,i)=>{const m=PM[name]||{};return`<button onclick="window._selA=${i};renderAdv()" class="btn btn-sm ${i===pidx?"btn-blue":""}">${flagEmoji(m.champFlag,13)} ${esc(sn(name))}</button>`;}).join("")}</div>`;
  const name=PL[pidx];if(!name){document.getElementById("ab").innerHTML=ri+sel;return;}
  const m=PM[name]||{};const ap=calcAdv(name);
  const spec=getDynamicSpec(name)||{};
  // Build read-only predictions display from las predicciones especiales dinámicas
  // Check prereqs for conditional scoring
  const scorerMatch=n(spec.scorer||"")&&n(r.topScorer)&&n(spec.scorer)===n(r.topScorer);
  const countryMatch=n(spec.topCountry||"")&&n(r.topCountry)&&n(spec.topCountry)===n(r.topCountry);

  // Auto-fill notice if champ/runner/third were auto-loaded
  const autoFilled=(r.champ||r.runner||r.third)?"":""

  const specItems=[
    {l:"🥇 Campeón",val:spec.champ,pts:15,real:r.champ,locked:false},
    {l:"🥈 Subcampeón",val:spec.runner,pts:10,real:r.runner,locked:false},
    {l:"🥉 3er lugar",val:spec.third,pts:8,real:r.third,locked:false},
    {l:"⚽ Goleador del torneo",val:spec.scorer,pts:12,real:r.topScorer,locked:false},
    {l:"⚽ Goles del goleador",val:spec.scorerGoals,pts:8,real:r.topScorerGoals,locked:!scorerMatch,lockReason:"requiere acertar el goleador"},
    {l:"🌍 País más goleador",val:spec.topCountry,pts:8,real:r.topCountry,locked:false},
    {l:"🌍 Goles de ese país",val:spec.topCountryGoals,pts:10,real:r.topCountryGoals,locked:!countryMatch,lockReason:"requiere acertar el país"},
    {l:"😬 País más goleado (1 juego)",val:spec.mostConceded,pts:8,real:r.mostConceded,locked:false},
  ];
  const specHtml=specItems.map(it=>{
    const matched=!it.locked&&it.real&&n(String(it.val||""))===n(String(it.real));
    const hasReal=!!it.real;
    let bg,bc;
    if(it.locked&&hasReal){bg="var(--qb-surface2)";bc="var(--qb-border)";}
    else if(hasReal&&matched){bg="rgba(0,200,83,.07)";bc="rgba(0,200,83,.4)";}
    else if(hasReal&&!matched){bg="rgba(212,0,26,.07)";bc="rgba(212,0,26,.4)";}
    else{bg="var(--qb-surface2)";bc="var(--qb-border)";}
    let badge;
    if(it.locked&&hasReal){
      badge=`<span style="font-size:9px;color:var(--qb-muted);font-style:italic">🔒 ${it.lockReason}</span>`;
    }else if(hasReal){
      badge=matched
        ?`<span style="color:#4dde8c;font-weight:700;font-size:10px">+${it.pts}pts</span>`
        :`<span style="color:#ff8080;font-size:10px">✗ ${it.real}</span>`;
    }else{
      badge=`<span style="color:var(--qb-muted);font-size:10px">⏳</span>`;
    }
    return`<div style="display:flex;align-items:center;gap:8px;padding:6px 9px;border:1px solid ${bc};border-radius:8px;margin-bottom:3px;background:${bg}${it.locked?"opacity:.7;":""}">
      <div style="flex:1;font-size:11px;color:${it.locked?"var(--qb-muted)":"var(--qb-text)"}">${it.l}</div>
      <div style="font-family:var(--ff-display);font-size:14px;font-weight:800;color:${it.locked?"var(--qb-muted)":"var(--qb-text)"}">${it.val||"—"}</div>
      <div style="font-size:10px;min-width:50px;text-align:right">${badge}</div>
    </div>`;
  }).join("");
  const abEl=document.getElementById("ab");if(!abEl)return;abEl.innerHTML=ri+sel+`<div style="border:1px solid var(--qb-border);border-radius:12px;padding:.75rem .875rem;background:var(--qb-surface)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem">
      <span style="font-weight:700;font-size:13px;color:var(--qb-text)">${flagEmoji(m.champFlag,15)} ${esc(name)}</span>
      <span class="pill pg">${ap} pts</span>
    </div>
    <div style="margin-bottom:.5rem;font-size:10px;color:var(--qb-muted);letter-spacing:.04em;text-transform:uppercase;font-family:var(--ff-display);font-weight:700">Predicciones especiales (del archivo maestro)</div>
    ${specHtml}
  </div>`;
}
function setAd(name,key,val){if(!S.adv[name])S.adv[name]={};S.adv[name][key]=val;save();}

// Auto-fill champ/runner/3rd from P103 (3rd place) and P104 (final) results
function autoFillRealityFromElim(){
  let changed=false;
  // P104 = Final: winner=champ, loser=runner
  const sc104=S.elimScores[104]||S.elimScores["104"];
  if(sc104){
    const teams104=getRealElimTeams(104);
    if(teams104){
      const champ=getRealWinner(104,false);
      const runner=getRealWinner(104,true);
      if(champ&&!S.reality.champ){S.reality.champ=champ;changed=true;}
      if(runner&&!S.reality.runner){S.reality.runner=runner;changed=true;}
      // Overwrite if already set but different (result may have been corrected)
      if(champ&&S.reality.champ&&n(S.reality.champ)!==n(champ)){S.reality.champ=champ;changed=true;}
      if(runner&&S.reality.runner&&n(S.reality.runner)!==n(runner)){S.reality.runner=runner;changed=true;}
    }
  }
  // P103 = 3rd place: winner=third
  const sc103=S.elimScores[103]||S.elimScores["103"];
  if(sc103){
    const third=getRealWinner(103,false);
    if(third&&!S.reality.third){S.reality.third=third;changed=true;}
    if(third&&S.reality.third&&n(S.reality.third)!==n(third)){S.reality.third=third;changed=true;}
  }
  if(changed){
    save();
    // Refresh adv panel if open
    if(document.getElementById("t-adv")?.style.display!=="none")renderAdv();
    renderRank();
    toast("🏆 Resultados finales cargados automáticamente en Avanzado");
  }
}

// ══════════════════════════════════════════════════════════════
// GOLEADORES — ESPN en vivo + manual
// ══════════════════════════════════════════════════════════════
const ESPN_CORE='https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/seasons/2026';
const LDR_TYPES=[1,2,3,4,5,6,7]; // All phases: groups, R32, R16, QF, SF, 3rd, Final

async function fetchESPNScorers(){
  const body=document.getElementById("gb");
  body.innerHTML=`<div class="es"><span class="spin" style="display:inline-block;font-size:24px">↻</span><br><br>Cargando goleadores desde ESPN…</div>`;
  try{
    // Collect goals across all tournament phases (same method as mundial-2026.html)
    const res=await Promise.all(LDR_TYPES.map(t=>
      fetch(`${ESPN_CORE}/types/${t}/leaders?limit=100`).then(r=>r.ok?r.json():null).catch(()=>null)
    ));
    const goalBucket={};
    res.filter(Boolean).forEach(j=>{
      (j.categories||[]).forEach(c=>{
        if(c.name!=="goals")return;
        (c.leaders||[]).forEach(l=>{
          const aid=((l.athlete?.$ref||"").match(/athletes\/(\d+)/)||[])[1];
          if(!aid)return;
          const tid=((l.team?.$ref||"").match(/teams\/(\d+)/)||[])[1];
          const cur=goalBucket[aid]||(goalBucket[aid]={v:0,tid});
          cur.v+=l.value||0;
          if(tid)cur.tid=tid;
        });
      });
    });
    const top=Object.entries(goalBucket).sort((a,b)=>b[1].v-a[1].v).slice(0,20);
    if(!top.length)throw new Error("Sin datos de goles aún");

    // Fetch athlete details in parallel (with localStorage cache, same as mundial-2026)
    const getAth=async(id)=>{
      const k="wb26_ath_"+id;
      try{const c=localStorage.getItem(k);if(c)return JSON.parse(c);}catch(e){}
      let o={n:"Jugador",p:""};
      try{
        const r=await fetch(`${ESPN_CORE.replace("/seasons/2026","")}/athletes/${id}`);
        if(r.ok){const j=await r.json();o={n:j.displayName||j.fullName||o.n,p:j.position?.abbreviation||""};}
      }catch(e){}
      try{localStorage.setItem(k,JSON.stringify(o));}catch(e){}
      return o;
    };
    // Fetch team names in parallel
    const getTeam=async(tid)=>{
      if(!tid)return{name:"",flag:""};
      const k="wb26_team_"+tid;
      try{const c=localStorage.getItem(k);if(c)return JSON.parse(c);}catch(e){}
      let o={name:"",flag:""};
      try{
        const r=await fetch(`${ESPN_CORE}/teams/${tid}`);
        if(r.ok){const j=await r.json();const t=j.team||j;o={name:t.displayName||t.name||"",flag:t.flag?.href||t.logos?.[0]?.href||""};}
      }catch(e){}
      try{localStorage.setItem(k,JSON.stringify(o));}catch(e){}
      return o;
    };

    const [aths,teams]=await Promise.all([
      Promise.all(top.map(([aid])=>getAth(aid))),
      Promise.all(top.map(([,o])=>getTeam(o.tid)))
    ]);

    const now=new Date().toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"});
    let html=`<div class="status-bar" style="margin-bottom:.625rem">
      <span class="sbadge ok">⚽ ESPN en vivo · ${now}</span>
      <button class="btn btn-sm btn-espn" onclick="fetchESPNScorers()" style="margin-left:4px">↻ Actualizar</button>
    </div>`;

    top.forEach(([aid,o],i)=>{
      const a=aths[i];const team=teams[i];
      const teamName=team.name||"";
      const flagIco=ALL_FLAGS[teamName]||ALL_FLAGS[espnNameES(teamName)]||"⚽";
      const isFirst=i===0;
      html+=`<div class="sr" style="${isFirst?"border-top:1px solid var(--qb-border);":""}">
        <span style="width:24px;font-family:var(--ff-display);font-size:${i<3?"15":"11"}px;font-weight:800;color:${i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#cd7f32":"var(--qb-muted)"}">
          ${i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
        </span>
        <span style="font-size:20px;line-height:1;flex-shrink:0">${flagIco}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;color:var(--qb-text)">${a.n}</div>
          <div style="font-size:10px;color:var(--qb-muted)">${teamName}</div>
        </div>
        <span style="font-family:var(--ff-display);font-size:22px;font-weight:900;color:var(--qb-blue);min-width:32px;text-align:right">${o.v}</span>
        <span style="font-size:10px;color:var(--qb-muted);margin-left:2px">⚽</span>
      </div>`;
    });
    body.innerHTML=html;
  }catch(e){
    // Fallback to manual
    renderScorers(true);
    const statusDiv=document.createElement("div");
    statusDiv.innerHTML=`<span class="sbadge warn" style="margin-bottom:.5rem;display:inline-flex">⚠️ ESPN aún sin datos — mostrando tabla manual</span>`;
    body.prepend(statusDiv.firstChild);
  }
}

function renderScorers(silent=false){
  const body=document.getElementById("gb");
  if(!S.scorers.length){
    body.innerHTML=`<div class="es">Sin goleadores aún ⚽<br><br><button class="btn btn-espn btn-sm" onclick="fetchESPNScorers()">⚡ Cargar desde ESPN</button></div>`;
    return;
  }
  let html=`<div class="status-bar" style="margin-bottom:.5rem">
    <span class="sbadge info">📋 Datos manuales</span>
    <button class="btn btn-sm btn-espn" onclick="fetchESPNScorers()" style="margin-left:4px">⚡ ESPN en vivo</button>
  </div>`;
  html+=[...S.scorers].sort((a,b)=>b.goals-a.goals).map((s,i)=>{
    const flagIco=ALL_FLAGS[s.country]||"⚽";
    return`<div class="sr">
      <span style="width:18px;font-family:var(--ff-display);font-size:11px;font-weight:700;color:var(--qb-muted)">${i+1}</span>
      <span style="font-size:16px;line-height:1">${flagIco}</span>
      <div style="flex:1"><div style="font-weight:600;font-size:12px;color:var(--qb-text)">${esc(s.name)}</div><div style="font-size:10px;color:var(--qb-muted)">${esc(s.country||"")}</div></div>
      <span class="pill pb">${s.goals} ⚽</span>
      <button class="btn btn-red btn-sm js-rm-scorer" data-sname="${esc(s.name)}">✕</button>
    </div>`;
  }).join("");
  body.innerHTML=html;
}
function addScorer(){const name=document.getElementById("sn").value.trim(),country=document.getElementById("sc2").value.trim(),goals=parseInt(document.getElementById("sg").value)||1;if(!name)return;const ex=S.scorers.find(s=>s.name.toLowerCase()===name.toLowerCase());if(ex)ex.goals=goals;else S.scorers.push({name,country,goals});document.getElementById("sn").value="";document.getElementById("sc2").value="";document.getElementById("sg").value="";save();renderScorers();toast("✓ Actualizado");}
function rmS(name){S.scorers=S.scorers.filter(s=>s.name!==name);save();renderScorers();}

// v1.5.3 — Fase 0 de seguridad: antes el botón ✕ de goleadores era
// onclick="rmS('${s.name.replace(/'/g,"\\'")}')" — el escape de comillas
// acá SÍ funcionaba bien (a diferencia del de app-bracket-view.js), pero
// se migra igual a data-attribute + listener delegado por consistencia
// con el resto del proyecto: un solo patrón para todos los botones que
// llevan un nombre libre adentro, más fácil de auditar a futuro.
document.addEventListener("click",(ev)=>{
  const rmBtn=ev.target.closest(".js-rm-scorer");
  if(rmBtn){rmS(rmBtn.dataset.sname);}
});

function renderRules(){
  const ruleRow=(r,color)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--qb-border);font-size:11px;color:var(--qb-text)"><span>${r.l}</span><span class="pill" style="background:${color.bg};color:${color.fg};border:1px solid ${color.bc}">${r.p} pts</span></div>`;
  document.getElementById("rbasic").innerHTML=BRULES.map(r=>ruleRow(r,{bg:"var(--qb-blue-dim)",fg:"#6ab8f7",bc:"rgba(20,120,200,.35)"})).join("");
  document.getElementById("radv").innerHTML=ARULES.map(r=>ruleRow(r,{bg:"var(--qb-green-dim)",fg:"#4dde8c",bc:"rgba(0,200,83,.35)"})).join("");
  document.getElementById("relim").innerHTML=ELIMRULES.map(r=>ruleRow(r,{bg:"rgba(124,58,237,.18)",fg:"#c4b5fd",bc:"rgba(124,58,237,.35)"})).join("");
  document.getElementById("rlast").innerHTML=LASTRULES.map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--qb-border);font-size:11px;color:var(--qb-text)"><span>${r.l}</span><span class="pill" style="background:rgba(245,166,35,.14);color:#f5c842;border:1px solid rgba(245,166,35,.35)">${r.p} pts</span></div>`).join("");
}

// ══════════════════════════════════════════════════════════════
