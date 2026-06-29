/* ════════════════════════════════════════════════════════════
   app-bracket-espn-live.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Sincronización en vivo con ESPN para resultados de eliminatoria, con protección de conflictos.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): ESPN — con protección de conflictos

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

// ESPN — con protección de conflictos
// ══════════════════════════════════════════════════════════════
const ESPN_API="https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const ALL_DATES=["20260611","20260612","20260613","20260614","20260615","20260616","20260617","20260618","20260619","20260620","20260621","20260622","20260623","20260624","20260625","20260626","20260627"];

async function fetchAllDates(dates){
  const results=await Promise.allSettled(dates.map(d=>fetch(`${ESPN_API}?dates=${d}&limit=50`).then(r=>r.ok?r.json():null).catch(()=>null)));
  const evts=[];
  results.forEach(r=>{if(r.status==="fulfilled"&&r.value?.events)r.value.events.forEach(ev=>evts.push(ev));});
  return evts;
}

// Cola de conflictos
function openConflict(mid,manual,espn,callback){
  const m=MD[mid];const lbl=m?.lbl||`Partido ${mid}`;
  document.getElementById("conflict-body").innerHTML=
    `<strong>${lbl}</strong><br><br>
     · Resultado manual guardado: <strong>${manual.h}-${manual.a}</strong><br>
     · ESPN trae ahora: <strong>${espn.h}-${espn.a}</strong><br><br>
     ¿Cuál quieres conservar?`;
  _conflictCurrent={mid,manual,espn,callback};
  document.getElementById("conflict-overlay").style.display="flex";
}
function resolveConflict(choice){
  if(!_conflictCurrent)return;
  const{mid,manual,espn,callback}=_conflictCurrent;
  if(choice==="espn"){saveScore(mid,espn.h,espn.a,{live:espn.live||false});}
  _conflictCurrent=null;
  document.getElementById("conflict-overlay").style.display="none";
  // Continuar con la cola
  if(_conflictQueue.length>0){const next=_conflictQueue.shift();openConflict(next.mid,next.manual,next.espn,next.callback);}
  else{renderFix();renderRank();toast("✓ Conflictos resueltos");}
}
function closeConflict(){resolveConflict("keep");}

async function fetchESPN(){
  const sp=document.getElementById("fi-spin");const tx=document.getElementById("fi-txt");
  if(sp)sp.classList.add("spin");if(tx)tx.textContent="Cargando...";
  setFS(`<span style="color:var(--qb-muted);font-size:10px"><span class="spin" style="display:inline-block">↻</span> Consultando ESPN…</span>`);
  try{
    const evts=await fetchAllDates(ALL_DATES);
    let updated=0,live=0,conflicts=0;
    _conflictQueue=[];
    evts.forEach(ev=>{
      const p=parseESPNEvent(ev);if(!p)return;
      // Always save match time if available
      if(ev.date&&!S.matchTimes[p.mid]){
        S.matchTimes[p.mid]=ev.date;
      }
      if(p.state==="post"||p.state==="in"){
        // CAPA 1: Validar resultado ESPN antes de procesar
        const vr=validateScore(p.mid,p.homeScore,p.awayScore);
        if(!vr.ok){console.warn(`ESPN P${p.mid} rechazado: ${vr.err}`);return;}
        const existing=sc(p.mid);
        if(existing&&!existing.live&&(existing.h!==p.homeScore||existing.a!==p.awayScore)&&p.state==="post"){
          // Hay conflicto: hay resultado manual y ESPN trae algo diferente
          conflicts++;
          _conflictQueue.push({mid:p.mid,manual:existing,espn:{h:p.homeScore,a:p.awayScore,live:false}});
        } else {
          // Sin conflicto: guardar directamente
          saveScore(p.mid,p.homeScore,p.awayScore,{live:p.state==="in"});
          updated++;if(p.state==="in")live++;
        }
      }
    });
    save();
    const now=new Date().toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"});
    const lH=live>0?`<span class="sbadge" style="background:rgba(212,0,26,.18);color:#ff8080;border:1px solid rgba(212,0,26,.4)"><span class="ldot" style="width:5px;height:5px;margin-right:2px"></span>${live} en vivo</span>`:"";
    const cH=conflicts>0?`<span class="sbadge warn">⚠️ ${conflicts} conflicto(s)</span>`:"";
    setFS(`<span class="sbadge ok">✓ ESPN · ${updated} resultados</span>${lH}${cH}<span style="color:var(--qb-muted)">${now}</span>`);
    if(conflicts>0){
      // Abrir primer conflicto de la cola
      const first=_conflictQueue.shift();
      openConflict(first.mid,first.manual,first.espn);
    } else {
      renderFix();renderRank();updateGenerarBtn();
      toast(updated>0?`✓ ${updated} resultados`:"Sin resultados nuevos");
    }
  }catch(e){setFS(`<span class="sbadge err">⚠️ Error: ${e.message}</span>`);toast("Error ESPN",true);}
  if(sp)sp.classList.remove("spin");if(tx)tx.textContent="ESPN Live";
}

function startMMT(){stopMMT();mmS=30;mmT=setInterval(()=>{mmS--;const el=document.getElementById("mm-cd");if(el)el.textContent=`Auto-actualiza en ${mmS}s`;if(mmS<=0){mmS=30;loadMM(false);}},1000);}
function stopMMT(){if(mmT){clearInterval(mmT);mmT=null;}}

async function loadMM(showSpinner=false){
  const sp=document.getElementById("mm-spin");const tx=document.getElementById("mm-txt");
  if(showSpinner){if(sp)sp.classList.add("spin");if(tx)tx.textContent="Cargando...";}
  const statusEl=document.getElementById("mm-status");
  try{
    const pad=n=>String(n).padStart(2,"0");const today=new Date();
    const d1=`${today.getFullYear()}${pad(today.getMonth()+1)}${pad(today.getDate())}`;
    const tmrw=new Date(today);tmrw.setDate(tmrw.getDate()+1);
    const d2=`${tmrw.getFullYear()}${pad(tmrw.getMonth()+1)}${pad(tmrw.getDate())}`;
    const evts=await fetchAllDates([d1,d2]);
    const now=new Date().toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"});
    const parsed=evts.map(ev=>({ev,p:parseESPNEvent(ev)})).filter(x=>x.p);
    const liveOnes=parsed.filter(x=>x.p.state==="in");
    const preOnes=parsed.filter(x=>x.p.state==="pre").sort((a,b)=>new Date(a.ev.date)-new Date(b.ev.date));
    if(statusEl)statusEl.innerHTML=`<span class="sbadge info">ESPN · ${now}</span>${liveOnes.length?`<span class="sbadge" style="background:rgba(212,0,26,.18);color:#ff8080;border:1px solid rgba(212,0,26,.4)"><span class="ldot" style="width:5px;height:5px;margin-right:2px"></span>${liveOnes.length} en vivo</span>`:""}`;
    renderMM(liveOnes,preOnes);
  }catch(e){if(statusEl)statusEl.innerHTML=`<span class="sbadge err">⚠️ Sin conexión ESPN</span>`;}
  if(showSpinner){if(sp)sp.classList.remove("spin");if(tx)tx.textContent="Actualizar";}
}

function predGroups(mid){const g={};PL.forEach(name=>{const p=MD[mid]?.preds[name];if(!p)return;const k=`${p.h}-${p.a}`;if(!g[k])g[k]=[];g[k].push(sn(name));});return g;}

function renderMM(liveList,preList){
  const body=document.getElementById("mm-body");if(!body)return;
  const showLive=liveList;const showNext=preList.slice(0,4);let html="";
  function buildCard(parsed,ev,isLive){
    const mid=parsed.mid;const g=MGMAP[mid]||"";const lbl=MD[mid]?.lbl||"";
    const pts=lbl.split(" vs ");const hN=(pts[0]||"").trim();const aN=(pts[1]||"").trim();
    const hF=getFlag(g,hN);const aF=getFlag(g,aN);
    const pgs=predGroups(mid);const sorted=Object.entries(pgs).sort((a,b)=>b[1].length-a[1].length);
    if(isLive){
      const hs=parsed.homeScore;const as=parsed.awayScore;const curKey=`${hs}-${as}`;
      const predsHtml=sorted.map(([score,names])=>{const hit=score===curKey;
        return`<div class="pred-row"><div class="pred-row-hdr"><span class="spill ${hit?"match":""}">${score.replace("-"," – ")}</span><span class="cpill">${names.length}</span>${hit?`<span style="font-size:10px;color:#15803d;font-weight:500">← actual</span>`:""}</div><div class="names">${names.map(n=>`<span class="nchip ${hit?"hit":""}">${n}</span>`).join("")}</div></div>`;
      }).join("")||`<div style="font-size:11px;color:var(--qb-muted);padding:4px 0">Sin predicciones</div>`;
      return`<div class="live-card is-live"><div class="live-hdr"><div style="display:flex;align-items:center;gap:6px"><span class="ldot"></span><span style="font-family:var(--ff-display);font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--qb-red);text-transform:uppercase">EN VIVO</span>${parsed.clock?`<span style="font-size:11px;color:var(--qb-muted)">${parsed.clock}'</span>`:""}</div><span style="font-size:10px;color:var(--qb-muted)">Grupo ${g} · P${mid}</span></div><div class="scoreboard"><div class="live-team"><span class="live-team-flag">${hF}</span><span class="live-team-name">${hN}</span></div><div class="live-score red">${hs} – ${as}</div><div class="live-team"><span class="live-team-flag">${aF}</span><span class="live-team-name">${aN}</span></div></div><div style="padding:0 14px 6px;font-family:var(--ff-display);font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);text-transform:uppercase">Predicciones de los 27</div><div class="pred-section">${predsHtml}</div></div>`;
    }else{
      const ko=new Date(ev.date).toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"});
      const koDate=new Date(ev.date).toLocaleDateString("es",{weekday:"short",day:"numeric",month:"short"});
      const predsHtml=sorted.map(([score,names])=>`<div class="pred-row"><div class="pred-row-hdr"><span class="spill">${score.replace("-"," – ")}</span><span class="cpill">${names.length}</span></div><div class="names">${names.map(n=>`<span class="nchip">${n}</span>`).join("")}</div></div>`).join("");
      return`<div class="live-card"><div class="live-hdr"><span style="font-family:var(--ff-display);font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--qb-text)">Grupo ${g} · ${lbl}</span><span style="font-size:11px;color:var(--qb-muted)">⏱ ${ko} · ${koDate}</span></div><div class="scoreboard" style="padding:13px 14px 8px"><div class="live-team"><span class="live-team-flag">${hF}</span><span class="live-team-name">${hN}</span></div><div class="live-score" style="font-family:var(--ff-display);font-size:28px;font-weight:900;color:var(--qb-muted)">VS</div><div class="live-team"><span class="live-team-flag">${aF}</span><span class="live-team-name">${aN}</span></div></div>${predsHtml?`<div style="padding:0 14px 6px;font-family:var(--ff-display);font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);text-transform:uppercase">Predicciones</div><div class="pred-section">${predsHtml}</div>`:""}</div>`;
    }
  }
  showLive.forEach(({ev,p})=>{html+=buildCard(p,ev,true);});
  if(showNext.length){if(showLive.length)html+=`<div style="font-family:var(--ff-display);font-size:10px;font-weight:700;letter-spacing:.07em;color:var(--qb-muted);text-transform:uppercase;margin:4px 0 8px">Próximos</div>`;showNext.forEach(({ev,p})=>{html+=buildCard(p,ev,false);});}
  if(!showLive.length&&!showNext.length){html=`<div class="mm-empty"><div style="font-size:32px;margin-bottom:.5rem">⚽</div><div style="font-family:var(--ff-display);font-size:16px;font-weight:700;letter-spacing:.03em;color:var(--qb-text);margin-bottom:.5rem">No hay partidos ahora mismo</div><div>Cuando empiece un partido aparecerá aquí con predicciones de los 27.</div><div style="margin-top:.75rem;font-size:10px;color:var(--qb-muted)">Auto-actualiza cada 30 segundos</div></div>`;}
  body.innerHTML=html;
}

// ══════════════════════════════════════════════════════════════
