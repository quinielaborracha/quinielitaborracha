/* ════════════════════════════════════════════════════════════
   app-bracket-espn-sync.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Sincronización con ESPN para la fase eliminatoria (P73-P104) y resolución de conflictos de llave.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): ESPN — ELIMINATORIA (P73-P104); CONFLICTO DE LLAVE DE ELIMINATORIA

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

// ESPN — ELIMINATORIA (P73-P104)
// ══════════════════════════════════════════════════════════════
// Traducción de nombres ESPN (en) → español para los equipos
const ESPN_NAME_ES={
  "Mexico":"México","South Korea":"Corea del Sur","Czech Republic":"República Checa","Czechia":"República Checa",
  "Bosnia and Herzegovina":"Bosnia y Herzegovina","Qatar":"Catar","Switzerland":"Suiza",
  "Brazil":"Brasil","Morocco":"Marruecos","Haiti":"Haití","Scotland":"Escocia",
  "United States":"Estados Unidos","USA":"Estados Unidos","Turkey":"Turquía","Turkiye":"Turquía","Türkiye":"Turquía",
  "Germany":"Alemania","Ivory Coast":"Costa de Marfil","Cote d'Ivoire":"Costa de Marfil","Côte d'Ivoire":"Costa de Marfil","Ecuador":"Ecuador",
  "Netherlands":"Países Bajos","Japan":"Japón","Sweden":"Suecia","Tunisia":"Túnez",
  "Saudi Arabia":"Arabia Saudita","Uruguay":"Uruguay","Spain":"España","Cape Verde":"Cabo Verde",
  "Iran":"Irán","New Zealand":"Nueva Zelanda","Belgium":"Bélgica","Egypt":"Egipto",
  "France":"Francia","Senegal":"Senegal","Iraq":"Irak","Norway":"Noruega",
  "Argentina":"Argentina","Algeria":"Argelia","Austria":"Austria","Jordan":"Jordania",
  "Portugal":"Portugal","DR Congo":"RD Congo","Congo DR":"RD Congo","Congo":"RD Congo","Uzbekistan":"Uzbekistán",
  "Colombia":"Colombia","England":"Inglaterra","Croatia":"Croacia","Ghana":"Ghana","Panama":"Panamá",
  "Paraguay":"Paraguay","Australia":"Australia","Korea Republic":"Corea del Sur","Curacao":"Curazao","Curaçao":"Curazao",
  "Canada":"Canadá","Bosnia-Herzegovina":"Bosnia y Herzegovina","South Africa":"Sudáfrica",
};

// Rango de fechas usado para consultar el scoreboard de ESPN — ya NO se
// usa para identificar el slot (eso es directo por ESPN_GAMEID_TO_PID, ver
// arriba), solo acota la ventana de la consulta.
const ELIM_DATES=["20260628","20260629","20260630","20260701","20260702","20260703","20260704","20260705","20260706","20260707","20260709","20260710","20260711","20260712","20260714","20260715","20260718","20260719"];

// Equipos "reales" conocidos hoy para un pid de eliminatoria, para poder
// comparar orientación/identidad contra lo que reporta ESPN. Para 1/16
// (73-88) viene de S.elimTeams; de Octavos en adelante viene de
// getRealElimTeams(), que resuelve recursivamente contra ELIM_TREE y los
// resultados de la fase previa (ya debería estar cerrada, ver
// getFirstBlockedElimPhase()).
function equiposConocidosElim(pid){
  if(ELIM_1_16_IDS.includes(pid))return(S.elimTeams[pid]&&S.elimTeams[pid].h)?S.elimTeams[pid]:null;
  return getRealElimTeams(pid);
}

async function fetchESPNElim(){
  const sp=document.getElementById("ei-spin");const tx=document.getElementById("ei-txt");
  if(sp)sp.classList.add("spin");if(tx)tx.textContent="Cargando...";
  setES(`<span style="color:var(--qb-muted);font-size:10px"><span class="spin" style="display:inline-block">↻</span> Consultando ESPN…</span>`);
  try{
    const results=await Promise.allSettled(ELIM_DATES.map(d=>fetch(`${ESPN_API}?dates=${d}&limit=50`).then(r=>r.ok?r.json():null).catch(()=>null)));
    const evts=[];
    results.forEach(r=>{if(r.status==="fulfilled"&&r.value?.events)r.value.events.forEach(ev=>evts.push(ev));});

    let updated=0,live=0,teamsLoaded=0,teamsCorrected=0;
    const changedPids=[]; // v2.3 — mejora visual: qué filas flashear tras renderElim()
    _elimConflictQueue=[];
    const pidsEnConflicto=new Set();

    evts.forEach(ev=>{
      // v7.0 — El partido se identifica por el gameId fijo de ESPN (ver
      // ESPN_GAMEID_TO_PID), no por nombre de equipo ni por orden
      // cronológico. Si el gameId no está en el mapa, no es uno de los 32
      // cruces de eliminatoria que rastreamos (es de fase de grupos).
      const pid=ESPN_GAMEID_TO_PID[String(ev.id)];
      if(!pid)return;

      const comp=ev.competitions?.[0]||{};const comps=comp.competitors||[];
      if(comps.length<2)return;
      const home=comps.find(c=>c.homeAway==="home")||comps[0];
      const away=comps.find(c=>c.homeAway==="away")||comps[1];
      const homeNameEN=home.team?.displayName||home.team?.shortDisplayName||"";
      const awayNameEN=away.team?.displayName||away.team?.shortDisplayName||"";
      const homeES=espnNameES(homeNameEN);
      const awayES=espnNameES(awayNameEN);
      const st=ev.status||comp.status;const state=st?.type?.state||"pre";

      if(ev.date&&!S.elimTimes[pid]){
        S.elimTimes[pid]=ev.date;
      }

      // ── Cruce real (solo aplica a 1/16, P73-P88 — las rondas
      //    posteriores se resuelven solas a partir de los resultados
      //    previos vía ELIM_TREE) ──
      if(ELIM_1_16_IDS.includes(pid)&&homeES&&awayES){
        const existT=S.elimTeams[pid];
        const sameTeams=!!(existT&&existT.h&&
          new Set([n(existT.h),n(existT.a)]).size===2&&
          [n(homeES),n(awayES)].every(x=>new Set([n(existT.h),n(existT.a)]).has(x)));
        if(!existT||!existT.h){
          // No había nada cargado para este cruce — lo cargamos directo.
          S.elimTeams[pid]={h:homeES,a:awayES};
          teamsLoaded++;
        }else if(!sameTeams){
          if(S.elimScores[pid]){
            // Ya hay un resultado guardado para este pid con OTROS
            // equipos — no lo pisamos en silencio, el admin decide.
            if(!pidsEnConflicto.has(pid)){
              _elimConflictQueue.push({pid,current:existT,espn:{h:homeES,a:awayES}});
              pidsEnConflicto.add(pid);
            }
          }else{
            // No hay resultado en juego todavía: corregir es seguro.
            S.elimTeams[pid]={h:homeES,a:awayES};
            teamsCorrected++;
          }
        }else if(n(existT.h)!==n(homeES)){
          // Mismos 2 equipos, pero local/visitante invertido respecto a lo
          // que reporta ESPN ahora — realinear no pierde información.
          S.elimTeams[pid]={h:homeES,a:awayES};
        }
      }

      if(pidsEnConflicto.has(pid))return; // llave pendiente de resolución, no tocar el marcador

      if(state==="post"||state==="in"){
        const hs=parseInt(home.score)||0;const as=parseInt(away.score)||0;
        const existing=S.elimScores[pid];
        // Orientación contra los equipos reales conocidos (1/16: recién
        // actualizado arriba; Octavos+: getRealElimTeams).
        const real=equiposConocidosElim(pid);
        let finalH=hs,finalA=as,orientable=true;
        if(real){
          if(n(real.h)===n(awayES)&&n(real.a)===n(homeES)){finalH=as;finalA=hs;}
          else if(!(n(real.h)===n(homeES)&&n(real.a)===n(awayES))){
            orientable=false; // ni coincide derecho ni invertido — no se adivina
          }
        }else if(!ELIM_1_16_IDS.includes(pid)){
          orientable=false; // fase previa todavía no resuelta/cerrada
        }
        if(orientable&&(!existing||existing.live)){
          const changed=!existing||existing.h!==finalH||existing.a!==finalA||!!existing.live!==(state==="in");
          S.elimScores[pid]={h:finalH,a:finalA,live:state==="in"};
          updated++;if(state==="in")live++;
          if(changed)changedPids.push(pid);
        }
      }
    });

    save();
    const now=new Date().toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"});
    const lH=live>0?`<span class="sbadge" style="background:rgba(212,0,26,.18);color:#ff8080;border:1px solid rgba(212,0,26,.4)"><span class="ldot" style="width:5px;height:5px;margin-right:2px"></span>${live} en vivo</span>`:"";
    const tH=teamsLoaded>0?`<span class="sbadge info">🏴 ${teamsLoaded} equipos nuevos</span>`:"";
    const cH=teamsCorrected>0?`<span class="sbadge info">🔧 ${teamsCorrected} llave(s) corregida(s)</span>`:"";
    const wH=_elimConflictQueue.length>0?`<span class="sbadge warn">⚠️ ${_elimConflictQueue.length} conflicto(s) de llave</span>`:"";
    setES(`<span class="sbadge ok">✓ ESPN Elim · ${updated} resultados</span>${lH}${tH}${cH}${wH}<span style="color:var(--qb-muted)">${now}</span>`);
    if(_elimConflictQueue.length>0){
      const first=_elimConflictQueue.shift();
      openElimConflict(first.pid,first.current,first.espn);
    }else{
      renderElim();renderBracket();renderRank();autoFillRealityFromElim();
      flashRows("data-pid",changedPids);
      toast(updated>0||teamsLoaded>0||teamsCorrected>0?`✓ ${updated} resultados · ${teamsLoaded} nuevos · ${teamsCorrected} corregidos`:"Sin datos nuevos");
    }
  }catch(e){setES(`<span class="sbadge err">⚠️ Error: ${e.message}</span>`);toast("Error ESPN",true);}
  if(sp)sp.classList.remove("spin");if(tx)tx.textContent="ESPN Live";
}

// ══════════════════════════════════════════════════════════════
// CONFLICTO DE LLAVE DE ELIMINATORIA — v7.0
// ══════════════════════════════════════════════════════════════
// Se dispara cuando ESPN confirma equipos DISTINTOS a los que ya están
// guardados en un pid que YA tiene un resultado cargado (manual o de una
// corrida anterior de ESPN/simulación) — pisarlo en silencio dejaría un
// marcador real pegado a los equipos equivocados. El admin decide.
function openElimConflict(pid,current,espn){
  const lbl=ELIM_1_16_LABELS[pid]||`P${pid}`;
  const sc=S.elimScores[pid]||{};
  document.getElementById("elim-conflict-body").innerHTML=
    `<strong>${lbl}</strong> ya tiene un resultado guardado (<strong>${sc.h}-${sc.a}</strong>) para estos equipos:<br><br>
     · Guardado ahora: <strong>${current.h} vs ${current.a}</strong><br>
     · ESPN confirma: <strong>${espn.h} vs ${espn.a}</strong><br><br>
     Si usás los equipos de ESPN, el resultado guardado se borra (ya no aplicaría a ese cruce) y vas a tener que volver a cargarlo.<br><br>
     ¿Qué querés conservar?`;
  _elimConflictCurrent={pid,current,espn};
  document.getElementById("elim-conflict-overlay").style.display="flex";
}
function resolveElimTeamConflict(choice){
  if(!_elimConflictCurrent)return;
  const{pid,espn}=_elimConflictCurrent;
  if(choice==="espn"){
    S.elimTeams[pid]={h:espn.h,a:espn.a};
    delete S.elimScores[pid];
    save();
  }
  _elimConflictCurrent=null;
  document.getElementById("elim-conflict-overlay").style.display="none";
  if(_elimConflictQueue.length>0){
    const next=_elimConflictQueue.shift();
    openElimConflict(next.pid,next.current,next.espn);
  }else{
    renderElim();renderBracket();renderRank();autoFillRealityFromElim();
    toast("✓ Conflictos de llave resueltos");
  }
}
function closeElimConflict(){resolveElimTeamConflict("keep");}

// ══════════════════════════════════════════════════════════════
