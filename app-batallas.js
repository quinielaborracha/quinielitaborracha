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

// Puntos de Básico + Eliminatoria (sin Avanzado ni Bonos, a propósito: una
// batalla mide quién predijo mejor los partidos de esa ventana puntual, no
// apuestas de todo el torneo como campeón/goleador o premios acumulados)
// que 'name' ganó específicamente en los partidos de hoy — ni snapshot ni
// resta, suma directa.

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

// ══════════════════════════════════════════════════════════════
// LIGAS DE BATALLAS (Fase 3, sistema estilo suizo) — v2.0
// ══════════════════════════════════════════════════════════════
// 3 grupos dinámicos (Champions/Premier/Serie B), recalculados en cada
// render a partir de S.battleHistory -- no se persiste a qué liga
// pertenece cada quien, se recalcula siempre desde cero (la misma idea
// que ya usa getRank() con el ranking general: una sola fuente de verdad,
// nunca puede desincronizarse).
const LIGAS=[
  {key:"champions",label:"🏆 Champions League"},
  {key:"premier",label:"⚽ Premier League"},
  {key:"serieb",label:"🥉 Serie B"},
];

// Recuento de victorias/derrotas/partidos jugados por participante, leído
// de S.battleHistory (el mismo array que ya llena resetBattle()). Un
// "Empate" no suma a wins ni a losses de nadie, pero SÍ cuenta como
// "jugadas" -- alguien que solo empató ya compitió, no es lo mismo que
// alguien que nunca peleó ninguna batalla (ver getLigaGroups).
function computeBattleRecord(){
  const rec={};
  const ensure=(name)=>{ if(!rec[name])rec[name]={wins:0,losses:0,jugadas:0}; return rec[name]; };
  (S.battleHistory||[]).forEach(h=>{
    ensure(h.p1).jugadas++;
    ensure(h.p2).jugadas++;
    if(h.winner && h.winner!=="Empate"){
      ensure(h.winner).wins++;
      const loser=h.winner===h.p1?h.p2:h.p1;
      ensure(loser).losses++;
    }
  });
  return rec;
}

// Standings de TODOS los participantes activos, ordenados por el criterio
// de la Liga: más victorias primero; empate en victorias, menos derrotas;
// sigue empatado, el ranking general de predicciones (Básico+Avanzado+
// Eliminatoria+Bonos, el mismo total que ya muestra getRank()) como
// último desempate.
function getLigaStandings(){
  const record=computeBattleRecord();
  const rankTotal={};
  getRank().forEach(p=>{rankTotal[p.name]=p.total;});
  const rows=PL.map(name=>{
    const r=record[name]||{wins:0,losses:0,jugadas:0};
    return{name,wins:r.wins,losses:r.losses,jugadas:r.jugadas,total:rankTotal[name]||0};
  });
  rows.sort((a,b)=>{
    if(b.wins!==a.wins)return b.wins-a.wins;
    if(a.losses!==b.losses)return a.losses-b.losses;
    return b.total-a.total;
  });
  return rows;
}

// Reparte los standings en las 3 ligas. Criterio (default acordado, ver
// brief de la Fase 3):
//   - Tamaños: Champions = top 10 por victorias (de quienes YA jugaron al
//     menos una batalla); Premier = la mitad de los restantes; Serie B =
//     el resto.
//   - Quien todavía NO jugó ninguna batalla (jugadas===0, ni ganó, ni
//     perdió, ni empató nunca) arranca SIEMPRE en Premier League, sin
//     importar el tamaño que eso le sume -- no compite por los tamaños de
//     arriba hasta jugar su primera batalla.
function getLigaGroups(){
  const standings=getLigaStandings();
  const jugaron=standings.filter(p=>p.jugadas>0);
  const nuncaJugaron=standings.filter(p=>p.jugadas===0);
  const n=jugaron.length;
  const champSize=Math.min(10,n);
  const restoSize=n-champSize;
  const premSize=Math.ceil(restoSize/2);
  const champions=jugaron.slice(0,champSize);
  const premier=jugaron.slice(champSize,champSize+premSize).concat(nuncaJugaron);
  const serieb=jugaron.slice(champSize+premSize);
  return{champions,premier,serieb};
}

// A qué liga pertenece un participante puntual -- usado para la
// restricción de "solo misma liga" al armar una batalla 1v1.
function getLigaDe(name){
  const groups=getLigaGroups();
  for(const {key} of LIGAS){
    if(groups[key].some(p=>p.name===name))return key;
  }
  return null;
}

// Días configurados para la ranura (input numérico "battle-slotN-dias" en
// index.html) — número libre, sin límite fijo. Sin valor cargado o valor
// inválido, cae a 1 día (mismo comportamiento de siempre: "los partidos
// de hoy").
function getDiasRanura(slot){
  const el=document.getElementById(`battle-slot${slot}-dias`);
  const v=parseInt(el?.value);
  return (v>0)?v:1;
}

// v1.9 — "Partidos de duración" (input "battle-slotN-partidos" en
// index.html), alternativa a "Días de duración": si tiene un número
// válido (>0) cargado, la ventana se arma por CANTIDAD de partidos
// (getMatchIdsByCount) en vez de por días calendario (getMatchIdsInWindow)
// -- gana ella sobre "días" cuando ambas están cargadas, porque es el
// campo que el admin llenó más específicamente a propósito. Vacía (o en
// 0), se ignora y se usa "días" como siempre.
function getPartidosRanura(slot){
  const el=document.getElementById(`battle-slot${slot}-partidos`);
  const v=parseInt(el?.value);
  return (v>0)?v:null;
}

// Ventana de partidos (grupos+elim) que le toca a esta ranura, según cuál
// de los 2 campos de duración esté cargado. Única función que arma la
// ventana para toda la ranura -- startBattle() y sugerirRival() la usan
// para no poder desincronizarse entre sí sobre qué ventana le toca a cuál.
function getVentanaRanura(slot){
  const partidos=getPartidosRanura(slot);
  if(partidos!==null)return{modo:"partidos",valor:partidos,...getMatchIdsByCount(partidos)};
  const dias=getDiasRanura(slot);
  return{modo:"dias",valor:dias,...getMatchIdsInWindow(dias)};
}

function descripVentana(modo,valor){
  return modo==="partidos" ? `${valor} partido${valor===1?"":"s"}` : `${valor} día${valor===1?"":"s"}`;
}

function startBattle(slot){
  if(!isAdmin())return;
  ensureBattlesState();
  const p1=document.getElementById(`battle-slot${slot}-p1`).value;
  const p2=document.getElementById(`battle-slot${slot}-p2`).value;
  if(!p1||!p2||p1===p2){toast("Elige 2 participantes distintos",true);return;}
  // Fase 3 — restricción de Liga: en 1v1 solo se pueden enfrentar
  // participantes de la MISMA liga (el Royal Rumble de la Fase 4 no tiene
  // esta restricción, cruza libremente).
  const liga1=getLigaDe(p1),liga2=getLigaDe(p2);
  if(liga1&&liga2&&liga1!==liga2){
    const lbl1=LIGAS.find(l=>l.key===liga1)?.label||liga1;
    const lbl2=LIGAS.find(l=>l.key===liga2)?.label||liga2;
    toast(`${p1} (${lbl1}) y ${p2} (${lbl2}) están en ligas distintas -- en 1v1 solo pueden pelear entre sí`,true);
    return;
  }
  const{modo,valor,groupMids,elimMids}=getVentanaRanura(slot);
  if(groupMids.length===0&&elimMids.length===0){
    toast(`No hay partidos disponibles para esa ventana (${descripVentana(modo,valor)})`,true);return;
  }
  const nameInput=document.getElementById(`battle-slot${slot}-name`);
  let name=(nameInput?.value||"").trim();
  if(!name)name=BATTLE_AUTO_NAMES[Math.floor(Math.random()*BATTLE_AUTO_NAMES.length)];
  S.battles[slot]={p1,p2,name,ventanaModo:modo,ventanaValor:valor,groupMids,elimMids,startedAt:Date.now(),closed:false};
  save();renderBattlesPanel();
  toast(`⚔️ Batalla ${slot} iniciada: ${p1} vs ${p2} (${descripVentana(modo,valor)})`);
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

// ══════════════════════════════════════════════════════════════
// ROYAL RUMBLE (Fase 4) — v2.1
// ══════════════════════════════════════════════════════════════
// Modo de juego NUEVO, no una extensión de las Batallas 1v1: estructura
// propia (S.rumble = {participantes:[...nombres], ...} -- un array, no
// p1/p2 sueltos). El admin elige específicamente quiénes participan (no
// automático) y cuántos días/partidos dura (mismo mecanismo de la Fase 2).
// Cruza ligas libremente -- a propósito NO tiene la restricción de la
// Fase 3, que solo aplica a duelos 1v1. Un solo Rumble activo a la vez.
function ensureRumbleState(){
  if(S.rumble===undefined)S.rumble=null;
  if(!S.rumbleHistory)S.rumbleHistory=[];
}

// Básico + Avanzado + Eliminatoria (clasificados incluidos), SIN Bonos.
// v1.9 — calcBattlePts() ya suma Avanzado por su cuenta (mismo criterio
// que acá: no tiene "ventana" propia, se cuenta entero) -- antes esta
// función lo volvía a sumar POR SEPARADO, así que un Rumble contaba
// Avanzado dos veces. Ahora calcRumblePts() y calcBattlePts() dan
// exactamente lo mismo; queda como alias por claridad semántica (Rumble
// vs Batalla 1v1) y porque otros archivos ya llaman a calcRumblePts().
function calcRumblePts(name,groupMids,elimMids){
  return calcBattlePts(name,groupMids,elimMids);
}

function populateRumbleChecklist(){
  if(!isAdmin())return;
  const wrap=document.getElementById("rumble-participants-list");
  if(!wrap)return;
  ensureRumbleState();
  const yaJugando=new Set(S.rumble?S.rumble.participantes:[]);
  const names=PL.slice().sort();
  wrap.innerHTML=names.map(n=>`<label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0">
      <input type="checkbox" class="js-rumble-check" value="${esc(n)}" ${yaJugando.has(n)?"checked disabled":""}> ${esc(n)}
    </label>`).join("");
}

function getParticipantesSeleccionadosRumble(){
  return Array.from(document.querySelectorAll(".js-rumble-check:checked"))
    .filter(el=>!el.disabled) // los ya jugando en un Rumble activo aparecen tildados pero no se re-seleccionan
    .map(el=>el.value);
}

function getVentanaRumble(){
  const partidosEl=document.getElementById("rumble-partidos");
  const partidos=parseInt(partidosEl?.value);
  if(partidos>0)return{modo:"partidos",valor:partidos,...getMatchIdsByCount(partidos)};
  const diasEl=document.getElementById("rumble-dias");
  const dv=parseInt(diasEl?.value);
  const dias=(dv>0)?dv:1;
  return{modo:"dias",valor:dias,...getMatchIdsInWindow(dias)};
}

function startRumble(){
  if(!isAdmin())return;
  ensureRumbleState();
  if(S.rumble){toast("Ya hay un Royal Rumble activo -- terminalo primero",true);return;}
  const seleccionados=getParticipantesSeleccionadosRumble();
  if(seleccionados.length<2){toast("Elegí al menos 2 participantes para el Rumble",true);return;}
  const{modo,valor,groupMids,elimMids}=getVentanaRumble();
  if(groupMids.length===0&&elimMids.length===0){
    toast(`No hay partidos disponibles para esa ventana (${descripVentana(modo,valor)})`,true);return;
  }
  const nameInput=document.getElementById("rumble-name");
  let name=(nameInput?.value||"").trim();
  if(!name)name="Royal Rumble";
  S.rumble={participantes:seleccionados,name,ventanaModo:modo,ventanaValor:valor,groupMids,elimMids,startedAt:Date.now()};
  save();renderRumblePanel();
  toast(`👑 Royal Rumble iniciado con ${seleccionados.length} participantes (${descripVentana(modo,valor)})`);
}

function resetRumble(){
  if(!isAdmin())return;
  ensureRumbleState();
  const r=S.rumble;
  if(r){
    const puntos={};
    r.participantes.forEach(n=>{puntos[n]=calcRumblePts(n,r.groupMids,r.elimMids);});
    const max=Math.max(...Object.values(puntos));
    const ganadores=r.participantes.filter(n=>puntos[n]===max);
    const winner=ganadores.length===1?ganadores[0]:"Empate";
    S.rumbleHistory.unshift({
      name:r.name||"Royal Rumble",
      participantes:r.participantes,
      puntos,winner,
      date:new Date().toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"})
    });
  }
  S.rumble=null;
  save();renderRumblePanel();
  toast("Royal Rumble terminado y guardado");
}

function renderRumblePanel(){
  ensureRumbleState();
  populateRumbleChecklist();
  const wrap=document.getElementById("rumble-active-body");
  if(wrap){
    if(!S.rumble){
      wrap.innerHTML=`<div style="text-align:center;padding:1.5rem 1rem;color:var(--qb-muted);font-size:12px">👑 No hay ningún Royal Rumble activo.${isAdmin()?" Elegí participantes arriba y arrancá uno.":""}</div>`;
    }else{
      const r=S.rumble;
      const filas=r.participantes
        .map(n=>({name:n,pts:calcRumblePts(n,r.groupMids,r.elimMids)}))
        .sort((a,b)=>b.pts-a.pts);
      const done=areBattleMatchesDone(r.groupMids,r.elimMids);
      wrap.innerHTML=`
        <div style="text-align:center;font-size:11px;font-weight:700;color:var(--qb-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">${esc(r.name)} · ${descripVentana(r.ventanaModo,r.ventanaValor)} · ${r.participantes.length} participantes</div>
        <table class="rt" style="width:100%">
          <thead><tr><th>#</th><th>Participante</th><th style="text-align:right">Puntos</th></tr></thead>
          <tbody>
            ${filas.map((f,i)=>`<tr>
              <td>${i===0?'<span style="font-size:18px">👑</span>':`<span class="rk">${i+1}</span>`}</td>
              <td><div class="pn" style="display:flex;align-items:center;gap:6px">${avatarImg((PM[f.name]||{}).champAvatar,27)}${esc(f.name)}</div></td>
              <td style="text-align:right;font-weight:800">${f.pts}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        ${done?'<div style="text-align:center;margin-top:.5rem;font-size:10px;color:var(--qb-muted)">✓ Todos los partidos de la ventana ya se jugaron.</div>':""}
      `;
    }
  }
  renderRumbleHistory();
}

function renderRumbleHistory(){
  const wrap=document.getElementById("rumble-history-body");
  if(!wrap)return;
  ensureRumbleState();
  if(!S.rumbleHistory.length){
    wrap.innerHTML=`<div style="text-align:center;padding:1rem;color:var(--qb-muted);font-size:11px">👑 Ningún Royal Rumble todavía. La corona sigue esperando dueño.</div>`;
    return;
  }
  wrap.innerHTML=S.rumbleHistory.map(h=>{
    const filas=Object.entries(h.puntos).sort((a,b)=>b[1]-a[1]);
    return`<div style="border:1px solid var(--qb-border);border-radius:10px;padding:.75rem;margin-bottom:.625rem;background:var(--qb-surface)">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--qb-text)">
        <span>${esc(h.name)}</span><span style="color:var(--qb-muted)">${h.date}</span>
      </div>
      <div style="margin-top:.375rem;font-size:11px;display:flex;align-items:center;gap:6px">${h.winner==="Empate"?"🤝 Empate":`👑 ${avatarImg((PM[h.winner]||{}).champAvatar,24)}${esc(h.winner)}`}</div>
      <details style="margin-top:.375rem">
        <summary style="font-size:10px;color:var(--qb-muted);cursor:pointer">${filas.length} participantes</summary>
        <div style="margin-top:.375rem">${filas.map(([n,p])=>`<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--qb-muted)"><span>${esc(n)}</span><span>${p}pts</span></div>`).join("")}</div>
      </details>
    </div>`;
  }).join("");
}

// v1.7.2 — BUG REPORTADO: alguien se postulaba y nunca aparecía en
// Postulados, incluso después de una recarga completa. Causa: al recargar
// (F5), el navegador restaura solo los <select> de "Armar batalla" con lo
// último que tenían seleccionado ANTES del reload (comportamiento nativo
// del navegador, no algo que este código dispare) -- y como
// getPostuladosDisponibles() trata "ya cargado en un <select>" como
// "ocupado" (a propósito, para que desaparezca apenas se lo asigna), un
// nombre restaurado por el navegador quedaba tapando a un postulado real
// sin que el admin hubiera tocado nada. Fix real: `autocomplete="off"` en
// los 4 <select> de index.html, para que el navegador no los restaure.
function populateBattleSelects(){
  if(!isAdmin())return;
  const names=PL.slice().sort();
  [1,2].forEach(slot=>{
    [1,2].forEach(p=>{
      const sel=document.getElementById(`battle-slot${slot}-p${p}`);
      if(!sel)return;
      const current=sel.value;
      sel.innerHTML=`<option value="">— elegir —</option>`+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
      if(names.includes(current))sel.value=current;
    });
  });
}

// v1.7 — POSTULADOS (Fase 1 del roadmap de Batallas): quién marcó "Quiero
// pelear 🥊" en Mi Quiniela (participantes.js::quierePelear, persiste en
// registro_privado) y todavía está disponible -- ni ya emparejado en una
// batalla activa, ni ya cargado (sin confirmar) en alguno de los 4
// <select> de "Armar batalla". Esto último es a propósito: apenas el
// admin clickea un postulado y lo carga en una ranura, desaparece de la
// lista de inmediato (no recién al apretar "Iniciar duelo"), para que no
// lo pueda cargar dos veces por error en el mismo duelo.
function getPostuladosDisponibles(){
  ensureBattlesState();
  const ocupados=new Set();
  [1,2].forEach(slot=>{
    const b=S.battles[slot];
    if(b){ ocupados.add(b.p1); ocupados.add(b.p2); }
    [1,2].forEach(p=>{
      const sel=document.getElementById(`battle-slot${slot}-p${p}`);
      if(sel && sel.value) ocupados.add(sel.value);
    });
  });
  return (DB.participants||[])
    .filter(p=>p.quierePelear && !ocupados.has(p.name))
    .map(p=>p.name)
    .sort();
}

function renderPostuladosPanel(){
  const wrap=document.getElementById("battles-postulados");
  if(!wrap || !isAdmin())return;
  const disponibles=getPostuladosDisponibles();
  if(!disponibles.length){
    wrap.innerHTML=`<div style="font-size:10px;color:var(--qb-muted);margin-top:.5rem">🦗 Se escuchan los grillos. Nadie se anotó para pelear todavía.</div>`;
    return;
  }
  wrap.innerHTML=`
    <div style="font-size:10px;color:var(--qb-muted);margin:.5rem 0 .25rem">🥊 Postulados — click para cargar en la próxima ranura libre</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${disponibles.map(name=>`<button class="btn btn-sm js-postulado-chip" data-pname="${esc(name)}">🥊 ${esc(name)}</button>`).join("")}
    </div>`;
}

// Carga a `name` en la primera ranura libre (en orden ranura1-p1,
// ranura1-p2, ranura2-p1, ranura2-p2), sin repetirlo dentro del mismo
// duelo. Si las 2 ranuras ya están llenas, avisa en vez de pisar algo.
function asignarPostulado(name){
  if(!isAdmin())return;
  const orden=[[1,1,2],[1,2,1],[2,1,2],[2,2,1]];
  for(const [slot,pnum,otherPnum] of orden){
    const sel=document.getElementById(`battle-slot${slot}-p${pnum}`);
    const otherSel=document.getElementById(`battle-slot${slot}-p${otherPnum}`);
    if(sel && !sel.value && !(otherSel && otherSel.value===name)){
      sel.value=name;
      renderPostuladosPanel();
      return;
    }
  }
  toast("Las 2 ranuras ya están llenas",true);
}

// v1.8 (Fase 2) — "Sugerime un rival": cuánto discrepan las predicciones
// de dos participantes para los partidos de una ventana (grupos + elim).
// Criterio (documentado acá porque el brief no fijó una fórmula exacta):
//   - Partido de grupos: +1 si predicen resultados distintos (gana
//     H/gana A/empate), +0.3 si predicen el MISMO resultado pero con
//     marcador distinto (menos tensión que un resultado distinto, pero
//     no cero -- igual pueden desempatar puntos por el marcador exacto).
//   - Partido de eliminatoria: +1 si predicen un GANADOR distinto (el
//     equipo, no el pid -- dos personas pueden haber armado llaves
//     distintas y de todas formas llegar a este cruce con equipos
//     distintos), +0.3 si coinciden en el ganador pero no en el marcador.
//   - Partidos donde a cualquiera de los dos le falta la predicción se
//     saltean (no se puede comparar, así que ni suman ni restan tensión).
// Mayor total = más motivos para que el resultado final no quede atado.
function calcularDiffPrediccion(nameA,nameB,groupMids,elimMids){
  let diff=0;
  groupMids.forEach(mid=>{
    const pa=MD[mid]?.preds?.[nameA],pb=MD[mid]?.preds?.[nameB];
    if(!pa||!pb)return;
    const ra=pa.h>pa.a?"H":pa.h<pa.a?"A":"D";
    const rb=pb.h>pb.a?"H":pb.h<pb.a?"A":"D";
    if(ra!==rb)diff+=1;
    else if(pa.h!==pb.h||pa.a!==pb.a)diff+=0.3;
  });
  elimMids.forEach(pid=>{
    const wa=getPredWinner(nameA,pid),wb=getPredWinner(nameB,pid);
    if(!wa||!wb)return;
    if(n(wa)!==n(wb)){diff+=1;return;}
    const pa=elimPred(nameA,pid),pb=elimPred(nameB,pid);
    if(pa&&pb&&(pa.h!==pb.h||pa.a!==pb.a))diff+=0.3;
  });
  return diff;
}

// Sobre los postulados DISPONIBLES para esta ranura (misma lista que ve
// el panel de Postulados), busca el par con mayor diferencia de
// predicciones para la ventana de N días ya configurada en esta ranura, y
// lo carga directo en los 2 <select>. Requiere la ranura vacía primero
// (no pisa una selección ya hecha a mano).
function sugerirRival(slot){
  if(!isAdmin())return;
  const p1Sel=document.getElementById(`battle-slot${slot}-p1`);
  const p2Sel=document.getElementById(`battle-slot${slot}-p2`);
  if(!p1Sel||!p2Sel)return;
  if(p1Sel.value||p2Sel.value){toast("Vaciá esta ranura primero para poder sugerir un rival",true);return;}
  const candidatos=getPostuladosDisponibles();
  if(candidatos.length<2){toast("Hacen falta al menos 2 postulados disponibles para sugerir un duelo",true);return;}
  const{modo,valor,groupMids,elimMids}=getVentanaRanura(slot);
  let mejor=null,mejorDiff=-1;
  for(let i=0;i<candidatos.length;i++){
    for(let j=i+1;j<candidatos.length;j++){
      // Fase 3 — restricción de Liga: no sugerir un par que 1v1 no podría
      // pelear igual (misma restricción que ya aplica startBattle()).
      if(getLigaDe(candidatos[i])!==getLigaDe(candidatos[j]))continue;
      const d=calcularDiffPrediccion(candidatos[i],candidatos[j],groupMids,elimMids);
      if(d>mejorDiff){mejorDiff=d;mejor=[candidatos[i],candidatos[j]];}
    }
  }
  if(!mejor){toast("No se pudo sugerir ningún par (¿todos los postulados están en ligas distintas?)",true);return;}
  p1Sel.value=mejor[0];
  p2Sel.value=mejor[1];
  renderPostuladosPanel();
  toast(`🎯 Sugerido: ${mejor[0]} vs ${mejor[1]} (diferencia ${mejorDiff.toFixed(1)} en ${groupMids.length+elimMids.length} partido(s), ventana de ${descripVentana(modo,valor)})`);
}

// Delegado en document (mismo patrón que .js-edit-participant en
// app-bracket-view.js): un solo listener, siempre vivo, no depende de que
// #battles-postulados ya exista cuando este script corre.
document.addEventListener("click", (ev)=>{
  const chip=ev.target.closest(".js-postulado-chip");
  if(chip){ asignarPostulado(chip.dataset.pname); }
});

function renderBattleCountdown(groupMids,elimMids,big){
  // Encuentra la hora de fin estimada del ÚLTIMO partido de la ventana del
  // duelo (inicio + ~2h como estimado) -- desde la Fase 2, esa ventana
  // puede abarcar varios días, no solo hoy.
  const times=[];
  groupMids.forEach(mid=>{if(S.matchTimes[mid])times.push(new Date(S.matchTimes[mid]).getTime());});
  elimMids.forEach(pid=>{if(S.elimTimes[pid])times.push(new Date(S.elimTimes[pid]).getTime());});
  if(!times.length)return"";
  const lastStart=Math.max(...times);
  const estEnd=lastStart+2*60*60*1000; // estimado: 2h de duración de partido
  const now=Date.now();
  const diff=estEnd-now;
  const fs=big?"13px":"10px";
  if(diff<=0)return`<span style="color:var(--qb-muted);font-size:${fs}">Esperando resultado del último partido del duelo…</span>`;
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
    const done=areBattleMatchesDone(b.groupMids,b.elimMids);
    if(!done){countdownHtml=renderBattleCountdown(b.groupMids,b.elimMids,true);break;}
  }
  return`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:.75rem;padding-bottom:.625rem;border-bottom:1px solid var(--qb-border)">
    <span style="font-family:var(--ff-display);font-size:13px;font-weight:800;color:var(--qb-text)">📅 ${today}</span>
    ${countdownHtml||'<span style="font-size:11px;color:var(--qb-muted)">✓ Duelos activos cerrados</span>'}
  </div>`;
}

function renderOneBattle(slot){
  ensureBattlesState();
  const b=S.battles[slot];
  if(!b)return"";
  const{p1,p2,groupMids,elimMids,name}=b;
  // Compat: batallas creadas antes de "partidos de duración" solo tienen
  // b.dias (Fase 2 original); las creadas antes de la Fase 2 no tienen
  // ninguno de los dos -- en ambos casos, mostrar "1 día" (comportamiento
  // de siempre) es un fallback seguro.
  const ventanaModo=b.ventanaModo||"dias";
  const ventanaValor=b.ventanaValor??b.dias??1;
  const pts1=calcBattlePts(p1,groupMids,elimMids);
  const pts2=calcBattlePts(p2,groupMids,elimMids);
  const done=areBattleMatchesDone(groupMids,elimMids);
  const total=pts1+pts2;
  const pct1=total>0?Math.round((pts1/total)*100):50;
  let winnerBadge="";
  if(done){
    if(pts1>pts2)winnerBadge=`<div style="text-align:center;font-size:13px;font-weight:800;color:#f5c842;margin-top:.5rem">👑 ${esc(p1)} GANA EL DUELO</div>`;
    else if(pts2>pts1)winnerBadge=`<div style="text-align:center;font-size:13px;font-weight:800;color:#f5c842;margin-top:.5rem">👑 ${esc(p2)} GANA EL DUELO</div>`;
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
    // v1.9 — BUG REPORTADO: la Cartelera de una Batalla no mostraba NADA
    // útil para partidos de eliminatoria ("pred1"/"pred2" siempre "—"),
    // así que cuando el marcador de la batalla no se movía no había forma
    // de ver POR QUÉ sin ir a revisar Reglas/Bonos a mano. Ahora muestra
    // los puntos reales que cada quien sacó de ESE partido puntual
    // (partido + clasificado, igual que calcBattlePts) y, si dio 0, el
    // motivo concreto (explainZeroElimPts(), scoring.js) en vez de un
    // "—" mudo.
    ...elimMids.map(pid=>{
      const es=S.elimScores[pid]||S.elimScores[String(pid)];
      const teams=getRealElimTeams(pid);
      const lbl=teams?`${teams.h} vs ${teams.a}`:`Eliminatoria #${pid}`;
      const pts1elim=calcElimMatchPts(p1,pid)+calcClassifiedPtsForRealMatch(p1,pid);
      const pts2elim=calcElimMatchPts(p2,pid)+calcClassifiedPtsForRealMatch(p2,pid);
      const reason1=pts1elim===0?explainZeroElimPts(p1,pid):null;
      const reason2=pts2elim===0?explainZeroElimPts(p2,pid):null;
      const fmtElim=(pts,reason)=>pts>0?`+${pts}pts`:(reason?`0 (${reason})`:"0");
      return{lbl,played:!!es,real:es?`${es.h}-${es.a}`:null,pred1:fmtElim(pts1elim,reason1),pred2:fmtElim(pts2elim,reason2)};
    })
  ];
  const battleName=esc(name||"Batalla del día");
  const m1=PM[p1]||{},m2=PM[p2]||{};
  return`<div style="border:1px solid var(--qb-border);border-radius:12px;padding:.875rem;margin-bottom:.875rem;background:var(--qb-surface);${done?"border-color:rgba(245,166,35,.5)":""}">
    <div style="text-align:center;font-size:11px;font-weight:700;color:var(--qb-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">${battleName} · ${descripVentana(ventanaModo,ventanaValor)}</div>
    <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;text-align:center">
      <div>
        ${m1.champAvatar?`<div style="margin-bottom:4px">${avatarImg(m1.champAvatar,59)}</div>`:""}
        <div style="font-family:var(--ff-display);font-weight:800;font-size:14px;color:var(--qb-text)">${esc(p1)}</div>
        <div style="font-size:24px;font-weight:900;color:${pts1>=pts2?'#f5c842':'var(--qb-text)'}">${pts1}</div>
      </div>
      <div style="font-family:var(--ff-display);font-size:18px;font-weight:900;color:var(--qb-red)">VS</div>
      <div>
        ${m2.champAvatar?`<div style="margin-bottom:4px">${avatarImg(m2.champAvatar,59)}</div>`:""}
        <div style="font-family:var(--ff-display);font-weight:800;font-size:14px;color:var(--qb-text)">${esc(p2)}</div>
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
      <summary style="font-size:10px;color:var(--qb-muted);cursor:pointer">Cartelera del duelo (${cartelera.length} partido${cartelera.length===1?"":"s"})</summary>
      <div style="margin-top:.5rem;display:flex;flex-direction:column;gap:8px">
        ${cartelera.map(c=>`<div style="border-top:1px solid var(--qb-border);padding-top:6px">
          <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:var(--qb-text)">
            <span>${c.lbl}</span>
            <span>${c.played?`✓ ${c.real}`:"⏳ pendiente"}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--qb-muted);margin-top:2px">
            <span>${esc(p1)}: ${c.pred1}</span>
            <span>${esc(p2)}: ${c.pred2}</span>
          </div>
        </div>`).join("")}
      </div>
    </details>
  </div>`;
}

// Panel nuevo (Fase 3): las 3 tablas de la Liga de Batallas, misma onda
// visual que el Ranking general (reusa la clase "rt" -- ver #rank-table
// en index.html/styles.css -- para no duplicar estilos de tabla).
function renderLigaTable(rows){
  if(!rows.length){
    return`<div style="text-align:center;padding:1rem;color:var(--qb-muted);font-size:11px">🏟️ Esta liga está más vacía que una cancha un lunes a la mañana.</div>`;
  }
  const rki=["🥇","🥈","🥉"];
  return`<table class="rt" style="width:100%">
    <thead><tr><th>#</th><th>Participante</th><th style="text-align:center">Ganadas</th><th style="text-align:center">Perdidas</th></tr></thead>
    <tbody>
      ${rows.map((p,i)=>`<tr>
        <td>${i<3?`<span style="font-size:18px">${rki[i]}</span>`:`<span class="rk">${i+1}</span>`}</td>
        <td>${esc(p.name)}</td>
        <td style="text-align:center">${p.wins}</td>
        <td style="text-align:center">${p.losses}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function renderLigasPanel(){
  const wrap=document.getElementById("battles-ligas-wrap");
  if(!wrap)return;
  const groups=getLigaGroups();
  wrap.innerHTML=LIGAS.map(({key,label})=>`
    <div style="margin-bottom:1rem">
      <div style="font-family:var(--ff-display);font-size:12px;font-weight:800;color:var(--qb-text);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">${label}</div>
      ${renderLigaTable(groups[key])}
    </div>
  `).join("");
}

function renderBattlesPanel(){
  ensureBattlesState();
  populateBattleSelects();
  renderPostuladosPanel();
  const body=document.getElementById("battles-body");
  if(!body)return;
  const slots=[1,2].filter(s=>S.battles[s]);
  if(!slots.length){
    body.innerHTML=`<div style="text-align:center;padding:2rem 1rem;color:var(--qb-muted);font-size:12px">
      <div style="font-size:32px;margin-bottom:.5rem">😌</div>
      Tranquilo, hoy no hay ningún duelo. Paz mundial momentánea.${isAdmin()?" Armá una arriba, si te aburrís.":""}
    </div>`;
    return;
  }
  body.innerHTML=renderBattlesSectionHeader(slots)+slots.map(s=>renderOneBattle(s)).join("");
}

function battlesTab(id){
  document.getElementById("battles-active-wrap").style.display=id==="active"?"block":"none";
  document.getElementById("battles-history-wrap").style.display=id==="history"?"block":"none";
  document.getElementById("battles-ligas-wrap").style.display=id==="ligas"?"block":"none";
  document.getElementById("battles-rumble-wrap").style.display=id==="rumble"?"block":"none";
  document.getElementById("btab-active").classList.toggle("on",id==="active");
  document.getElementById("btab-history").classList.toggle("on",id==="history");
  document.getElementById("btab-ligas").classList.toggle("on",id==="ligas");
  document.getElementById("btab-rumble").classList.toggle("on",id==="rumble");
  if(id==="history")renderBattleHistory();
  if(id==="ligas")renderLigasPanel();
  if(id==="rumble")renderRumblePanel();
}

function renderBattleHistory(){
  const wrap=document.getElementById("battles-history-wrap");
  if(!wrap)return;
  ensureBattlesState();
  const hist=S.battleHistory||[];
  if(!hist.length){
    wrap.innerHTML=`<div style="text-align:center;padding:2rem 1rem;color:var(--qb-muted);font-size:12px">
      <div style="font-size:32px;margin-bottom:.5rem">📜</div>
      El historial está en blanco. Nadie se peleó por nada todavía.
    </div>`;
    return;
  }
  wrap.innerHTML=hist.map((h,idx)=>{
    const isEditing=_editingHistIdx===idx;
    const winnerLine=h.winner==="Empate"
      ?`<span style="color:var(--qb-muted)">🤝 Empate</span>`
      :`<span style="color:#f5c842;font-weight:800">👑 ${esc(h.winner)}</span>`;
    // El ganador SIEMPRE se recalcula a partir del marcador editado (pts1 vs pts2),
    // así nunca puede quedar desincronizado del puntaje mostrado.
    const editControls=isEditing?`<div style="margin-top:.5rem;padding-top:.5rem;border-top:1px dashed var(--qb-border);display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap">
        <span style="font-size:10px;color:var(--qb-muted)">${esc(h.p1)}</span>
        <input type="number" id="hist-edit-pts1-${idx}" value="${h.pts1}" style="width:54px;font-size:12px;padding:4px;border-radius:6px;border:1px solid var(--qb-border2);background:var(--qb-surface2);color:var(--qb-text);text-align:center">
        <span style="font-size:10px;color:var(--qb-red);font-weight:800">VS</span>
        <input type="number" id="hist-edit-pts2-${idx}" value="${h.pts2}" style="width:54px;font-size:12px;padding:4px;border-radius:6px;border:1px solid var(--qb-border2);background:var(--qb-surface2);color:var(--qb-text);text-align:center">
        <span style="font-size:10px;color:var(--qb-muted)">${esc(h.p2)}</span>
        <button class="btn btn-sm btn-blue" onclick="saveEditBattleHistory(${idx})">Guardar</button>
        <button class="btn btn-sm" onclick="closeEditBattleHistory()">Cancelar</button>
      </div>`:"";
    const adminBtns=(isAdmin()&&!isEditing)?`<div style="margin-top:.5rem;display:flex;gap:6px;justify-content:center">
        <button class="btn btn-sm" onclick="openEditBattleHistory(${idx})">✏️ Editar marcador</button>
        <button class="btn btn-sm btn-red" onclick="deleteBattleHistory(${idx})">🗑️ Borrar</button>
      </div>`:"";
    return`<div style="border:1px solid var(--qb-border);border-radius:10px;padding:.75rem;margin-bottom:.625rem;background:var(--qb-surface)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.375rem">
        <span style="font-size:11px;font-weight:700;color:var(--qb-text)">${esc(h.name)}</span>
        <span style="font-size:10px;color:var(--qb-muted)">${h.date}</span>
      </div>
      <div style="display:flex;justify-content:center;align-items:center;gap:10px;font-size:13px;font-weight:800">
        ${avatarImg((PM[h.p1]||{}).champAvatar,27)}<span>${esc(h.p1)}</span><span style="color:${h.pts1>=h.pts2?'#f5c842':'var(--qb-text)'}">${h.pts1}</span>
        <span style="color:var(--qb-red);font-size:11px">VS</span>
        <span style="color:${h.pts2>=h.pts1?'#f5c842':'var(--qb-text)'}">${h.pts2}</span><span>${esc(h.p2)}</span>${avatarImg((PM[h.p2]||{}).champAvatar,27)}
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
      const m1=PM[b.p1]||{},m2=PM[b.p2]||{};
      return`<div style="display:flex;align-items:center;justify-content:center;gap:10px;font-size:11px;padding:.375rem 0;cursor:pointer" onclick="tab('battles')">
        ${avatarImg(m1.champAvatar,30)}<span style="font-weight:700">${esc(b.p1)}</span><span style="font-weight:900;color:${pts1>=pts2?'#f5c842':'var(--qb-text)'}">${pts1}</span>
        <span style="color:var(--qb-red);font-weight:800">VS</span>
        <span style="font-weight:900;color:${pts2>=pts1?'#f5c842':'var(--qb-text)'}">${pts2}</span><span style="font-weight:700">${esc(b.p2)}</span>${avatarImg(m2.champAvatar,30)}
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
    // v1.9 — BUG REPORTADO: el admin veía "71/72" en Grupos, no podía
    // cerrar la fase, y no tenía forma de saber CUÁL de los 72 partidos
    // era el que faltaba (¿uno sin jugar todavía? ¿uno que ESPN Live no
    // pudo mapear/rechazó por validateScore() y quedó sin S.scores[mid]
    // aunque en el fixture pareciera "cargado"?). Antes solo se mostraba
    // el conteo; ahora, si la fase está incompleta, se listan los
    // partidos puntuales que faltan (por nombre, no solo el número) para
    // poder ir directo a revisarlos en vez de tener que comparar los 72
    // uno por uno a mano.
    const missingIds=(!closed&&!complete)?phase.mids.filter(id=>phase.elimPhase
      ?!(S.elimScores[id]||S.elimScores[String(id)])
      :!(S.scores[id]||S.scores[String(id)])):[];
    const missingLbl=id=>{
      if(!phase.elimPhase)return MD[id]?.lbl||`P${id}`;
      const teams=getRealElimTeams(id);
      return teams?`${teams.h} vs ${teams.a}`:`P${id}`;
    };

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
      ${missingIds.length?`
        <div style="margin-top:6px;padding:5px 9px;background:rgba(107,115,132,.08);border-radius:6px;border:1px dashed var(--qb-border2);font-size:10px;color:var(--qb-muted)">
          Falta resultado real de: ${missingIds.slice(0,6).map(id=>esc(missingLbl(id))).join(' · ')}${missingIds.length>6?` · +${missingIds.length-6} más`:''}
        </div>`:""}
      ${closed&&S.bonos.lastPlace?.[phase.key]?`
        <div style="margin-top:6px;padding:5px 9px;background:rgba(245,166,35,.1);border-radius:6px;border:1px solid rgba(245,166,35,.25);font-size:11px;color:var(--qb-yellow)">
          🚑 Último lugar: <strong>${esc(S.bonos.lastPlace[phase.key].name)}</strong>
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
        <td><div class="pn">${flagEmoji(m.champFlag,14)} ${esc(p.name)}</div></td>
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
