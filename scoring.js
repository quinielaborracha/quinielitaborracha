/* ════════════════════════════════════════════════════════════
   SCORING — cálculo de puntos, standings y bracket (v6.3, Punto 2)
   ════════════════════════════════════════════════════════════
   39 funciones extraídas de app.js: todo el motor de puntaje (básicos,
   avanzado, eliminatoria, bonos, batallas, cierre de fases, standings
   de grupo, desempates, bracket). Cero acceso a document/DOM directo,
   pero SÍ leen y escriben estado global mutable (S, DB, MD, PL,
   BONUS_PHASES, etc.) que vive en app.js, y llaman a funciones que se
   quedaron en app.js (toast(), save()) — eso funciona bien porque para
   cuando estas funciones se INVOCAN (nunca al cargar el script, solo
   en respuesta a eventos o al renderRank() final de app.js), ya está
   todo cargado.

   Se carga ANTES de app.js en index.html. Ver nota de orden en utils.js.
   ════════════════════════════════════════════════════════════ */

// v1.2 (fase 2) — Puntos base de Grupos/Eliminatoria, editables desde
// Admin → Configuración del torneo → Reglas. Devuelven SIEMPRE un objeto
// completo (con los valores de hoy como fallback de cada campo) aunque
// falte la clave en DB.configGlobal.reglas, por seguridad — aunque en la
// práctica nunca debería faltar, ya que mergeReglas() (participantes.js)
// garantiza que siempre esté completo.
function getReglasGrupos(){
  const d={activo:true,ganador:2,empate:3,exacto:3};
  const r=DB.configGlobal?.reglas?.grupos;
  return r?{...d,...r}:d;
}
function getReglasElim(){
  const d={activo:true,llave:2,ganador:2,empate:3,exacto:3};
  const r=DB.configGlobal?.reglas?.elim;
  return r?{...d,...r}:d;
}
// Valor efectivo de un campo de fase (clasificado/llave/último lugar):
// si el admin lo personalizó en Configuración del torneo → Reglas, se usa
// eso; si no, se usa el valor de siempre (BONUS_PHASES). Una sola función
// para los 6 lugares que antes leían phase.classifiedPts/llavePts/lastPts
// directo, así "editar el puntaje de una regla" no exige cambiar la
// lógica de cálculo en cada uno por separado.
function getFaseValor(phase,campo){
  const override=DB.configGlobal?.reglas?.fases?.[phase.key]?.[campo];
  return (override!==undefined&&override!==null&&override!=='')?Number(override):phase[campo];
}
// NUEVO (fase 2) — Multiplicador por ronda: ×N sobre los puntos de
// "Ganador/Empate"+"Marcador exacto" de cada partido de ELIMINATORIA
// (nunca sobre llave/cruce ni sobre clasificado — esos premian otra cosa).
// Desactivado por defecto → siempre devuelve 1 (cero impacto en el
// puntaje de nadie hasta que el admin lo prenda).
function getMultiplicadorFase(key){
  const cfg=DB.configGlobal?.reglas?.multiplicador;
  if(!cfg||!cfg.activo)return 1;
  const v=Number(cfg.fases?.[key]);
  return (v>0)?v:1;
}

// v1.2 (fase 2) — ¿Esta fase otorga puntos? Distinto de isFaseActiva():
// una fase puede seguir EXISTIENDO (navegación/predicciones normales)
// pero tener sus puntos apagados a propósito (ej. "jugar por diversión").
// grupos/elim usan su propio switch global (R.grupos.activo/R.elim.activo,
// ver calcPts/calcElimMatchBreakdown); esta función es para el switch
// POR FASE de eliminatoria (R.fases[key].activo).
function isFasePuntosActiva(key){
  const v=DB.configGlobal?.reglas?.fases?.[key]?.activo;
  return v!==false;
}
// El bono de último lugar de "grupos" lo gobierna el switch de Puntos
// Base de Grupos (no tiene fila propia de "activo" en Puntos por fase,
// ya que esa tabla solo tiene la columna de Último lugar para grupos).
// El resto de las fases usa su propio switch de "Puntos por fase".
function isFaseLastPtsActiva(phase){
  if(phase.key==='grupos')return getReglasGrupos().activo!==false;
  return isFasePuntosActiva(phase.key);
}

function calcPts(name){
  if(!isFaseActiva("grupos"))return 0; // v1.2 — fase desactivada: no existe en este torneo
  const R=getReglasGrupos();
  if(R.activo===false)return 0; // v1.2 (fase 2) — switch de puntos de Fase de Grupos apagado
  let pts=0;
  MIDS.forEach(mid=>{
    const s=sc(mid);if(!s)return;
    const p=MD[mid]?.preds[name];if(!p)return;
    const rR=s.h>s.a?"H":s.h<s.a?"A":"D";
    const pR=p.h>p.a?"H":p.h<p.a?"A":"D";
    if(rR===pR){pts+=rR==="D"?R.empate:R.ganador;if(p.h===s.h&&p.a===s.a)pts+=R.exacto;}
  });return pts;
}

function getDynamicSpec(name){
  const person=(DB.participants||[]).find(p=>p.name===name);
  if(!person)return null;
  const raw=(DB.predictions[person.id]||{}).special;
  if(!raw)return null;
  const out={};
  Object.entries(SPECIAL_FIELD_MAP_V62).forEach(([newKey,oldKey])=>{
    if(raw[newKey]!==undefined&&raw[newKey]!=='') out[oldKey]=raw[newKey];
  });
  return out;
}

function calcAdv(name){
  const r=S.reality;
  const spec=getDynamicSpec(name)||{};
  const a=Object.keys(spec).length?spec:(S.adv[name]||{});
  const nn=s=>(s||"").trim().toLowerCase();
  let ap=0;
  if(nn(a.champ)&&nn(a.champ)===nn(r.champ))ap+=15;
  if(nn(a.runner)&&nn(a.runner)===nn(r.runner))ap+=10;
  if(nn(a.third)&&nn(a.third)===nn(r.third))ap+=8;
  // Scorer: must match scorer first to get goals bonus
  const scorerMatch=nn(a.scorer)&&nn(r.topScorer)&&nn(a.scorer)===nn(r.topScorer);
  if(scorerMatch){
    ap+=12;
    if(r.topScorerGoals>0&&parseInt(a.scorerGoals)===parseInt(r.topScorerGoals))ap+=8;
  }
  // Top country: must match country first to get goals bonus
  const countryMatch=nn(a.topCountry)&&nn(r.topCountry)&&nn(a.topCountry)===nn(r.topCountry);
  if(countryMatch){
    ap+=8;
    if(r.topCountryGoals>0&&parseInt(a.topCountryGoals)===parseInt(r.topCountryGoals))ap+=10;
  }
  if(nn(a.mostConceded)&&nn(a.mostConceded)===nn(r.mostConceded))ap+=8;
  return ap;
}

function elimPred(name,pid){
  const person=(DB.participants||[]).find(p=>p.name===name);
  if(!person)return null;
  const slot=PID_TO_SLOT[pid];if(!slot)return null;
  const rec=(DB.predictions[person.id]||{})[slot];
  if(!rec)return null;
  return{h:rec.h,a:rec.a};
}

function getElimTeams(name,pid){
  const person=(DB.participants||[]).find(p=>p.name===name);
  if(!person)return null;
  const slot=PID_TO_SLOT[pid];if(!slot)return null;
  const rec=(DB.predictions[person.id]||{})[slot];
  if(!rec||!rec._a||!rec._b||rec._a==="?")return null;
  return{h:rec._a,a:rec._b};
}

function getPredWinner(name,pid,wantLoser=false){
  const teams=getElimTeams(name,pid);if(!teams)return null;
  const pred=elimPred(name,pid);if(!pred)return null;
  let winner,loser;
  if(pred.h>pred.a){winner=teams.h;loser=teams.a;}
  else if(pred.a>pred.h){winner=teams.a;loser=teams.h;}
  else{winner=teams.h;loser=teams.a;} // empate → locales avanzan por defecto (penales)
  return wantLoser?loser:winner;
}

function getRealElimTeams(pid){
  // v1.2 — antes esto era "if(ELIM_1_16_IDS.includes(pid))", hardcodeado a
  // Dieciseisavos. getManualTeamPids() devuelve eso MISMO cuando todas las
  // fases están activas (comportamiento idéntico), pero si Dieciseisavos
  // (y/o Grupos) están desactivados, devuelve los pids de la PRIMERA fase
  // activa (ej. Octavos) — esos pasan a cargarse a mano/ESPN en vez de
  // calcularse del árbol, porque no hay ronda anterior real de la cual
  // derivarlos.
  if(getManualTeamPids().includes(pid)){
    const t=S.elimTeams[pid];
    if(!t||!t.h||!t.a)return null;
    return{h:t.h,a:t.a};
  }
  const node=ELIM_TREE[pid];if(!node)return null;
  const teamH=getRealWinner(node.parentH,node.useLoserH);
  const teamA=getRealWinner(node.parentA,node.useLoserA);
  if(!teamH||!teamA)return null;
  return{h:teamH,a:teamA};
}

function getRealWinner(pid,wantLoser=false){
  const sc=S.elimScores[pid];if(!sc)return null;
  const teams=getRealElimTeams(pid);if(!teams)return null;
  let winner,loser;
  if(sc.h>sc.a){winner=teams.h;loser=teams.a;}
  else if(sc.a>sc.h){winner=teams.a;loser=teams.h;}
  else{
    // Empate: usar tieBreaker definido por admin, si no hay → local avanza
    const tb=S.tieBreakers[pid];
    if(tb==="a"){winner=teams.a;loser=teams.h;}
    else{winner=teams.h;loser=teams.a;}
  }
  return wantLoser?loser:winner;
}

function isLlaveCorrecta(name,pid){
  const pred=getElimTeams(name,pid);
  const real=getRealElimTeams(pid);
  if(!pred||!real)return false;
  const ps=new Set([n(pred.h),n(pred.a)]);
  const rs=new Set([n(real.h),n(real.a)]);
  return [...ps].every(x=>rs.has(x));
}

// ── Cruce válido (criterio ampliado de llave) ──────────────────────
// Si la llave EXACTA de "pid" falló (equipos predichos ≠ equipos reales
// de ESE pid), igual reconocemos el acierto si ese mismo cruce (los 2
// países, sin importar local/visitante) ocurrió REALMENTE en otro pid
// DENTRO DE LA MISMA RONDA (ELIM_ROUNDS). Es un consuelo exclusivo:
// solo se evalúa cuando isLlaveCorrecta(name,pid) ya es false — si la
// llave exacta es correcta, este camino ni se intenta (y de hecho dos
// países no pueden cruzarse 2 veces reales en la misma ronda, así que
// no hay forma de que ambos caminos den true a la vez para pids
// distintos).
//
// Devuelve null si no hay cruce válido, o {pidReal, real, swapped} si
// lo hay: pidReal = el pid donde realmente ocurrió el cruce, real = el
// marcador real EN ESE pid, swapped = true si el local/visitante real
// está invertido respecto a como el participante predijo (para poder
// realinear el marcador antes de comparar ganador/empate/exacto).
function findCruceValido(name,pid){
  const pred=getElimTeams(name,pid);
  if(!pred)return null;
  if(isLlaveCorrecta(name,pid))return null; // consuelo exclusivo
  const round=ELIM_ROUNDS.find(r=>r.ids.includes(pid));
  if(!round)return null;
  const ps=new Set([n(pred.h),n(pred.a)]);
  for(const pid2 of round.ids){
    if(pid2===pid)continue;
    const sc2=S.elimScores[pid2]||S.elimScores[String(pid2)];
    if(!sc2)continue; // ese cruce todavía no tiene resultado real
    const real2=getRealElimTeams(pid2);
    if(!real2)continue;
    const rs=new Set([n(real2.h),n(real2.a)]);
    if(ps.size!==rs.size)continue;
    if(![...ps].every(x=>rs.has(x)))continue;
    // Mismo par de países encontrado en otra llave de la ronda.
    // ¿Está invertido el orden h/a respecto a la predicción?
    const swapped=n(pred.h)!==n(real2.h);
    return{pidReal:pid2,real:sc2,swapped};
  }
  return null;
}

function phaseForPid(pid){
  return BONUS_PHASES.find(p=>p.elimPhase&&p.mids.includes(pid))||null;
}

// Desglose detallado de los puntos de una llave eliminatoria para un
// participante: de dónde viene cada punto (llave exacta o por cruce,
// ganador/empate, marcador exacto), para mostrarlo en la UI en vez de
// solo el total. calcElimMatchPts() usa esto y suma el total, así hay
// una sola fuente de verdad y no se pueden desincronizar.
//
// Devuelve un array de items: [{label, pts}, ...] — vacío si no hay
// ningún punto otorgado (llave fallida sin cruce, sin resultado, etc).
function calcElimMatchBreakdown(name,pid){
  const phase=phaseForPid(pid);
  if(!phase)return[];
  if(!isFaseActiva(phase.key))return[]; // v1.2 — fase desactivada: no existe, no puntúa
  if(!isPrevPhaseClosed(phase))return[];
  if(!isFasePuntosActiva(phase.key))return[]; // v1.2 (fase 2) — puntos de esta fase apagados a propósito
  const items=[];
  const llaveOk=isLlaveCorrecta(name,pid);
  const sc=S.elimScores[pid]||S.elimScores[String(pid)];
  const R=getReglasElim();
  const resultadoOn=R.activo!==false; // v1.2 (fase 2) — switch global de "puntos de resultado" en Eliminatoria
  const llavePts=getFaseValor(phase,'llavePts');
  // v1.2 (fase 2) — Multiplicador por ronda: solo sobre Ganador/Empate +
  // Marcador exacto (no sobre llave/cruce). ×1 = sin cambio (default).
  const mult=getMultiplicadorFase(phase.key);
  const mtag=mult!==1?` ×${mult}`:'';

  if(llaveOk){
    if(llavePts>0)items.push({label:"Llave",pts:llavePts});
    if(sc&&resultadoOn){
      const pred=elimPred(name,pid);
      if(pred){
        const rR=sc.h>sc.a?"H":sc.h<sc.a?"A":"D";
        const pR=pred.h>pred.a?"H":pred.h<pred.a?"A":"D";
        if(rR===pR){
          const base=rR==="D"?R.empate:R.ganador;
          items.push({label:(rR==="D"?"Empate":"Ganador")+mtag,pts:Math.round(base*mult)});
          if(pred.h===sc.h&&pred.a===sc.a)items.push({label:"Marcador exacto"+mtag,pts:Math.round(R.exacto*mult)});
        }
      }
    }
  } else {
    const cruce=findCruceValido(name,pid);
    if(cruce){
      if(llavePts>0)items.push({label:"Cruce",pts:llavePts});
      const pred=elimPred(name,pid);
      if(pred&&resultadoOn){
        const realH=cruce.swapped?cruce.real.a:cruce.real.h;
        const realA=cruce.swapped?cruce.real.h:cruce.real.a;
        const rR=realH>realA?"H":realH<realA?"A":"D";
        const pR=pred.h>pred.a?"H":pred.h<pred.a?"A":"D";
        if(rR===pR){
          const base=rR==="D"?R.empate:R.ganador;
          items.push({label:(rR==="D"?"Empate":"Ganador")+mtag,pts:Math.round(base*mult)});
          if(pred.h===realH&&pred.a===realA)items.push({label:"Marcador exacto"+mtag,pts:Math.round(R.exacto*mult)});
        }
      }
    }
  }
  return items;
}

function calcElimMatchPts(name,pid){
  return calcElimMatchBreakdown(name,pid).reduce((sum,item)=>sum+item.pts,0);
}

function calcClassifiedPtsForPhase(name,phase){
  const classifiedPts=getFaseValor(phase,'classifiedPts');
  if(!classifiedPts)return 0;
  if(!isFaseActiva(phase.key))return 0; // v1.2 — fase desactivada: no existe, no puntúa
  if(!isFasePuntosActiva(phase.key))return 0; // v1.2 (fase 2) — puntos de esta fase apagados a propósito
  if(!isPrevPhaseClosed(phase))return 0;
  if(!phase.elimPhase)return 0;
  // Build set of real advancers from this phase
  const realAdvancers=getRealAdvancers(phase);
  let pts=0;
  // For each match in this phase, check predicted winner
  phase.mids.forEach(pid=>{
    const predTeams=getElimTeams(name,pid);if(!predTeams)return;
    const pred=elimPred(name,pid);if(!pred)return;
    let predWinner;
    if(pred.h>pred.a)predWinner=predTeams.h;
    else if(pred.a>pred.h)predWinner=predTeams.a;
    else predWinner=predTeams.h;
    // Check if predWinner is in real advancers (team, not llave)
    if(predWinner&&realAdvancers.has(n(predWinner)))pts+=classifiedPts;
  });
  return pts;
}

function calcElimPts(name){
  let pts=0;
  // Match pts
  for(let pid=73;pid<=104;pid++)pts+=calcElimMatchPts(name,pid);
  // Classified pts — en vivo por fase (gated por isPrevPhaseClosed)
  BONUS_PHASES.forEach(phase=>{
    if(phase.elimPhase)pts+=calcClassifiedPtsForPhase(name,phase);
  });
  return pts;
}

function isPrevPhaseClosed(phase){
  if(!phase.prevPhase)return true; // grupos no tiene prerequisito
  // v1.2 — si la fase anterior está desactivada (no existe en este
  // torneo), no hay nada que cerrar: se considera satisfecha. Sin esto,
  // una fase cuyo prevPhase está apagado quedaría bloqueada para
  // siempre (su prerequisito jamás podría "cerrarse").
  if(!isFaseActiva(phase.prevPhase))return true;
  return !!(S.bonos.closed?.[phase.prevPhase]);
}

function getPhaseByKey(key){return BONUS_PHASES.find(p=>p.key===key)||null;}

// ══════════════════════════════════════════════════════════════
// FASES ACTIVAS — v1.2, Constructor de Torneos (fase 1)
// ══════════════════════════════════════════════════════════════
// Única fuente de verdad para "¿esta fase existe en este torneo?". Lee
// DB.configGlobal.fasesActivas (participantes.js, con migración segura:
// ver mergeConfigGlobal()). Si la clave no existe ahí (torneo viejo, o
// clave desconocida), se considera ACTIVA por defecto — así ningún
// torneo existente cambia de comportamiento con este cambio.
function isFaseActiva(key){
  if(!key)return true;
  const cfg=(typeof DB!=="undefined"&&DB&&DB.configGlobal&&DB.configGlobal.fasesActivas)||null;
  if(!cfg)return true;
  return cfg[key]!==false;
}

// BONUS_PHASES, pero solo las fases activas — para que cada pantalla que
// hoy recorre BONUS_PHASES directo (panel de Bonos, bracket, wizard de Mi
// Quiniela) deje de mostrar/calcular las que el torneo no usa, sin que
// cada una tenga que repetir el filtro a mano.
function getActivePhases(){
  return BONUS_PHASES.filter(p=>isFaseActiva(p.key));
}

// ELIM_ROUNDS, pero solo las rondas cuya fase (BONUS_PHASES) está activa.
function getActiveElimRounds(){
  return ELIM_ROUNDS.filter(r=>{
    const ph=BONUS_PHASES.find(bp=>bp.elimPhase&&bp.mids.includes(r.ids[0]));
    return ph?isFaseActiva(ph.key):true;
  });
}

// Primera fase de eliminatoria ACTIVA, en el orden de BONUS_PHASES
// (grupos→r16→r8→qf→sf→{final,third}). Si todas las fases de eliminatoria
// están activas (caso de siempre), esto es "r16" (Dieciseisavos).
function getFirstActiveElimPhase(){
  return BONUS_PHASES.find(p=>p.elimPhase&&isFaseActiva(p.key))||null;
}

// pids que reciben equipos "a mano" (editor de llaves admin / ESPN),
// en vez de calcularse del árbol (ELIM_TREE) a partir de la ronda
// anterior. Hoy eso es SIEMPRE Dieciseisavos (ELIM_1_16_IDS) — pero si
// Dieciseisavos (y/o Grupos) están desactivados, la PRIMERA fase de
// eliminatoria activa pasa a ser la que recibe los equipos a mano (ej.
// Octavos), porque no hay ronda anterior de la cual calcularlos. Esto es
// lo único que hace falta para que "empezar desde cualquier fase"
// reutilice TODO el motor existente (getRealElimTeams, ESPN sync, editor
// de llaves) sin duplicar nada.
function getManualTeamPids(){
  const firstActive=getFirstActiveElimPhase();
  return firstActive?firstActive.mids:ELIM_1_16_IDS;
}

function calcBonos(name){
  let pts=0;
  Object.values(S.bonos.lastPlace||{}).forEach(lp=>{
    if(lp&&lp.name===name)pts+=lp.pts;
  });
  pts+=calcRachaBonos(name); // v1.2 (fase 2) — nuevo, desactivado por defecto
  pts+=calcRachaDesaciertosBonos(name); // v1.6 — nuevo, desactivado por defecto
  pts+=calcMvpBonos(name);   // v1.2 (fase 2) — nuevo, desactivado por defecto
  return pts;
}

// ══════════════════════════════════════════════════════════════
// REGLAS NUEVAS (v1.2, fase 2) — Racha de aciertos + MVP de la jornada
// ══════════════════════════════════════════════════════════════

// Lista de resultados de UN participante, en orden CRONOLÓGICO de partido
// (grupos + eliminatoria mezclados, ordenados por hora real del partido),
// cada uno marcado como acierto (hit:true) o no. Solo se cuentan partidos
// que YA tienen hora programada Y resultado real terminado (no "live") —
// un partido sin jugar todavía simplemente no entra a la lista (no rompe
// la racha, no la sigue tampoco: para cuando se juegue, sí se evalúa).
// "Acierto" en grupos = pegarle al ganador/empate (no exige marcador
// exacto). En eliminatoria = llave (o cruce válido) correcta Y además
// pegarle al ganador/empate de ese cruce — mismo criterio que otorga los
// puntos de "Ganador/Empate" en calcElimMatchBreakdown, para no inventar
// un segundo criterio de "acierto" distinto al que ya usa el motor.
function buildChronologicalResults(name){
  const list=[];
  if(isFaseActiva("grupos")&&getReglasGrupos().activo!==false){
    MIDS.forEach(mid=>{
      const t=S.matchTimes&&S.matchTimes[mid];if(!t)return;
      const s=sc(mid);if(!s||s.live)return;
      const p=MD[mid]?.preds?.[name];if(!p)return;
      const rR=s.h>s.a?"H":s.h<s.a?"A":"D";
      const pR=p.h>p.a?"H":p.h<p.a?"A":"D";
      list.push({ts:new Date(t).getTime(),hit:rR===pR});
    });
  }
  const elimActivo=getReglasElim().activo!==false;
  for(let pid=73;pid<=104;pid++){
    const phase=phaseForPid(pid);if(phase&&!isFaseActiva(phase.key))continue;
    if(phase&&(!elimActivo||!isFasePuntosActiva(phase.key)))continue; // v1.2 (fase 2) — puntos de esta fase apagados: no entra a la racha
    const t=S.elimTimes&&S.elimTimes[pid];if(!t)continue;
    const real=S.elimScores[pid]||S.elimScores[String(pid)];if(!real||real.live)continue;
    const pred=elimPred(name,pid);if(!pred)continue;
    const llaveOk=isLlaveCorrecta(name,pid)||!!findCruceValido(name,pid);
    let hit=false;
    if(llaveOk){
      const rR=real.h>real.a?"H":real.h<real.a?"A":"D";
      const pR=pred.h>pred.a?"H":pred.h<pred.a?"A":"D";
      hit=rR===pR;
    }
    list.push({ts:new Date(t).getTime(),hit});
  }
  list.sort((a,b)=>a.ts-b.ts);
  return list;
}

// Bono de racha: cada vez que la racha de aciertos CONSECUTIVOS de este
// participante llega EXACTO a uno de los hitos configurados (3,5,8... por
// defecto), se suma el bono de ese hito. Si la racha sigue después del
// último hito, no hay más bono hasta que se corte y se vuelva a alcanzar
// un hito (de nuevo desde 0). Una racha completa de 8 aciertos seguidos
// (con los hitos default) suma 3+6+10=19pts en total, no solo el último.
function calcRachaBonos(name){
  const cfg=DB.configGlobal?.reglas?.racha;
  if(!cfg||!cfg.activo)return 0;
  const hitos=(cfg.hitos||[]).filter(h=>h&&h.n>0).sort((a,b)=>a.n-b.n);
  if(!hitos.length)return 0;
  let streak=0,pts=0;
  buildChronologicalResults(name).forEach(m=>{
    if(m.hit){
      streak++;
      hitos.forEach(h=>{if(streak===Number(h.n))pts+=Number(h.pts)||0;});
    }else{
      streak=0;
    }
  });
  return pts;
}

// v1.6 — Bono de racha de DESACIERTOS: el espejo exacto de calcRachaBonos
// de arriba, pero contando fallos CONSECUTIVOS en vez de aciertos (mismo
// buildChronologicalResults(), mismo criterio de "acierto/fallo" que ya
// usa el resto del sistema -- no se inventa un segundo criterio). Cada
// vez que la racha de fallos llega EXACTO a uno de los hitos configurados
// en reglas.rachaDesaciertos, se suma el bono de consuelo de ese hito.
// Un acierto (aunque sea uno solo) corta la racha de fallos y la vuelve a
// 0, igual que un fallo corta la racha de aciertos en la función hermana.
function calcRachaDesaciertosBonos(name){
  const cfg=DB.configGlobal?.reglas?.rachaDesaciertos;
  if(!cfg||!cfg.activo)return 0;
  const hitos=(cfg.hitos||[]).filter(h=>h&&h.n>0).sort((a,b)=>a.n-b.n);
  if(!hitos.length)return 0;
  let streak=0,pts=0;
  buildChronologicalResults(name).forEach(m=>{
    if(!m.hit){
      streak++;
      hitos.forEach(h=>{if(streak===Number(h.n))pts+=Number(h.pts)||0;});
    }else{
      streak=0;
    }
  });
  return pts;
}

// Fecha (yyyy-mm-dd, hora local) de un partido ya jugado y terminado.
function dayKeyOf(ts){
  const d=new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// Todos los días de calendario que tuvieron al menos un partido CON
// resultado real terminado (grupos y/o eliminatoria, según fases activas).
function getPlayedDaysList(){
  const days=new Set();
  if(isFaseActiva("grupos")){
    MIDS.forEach(mid=>{
      const t=S.matchTimes&&S.matchTimes[mid];if(!t)return;
      const s=sc(mid);if(!s||s.live)return;
      days.add(dayKeyOf(t));
    });
  }
  for(let pid=73;pid<=104;pid++){
    const phase=phaseForPid(pid);if(phase&&!isFaseActiva(phase.key))continue;
    const t=S.elimTimes&&S.elimTimes[pid];if(!t)continue;
    const s=S.elimScores[pid]||S.elimScores[String(pid)];if(!s||s.live)continue;
    days.add(dayKeyOf(t));
  }
  return[...days].sort();
}

// Puntos que UN participante ganó por partidos jugados EN UN DÍA puntual
// (mismo criterio de puntaje que calcPts/calcElimMatchPts, incluido el
// multiplicador por ronda si está activo — se reusa calcElimMatchPts para
// no duplicar esa cuenta).
function calcPtsForDay(name,dayKey){
  let pts=0;
  const Rg=getReglasGrupos();
  if(isFaseActiva("grupos")&&Rg.activo!==false){
    MIDS.forEach(mid=>{
      const t=S.matchTimes&&S.matchTimes[mid];if(!t||dayKeyOf(t)!==dayKey)return;
      const s=sc(mid);if(!s||s.live)return;
      const p=MD[mid]?.preds?.[name];if(!p)return;
      const rR=s.h>s.a?"H":s.h<s.a?"A":"D";
      const pR=p.h>p.a?"H":p.h<p.a?"A":"D";
      if(rR===pR){pts+=rR==="D"?Rg.empate:Rg.ganador;if(p.h===s.h&&p.a===s.a)pts+=Rg.exacto;}
    });
  }
  for(let pid=73;pid<=104;pid++){
    const phase=phaseForPid(pid);if(phase&&!isFaseActiva(phase.key))continue;
    const t=S.elimTimes&&S.elimTimes[pid];if(!t||dayKeyOf(t)!==dayKey)continue;
    const s=S.elimScores[pid]||S.elimScores[String(pid)];if(!s||s.live)continue;
    pts+=calcElimMatchPts(name,pid); // ya respeta R.elim.activo/isFasePuntosActiva internamente
  }
  return pts;
}

// Mapa {nombre → pts de MVP} para TODOS los días jugados de una sola
// pasada — se cachea por el tiempo de un solo getRank() (ver _mvpCache),
// porque calcBonos() se llama una vez POR participante y, sin caché,
// recalcularía el líder de cada día desde cero en cada una de esas
// llamadas (27 participantes × N días × ~100 partidos se vuelve
// innecesariamente lento). Si hay empate en el máximo del día, el bono se
// reparte completo entre todos los empatados (no se parte el punto).
let _mvpCache=null;
function computeMvpAwardsByDay(){
  const cfg=DB.configGlobal?.reglas?.mvp;
  const out={};
  if(!cfg||!cfg.activo)return out;
  const bonusPts=Number(cfg.pts)||0;
  if(bonusPts<=0)return out;
  getPlayedDaysList().forEach(day=>{
    let bestPts=-Infinity,best=[];
    PL.forEach(p=>{
      const pts=calcPtsForDay(p,day);
      if(pts>bestPts){bestPts=pts;best=[p];}
      else if(pts===bestPts)best.push(p);
    });
    if(bestPts>0)best.forEach(p=>{out[p]=(out[p]||0)+bonusPts;});
  });
  return out;
}
function calcMvpBonos(name){
  if(!_mvpCache)_mvpCache=computeMvpAwardsByDay();
  return _mvpCache[name]||0;
}

// ══════════════════════════════════════════════════════════════
// EVOLUCIÓN — v1.5. Replay histórico de puntaje/ranking.
// ══════════════════════════════════════════════════════════════
// Estas 5 funciones alimentan el panel "Mi Evolución" (registro.js,
// pestaña del Dashboard del participante). Reutilizan el mismo criterio
// de "qué partido cuenta y cuándo" que ya usan buildChronologicalResults()
// / getPlayedDaysList() / calcPtsForDay() (racha + MVP, arriba en este
// archivo) — a propósito, para no tener dos definiciones distintas de
// "partido jugado" que se puedan desincronizar entre sí.
//
// QUÉ SÍ entra al replay histórico: puntos de Básicos (grupos) +
// Eliminatoria (ganador/empate + marcador exacto + llave/cruce, con el
// multiplicador de ronda si aplica) — el mismo cálculo que ya usa
// calcPtsForDay() para el bono de MVP. Se recalcula partido a partido,
// en orden cronológico real (S.matchTimes / S.elimTimes), sin importar
// si el partido es de Grupos o de Eliminatoria — así el panel sigue
// funcionando sin cortes al pasar de una fase a la otra (mismo gateo de
// isFaseActiva()/isFasePuntosActiva() que ya usa buildChronologicalResults(),
// partido por partido, no una sola vez al principio).
//
// QUÉ NO entra (a propósito, mismo criterio que calcPtsForDay/MVP):
// predicciones especiales (calcAdv — campeón, goleador, etc., que solo
// se resuelven al cerrar el torneo) ni bonos de racha/MVP/último lugar
// (calcBonos — no tienen una fecha de partido a la que atribuirse). Por
// esto el ranking "histórico" del gráfico puede diferir un poco del
// ranking oficial de HOY (que sí incluye bonos) — es una diferencia
// menor y esperada, no un bug.
//
// Participantes ocultos (S.hiddenPL) se excluyen del replay, igual que
// getRank()/getDashStatsInfo() los excluye del ranking oficial.

function _evolActivePL(){
  const hiddenSet = S.hiddenPL instanceof Set ? S.hiddenPL
    : new Set(Object.keys(S.hiddenPL||{}).filter(k=>S.hiddenPL[k]));
  return PL.filter(name=>!hiddenSet.has(name));
}

// Todos los partidos YA jugados y terminados (grupos + eliminatoria,
// según fases activas y puntos-activos por fase), en orden cronológico
// real. Cada evento es UN partido puntual (no un participante) — el
// mismo universo de partidos que ya usa buildChronologicalResults() por
// participante, pero acá es uno solo para todos.
function getChronoMatchEvents(){
  const list=[];
  if(isFaseActiva("grupos")&&getReglasGrupos().activo!==false){
    MIDS.forEach(mid=>{
      const t=S.matchTimes&&S.matchTimes[mid];if(!t)return;
      const s=sc(mid);if(!s||s.live)return;
      list.push({mid,isElim:false,ts:new Date(t).getTime()});
    });
  }
  const elimActivo=getReglasElim().activo!==false;
  for(let pid=73;pid<=104;pid++){
    const phase=phaseForPid(pid);if(phase&&!isFaseActiva(phase.key))continue;
    if(phase&&(!elimActivo||!isFasePuntosActiva(phase.key)))continue;
    const t=S.elimTimes&&S.elimTimes[pid];if(!t)continue;
    const real=S.elimScores[pid]||S.elimScores[String(pid)];if(!real||real.live)continue;
    list.push({mid:pid,isElim:true,ts:new Date(t).getTime()});
  }
  list.sort((a,b)=>a.ts-b.ts);
  return list;
}

// Puntos que UN participante ganó por UN evento puntual (mismo criterio
// que calcPtsForDay(), pero para un solo partido en vez de un día
// entero) — se usa para armar el replay partido a partido.
function _evolPtsForEvent(name,e){
  if(!e.isElim){
    const s=sc(e.mid);if(!s)return 0;
    const p=MD[e.mid]?.preds?.[name];if(!p)return 0;
    const Rg=getReglasGrupos();
    const rR=s.h>s.a?"H":s.h<s.a?"A":"D";
    const pR=p.h>p.a?"H":p.h<p.a?"A":"D";
    if(rR!==pR)return 0;
    let pts=rR==="D"?Rg.empate:Rg.ganador;
    if(p.h===s.h&&p.a===s.a)pts+=Rg.exacto;
    return pts;
  }
  return calcElimMatchPts(name,e.mid); // ya respeta R.elim.activo/isFasePuntosActiva internamente
}

// Convierte la lista de eventos en un snapshot DE TODOS los
// participantes por cada partido jugado: puntaje acumulado (cum) y
// posición en la tabla (ranks) justo después de ese partido. Granularidad
// fina (partido a partido, no por día) — getTendenciaStats() la necesita
// así para poder comparar "los últimos N partidos" sin importar cuántos
// días abarquen.
function buildHistoricalSnapshots(events){
  const activePL=_evolActivePL();
  const cum={};activePL.forEach(name=>cum[name]=0);
  return events.map(e=>{
    activePL.forEach(name=>{cum[name]+=_evolPtsForEvent(name,e);});
    const ranked=activePL.slice().sort((a,b)=>cum[b]-cum[a]||a.localeCompare(b));
    const ranks={};ranked.forEach((name,i)=>ranks[name]=i+1);
    return{ts:e.ts,dayKey:dayKeyOf(e.ts),cum:{...cum},ranks};
  });
}

// Agrupa los snapshots partido-a-partido en JORNADAS (un día calendario
// con al menos un partido jugado — mismo concepto que getPlayedDaysList()).
// Para cada jornada guarda la posición de cierre del día (ranks del
// último partido de ese día) y el puntaje acumulado al empezar y al
// terminar el día (para poder calcular "cuánto sumó ESE día" restando).
function groupSnapshotsByJornada(snapshots){
  const order=[];const byDay={};
  snapshots.forEach(s=>{
    if(!byDay[s.dayKey]){byDay[s.dayKey]=[];order.push(s.dayKey);}
    byDay[s.dayKey].push(s);
  });
  const days=[];let prevCum=null;
  order.forEach(dayKey=>{
    const list=byDay[dayKey];
    const last=list[list.length-1];
    days.push({ts:last.ts,ranks:last.ranks,startCum:prevCum||{},endCum:last.cum});
    prevCum=last.cum;
  });
  return days;
}

// Tendencia reciente: compara el % de aciertos de los últimos winSize
// partidos contra los winSize anteriores a esos. Necesita una muestra
// mínima para no mostrar "tendencia" con 1 o 2 partidos jugados (la UI
// usa t.available=false para mostrar un mensaje en vez de un dato poco
// confiable).
function getTendenciaStats(name,events,snapshots,rankNow){
  const results=buildChronologicalResults(name); // {ts,hit}, ya gateado por fase
  const totalPlayed=results.length;
  const winSize=5;
  if(totalPlayed<winSize+3){
    return{available:false,totalPlayed,rankNow};
  }
  const pct=arr=>arr.length?Math.round(arr.filter(r=>r.hit).length/arr.length*100):0;
  const recent=results.slice(-winSize);
  const before=results.slice(-winSize*2,-winSize);
  const precAhora=pct(recent);
  const precAntes=before.length?pct(before):precAhora;
  const idxAntes=Math.max(0,snapshots.length-winSize-1);
  const rankAntes=(snapshots.length&&snapshots[idxAntes])?(snapshots[idxAntes].ranks[name]||rankNow):rankNow;
  const diff=precAhora-precAntes;
  const trend=diff>=8?'mejorando':diff<=-8?'empeorando':'estable';
  return{available:true,totalPlayed,winSize,precAntes,precAhora,rankAntes,rankNow,trend};
}

// Logros desbloqueados: al menos un marcador exacto (grupos), racha de
// 10 aciertos consecutivos alguna vez (mismo criterio de "acierto" que
// buildChronologicalResults()/calcRachaBonos()), y mejor posición
// histórica alcanzada (Top 10/5/3/1).
function getLogrosStats(name,events,days,rankNow){
  let exactoAlguna=false;
  events.forEach(e=>{
    if(e.isElim)return; // "marcador exacto" como logro se limita a Grupos, mismo criterio visible en Predicciones
    const s=sc(e.mid);const p=MD[e.mid]?.preds?.[name];
    if(s&&p&&p.h===s.h&&p.a===s.a)exactoAlguna=true;
  });
  let curStreak=0,maxStreak=0;
  buildChronologicalResults(name).forEach(r=>{
    if(r.hit){curStreak++;if(curStreak>maxStreak)maxStreak=curStreak;}else curStreak=0;
  });
  const racha10=maxStreak>=10;
  const TIERS=[10,5,3,1];
  let bestRank=rankNow;
  days.forEach(d=>{const r=d.ranks[name];if(r&&r<bestRank)bestRank=r;});
  const unlockedTiers=TIERS.filter(t=>bestRank<=t);
  const nextTier=TIERS.find(t=>bestRank>t);
  return{exactoAlguna,racha10,unlockedTiers,nextTier};
}

function getTodaysMatchIds(){
  const now=new Date();
  const y=now.getFullYear(),m=now.getMonth(),d=now.getDate();
  const isToday=(ts)=>{
    if(!ts)return false;
    const dt=new Date(ts);
    return dt.getFullYear()===y&&dt.getMonth()===m&&dt.getDate()===d;
  };
  const groupMids=MIDS.filter(mid=>isToday(S.matchTimes[mid]));
  const elimMids=[];
  for(let pid=73;pid<=104;pid++){if(isToday(S.elimTimes[pid]))elimMids.push(pid);}
  return{groupMids,elimMids};
}

function calcBattlePts(name,groupMids,elimMids){
  let pts=0;
  const R=getReglasGrupos();
  if(R.activo!==false){
    groupMids.forEach(mid=>{
      const s=sc(mid);if(!s)return;
      const p=MD[mid]?.preds[name];if(!p)return;
      const rR=s.h>s.a?"H":s.h<s.a?"A":"D";
      const pR=p.h>p.a?"H":p.h<p.a?"A":"D";
      if(rR===pR){pts+=rR==="D"?R.empate:R.ganador;if(p.h===s.h&&p.a===s.a)pts+=R.exacto;}
    });
  }
  elimMids.forEach(pid=>{pts+=calcElimMatchPts(name,pid);});
  return pts;
}

function areTodaysMatchesDone(groupMids,elimMids){
  const gDone=groupMids.every(mid=>{const s=sc(mid);return!!s&&!s.live;});
  const eDone=elimMids.every(pid=>{const s=S.elimScores[pid]||S.elimScores[String(pid)];return!!s&&!s.live;});
  return gDone&&eDone;
}

function isPhaseComplete(phase){
  if(!phase.elimPhase){
    // JSON coerces numeric keys to strings on parse, so check both
    return phase.mids.every(mid=>!!(S.scores[mid]||S.scores[String(mid)]));
  }else{
    return phase.mids.every(pid=>!!(S.elimScores[pid]||S.elimScores[String(pid)]));
  }
}

function calcTotalAtCut(name,phaseKey){
  const b=calcPts(name);
  const av=calcAdv(name);
  const elim=calcElimPts(name); // incluye fase actual (en vivo), no la siguiente
  // Last place bonuses from PREVIOUS phases only
  let prevLastBonos=0;
  Object.entries(S.bonos.lastPlace||{}).forEach(([k,lp])=>{
    if(k!==phaseKey&&lp&&lp.name===name)prevLastBonos+=lp.pts;
  });
  return b+av+elim+prevLastBonos;
}

function calcClassifiedPts(name,phase){
  const classifiedPts=getFaseValor(phase,'classifiedPts');
  if(!classifiedPts)return 0;
  if(!isFaseActiva(phase.key))return 0; // v1.2 — fase desactivada: no existe, no puntúa
  if(!isFasePuntosActiva(phase.key))return 0; // v1.2 (fase 2) — puntos de esta fase apagados a propósito
  let pts=0;
  // Los clasificados REALES son los ganadores de los partidos de esta fase
  const realWinners=new Set();
  phase.mids.forEach(pid=>{
    const sc=S.elimScores[pid];if(!sc)return;
    const teams=getRealElimTeams(pid);if(!teams)return;
    let winner;
    if(sc.h>sc.a)winner=teams.h;
    else if(sc.a>sc.h)winner=teams.a;
    else winner=teams.h; // empate → local (penales)
    if(winner)realWinners.add(n(winner));
  });
  // Los clasificados PREDICHOS por el participante = ganadores que predijo en esta fase
  phase.mids.forEach(pid=>{
    const predTeams=getElimTeams(name,pid);if(!predTeams)return;
    const pred=elimPred(name,pid);if(!pred)return;
    let predWinner;
    if(pred.h>pred.a)predWinner=predTeams.h;
    else if(pred.a>pred.h)predWinner=predTeams.a;
    else predWinner=predTeams.h;
    if(predWinner&&realWinners.has(n(predWinner)))pts+=classifiedPts;
  });
  return pts;
}

function calcLlavePts(name,phase){
  const llavePts=getFaseValor(phase,'llavePts');
  if(!llavePts)return 0;
  if(!isFaseActiva(phase.key))return 0; // v1.2 — fase desactivada: no existe, no puntúa
  if(!isFasePuntosActiva(phase.key))return 0; // v1.2 (fase 2) — puntos de esta fase apagados a propósito
  let pts=0;
  phase.mids.forEach(pid=>{
    // Solo si el partido tiene resultado (la llave es real)
    const hasSc=phase.elimPhase?!!S.elimScores[pid]:!!S.scores[pid];
    if(!hasSc)return;
    // Verificar si la llave predicha coincide con la real
    if(isLlaveCorrecta(name,pid))pts+=llavePts;
  });
  return pts;
}

function closePhase(phaseKey){
  const phase=BONUS_PHASES.find(p=>p.key===phaseKey);
  if(!phase){toast("Fase no encontrada",true);return;}
  if(!isFaseActiva(phaseKey)){toast("Esta fase está desactivada en este torneo",true);return;} // v1.2
  if(!isPhaseComplete(phase)){toast("Faltan resultados en esta fase",true);return;}
  if(S.bonos.closed?.[phaseKey]){toast("Esta fase ya está cerrada",true);return;}
  // Check prereq: prev phase must be closed first (o desactivada, ver isPrevPhaseClosed)
  if(!isPrevPhaseClosed(phase)){
    const prev=getPhaseByKey(phase.prevPhase);
    toast(`Primero debes cerrar: ${prev?.label||phase.prevPhase}`,true);return;
  }

  // PASO 1: Adjudicar bono de último lugar
  const lastPts=isFaseLastPtsActiva(phase)?getFaseValor(phase,'lastPts'):0;
  if(lastPts>0){
    const ranking=PL.map(name=>({name,total:calcTotalAtCut(name,phaseKey)}))
                    .sort((a,b)=>a.total-b.total);
    const last=ranking[0];
    if(last){
      if(!S.bonos.lastPlace)S.bonos.lastPlace={};
      S.bonos.lastPlace[phaseKey]={name:last.name,pts:lastPts,total:last.total,phase:phase.label};
    }
  }

  // Marcar fase como cerrada (esto activa llaves+clasificados en calcElimPts)
  if(!S.bonos.closed)S.bonos.closed={};
  S.bonos.closed[phaseKey]=true;

  save();renderRank();renderBonosPanel();

  // Show who got last place bonus
  const lp=S.bonos.lastPlace?.[phaseKey];
  const msg=lp&&lastPts>0
    ?`✓ ${phase.label} cerrada · 🚑 Último: ${sn(lp.name)} +${lp.pts}pts`
    :`✓ ${phase.label} cerrada`;
  toast(msg);
}

function checkAndAwardBonos(){
  // FIX: antes esta función devolvía `false` siempre, sin importar lo que
  // hiciera autoCloseCompletedPhases() — por eso runBonosCheck() (el botón
  // "🎁 revisar bonos") decía "Sin fases nuevas completadas" incluso cuando
  // el cierre automático SÍ había cerrado una fase un segundo antes. Ahora
  // se propaga el resultado real de autoCloseCompletedPhases().
  if(S.autoClose)return autoCloseCompletedPhases();
  return false;
}

function autoCloseCompletedPhases(){
  // FIX: antes devolvía undefined (sin return explícito) — ahora devuelve
  // si efectivamente cerró algo, para que checkAndAwardBonos() pueda
  // informarlo correctamente.
  if(!S.autoClose)return false;
  let any=false;
  // Process in order so prereqs are satisfied
  BONUS_PHASES.forEach(phase=>{
    if(!isFaseActiva(phase.key))return; // v1.2 — fase desactivada: no existe en este torneo
    if(S.bonos.closed?.[phase.key])return;
    if(!isPhaseComplete(phase))return;
    if(!isPrevPhaseClosed(phase))return; // respect chain
    // Adjudicate last place
    const lastPts=isFaseLastPtsActiva(phase)?getFaseValor(phase,'lastPts'):0;
    if(lastPts>0){
      const ranking=PL.map(name=>({name,total:calcTotalAtCut(name,phase.key)})).sort((a,b)=>a.total-b.total);
      const last=ranking[0];
      if(last){
        if(!S.bonos.lastPlace)S.bonos.lastPlace={};
        S.bonos.lastPlace[phase.key]={name:last.name,pts:lastPts,total:last.total,phase:phase.label};
      }
    }
    if(!S.bonos.closed)S.bonos.closed={};
    S.bonos.closed[phase.key]=true;
    any=true;
    const lp=S.bonos.lastPlace?.[phase.key];
    toast(`✓ Auto-cerrada: ${phase.label}${lp&&lastPts>0?" · 🚑 "+sn(lp.name)+" +"+lp.pts+"pts":""}`);
  });
  if(any){save();renderRank();renderBonosPanel();}
  return any;
}

function reopenPhase(key){
  if(!confirm(`¿Reabrir fase "${key}"? Se borrarán los bonos adjudicados para esa fase.`))return;
  if(S.bonos.closed)delete S.bonos.closed[key];
  if(S.bonos.lastPlace)delete S.bonos.lastPlace[key];
  if(S.bonos.classified)delete S.bonos.classified[key];
  if(S.bonos.llaves)delete S.bonos.llaves[key];
  save();renderRank();renderBonosPanel();
  toast(`✓ Fase ${key} reabierta`);
}

function runBonosCheck(){
  const awarded=checkAndAwardBonos();
  if(!awarded)toast("Sin fases nuevas completadas");
  renderBonosPanel();
}

function clearAllBonos(){
  if(!confirm("¿Limpiar TODOS los bonos adjudicados? Esto reabre todas las fases."))return;
  S.bonos={lastPlace:{},classified:{},llaves:{},closed:{}};
  save();renderRank();renderBonosPanel();
  toast("✓ Bonos limpiados");
}

function calcGroupStandings() {
  // teams[group][teamName] = {pts, gf, ga, gd, played, w, d, l, fairPlay}
  const teams = {};
  // Inicializar todos los equipos en sus grupos
  const groupTeams = {}; // group → [teamNames]
  Object.entries(GES).forEach(([g, arr]) => {
    groupTeams[g] = arr.map(x => x.replace(/^\S+\s/, "").trim());
    teams[g] = {};
    groupTeams[g].forEach(t => {
      teams[g][t] = {pts:0, gf:0, ga:0, gd:0, played:0, w:0, d:0, l:0, fp:0, name:t};
    });
  });

  // Procesar todos los partidos de grupos (P1–P72)
  for (let mid = 1; mid <= 72; mid++) {
    const sc = S.scores[mid]; if (!sc) continue;
    const g = MGMAP[mid]; if (!g) continue;
    const abbrs = MID_ABBRS[mid]; if (!abbrs) continue;
    const [ha, aa] = abbrs.split("|");
    const hName = abbr2name(ha);
    const aName = abbr2name(aa);
    const ht = teams[g]?.[hName];
    const at = teams[g]?.[aName];
    if (!ht || !at) continue;

    ht.gf += sc.h; ht.ga += sc.a; ht.gd += (sc.h - sc.a); ht.played++;
    at.gf += sc.a; at.ga += sc.h; at.gd += (sc.a - sc.h); at.played++;

    if (sc.h > sc.a) { ht.pts += 3; ht.w++; at.l++; }
    else if (sc.a > sc.h) { at.pts += 3; at.w++; ht.l++; }
    else { ht.pts += 1; at.pts += 1; ht.d++; at.d++; }
  }

  // Ordenar cada grupo: pts → gd → gf → h2h pts → h2h gd → h2h gf → fairPlay
  const sorted = {};
  Object.entries(teams).forEach(([g, ts]) => {
    const arr = Object.values(ts);
    // H2H for tiebreaks between exactly-tied teams
    arr.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      // h2h: find the match between a and b
      const h2h = calcH2H(g, a.name, b.name);
      if (h2h.aPts !== h2h.bPts) return h2h.bPts - h2h.aPts; // b=a, a=b in sort context
      if (h2h.aGd !== h2h.bGd) return h2h.bGd - h2h.aGd;
      if (h2h.aGf !== h2h.bGf) return h2h.bGf - h2h.aGf;
      return 0;
    });
    sorted[g] = arr;
  });
  return sorted;
}

function calcH2H(g, nameA, nameB) {
  let aPts=0, bPts=0, aGf=0, bGf=0;
  for (let mid = 1; mid <= 72; mid++) {
    if (MGMAP[mid] !== g) continue;
    const sc = S.scores[mid]; if (!sc) continue;
    const abbrs = MID_ABBRS[mid]; if (!abbrs) continue;
    const [ha, aa] = abbrs.split("|");
    const hName = abbr2name(ha);
    const aName2 = abbr2name(aa);
    const involved = (hName === nameA && aName2 === nameB) || (hName === nameB && aName2 === nameA);
    if (!involved) continue;
    const hIsA = hName === nameA;
    const aG = hIsA ? sc.h : sc.a;
    const bG = hIsA ? sc.a : sc.h;
    aGf += aG; bGf += bG;
    if (aG > bG) aPts += 3;
    else if (bG > aG) bPts += 3;
    else { aPts++; bPts++; }
  }
  return { aPts, bPts, aGd: aGf-bGf, bGd: bGf-aGf, aGf, bGf };
}

function getBest3rds(standings) {
  const thirds = [];
  Object.entries(standings).forEach(([g, arr]) => {
    if (arr.length >= 3) {
      thirds.push({ ...arr[2], group: g });
    }
  });
  // Ordenar los 12 terceros: pts → gd → gf → fairplay
  thirds.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return 0;
  });
  return thirds.slice(0, 8); // top 8
}

function annexCLookup(groups8) {
  // groups8 = array de 8 letras de grupo, ej ["B","C","D","E","F","G","H","I"]
  const key = [...groups8].sort().join("");
  const row = ANNEX_C[key];
  if (!row || row === "SKIP") return null;
  // row = [vs1A, vs1B, vs1D, vs1E, vs1G, vs1I, vs1K, vs1L]
  // Match IDs that have 3rd place opponents:
  // P74: 1E vs 3rd, P77: 1I vs 3rd, P79: 1A vs 3rd
  // P80: 1L vs 3rd, P81: 1D vs 3rd, P82: 1G vs 3rd
  // P85: 1B vs 3rd, P87: 1K vs 3rd
  return {
    P79: row[0], // 1A vs 3rd-row[0]
    P85: row[1], // 1B vs 3rd-row[1]
    P81: row[2], // 1D vs 3rd-row[2]
    P74: row[3], // 1E vs 3rd-row[3]
    P82: row[4], // 1G vs 3rd-row[4]
    P77: row[5], // 1I vs 3rd-row[5]
    P87: row[6], // 1K vs 3rd-row[6]
    P80: row[7], // 1L vs 3rd-row[7]
  };
}

function allGroupsComplete() {
  for (let mid = 1; mid <= 72; mid++) {
    if (!S.scores[mid] && !S.scores[String(mid)]) return false;
  }
  return true;
}

function getFirstBlockedElimPhase(){
  for(const phase of BONUS_PHASES){
    if(!phase.elimPhase)continue;
    if(!isFaseActiva(phase.key))continue; // v1.2 — fase desactivada: no existe en este torneo
    if(!phase.prevPhase)continue;
    // Only block if this phase has at least some teams loaded (is active)
    const hasTeams=phase.mids.some(pid=>getRealElimTeams(pid));
    if(!hasTeams)continue;
    if(!isPrevPhaseClosed(phase))return phase;
  }
  return null;
}

function getRealAdvancers(phase){
  const winners=new Set();
  if(!phase.elimPhase)return winners;
  phase.mids.forEach(pid=>{
    const sc=S.elimScores[pid]||S.elimScores[String(pid)];if(!sc)return;
    const teams=getRealElimTeams(pid);if(!teams)return;
    let w;
    if(sc.h>sc.a)w=teams.h;
    else if(sc.a>sc.h)w=teams.a;
    else{const tb=S.tieBreakers[pid];w=tb==="a"?teams.a:teams.h;}
    if(w)winners.add(n(w));
  });
  return winners;
}

function getClassifiedBadgeForPid(playerName, pid){
  const phase=phaseForPid(pid);
  const classifiedPts=phase?getFaseValor(phase,'classifiedPts'):0;
  if(!phase||!classifiedPts||!isFaseActiva(phase.key)||!isFasePuntosActiva(phase.key)||!isPrevPhaseClosed(phase))return null;

  // Who did this player predict to win this match?
  const predTeams=getElimTeams(playerName,pid);
  const pred=elimPred(playerName,pid);
  if(!predTeams||!pred)return null;

  let predWinner;
  if(pred.h>pred.a)predWinner=predTeams.h;
  else if(pred.a>pred.h)predWinner=predTeams.a;
  else predWinner=predTeams.h; // draw → home

  if(!predWinner)return null;

  // Did this predicted winner actually advance from this phase?
  const realAdvancers=getRealAdvancers(phase);
  const advanced=realAdvancers.has(n(predWinner));

  // Flag emoji for the team
  const flag=ALL_FLAGS[predWinner]||"⚽";

  return{team:predWinner,flag,advanced,pts:classifiedPts};
}

function getRank(){
  // S.hiddenPL = set of hidden participant names
  if(!S.hiddenPL)S.hiddenPL=new Set();
  _mvpCache=null; // v1.2 (fase 2) — recalcular el líder de cada día una sola vez por ranking, no una vez por participante
  return PL.map(name=>{
    const m=PM[name]||{};
    const b=calcPts(name);
    const av=calcAdv(name);
    const elim=calcElimPts(name);
    const bon=calcBonos(name);
    const hidden=S.hiddenPL instanceof Set?S.hiddenPL.has(name):!!(S.hiddenPL?.[name]);
    return{name,b,av,elim,bon,total:b+av+elim+bon,hidden,...m};
  }).sort((a,x)=>x.total-a.total);
}

function getMovement(name,pos){
  const snap=getActiveSnapshot();
  if(!snap||!snap.positions)return "";
  const prev=snap.positions[name];
  if(!prev)return "";
  const diff=prev-pos; // positivo = subió
  if(diff===0)return `<span style="font-size:10px;color:var(--qb-muted)">—</span>`;
  if(diff>0)return `<span style="font-size:10px;font-weight:800;color:#4dde8c">↑${diff}</span>`;
  return `<span style="font-size:10px;font-weight:800;color:#ef4444">↓${Math.abs(diff)}</span>`;
}