/* ════════════════════════════════════════════════════════════
   app-bracket-compute.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Motor de cálculo automático de llaves de dieciseisavos a partir de la fase de grupos (tablas de posiciones, mejores terceros, cruces dinámicos).

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): CÁLCULO AUTOMÁTICO DE LLAVES DE DIECISEISAVOS

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

// CÁLCULO AUTOMÁTICO DE LLAVES DE DIECISEISAVOS
// Basado en standings reales de grupos + Annex C (FIFA Official)
// ══════════════════════════════════════════════════════════════

// Nombre canónico de cada equipo para comparaciones
const TEAM_NAMES = {
  "MEX":"México","RSA":"Sudáfrica","KOR":"Corea del Sur","CZE":"Chequia",
  "CAN":"Canadá","BIH":"Bosnia y Herzegovina","QAT":"Catar","SUI":"Suiza",
  "BRA":"Brasil","MAR":"Marruecos","HAI":"Haití","SCO":"Escocia",
  "USA":"Estados Unidos","PAR":"Paraguay","AUS":"Australia","TUR":"Turquía",
  "GER":"Alemania","CIV":"Costa de Marfil","ECU":"Ecuador","CUR":"Curazao",
  "NED":"Países Bajos","JPN":"Japón","SWE":"Suecia","TUN":"Túnez",
  "KSA":"Arabia Saudita","URU":"Uruguay","ESP":"España","CPV":"Cabo Verde",
  "IRN":"Irán","NZL":"Nueva Zelanda","BEL":"Bélgica","EGY":"Egipto",
  "FRA":"Francia","SEN":"Senegal","IRQ":"Irak","NOR":"Noruega",
  "ARG":"Argentina","ALG":"Argelia","AUT":"Austria","JOR":"Jordania",
  "ENG":"Inglaterra","CRO":"Croacia","GHA":"Ghana","PAN":"Panamá",
  "POR":"Portugal","CGO":"RD Congo","UZB":"Uzbekistán","COL":"Colombia",
};

// Mapa completo: abreviatura → nombre completo (desde MID_ABBRS)

// Calcular standings de todos los grupos desde los 72 resultados reales

// H2H entre dos equipos en un grupo

// Calcular los 8 mejores terceros de los 12 grupos

// v1.7 — ANNEX_C (la tabla de 495 combinaciones de FIFA) se movió a su
// propio archivo, app-bracket-annexc.js (carga justo antes que este) --
// eran ~1000 líneas de datos puros sentadas en medio del motor de
// cálculo. annexCLookup() (scoring.js) sigue leyendo el mismo global
// ANNEX_C, sin ningún cambio de comportamiento.

// LOOKUP ANNEX C: dado el conjunto de 8 grupos con terceros, devuelve la asignación
// Returns: {P74:grp, P77:grp, P79:grp, P80:grp, P81:grp, P82:grp, P85:grp, P87:grp}
// donde grp es el grupo del 3ero que juega en ese partido

// Verificar si todos los 72 partidos de grupos tienen resultado

// FUNCIÓN PRINCIPAL: Calcular y cargar llaves de Dieciseisavos automáticamente
function generarLlavesDieciseisavos() {
  if (!allGroupsComplete()) {
    toast("Faltan resultados de la fase de grupos", true);
    return;
  }
  if (!confirm("¿Generar las llaves de Dieciseisavos automáticamente a partir de los resultados de grupos?")) return;

  const standings = calcGroupStandings();
  // Verificar que todos los grupos tengan al menos 3 equipos con partidos jugados
  const groups = ["A","B","C","D","E","F","G","H","I","J","K","L"];
  
  // Obtener 1eros y 2dos de cada grupo
  const firsts = {}, seconds = {}, thirds_all = [];
  groups.forEach(g => {
    const arr = standings[g] || [];
    if (arr.length >= 1) firsts[g] = arr[0].name;
    if (arr.length >= 2) seconds[g] = arr[1].name;
    if (arr.length >= 3) thirds_all.push({ ...arr[2], group: g });
  });

  // Obtener los 8 mejores terceros
  const best8thirds = [...thirds_all].sort((a,b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return 0;
  }).slice(0, 8);

  const third8groups = best8thirds.map(t => t.group);
  const thirdByGroup = {};
  best8thirds.forEach(t => { thirdByGroup[t.group] = t.name; });

  // Buscar en Annex C
  const allocation = annexCLookup(third8groups);
  
  // Partidos fijos (1ero vs 2do — siempre iguales):
  // P73: 2A vs 2B
  // P75: 1F vs 2C
  // P76: 1C vs 2F
  // P78: 2E vs 2I
  // P83: 2K vs 2L
  // P84: 1H vs 2J
  // P86: 1J vs 2H
  // P88: 2D vs 2G
  const fixed = {
    73: { h: seconds["A"], a: seconds["B"] },
    75: { h: firsts["F"],  a: seconds["C"] },
    76: { h: firsts["C"],  a: seconds["F"] },
    78: { h: seconds["E"], a: seconds["I"] },
    83: { h: seconds["K"], a: seconds["L"] },
    84: { h: firsts["H"],  a: seconds["J"] },
    86: { h: firsts["J"],  a: seconds["H"] },
    88: { h: seconds["D"], a: seconds["G"] },
  };

  // Partidos con 3eros (dependen de Annex C):
  // P74: 1E vs 3rd(allocation.P74)
  // P77: 1I vs 3rd(allocation.P77)
  // P79: 1A vs 3rd(allocation.P79)
  // P80: 1L vs 3rd(allocation.P80)
  // P81: 1D vs 3rd(allocation.P81)
  // P82: 1G vs 3rd(allocation.P82)
  // P85: 1B vs 3rd(allocation.P85)
  // P87: 1K vs 3rd(allocation.P87)
  const withThirds = {};
  if (allocation) {
    withThirds[74] = { h: firsts["E"], a: thirdByGroup[allocation.P74] || "?" };
    withThirds[77] = { h: firsts["I"], a: thirdByGroup[allocation.P77] || "?" };
    withThirds[79] = { h: firsts["A"], a: thirdByGroup[allocation.P79] || "?" };
    withThirds[80] = { h: firsts["L"], a: thirdByGroup[allocation.P80] || "?" };
    withThirds[81] = { h: firsts["D"], a: thirdByGroup[allocation.P81] || "?" };
    withThirds[82] = { h: firsts["G"], a: thirdByGroup[allocation.P82] || "?" };
    withThirds[85] = { h: firsts["B"], a: thirdByGroup[allocation.P85] || "?" };
    withThirds[87] = { h: firsts["K"], a: thirdByGroup[allocation.P87] || "?" };
  } else {
    // v1.7 — Con ANNEX_C completa (495/495 combinaciones posibles de 8
    // grupos entre 12), este camino ya no debería dispararse nunca en un
    // torneo real: se deja solo como red de seguridad por si
    // best8thirds trae menos de 8 grupos (datos de grupos incompletos).
    // Si esto llega a mostrarse, es señal de un bug — no de una
    // combinación real faltante en la tabla.
    const thirdsArr = best8thirds.map(t => t.name);
    const midsWithThirds = [74,77,79,80,81,82,85,87];
    const winners = {74:firsts["E"],77:firsts["I"],79:firsts["A"],80:firsts["L"],81:firsts["D"],82:firsts["G"],85:firsts["B"],87:firsts["K"]};
    midsWithThirds.forEach((pid,i) => {
      withThirds[pid] = { h: winners[pid], a: thirdsArr[i] || "?" };
    });
  }

  // Guardar todos los equipos en S.elimTeams
  const allMatches = { ...fixed, ...withThirds };
  Object.entries(allMatches).forEach(([pid, teams]) => {
    S.elimTeams[Number(pid)] = { h: teams.h || "?", a: teams.a || "?" };
  });

  save();
  renderElim();
  renderBracket();
  renderRank();

  // Mostrar resumen
  const thirdsStr = best8thirds.map(t => `${t.group}: ${t.name} (${t.pts}pts)`).join(", ");
  const allNotFound = !allocation;
  toast(`✓ Llaves generadas${allNotFound ? " (Annex C no encontrado, orden estimado)" : ""}`);
  
  // Mostrar modal de resumen
  const summaryEl = document.getElementById("generate-summary");
  if (summaryEl) {
    summaryEl.innerHTML = `<div class="ib" style="margin-top:.5rem">
      <strong>Grupos clasificados:</strong><br>
      🥇 1eros: ${groups.map(g=>firsts[g]?g+": "+firsts[g]:"").filter(Boolean).join(", ")}<br>
      🥈 2dos: ${groups.map(g=>seconds[g]?g+": "+seconds[g]:"").filter(Boolean).join(", ")}<br>
      🥉 8 mejores 3eros: ${thirdsStr}<br>
      ${allocation ? "✅ Annex C aplicado" : "⚠️ Combinación no en tabla — asignación estimada"}
    </div>`;
    summaryEl.style.display = "block";
  }
}

function simularMarcadores(){
  // Find next incomplete phase
  let targetPhase=null;
  // First check group stage
  const gruposComplete=Array.from({length:72},(_,i)=>i+1).every(mid=>S.scores[mid]||S.scores[String(mid)]);
  if(!gruposComplete){
    if(!confirm("¿Simular marcadores de la Fase de Grupos? Solo llena los partidos vacíos."))return;
    for(let mid=1;mid<=72;mid++){
      if(S.scores[mid]||S.scores[String(mid)])continue;
      const h=Math.floor(Math.random()*4);
      const a=Math.floor(Math.random()*4);
      const v=validateScore(mid,h,a);
      if(v.ok){S.scores[mid]={h,a,live:false};S.checksums[mid]=makeChecksum(mid,h,a);}
    }
    save();renderFix();renderRank();updateGenerarBtn();
    toast("🎲 Fase de Grupos simulada");
    return;
  }
  // Then check each elim phase in order
  for(const phase of BONUS_PHASES){
    if(!phase.elimPhase)continue;
    const hasAny=phase.mids.some(pid=>S.elimScores[pid]||S.elimScores[String(pid)]);
    const allDone=phase.mids.every(pid=>S.elimScores[pid]||S.elimScores[String(pid)]);
    if(!allDone){targetPhase=phase;break;}
  }
  if(!targetPhase){toast("Todos los partidos ya tienen resultado",true);return;}
  if(!confirm(`¿Simular marcadores de ${targetPhase.label}? Solo llena los partidos vacíos.`))return;
  targetPhase.mids.forEach(pid=>{
    if(S.elimScores[pid]||S.elimScores[String(pid)])return;
    const teams=getRealElimTeams(pid);if(!teams)return;
    const h=Math.floor(Math.random()*4);
    const a=Math.floor(Math.random()*4);
    S.elimScores[pid]={h,a,live:false};
  });
  save();renderElim();renderBracket();renderRank();renderBonosPanel();
  toast(`🎲 ${targetPhase.label} simulada`);
}

// Actualizar estado del botón generar llaves según si grupos están completos
// Check if ANY elim phase needs prev phase closed before allowing results

function fetchESPNElimChecked(){
  const blocked=getFirstBlockedElimPhase();
  if(blocked){
    const prev=getPhaseByKey(blocked.prevPhase);
    toast(`🔒 Cierra "${prev?.label||blocked.prevPhase}" en Bonos antes de cargar resultados de ${blocked.label}`,true);
    return;
  }
  fetchESPNElim();
}

function simularMarcadoresChecked(){
  const blocked=getFirstBlockedElimPhase();
  if(blocked){
    const prev=getPhaseByKey(blocked.prevPhase);
    toast(`🔒 Cierra "${prev?.label||blocked.prevPhase}" en Bonos antes de simular ${blocked.label}`,true);
    return;
  }
  simularMarcadores();
}

// Update elim buttons disabled state based on blocked phases
function updateElimBtns(){
  const blocked=getFirstBlockedElimPhase();
  const espnBtn=document.getElementById("btn-espn-elim");
  const simBtn=document.getElementById("btn-simular");
  if(espnBtn){
    espnBtn.disabled=!!blocked;
    espnBtn.style.opacity=blocked?"0.45":"1";
    espnBtn.title=blocked?`Bloqueado: cierra ${getPhaseByKey(blocked?.prevPhase)?.label||""} primero`:"ESPN Live";
  }
  if(simBtn){
    simBtn.disabled=!!blocked;
    simBtn.style.opacity=blocked?"0.45":"1";
    simBtn.title=blocked?`Bloqueado: cierra ${getPhaseByKey(blocked?.prevPhase)?.label||""} primero`:"Simular marcadores";
  }
}

function updateGenerarBtn(){
  const btn=document.getElementById("btn-generar-llaves");
  const status=document.getElementById("generar-status");
  if(!btn)return;
  const played=Object.keys(S.scores).filter(m=>Number(m)>=1&&Number(m)<=72).length;
  const complete=played>=72;
  btn.disabled=!complete;
  btn.style.opacity=complete?"1":"0.45";
  if(status)status.textContent=complete?"✓ Fase de grupos completa":played+"/72 partidos";
}

// ══════════════════════════════════════════════════════════════
