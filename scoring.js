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

// v3.5 — Comparador de Quinielas: clasifica el resultado (H/A/D) de la
// predicción de UN partido de Grupos para UN participante, sin calcular
// puntos (eso ya lo hace calcPts()) -- para poder comparar el pick de dos
// personas ENTRE SÍ sin duplicar una cuarta vez la lógica de puntaje que
// ya está inline en calcPts()/buildDashGruposHtml()/renderPred()/
// calcularDiffPrediccion().
function groupPickResult(mid,name){
  const p=MD[mid]?.preds?.[name];
  if(!p)return null;
  return p.h>p.a?"H":p.h<p.a?"A":"D";
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

// v2.7.6 — ¿Esta "Regla avanzada" puntual (ARULES/SPECIAL_QUESTIONS,
// mismo id en ambas) sigue otorgando puntos? Apagada por el admin desde
// Configuración del torneo → Reglas → 🎯 Preguntas avanzadas.
// v2.8.2 — registro.js (activeSpecialQuestions()) ahora también usa esta
// misma función para OCULTAR del wizard/PDF cualquier pregunta apagada,
// no solo dejar de puntuarla: antes el formulario seguía pidiéndola aunque
// el admin ya la hubiera apagado, lo cual confundía a los participantes.
function isPreguntaAvanzadaActiva(qid){
  const v=DB.configGlobal?.reglas?.avanzado?.[qid];
  return v!==false;
}

function calcAdv(name){
  const r=S.reality;
  const spec=getDynamicSpec(name)||{};
  const a=Object.keys(spec).length?spec:(S.adv[name]||{});
  const nn=s=>(s||"").trim().toLowerCase();
  let ap=0;
  if(isPreguntaAvanzadaActiva('campeon')&&nn(a.champ)&&nn(a.champ)===nn(r.champ))ap+=15;
  if(isPreguntaAvanzadaActiva('subcampeon')&&nn(a.runner)&&nn(a.runner)===nn(r.runner))ap+=10;
  if(isPreguntaAvanzadaActiva('tercer')&&nn(a.third)&&nn(a.third)===nn(r.third))ap+=8;
  // Scorer: must match scorer first to get goals bonus. Si 'goleador' está
  // apagada, ni el acierto del nombre ni el bono de goles exactos suman
  // (no tiene sentido premiar el bono de goles de un goleador que ya no
  // puntúa); 'goles_goleador' apagada por separado solo apaga ESE bono,
  // dejando los +12 del nombre si sigue acertado.
  const scorerMatch=isPreguntaAvanzadaActiva('goleador')&&nn(a.scorer)&&nn(r.topScorer)&&nn(a.scorer)===nn(r.topScorer);
  if(scorerMatch){
    ap+=12;
    if(isPreguntaAvanzadaActiva('goles_goleador')&&r.topScorerGoals>0&&parseInt(a.scorerGoals)===parseInt(r.topScorerGoals))ap+=8;
  }
  // Top country: mismo criterio que el goleador de arriba, pero acepta
  // CUALQUIERA de los países empatados si hay empate real (r.topCountry2
  // v4.5, r.topCountry3 v4.6 -- doble o triple empate).
  const countryMatch=isPreguntaAvanzadaActiva('pais_goleador')&&nn(a.topCountry)&&(
    (nn(r.topCountry)&&nn(a.topCountry)===nn(r.topCountry))||
    (nn(r.topCountry2)&&nn(a.topCountry)===nn(r.topCountry2))||
    (nn(r.topCountry3)&&nn(a.topCountry)===nn(r.topCountry3))
  );
  if(countryMatch){
    ap+=8;
    if(isPreguntaAvanzadaActiva('goles_pais')&&r.topCountryGoals>0&&parseInt(a.topCountryGoals)===parseInt(r.topCountryGoals))ap+=10;
  }
  if(isPreguntaAvanzadaActiva('pais_goleado')&&nn(a.mostConceded)&&nn(a.mostConceded)===nn(r.mostConceded))ap+=8;
  return ap;
}

function elimPred(name,pid){
  const person=(DB.participants||[]).find(p=>p.name===name);
  if(!person)return null;
  const slot=PID_TO_SLOT[pid];if(!slot)return null;
  const rec=(DB.predictions[person.id]||{})[slot];
  if(!rec)return null;
  return{h:rec.h,a:rec.a,pick:rec.pick};
}

// v3.15.2 — BUG REAL: en un cruce que el participante predijo EMPATADO
// (rec.h===rec.a), koWinner() (registro.js, lo que decide qué muestra el
// wizard/"Predicciones") SÍ respeta rec.pick (a quién marcó como que avanza
// por penales) -- pero getPredWinner()/calcClassifiedPtsForPid()/
// getClassifiedBadgeForPid() de acá abajo, en vez de mirar ese mismo pick,
// asumían SIEMPRE que el local (teams.h) avanzaba. Si el participante
// eligió al visitante (teams.a, el que aparece a la derecha en la fila),
// el wizard mostraba correctamente "pasa <visitante>" pero el motor de
// puntos seguía comparando contra el local -- 0pts de "Clasificado" para un
// pick que en realidad era correcto. Esta función centraliza el mismo
// criterio que koWinner(): en empate, sin pick definido no hay ganador
// predicho (no se puede inventar un default).
function predictedWinnerFromPred(pred,teams){
  if(!pred||!teams)return null;
  if(pred.h>pred.a)return teams.h;
  if(pred.a>pred.h)return teams.a;
  if(pred.pick===teams.h||pred.pick===teams.a)return pred.pick;
  return null;
}

function getElimTeams(name,pid){
  const person=(DB.participants||[]).find(p=>p.name===name);
  if(!person)return null;
  const slot=PID_TO_SLOT[pid];if(!slot)return null;
  const rec=(DB.predictions[person.id]||{})[slot];
  if(!rec)return null;
  // v3.2.4 — BUG REAL (torneo arrancando en una fase posterior a Grupos,
  // ej. Octavos): para el pid de la fase MANUAL (getManualTeamPids()), el
  // wizard siempre MUESTRA los equipos reales vigentes (S.elimTeams,
  // ver trustSlot/renderKoRow en registro.js) -- pero al tipear un
  // marcador congelaba esos nombres en _a/_b de la predicción, tal cual
  // estaban EN ESE MOMENTO. Si el admin corrige después ese nombre
  // (typo/acento, o ESPN reordena local/visitante), la copia congelada
  // del participante queda desincronizada del equipo real actual --
  // isLlaveCorrecta() (compara set de nombres) empieza a dar false para
  // ese participante aunque haya acertado el resultado real: 0pts
  // silencioso, sin ningún error visible, y sin forma de que se
  // autocorrija.
  //
  // OJO: esto SOLO aplica cuando la fase manual es el punto de entrada
  // real del torneo para TODOS por igual (Grupos desactivada, o
  // Dieciseisavos no es la primera fase activa) -- ahí nadie "adivina" el
  // cruce, todos comparten el mismo. Si en cambio Grupos está activa Y
  // Dieciseisavos es la primera fase (el caso de SIEMPRE hasta ahora),
  // CADA participante arma su propio cruce de Dieciseisavos desde SUS
  // PROPIOS resultados de grupo (ver r32SembradoDeGrupos en
  // registro.js::computeBracket) -- ahí la huella congelada SIGUE siendo
  // necesaria: es lo que permite comparar "¿tu bracket propio predijo el
  // MISMO cruce que realmente ocurrió en este pid oficial?", que es
  // justamente lo que puntúa la llave.
  const manualPhaseSembradaDeGrupos = isFaseActiva('grupos') && getFirstActiveElimPhase()?.key==='r16';
  if(!manualPhaseSembradaDeGrupos && getManualTeamPids().includes(pid)){
    const real=S.elimTeams[pid];
    if(real&&real.h&&real.a)return{h:real.h,a:real.a};
  }
  if(!rec._a||!rec._b||rec._a==="?")return null;
  return{h:rec._a,a:rec._b};
}

function getPredWinner(name,pid,wantLoser=false){
  const teams=getElimTeams(name,pid);if(!teams)return null;
  const pred=elimPred(name,pid);if(!pred)return null;
  const winner=predictedWinnerFromPred(pred,teams);
  if(!winner)return null;
  return wantLoser?(winner===teams.h?teams.a:teams.h):winner;
}

// v1.9 — NUEVO: "¿Quién avanza?" (pestaña ⚡ En vivo). A diferencia de
// isLlaveCorrecta()/findCruceValido() (que exigen que el cruce COMPLETO
// -- los 2 equipos puntuales -- coincida con un cruce real, para otorgar
// puntos), acá alcanza con que el participante tenga a ESE equipo
// jugando en ALGÚN cruce de SU PROPIO bracket predicho dentro de la misma
// ronda, sin importar contra quién: cada participante arma su bracket
// desde SUS PROPIOS resultados de grupo, así que puede no coincidir con
// el cruce real (ej. su versión de Portugal-vs-alguien puede no ser
// Portugal-vs-Croacia) y aun así haber apostado claramente a que Portugal
// pasa. roundIds = todos los pids de esa ronda (ELIM_ROUNDS) — se
// recorren todos porque no sabemos a priori en qué slot cada participante
// tiene a ese equipo. Devuelve los nombres (sin abreviar) de quienes
// predijeron que "teamName" gana su cruce.
function getTeamAdvancePickers(teamName,roundIds){
  const tn=n(teamName);
  const names=[];
  PL.forEach(name=>{
    for(const pid of roundIds){
      const teams=getElimTeams(name,pid);if(!teams)continue;
      if(n(teams.h)!==tn&&n(teams.a)!==tn)continue;
      const winner=getPredWinner(name,pid);
      if(winner&&n(winner)===tn)names.push(name);
      break; // ya encontramos el cruce de este participante con ese equipo
    }
  });
  return names;
}

// v1.9 — BUG REAL encontrado (el motivo de fondo por el que Batallas no
// sumaba "Clasificado" aunque el Ranking sí): calcClassifiedPtsForPid()
// (la versión que usaba calcBattlePts hasta ahora) exige que el
// participante haya llenado ESE MISMO pid oficial (ej. P73) con SU
// PROPIO cruce -- pero cada participante arma su bracket desde sus
// propios resultados de grupo, así que su predicción de "Portugal gana"
// casi nunca cae exactamente en el pid oficial donde Portugal juega de
// verdad (puede estar en cualquier otro slot de esa ronda). El Ranking
// nunca tuvo este problema porque calcClassifiedPtsForPhase() suma TODOS
// los pids de la fase de una sola vez (si no está en el pid 73, aparece
// en algún otro) -- pero una Batalla solo mira los pids puntuales de su
// ventana, así que ese "en algún otro pid" quedaba completamente fuera
// de la cuenta. Fix: en vez de mirar el pid oficial puntual, se pregunta
// "¿este participante predijo, en CUALQUIER slot de su propio bracket de
// esa ronda, que el equipo que REALMENTE ganó este partido iba a ganar
// el suyo?" -- reusa getTeamAdvancePickers() (la misma búsqueda por
// equipo que ya usa "¿Quién avanza?" en En vivo), así ambas quedan
// consistentes entre sí. calcClassifiedPtsForPid()/ForPhase() (el
// Ranking) NO se tocan -- se dejan intactas a propósito para no mover el
// puntaje ya otorgado a nadie a esta altura del torneo.
function calcClassifiedPtsForRealMatch(name,pid){
  const phase=phaseForPid(pid);
  if(!phase||!phase.elimPhase)return 0;
  const classifiedPts=getFaseValor(phase,'classifiedPts');
  if(!classifiedPts)return 0;
  if(!isFaseActiva(phase.key))return 0;
  if(!isFasePuntosActiva(phase.key))return 0;
  if(!isPrevPhaseClosed(phase))return 0;
  const winner=getRealWinner(pid);if(!winner)return 0;
  const round=(typeof ELIM_ROUNDS!=="undefined"?ELIM_ROUNDS:[]).find(r=>r.ids.includes(pid));
  const roundIds=round?round.ids:phase.mids;
  return getTeamAdvancePickers(winner,roundIds).includes(name)?classifiedPts:0;
}

// v3.5.1 — Reescrita: antes decidía PRIMERO si el pid es "manual" hoy
// (getManualTeamPids(), que sigue a la fase activa en cada momento) y
// solo si no lo era intentaba derivar del árbol (ELIM_TREE). BUG
// REPORTADO: "Torneo real" (Estadísticas) se veía en blanco para
// Dieciseisavos -- y en cascada, TODAS las rondas posteriores -- apenas
// el admin apagaba esa fase en el Constructor de Torneos, aunque los
// equipos/resultado real YA estaban cargados de antes. Causa: al apagar
// la fase, Dieciseisavos deja de ser "la fase manual" (pasa a serlo la
// siguiente activa, ej. Octavos) -- pero Dieciseisavos NUNCA tiene
// entrada en ELIM_TREE para derivarse de una ronda anterior (el árbol
// arranca en Octavos/pid 89: Dieciseisavos SIEMPRE es la raíz) -- sin
// ningún camino válido, quedaba en null. Y como cada ronda posterior
// depende de resolver la anterior (getRealWinner()->getRealElimTeams()
// en cadena), la raíz en null tumbaba también Octavos/Cuartos/etc.
//
// Ahora el orden es al revés: primero intenta derivar del árbol SI hay
// entrada (no le importa si el pid es "manual" ahora mismo); si eso no
// resuelve nada (porque no hay entrada -- Dieciseisavos siempre cae acá
// -- o porque la ronda anterior real todavía no tiene resultado, ej.
// Constructor de Torneos arrancando directo en Octavos, donde 89-96 SÍ
// tienen entrada en el árbol pero sus "padres" de Dieciseisavos nunca
// van a tener resultado real), recién ahí cae a S.elimTeams[pid] --
// donde vive cualquier dato cargado a mano/ESPN para ESE pid puntual, sin
// importar si sigue siendo "la fase manual" según la config de hoy.
// Apagar una fase solo debe afectar sus PUNTOS (isFaseActiva) -- nunca
// debe borrar ni ocultar lo que de verdad pasó.
function getRealElimTeams(pid){
  const node=ELIM_TREE[pid];
  if(node){
    const teamH=getRealWinner(node.parentH,node.useLoserH);
    const teamA=getRealWinner(node.parentA,node.useLoserA);
    if(teamH&&teamA)return{h:teamH,a:teamA};
  }
  const t=S.elimTeams[pid];
  if(!t||!t.h||!t.a)return null;
  return{h:t.h,a:t.a};
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

// v1.9 — Diagnóstico legible de POR QUÉ un partido de eliminatoria da
// 0pts para "name" -- mismos gates que calcElimMatchBreakdown()/
// calcClassifiedPtsForPid(), en el mismo orden, pero devolviendo un
// motivo en español en vez de silenciosamente [] o 0. Pensado para
// mostrarse en la Cartelera de una Batalla (app-batallas.js) cuando el
// admin necesita entender por qué el marcador no se mueve, sin tener que
// ir a revisar Reglas/Bonos a mano partido por partido. Devuelve null si
// no hay ningún motivo conocido para estar en 0 (o si de hecho da >0pts).
function explainZeroElimPts(name,pid){
  const phase=phaseForPid(pid);
  if(!phase)return"partido no reconocido";
  if(!isFaseActiva(phase.key))return`fase "${phase.label}" desactivada (Configuración del torneo → Fases activas)`;
  if(!isPrevPhaseClosed(phase)){
    const prev=getPhaseByKey(phase.prevPhase);
    return`falta cerrar "${prev?.label||phase.prevPhase}" en el panel 🎁 Bonos`;
  }
  if(!isFasePuntosActiva(phase.key))return`puntos de "${phase.label}" desactivados (Reglas → Puntos por fase)`;
  const sc=S.elimScores[pid]||S.elimScores[String(pid)];
  if(!sc)return"todavía no hay resultado real cargado para este partido";
  if(!isLlaveCorrecta(name,pid)&&!findCruceValido(name,pid))return`no tiene la llave (ni un cruce válido) de este partido — ${describeOwnElimGuess(name,pid)}`;
  return null; // llave/cruce ok y todo activo: si igual da 0, es que no acertó ganador/empate
}

// v1.9 — Complemento de explainZeroElimPts(): cuando la llave falla, esto
// dice CONCRETAMENTE qué predijo (o no) el participante para ese slot del
// bracket, para poder distinguir a simple vista entre 3 causas muy
// distintas: (1) predijo un cruce que simplemente no coincide con la
// realidad (su fase de grupos salió distinta), (2) dejó ese cruce puntual
// sin llenar pero sí completó otros de eliminatoria, o (3) nunca llegó a
// completar NADA de eliminatoria (quiniela sin terminar/enviar). Las 3
// dan "0pts" por igual, pero el motivo real (y lo que hay que corregir)
// es completamente distinto.
function describeOwnElimGuess(name,pid){
  const person=(DB.participants||[]).find(p=>p.name===name);
  if(!person)return"participante no encontrado en Mi Quiniela";
  const preds=DB.predictions[person.id]||{};
  const slot=PID_TO_SLOT[pid];
  const rec=slot?preds[slot]:null;
  if(rec&&rec._a&&rec._b&&rec._a!=="?"){
    const w=getPredWinner(name,pid);
    return`predijo ${rec._a} vs ${rec._b}${w?` (elige a ${w})`:''}`;
  }
  const tieneAlgunaKO=Object.keys(preds).some(k=>/^(r32|r16|qf|sf)_\d+$|^(third|final)$/.test(k));
  return tieneAlgunaKO?"no llenó ese cruce puntual (sí completó otros de eliminatoria)":"no completó ninguna predicción de eliminatoria todavía";
}

// v1.9 — Extraído de calcClassifiedPtsForPhase() para poder otorgar el
// bono de "clasificado" de UN partido puntual (no toda la fase de una
// sola vez) — lo necesita calcBattlePts() para poder atribuirle a una
// Batalla/Rumble el bono de clasificado SOLO de los pids que realmente
// caen dentro de su ventana de partidos (groupMids/elimMids), sin sumar
// de más el resto de la fase que quedó afuera de esa ventana.
function calcClassifiedPtsForPid(name,pid){
  const phase=phaseForPid(pid);
  if(!phase||!phase.elimPhase)return 0;
  const classifiedPts=getFaseValor(phase,'classifiedPts');
  if(!classifiedPts)return 0;
  if(!isFaseActiva(phase.key))return 0; // v1.2 — fase desactivada: no existe, no puntúa
  if(!isFasePuntosActiva(phase.key))return 0; // v1.2 (fase 2) — puntos de esta fase apagados a propósito
  if(!isPrevPhaseClosed(phase))return 0;
  const predTeams=getElimTeams(name,pid);if(!predTeams)return 0;
  const pred=elimPred(name,pid);if(!pred)return 0;
  const predWinner=predictedWinnerFromPred(pred,predTeams);
  if(!predWinner)return 0;
  // Check if predWinner is in real advancers (team, not llave)
  return getRealAdvancers(phase).has(n(predWinner))?classifiedPts:0;
}

function calcClassifiedPtsForPhase(name,phase){
  if(!phase.elimPhase)return 0;
  return phase.mids.reduce((sum,pid)=>sum+calcClassifiedPtsForPid(name,pid),0);
}

function calcElimPts(name){
  let pts=0;
  // Match pts
  for(let pid=ELIM_MID_MIN;pid<=ELIM_MID_MAX;pid++)pts+=calcElimMatchPts(name,pid);
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
  pts+=calcBattleWinBonos(name);  // v2.7.1 — nuevo, desactivado por defecto
  pts+=calcRumbleWinBonos(name);  // v2.7.1 — nuevo, desactivado por defecto
  return pts;
}

// v2.7.1 — Bono por ganar Batallas 1v1 / Royal Rumble (Configuración del
// torneo → Reglas → Batallas). Ambos leen el mismo switch "activo" (un
// solo interruptor para las 2, ganadorDuelo/ganadorRumble son los montos
// por victoria) y cuentan TODAS las victorias históricas de "name" en
// S.battleHistory/S.rumbleHistory (resetBattle()/resetRumble(), ya
// congeladas ahí -- no se recalculan, así que cerrar/reabrir fases o
// tocar resultados después no puede moverle el bono a nadie por
// sorpresa). Un "Empate" no cuenta como victoria de nadie: h.winner en
// ese caso vale literalmente "Empate", que nunca puede coincidir con el
// nombre real de un participante.
function calcBattleWinBonos(name){
  const cfg=DB.configGlobal?.reglas?.batallas;
  if(!cfg||!cfg.activo)return 0;
  const ptsPorVictoria=Number(cfg.ganadorDuelo)||0;
  if(ptsPorVictoria<=0)return 0;
  const wins=(S.battleHistory||[]).filter(h=>h&&h.winner===name).length;
  return wins*ptsPorVictoria;
}
function calcRumbleWinBonos(name){
  const cfg=DB.configGlobal?.reglas?.batallas;
  if(!cfg||!cfg.activo)return 0;
  const ptsPorVictoria=Number(cfg.ganadorRumble)||0;
  if(ptsPorVictoria<=0)return 0;
  const wins=(S.rumbleHistory||[]).filter(h=>h&&h.winner===name).length;
  return wins*ptsPorVictoria;
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
  for(let pid=ELIM_MID_MIN;pid<=ELIM_MID_MAX;pid++){
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
  for(let pid=ELIM_MID_MIN;pid<=ELIM_MID_MAX;pid++){
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
  for(let pid=ELIM_MID_MIN;pid<=ELIM_MID_MAX;pid++){
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
  for(let pid=ELIM_MID_MIN;pid<=ELIM_MID_MAX;pid++){
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
//
// v3.9 — BUG REPORTADO: "Puntos por Jornada" (registro.js) no sumaba lo
// mismo que el total real del Ranking -- solo entraban acá los puntos de
// partido (Básicos/Eliminatoria), nunca los bonos (calcBonos). De los 5
// bonos, el de MVP (calcMvpBonos/computeMvpAwardsByDay) es el ÚNICO que
// SÍ tiene una fecha exacta y sin ambigüedad: se otorga a quien sacó más
// puntos ESE día calendario puntual -- los otros 4 no (Último lugar se
// define al cerrar una fase entera, Batallas/Rumble llevan la fecha en
// que el admin cerró el duelo -- no necesariamente la de los partidos que
// lo decidieron, y Racha no registra en qué partido se alcanzó cada
// hito). Por eso, y solo por eso, el bono de MVP se suma acá, día por
// día, con el MISMO criterio exacto que ya usa computeMvpAwardsByDay()
// (mismo PL completo, mismo reparto si hay empate, mismo umbral
// bestPts>0) -- así el total que se ve sumando todas las jornadas
// coincide con calcMvpBonos(name), y buildEvolucionJornadaCardHtml()
// (registro.js) puede mostrar aparte, como residuo, lo que todavía no
// tiene una jornada a la que atribuirse.
function groupSnapshotsByJornada(snapshots){
  const order=[];const byDay={};
  snapshots.forEach(s=>{
    if(!byDay[s.dayKey]){byDay[s.dayKey]=[];order.push(s.dayKey);}
    byDay[s.dayKey].push(s);
  });
  const mvpCfg=DB.configGlobal?.reglas?.mvp;
  const mvpPts=(mvpCfg&&mvpCfg.activo)?(Number(mvpCfg.pts)||0):0;

  const days=[];let prevCum=null;const mvpAcum={};
  order.forEach(dayKey=>{
    const list=byDay[dayKey];
    const last=list[list.length-1];
    if(mvpPts>0){
      let bestPts=-Infinity,best=[];
      PL.forEach(p=>{
        const pts=calcPtsForDay(p,dayKey);
        if(pts>bestPts){bestPts=pts;best=[p];}
        else if(pts===bestPts)best.push(p);
      });
      if(bestPts>0)best.forEach(p=>{mvpAcum[p]=(mvpAcum[p]||0)+mvpPts;});
    }
    const endCum={...last.cum};
    Object.keys(mvpAcum).forEach(p=>{endCum[p]=(endCum[p]||0)+mvpAcum[p];});
    days.push({ts:last.ts,ranks:last.ranks,startCum:prevCum||{},endCum});
    prevCum=endCum;
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

// v1.8 (Fase 2 de Batallas) — Generalización de "los partidos de hoy" a
// "los partidos de los próximos N días calendario, arrancando hoy". Con
// days=1 (o sin argumento) el comportamiento es IDÉNTICO al de siempre:
// mismo criterio (hora de inicio local del partido cae en la ventana), la
// única diferencia es que la ventana ahora puede ser de más de un día.
function getMatchIdsInWindow(days){
  const n=Math.max(1,parseInt(days)||1);
  const start=new Date();start.setHours(0,0,0,0); // medianoche local de hoy
  const end=new Date(start);end.setDate(end.getDate()+n); // medianoche local, n días después (exclusivo)
  const inWindow=(ts)=>{
    if(!ts)return false;
    const dt=new Date(ts);
    return dt>=start&&dt<end;
  };
  const groupMids=MIDS.filter(mid=>inWindow(S.matchTimes[mid]));
  const elimMids=[];
  for(let pid=ELIM_MID_MIN;pid<=ELIM_MID_MAX;pid++){if(inWindow(S.elimTimes[pid]))elimMids.push(pid);}
  return{groupMids,elimMids};
}

// v1.9 (Fase 2, ajuste pedido) — Alternativa a getMatchIdsInWindow(): en
// vez de "duración en días calendario", "duración en cantidad de
// partidos". Toma los próximos N partidos (grupos + eliminatoria
// mezclados, sin importar cuántos días calendario abarquen) en orden
// cronológico A PARTIR DE AHORA -- a diferencia de la ventana por días
// (que arranca a medianoche de HOY, así que un partido de esta mañana
// también cuenta), acá "duración" es literal: desde el instante en que
// se arma la batalla, cuenta el próximo partido, el siguiente, etc.
// Partidos que ya arrancaron ANTES de este instante no se cuentan -- no
// tendría sentido que una batalla "de 2 partidos" incluya uno que ya
// estaba en curso o ya terminó cuando se armó.
function getMatchIdsByCount(count){
  const n=Math.max(1,parseInt(count)||1);
  const now=Date.now();
  const todos=[];
  MIDS.forEach(mid=>{const ts=S.matchTimes[mid];if(ts)todos.push({tipo:"g",id:mid,ts});});
  for(let pid=ELIM_MID_MIN;pid<=ELIM_MID_MAX;pid++){const ts=S.elimTimes[pid];if(ts)todos.push({tipo:"e",id:pid,ts});}
  const futuros=todos.filter(m=>m.ts>=now).sort((a,b)=>a.ts-b.ts).slice(0,n);
  const groupMids=futuros.filter(m=>m.tipo==="g").map(m=>m.id);
  const elimMids=futuros.filter(m=>m.tipo==="e").map(m=>m.id);
  return{groupMids,elimMids};
}

// v1.9 — BUG REPORTADO: el marcador de una Batalla no sumaba el bono de
// "clasificado" (+Npts por predecir el equipo que YA de hecho pasó de
// fase, ej. +3 cuando España avanzó de Dieciseisavos) ni Avanzado —
// ambos SÍ cuentan en el Ranking general (calcElimPts()/calcAdv(), vía
// getRank()) pero calcBattlePts() nunca los tocaba: antes era una
// decisión deliberada del brief ("Avanzado y Bonos quedan siempre afuera
// de Batallas"), pero el pedido explícito ahora es que una Batalla sume
// TODO lo que sumen básicos + eliminatoria + avanzado, solo Bonos
// (último lugar/racha/MVP) queda afuera. Fix:
//   - calcClassifiedPtsForRealMatch(pid) para cada elimMid de la ventana
//     (NO toda la fase — solo los partidos puntuales que caen dentro de
//     esta Batalla). Ver su comentario arriba: NO es
//     calcClassifiedPtsForPid() (esa exige el pid oficial exacto, que
//     casi nunca coincide con el slot donde cada participante tiene a
//     ese equipo en SU PROPIO bracket) — es la versión que busca por
//     equipo real ganador en cualquier slot de la ronda.
//   - calcAdv(name) entero (campeón/goleador/etc. no tiene "ventana"
//     propia, es una predicción de todo el torneo — mismo criterio que ya
//     usa calcRumblePts()).
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
  elimMids.forEach(pid=>{pts+=calcElimMatchPts(name,pid)+calcClassifiedPtsForRealMatch(name,pid);});
  pts+=calcAdv(name);
  return pts;
}

// v1.8 — Renombrada de areTodaysMatchesDone: el cuerpo no cambió (nunca
// dependió de "hoy" en sí, solo revisa si CADA mid/pid recibido ya tiene
// marcador no-"live"), pero el nombre anterior quedaba engañoso ahora que
// battle.groupMids/elimMids pueden abarcar varios días (Fase 2).
function areBattleMatchesDone(groupMids,elimMids){
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
  // v1.9 — updateElimBtns() (app-bracket-compute.js) ya no deshabilita
  // los botones de ESPN Live/Simular (ver nota ahí) -- se sigue llamando
  // acá solo como reset, por si alguno hubiera quedado deshabilitado de
  // una carga vieja de antes de ese fix. Guardado con typeof porque
  // scoring.js carga ANTES que app-bracket-compute.js (donde vive
  // updateElimBtns) — para cuando esto se INVOQUE (nunca al cargar el
  // script) ya está definida.
  if(typeof updateElimBtns==="function")updateElimBtns();

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
  if(any){save();renderRank();renderBonosPanel();if(typeof updateElimBtns==="function")updateElimBtns();}
  return any;
}

function reopenPhase(key){
  if(!confirm(`¿Reabrir fase "${key}"? Se borrarán los bonos adjudicados para esa fase.`))return;
  if(S.bonos.closed)delete S.bonos.closed[key];
  if(S.bonos.lastPlace)delete S.bonos.lastPlace[key];
  if(S.bonos.classified)delete S.bonos.classified[key];
  if(S.bonos.llaves)delete S.bonos.llaves[key];
  save();renderRank();renderBonosPanel();
  if(typeof updateElimBtns==="function")updateElimBtns();
  toast(`✓ Fase ${key} reabierta`);
}

function runBonosCheck(){
  const awarded=checkAndAwardBonos();
  if(!awarded)toast("Sin fases nuevas completadas");
  renderBonosPanel();
  if(typeof updateElimBtns==="function")updateElimBtns();
}

function clearAllBonos(){
  if(!confirm("¿Limpiar TODOS los bonos adjudicados? Esto reabre todas las fases."))return;
  S.bonos={lastPlace:{},classified:{},llaves:{},closed:{}};
  save();renderRank();renderBonosPanel();
  if(typeof updateElimBtns==="function")updateElimBtns();
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

  // Procesar todos los partidos de grupos
  for (let mid = 1; mid <= TORNEO_ACTUAL.groupMatches.length; mid++) {
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
  for (let mid = 1; mid <= TORNEO_ACTUAL.groupMatches.length; mid++) {
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
  for (let mid = 1; mid <= TORNEO_ACTUAL.groupMatches.length; mid++) {
    if (!S.scores[mid] && !S.scores[String(mid)]) return false;
  }
  return true;
}

// Sprint 7 (hoja de ruta comercial, Fase 2 "constructor de torneo" --
// bloqueo de reglas, 2026-07-23): las Reglas de puntaje (Configuración
// del torneo → Reglas) se pueden editar en vivo en cualquier momento,
// incluso a mitad de torneo -- nada lo impedía. Ahora, en cuanto existe
// AL MENOS un resultado real cargado (grupos o eliminatoria), se
// consideran "publicadas" y el panel las muestra de solo lectura (ver
// buildReglasHtml() en app-admin-tools.js) -- sin depender de que el
// admin se acuerde de apretar un botón de "publicar": el primer
// resultado real ES la publicación.
function isReglasBloqueadas(){
  return Object.keys(S.scores||{}).length>0 || Object.keys(S.elimScores||{}).length>0;
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

  const predWinner=predictedWinnerFromPred(pred,predTeams);
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