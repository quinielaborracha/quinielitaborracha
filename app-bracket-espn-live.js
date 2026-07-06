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

// v1.7 — Movidas acá desde app-admin-auth.js (vivían ahí por accidente
// histórico de orden en el app.js monolítico original): mmT/mmS son el
// timer del "matchmaker" en vivo (loadMM/startMMT, más abajo), y
// _conflictQueue/_conflictCurrent son la cola de conflictos manual-vs-ESPN
// de resultados de FASE DE GRUPOS (openConflict/resolveConflict, más
// abajo) — ningún otro archivo las lee ni las escribe.
let mmT=null,mmS=0;
let _conflictQueue=[],_conflictCurrent=null;

// v3.8.4 — timeout de red compartido por los 2 llamadores (fetchESPN()
// acá abajo, y loadMM() más adelante en este archivo): sin esto, un
// fetch colgado a ESPN podía dejar cualquiera de las dos corridas
// esperando indefinidamente (ver auditoría 2026-07-05, mismo hallazgo que
// ya se cerró para la eliminatoria en app-bracket-espn-sync.js).
async function fetchAllDates(dates){
  const timeoutCtrl=new AbortController();
  const timeoutId=setTimeout(()=>timeoutCtrl.abort(),15000);
  try{
    const results=await Promise.allSettled(dates.map(d=>fetch(`${ESPN_API}?dates=${d}&limit=50`,{signal:timeoutCtrl.signal}).then(r=>r.ok?r.json():null).catch(()=>null)));
    const evts=[];
    results.forEach(r=>{if(r.status==="fulfilled"&&r.value?.events)r.value.events.forEach(ev=>evts.push(ev));});
    return evts;
  }finally{
    clearTimeout(timeoutId);
  }
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

// v3.8.4 — guardia de reentrada: fetchESPN() se dispara cada vez que se
// abre la sub-pestaña Fixture → Grupos (app-tabs.js); sin esto, entrar y
// salir rápido de esa sub-pestaña varias veces podía solapar corridas y
// resetear _conflictQueue a mitad de la anterior (mismo patrón que ya se
// cerró para fetchESPNElim(), app-bracket-espn-sync.js).
let _espnGruposFetchInFlight=false;

async function fetchESPN(){
  if(_espnGruposFetchInFlight)return;
  _espnGruposFetchInFlight=true;
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
  finally{
    _espnGruposFetchInFlight=false;
    if(sp)sp.classList.remove("spin");if(tx)tx.textContent="ESPN Live";
  }
}

// v1.1 — Bug #3 (playbook eliminatoria): parseESPNEvent() solo reconoce
// partidos por par fijo de abreviaturas (ESPN_ABBR_MAP), que únicamente
// cubre los 72 partidos de grupos — los cruces de eliminatoria son
// dinámicos y no tienen un par fijo. Esta función es el camino paralelo
// que SÍ reconoce eliminatoria, usando el MISMO mecanismo por gameId que
// ya usa fetchESPNElim() (ESPN_GAMEID_TO_PID) para guardar los resultados
// oficiales — así no se duplica el criterio de qué gameId es cada cruce.
// No toca ni reemplaza parseESPNEvent(): se usa solo como respaldo cuando
// esa no reconoce el evento (ver loadMM()).
function parseESPNEventElim(ev){
  const pid=ESPN_GAMEID_TO_PID[String(ev.id)];
  if(!pid)return null;
  const comp=ev.competitions?.[0]||{};const comps=comp.competitors||[];if(comps.length<2)return null;
  const home=comps.find(c=>c.homeAway==="home")||comps[0];
  const away=comps.find(c=>c.homeAway==="away")||comps[1];
  const homeTeam=espnNameES(home.team?.displayName||"");
  const awayTeam=espnNameES(away.team?.displayName||"");
  const st=ev.status||comp.status;const state=st?.type?.state||"pre";const clock=st?.displayClock||"";
  const hs=parseInt(home.score)||0;const as=parseInt(away.score)||0;
  return{mid:pid,state,clock,homeScore:hs,awayScore:as,homeTeam,awayTeam,isElim:true};
}

function startMMT(){stopMMT();mmS=30;mmT=setInterval(()=>{mmS--;const el=document.getElementById("mm-cd");if(el)el.textContent=`Auto-actualiza en ${mmS}s`;if(mmS<=0){mmS=30;loadMM(false);}},1000);}
function stopMMT(){if(mmT){clearInterval(mmT);mmT=null;}}

// v3.8.4 — guardia de reentrada: startMMT() llama a loadMM(false) cada
// 30s mientras la pestaña "En vivo" está abierta, y volver a entrar a esa
// pestaña llama a loadMM(true) de nuevo -- sin esto, ambos disparadores
// podían solaparse si ESPN tardaba más de 30s en responder.
let _mmLoadInFlight=false;

async function loadMM(showSpinner=false){
  if(_mmLoadInFlight)return;
  _mmLoadInFlight=true;
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
    const parsed=evts.map(ev=>({ev,p:parseESPNEvent(ev)||parseESPNEventElim(ev)})).filter(x=>x.p); // v1.1 — fallback a eliminatoria si no es un partido de grupos
    const liveOnes=parsed.filter(x=>x.p.state==="in");
    const preOnes=parsed.filter(x=>x.p.state==="pre").sort((a,b)=>new Date(a.ev.date)-new Date(b.ev.date));
    if(statusEl)statusEl.innerHTML=`<span class="sbadge info">ESPN · ${now}</span>${liveOnes.length?`<span class="sbadge" style="background:rgba(212,0,26,.18);color:#ff8080;border:1px solid rgba(212,0,26,.4)"><span class="ldot" style="width:5px;height:5px;margin-right:2px"></span>${liveOnes.length} en vivo</span>`:""}`;
    renderMM(liveOnes,preOnes);
  }catch(e){if(statusEl)statusEl.innerHTML=`<span class="sbadge err">⚠️ Sin conexión ESPN</span>`;}
  finally{
    _mmLoadInFlight=false;
    if(showSpinner){if(sp)sp.classList.remove("spin");if(tx)tx.textContent="Actualizar";}
  }
}

function predGroups(mid){const g={};PL.forEach(name=>{const p=MD[mid]?.preds[name];if(!p)return;const k=`${p.h}-${p.a}`;if(!g[k])g[k]=[];g[k].push(sn(name));});return g;}

// v1.1 — Bug #3: equivalente a predGroups() pero para partidos de
// eliminatoria. Solo agrupa a quienes tienen la llave correcta para este
// pid (isLlaveCorrecta, scoring.js) — si la llave no coincide, su
// marcador predicho es para un cruce distinto y mostrarlo acá confundiría
// más de lo que ayuda. No duplica el criterio de "acierto": reusa la
// misma función que ya usa el desglose de puntos.
function predGroupsElim(pid){const g={};PL.forEach(name=>{if(!isLlaveCorrecta(name,pid))return;const p=elimPred(name,pid);if(!p)return;const k=`${p.h}-${p.a}`;if(!g[k])g[k]=[];g[k].push(sn(name));});return g;}

// v1.9 — BUG REPORTADO: la tarjeta de "En vivo" para un cruce de
// eliminatoria no mostraba nada de predicciones porque predGroupsElim()
// exige la llave EXACTA (los 2 equipos puntuales) para ese pid puntual —
// con el bracket dinámico (cada participante arma el suyo desde SUS
// PROPIOS resultados de grupo), es común que casi nadie tenga
// exactamente ese cruce si sus grupos no salieron 100% iguales a la
// realidad, aunque muchísimos sí hayan apostado a que ese equipo (ej.
// Portugal) pasa de ronda. Esta sección nueva ("¿Quién avanza?") usa
// getTeamAdvancePickers() (scoring.js) -- por EQUIPO, no por cruce
// exacto -- para mostrar esa apuesta más amplia, debajo de la sección de
// Predicciones (que sigue siendo la llave+marcador exacto). Solo aplica
// a partidos de eliminatoria (los de grupos no tienen "avanzar").
function buildAdvanceHtml(mid,hN,aN,hF,aF){
  const round=ELIM_ROUNDS.find(r=>r.ids.includes(mid));
  const roundIds=round?round.ids:[mid];
  const hPickers=getTeamAdvancePickers(hN,roundIds);
  const aPickers=getTeamAdvancePickers(aN,roundIds);
  if(!hPickers.length&&!aPickers.length)return"";
  const col=(flag,team,names)=>`<div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="font-size:14px">${flag}</span>
        <span style="font-family:var(--ff-display);font-size:11px;font-weight:700;color:var(--qb-text);text-transform:uppercase;letter-spacing:.03em">${esc(team)}</span>
        <span class="cpill">${names.length}</span>
      </div>
      <div class="names">${names.map(x=>`<span class="nchip">${esc(sn(x))}</span>`).join("")||`<span style="font-size:10px;color:var(--qb-muted)">Nadie todavía</span>`}</div>
    </div>`;
  const sides=[{flag:hF,team:hN,names:hPickers},{flag:aF,team:aN,names:aPickers}].sort((a,b)=>b.names.length-a.names.length);
  return`<div style="padding:10px 14px 14px;border-top:1px solid var(--qb-border)">
    <div style="font-family:var(--ff-display);font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);text-transform:uppercase;margin-bottom:8px">¿Quién avanza?</div>
    <div style="display:flex;gap:14px">${sides.map(s=>col(s.flag,s.team,s.names)).join("")}</div>
  </div>`;
}

function renderMM(liveList,preList){
  const body=document.getElementById("mm-body");if(!body)return;
  const showLive=liveList;const showNext=preList.slice(0,4);let html="";
  function buildCard(parsed,ev,isLive){
    const mid=parsed.mid;
    let g,lbl,hN,aN,hF,aF,pgs;
    if(parsed.isElim){
      // v1.1 — Bug #3: cruce de eliminatoria, no hay par fijo de grupo;
      // equipos y label de ronda vienen del evento ESPN / phaseForPid().
      g=phaseForPid(mid)?.label||"Eliminatoria";
      hN=parsed.homeTeam;aN=parsed.awayTeam;lbl=`${hN} vs ${aN}`;
      hF=getFlag(null,hN);aF=getFlag(null,aN);
      pgs=predGroupsElim(mid);
    }else{
      g=MGMAP[mid]||"";lbl=MD[mid]?.lbl||"";
      const pts=lbl.split(" vs ");hN=(pts[0]||"").trim();aN=(pts[1]||"").trim();
      hF=getFlag(g,hN);aF=getFlag(g,aN);
      pgs=predGroups(mid);
    }
    const gLbl=parsed.isElim?g:`Grupo ${g}`;
    const sorted=Object.entries(pgs).sort((a,b)=>b[1].length-a[1].length);
    const advanceHtml=parsed.isElim?buildAdvanceHtml(mid,hN,aN,hF,aF):"";
    if(isLive){
      const hs=parsed.homeScore;const as=parsed.awayScore;const curKey=`${hs}-${as}`;
      const predsHtml=sorted.map(([score,names])=>{const hit=score===curKey;
        return`<div class="pred-row"><div class="pred-row-hdr"><span class="spill ${hit?"match":""}">${score.replace("-"," – ")}</span><span class="cpill">${names.length}</span>${hit?`<span style="font-size:10px;color:#15803d;font-weight:500">← actual</span>`:""}</div><div class="names">${names.map(n=>`<span class="nchip ${hit?"hit":""}">${esc(n)}</span>`).join("")}</div></div>`;
      }).join("")||`<div style="font-size:11px;color:var(--qb-muted);padding:4px 0">Sin predicciones</div>`;
      return`<div class="live-card is-live"><div class="live-hdr"><div style="display:flex;align-items:center;gap:6px"><span class="ldot"></span><span style="font-family:var(--ff-display);font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--qb-red);text-transform:uppercase">EN VIVO</span>${parsed.clock?`<span style="font-size:11px;color:var(--qb-muted)">${parsed.clock}'</span>`:""}</div><span style="font-size:10px;color:var(--qb-muted)">${gLbl} · P${mid}</span></div><div class="scoreboard"><div class="live-team"><span class="live-team-flag">${hF}</span><span class="live-team-name">${hN}</span></div><div class="live-score red">${hs} – ${as}</div><div class="live-team"><span class="live-team-flag">${aF}</span><span class="live-team-name">${aN}</span></div></div><div style="padding:0 14px 6px;font-family:var(--ff-display);font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);text-transform:uppercase">Predicciones de los 27</div><div class="pred-section">${predsHtml}</div>${advanceHtml}</div>`;
    }else{
      const ko=new Date(ev.date).toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"});
      const koDate=new Date(ev.date).toLocaleDateString("es",{weekday:"short",day:"numeric",month:"short"});
      const predsHtml=sorted.map(([score,names])=>`<div class="pred-row"><div class="pred-row-hdr"><span class="spill">${score.replace("-"," – ")}</span><span class="cpill">${names.length}</span></div><div class="names">${names.map(n=>`<span class="nchip">${esc(n)}</span>`).join("")}</div></div>`).join("");
      return`<div class="live-card"><div class="live-hdr"><span style="font-family:var(--ff-display);font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--qb-text)">${gLbl} · ${lbl}</span><span style="font-size:11px;color:var(--qb-muted)">⏱ ${ko} · ${koDate}</span></div><div class="scoreboard" style="padding:13px 14px 8px"><div class="live-team"><span class="live-team-flag">${hF}</span><span class="live-team-name">${hN}</span></div><div class="live-score" style="font-family:var(--ff-display);font-size:28px;font-weight:900;color:var(--qb-muted)">VS</div><div class="live-team"><span class="live-team-flag">${aF}</span><span class="live-team-name">${aN}</span></div></div>${predsHtml?`<div style="padding:0 14px 6px;font-family:var(--ff-display);font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--qb-muted);text-transform:uppercase">Predicciones</div><div class="pred-section">${predsHtml}</div>`:""}${advanceHtml}</div>`;
    }
  }
  showLive.forEach(({ev,p})=>{html+=buildCard(p,ev,true);});
  if(showNext.length){if(showLive.length)html+=`<div style="font-family:var(--ff-display);font-size:10px;font-weight:700;letter-spacing:.07em;color:var(--qb-muted);text-transform:uppercase;margin:4px 0 8px">Próximos</div>`;showNext.forEach(({ev,p})=>{html+=buildCard(p,ev,false);});}
  if(!showLive.length&&!showNext.length){html=`<div class="mm-empty"><div style="font-size:32px;margin-bottom:.5rem">⚽</div><div style="font-family:var(--ff-display);font-size:16px;font-weight:700;letter-spacing:.03em;color:var(--qb-text);margin-bottom:.5rem">No hay partidos ahora mismo</div><div>Cuando empiece un partido aparecerá aquí con predicciones de los 27.</div><div style="margin-top:.75rem;font-size:10px;color:var(--qb-muted)">Auto-actualiza cada 30 segundos</div></div>`;}
  body.innerHTML=html;
}

// ══════════════════════════════════════════════════════════════
