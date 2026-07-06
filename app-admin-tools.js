/* ════════════════════════════════════════════════════════════
   app-admin-tools.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Edición de datos de un participante (admin) y backup/restore del estado completo en JSON.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): EDIT PARTICIPANT; BACKUP / RESTORE JSON

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

// EDIT PARTICIPANT
// ══════════════════════════════════════════════════════════════
function openEditParticipant(name){
  const m=PM[name]||{};
  document.getElementById("ep-modal").style.display="flex";
  document.getElementById("ep-name").value=name;
  document.getElementById("ep-country").value=m.country||"";
  document.getElementById("ep-city").value=m.city||"";
  document.getElementById("ep-orig-name").value=name;
}

// v6.2 — Antes editaba directamente PM/PL/MD/ELIM_SPEC (las constantes
// hardcodeadas). Ahora el participante real vive en DB.participants
// (compartido con Mi Quiniela); editarlo acá es lo mismo que editarlo
// desde el panel Admin de Mi Quiniela, solo que más rápido desde el
// Ranking. saveData(DB) ya dispara rebuildDynamicData() solo (vía el
// listener de participantes.js) — no hace falta tocar PM/PL/MD a mano.
function saveEditParticipant(){
  const origName=document.getElementById("ep-orig-name").value;
  const newName=document.getElementById("ep-name").value.trim();
  const country=document.getElementById("ep-country").value.trim();
  const city=document.getElementById("ep-city").value.trim();
  if(!newName){toast("El nombre no puede estar vacío",true);return;}
  const person=(DB.participants||[]).find(p=>p.name===origName);
  if(!person){toast("No se encontró ese participante en Mi Quiniela.",true);return;}
  person.country=country;
  person.city=city;
  if(newName!==origName){
    person.name=newName;
    // S.hiddenPL y S.adv siguen viviendo en quiniela/estado, por nombre
    // (no por id) — se actualizan igual que siempre.
    if(S.hiddenPL instanceof Set&&S.hiddenPL.has(origName)){
      S.hiddenPL.delete(origName);S.hiddenPL.add(newName);
    }
    if(S.adv[origName]){S.adv[newName]=S.adv[origName];delete S.adv[origName];}
  }
  person.fechaActualizacion=Date.now();
  saveData(DB); // registro/estado
  rebuildDynamicData();
  save();       // quiniela/estado — por si cambió S.hiddenPL/S.adv
  closeEditParticipant();
  renderRank();
  toast(`✓ Participante actualizado`);
}

function closeEditParticipant(){
  document.getElementById("ep-modal").style.display="none";
}

// ══════════════════════════════════════════════════════════════
// BACKUP / RESTORE JSON — v1.5.1: backup INTEGRAL
// ══════════════════════════════════════════════════════════════
// Antes (hasta v1.5) esto solo respaldaba quiniela/estado (resultados,
// bonos, batallas, snapshots...) -- restaurar ese backup en un sitio
// nuevo perdía TODOS los participantes, sus predicciones, la papelera y
// la configuración del torneo (fases activas, reglas de puntaje). Ahora
// el JSON trae las dos mitades del sistema:
//   - "quiniela": el mismo payload de siempre (buildStatePayload(),
//     app-live-sync.js) -- única fuente de verdad, ya no se duplican los
//     campos a mano acá (eso fue justo el bug que hacía que hiddenPL
//     nunca se exportara aunque el import sí sabía leerlo).
//   - "registro": participantes + predicciones + papelera + nextSeq +
//     configGlobal (todo lo que vive en participantes.js/registro.js).
// Deliberadamente NO se incluye:
//   - quiniela/estado-test (el espejo de "🧪 Modo Prueba"): es
//     efímero, no es parte de la quiniela real.
//   - registro/admin2fa (secreto TOTP + navegadores de confianza del
//     admin): es un secreto equivalente a una contraseña. Meterlo en un
//     JSON descargable (que puede terminar copiado, compartido por
//     correo, etc.) sería un riesgo real de seguridad para un beneficio
//     chico -- si hace falta reconfigurar el 2FA, ya existe el flujo
//     normal para eso. Restaurar un backup NUNCA toca este documento,
//     así que el admin nunca queda bloqueado de su propia sesión por
//     restaurar un backup viejo.
function buildFullBackupPayload(){
  return {
    tipo:"quinielaborracha_backup_integral",
    version:"1.5.1",
    exportedAt:new Date().toISOString(),
    quiniela:buildStatePayload(),
    registro:{
      participants:DB.participants,
      predictions:DB.predictions,
      papelera:DB.papelera,
      nextSeq:DB.nextSeq,
      configGlobal:DB.configGlobal
    }
  };
}

function descargarJSON(obj,nombreArchivo){
  const json=JSON.stringify(obj,null,2);
  const blob=new Blob([json],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=nombreArchivo;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},500);
}

function exportBackupJSON(){
  const payload=buildFullBackupPayload();
  const date=new Date().toISOString().slice(0,10);
  descargarJSON(payload,`quiniela-backup-integral-${date}.json`);
  const n=(DB.participants||[]).length;
  const el=document.getElementById("backup-status");
  if(el)el.innerHTML=`<span style="color:#4dde8c">✓ Backup integral exportado: ${n} participante(s) + resultados/bonos/batallas + configuración del torneo</span>`;
  toast("✓ Backup integral exportado");
}

function importBackupJSON(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const p=JSON.parse(e.target.result);
      const esIntegral=!!(p&&p.quiniela&&p.registro);
      const esFormatoViejo=!esIntegral&&!!(p&&(p.scores||p.elimScores));
      if(!esIntegral&&!esFormatoViejo){
        throw new Error("Archivo no válido — no parece un backup de la quiniela");
      }

      const fb=window.__fb;
      if(esIntegral&&(!fb||!fb.PARTICIPANTS_COL||!fb.PRIVADO_COL||!fb.REGISTRO_META_DOC)){
        toast("Firebase todavía no está listo en esta pestaña (o quedó una versión vieja en caché). Recargá la página (Ctrl+Shift+R) y volvé a intentar.",true);
        return;
      }

      const fecha=p.exportedAt?new Date(p.exportedAt).toLocaleString("es"):"archivo";
      const nParticipantes=esIntegral?(p.registro.participants||[]).length:null;
      const msg=esIntegral
        ?`Este es un BACKUP INTEGRAL del ${fecha}: va a REEMPLAZAR TODO (${nParticipantes} participante(s) con sus predicciones, papelera, configuración del torneo Y resultados/bonos/batallas) por lo que hay en el archivo. Cualquier participante o cambio que exista hoy y NO esté en el archivo se BORRA. Antes de aplicar nada se descarga automáticamente un backup del estado actual, por si hay que volver atrás. ¿Continuar?`
        :`¿Importar backup del ${fecha}? Es un archivo del formato anterior (solo resultados/bonos/batallas, sin participantes) — esto reemplaza esos datos actuales, sin tocar participantes. ¿Continuar?`;
      if(!confirm(msg))return;

      // Backup de seguridad automático del estado ACTUAL antes de tocar
      // nada -- mismo cuidado que ya usa importarInfoParticipantes()
      // (registro.js) para cualquier operación que reescribe datos de
      // varios participantes a la vez.
      descargarJSON(buildFullBackupPayload(),`backup_antes_de_restaurar_${Date.now()}.json`);

      const quinielaData=esIntegral?p.quiniela:p; // formato viejo: los campos de S viven sueltos en la raíz
      applyStatePayload(quinielaData);
      save();

      const el=document.getElementById("backup-status");
      const terminarOk=(detalle)=>{
        renderRank();renderSnapshotPanel();updateGenerarBtn();updateElimBtns();
        if(el)el.innerHTML=`<span style="color:#4dde8c">✓ Backup importado correctamente${detalle}</span>`;
        toast("✓ Backup importado");
      };

      if(esIntegral){
        rgRestoreFullBackup(p.registro)
          .then(()=> terminarOk(` · ${nParticipantes} participante(s) restaurado(s)`))
          .catch(err=>{
            console.error("Error al restaurar participantes del backup:",err);
            if(el)el.innerHTML=`<span style="color:#ff8080">⚠️ Los resultados se restauraron, pero hubo un error al restaurar participantes: ${err.message}</span>`;
            toast("⚠️ Error al restaurar participantes: "+err.message,true);
          });
      }else{
        terminarOk("");
      }
    }catch(err){
      const el=document.getElementById("backup-status");
      if(el)el.innerHTML=`<span style="color:#ff8080">⚠️ Error: ${err.message}</span>`;
      toast("Error importando backup: "+err.message,true);
    }
  };
  reader.readAsText(file);
  input.value=""; // reset so same file can be re-imported
}

// ── Clear reality form ──
function clearReality(){
  if(!confirm("¿Limpiar todos los resultados reales del torneo (campeón, goleador, etc.)?"))return;
  S.reality={champ:"",runner:"",third:"",topScorer:"",topScorerGoals:0,topCountry:"",topCountryGoals:0,mostConceded:""};
  save();renderAdv();renderRank();
  toast("✓ Resultados reales limpiados");
}

// ══════════════════════════════════════════════════════════════
// CONFIGURACIÓN DEL TORNEO — v1.2, Constructor de Torneos (fase 1)
// ══════════════════════════════════════════════════════════════
// Checklist de "Fases activas": cuáles fases usa este torneo. Lee/escribe
// DB.configGlobal.fasesActivas (mismo mecanismo ya usado por los demás
// switches del panel Admin — persistencia local + Firestore vía
// saveData(DB), ya protegido en firestore.rules para que solo el admin
// pueda escribirlo). isFaseActiva()/getActivePhases()/etc. (scoring.js)
// son la única fuente de verdad que lee este dato — esta pantalla solo
// lo edita, no duplica ninguna lógica de cuáles fases existen.
function renderTorneoConfig(){
  const c=document.getElementById("torneo-content");
  if(!c)return;
  if(!isAdmin()){
    c.innerHTML=`<div class="card center" style="padding:2rem 1rem">
      <div style="font-size:32px;margin-bottom:.5rem">🔒</div>
      <div class="card-title" style="justify-content:center">Acceso restringido</div>
      <div class="muted" style="margin-bottom:1rem">Esta sección es solo para el administrador de la quiniela.</div>
    </div>`;
    return;
  }
  const fa=DB.configGlobal.fasesActivas||{};
  const row=(key,label)=>{
    const on=fa[key]!==false;
    return`<div class="switch-row">
      <div>
        <div style="font-weight:700;color:var(--qb-text)">${label}</div>
      </div>
      <div class="switch ${on?'on':''}" role="switch" aria-checked="${on}" tabindex="0" onclick="toggleFaseActiva('${key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleFaseActiva('${key}');}"><div class="switch-knob"></div></div>
    </div>`;
  };
  const R=DB.configGlobal.reglas;
  c.innerHTML=`
    <div class="card">
      <div class="card-title">⚙️ Fases activas</div>
      <div class="muted" style="font-size:11.5px;margin-bottom:.75rem">
        Elige qué fases usa este torneo. Una fase desactivada deja de existir para las predicciones, calendario, llaves y rankings, y no otorga puntos. Útil para arrancar una quiniela directamente desde, por ejemplo, Octavos de Final, reutilizando todo el motor existente. <b>Excepción (v3.5.1):</b> 🏆 Torneo real (dentro de Estadísticas) siempre muestra los resultados reales ya cargados para esa fase, sin importar este switch — apagar una fase acá solo afecta el puntaje, nunca oculta lo que de verdad pasó en el Mundial.
      </div>
      ${row('grupos','⚽ Fase de grupos')}
      ${row('r16','🔥 Dieciseisavos')}
      ${row('r8','🏆 Octavos')}
      ${row('qf','⭐ Cuartos')}
      ${row('sf','🥇 Semifinal')}
      ${row('third','🥉 Tercer Lugar')}
      ${row('final','🏆 Final')}
      <div class="ib" style="margin-top:.75rem">
        💡 Si la primera fase de eliminatoria activa NO es Dieciseisavos (ej. arrancaste en Octavos), cargá sus equipos reales desde <strong>📅 Fixture → 🏆 Eliminatoria → ✏️ Editar llaves</strong> (o con <strong>⚡ ESPN Live</strong>) antes de que los participantes empiecen a predecir esa fase.
      </div>
    </div>

    ${buildReglasHtml(R)}
  `;
}

// ══════════════════════════════════════════════════════════════
// REGLAS DE PUNTAJE — v1.2, Constructor de Torneos (fase 2)
// ══════════════════════════════════════════════════════════════
// Lee/escribe DB.configGlobal.reglas. Cada input/switch usa un "path" en
// notación de puntos (ej. "elim.ganador", "fases.qf.classifiedPts",
// "multiplicador.fases.final", "racha.hitos.0.pts") — updateReglaValor()/
// toggleReglaSwitch() son las DOS únicas funciones que escriben sobre
// reglas, navegando ese path; así no hace falta un handler distinto por
// cada campo, y es imposible que un campo se guarde con una regla de
// escritura distinta a otro.
// v1.2 (fase 2.1) — clase "reglas-num" (CSS en styles.css) le quita las
// flechitas ↑↓ del input number, y fuerza color/fondo explícitos en vez
// de heredarlos — así nunca dependen de en qué contenedor termine cada
// número, evitando el problema de contraste que reportaste en "Puntos
// por fase".
function reglaNumInput(path,value,width,disabled){
  return `<input type="number" class="reglas-num" min="0" step="1" value="${value}" data-reglas-path="${path}" onchange="updateReglaValor(this)" style="width:${width||50}px" ${disabled?"disabled":""}>`;
}
function reglaSwitchRow(path,on,label,desc){
  return `<div class="switch-row">
    <div>
      <div style="font-weight:700;color:var(--qb-text)">${label}</div>
      ${desc?`<div class="muted" style="font-size:11px;margin-top:2px">${desc}</div>`:""}
    </div>
    <div class="switch ${on?'on':''}" role="switch" aria-checked="${on}" tabindex="0" onclick="toggleReglaSwitch('${path}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleReglaSwitch('${path}');}"><div class="switch-knob"></div></div>
  </div>`;
}
// Switch chico (sin descripción aparte), para usar DENTRO de una fila
// existente (ej. el switch de "puntos activos" de cada fase).
function reglaSwitchMini(path,on){
  return `<div class="switch ${on?'on':''}" role="switch" aria-checked="${on}" tabindex="0" onclick="toggleReglaSwitch('${path}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleReglaSwitch('${path}');}" style="flex-shrink:0"><div class="switch-knob"></div></div>`;
}
function buildReglasHtml(R){
  const activeAll=getActivePhases();
  const elimActive=activeAll.filter(p=>p.elimPhase);
  const gOn=R.grupos.activo!==false;
  const eOn=R.elim.activo!==false;

  // v1.2 (fase 2.1) — antes esto era una <table> sin clase, heredando
  // estilos de forma poco confiable (eso era el problema de contraste).
  // Ahora cada fase es su propia fila explícita (.reglas-fase-row, CSS en
  // styles.css), con color de texto fijo y un switch propio de "puntos
  // activos en esta fase" (independiente de si la fase EXISTE — eso lo
  // decide "Fases activas" arriba; esto solo decide si puntúa).
  const faseRows=activeAll.map(ph=>{
    const f=R.fases[ph.key]||{};
    const isGrupos=ph.key==='grupos';
    // "grupos" no tiene switch propio acá: lo gobierna el switch de
    // "Fase de grupos" de la tarjeta de arriba (Puntos base).
    const fOn=isGrupos?gOn:(f.activo!==false);
    const dim=!fOn;
    const classCol=ph.elimPhase?reglaNumInput(`fases.${ph.key}.classifiedPts`,f.classifiedPts??0,50,dim):'<span class="muted">—</span>';
    const llaveCol=ph.elimPhase?reglaNumInput(`fases.${ph.key}.llavePts`,f.llavePts??0,50,dim):'<span class="muted">—</span>';
    const lastCol=reglaNumInput(`fases.${ph.key}.lastPts`,f.lastPts??0,50,dim);
    const switchHtml=isGrupos?'':reglaSwitchMini(`fases.${ph.key}.activo`,fOn);
    return `<div class="reglas-fase-row" style="${dim?'opacity:.5':''}">
      <div class="reglas-fase-label">
        <span>${ph.label}</span>
        ${switchHtml}
      </div>
      <div class="reglas-fase-cols">
        <div class="reglas-fase-col"><span class="reglas-fase-col-lbl">Clasificado</span>${classCol}</div>
        <div class="reglas-fase-col"><span class="reglas-fase-col-lbl">Llave</span>${llaveCol}</div>
        <div class="reglas-fase-col"><span class="reglas-fase-col-lbl">Último lugar</span>${lastCol}</div>
      </div>
    </div>`;
  }).join('');

  const multRows=elimActive.map(ph=>{
    const v=R.multiplicador.fases[ph.key]??1;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--qb-border);color:var(--qb-text)">
      <span>${ph.label}</span>
      <span>× ${reglaNumInput(`multiplicador.fases.${ph.key}`,v,44)}</span>
    </div>`;
  }).join('');

  // v2.7.6 — Preguntas avanzadas (ARULES, app-static-data.js): un switch
  // mini por pregunta, mismo patrón visual que faseRows de arriba (label +
  // switch, sin campos numéricos porque los puntos de ARULES no son
  // editables acá -- solo se puede prender/apagar cada una).
  const arulesRows=ARULES.map(r=>{
    const on=(R.avanzado||{})[r.id]!==false;
    return `<div class="reglas-fase-row" style="${on?'':'opacity:.5'}">
      <div class="reglas-fase-label">
        <span>${r.l} (${r.p} pts)</span>
        ${reglaSwitchMini(`avanzado.${r.id}`,on)}
      </div>
    </div>`;
  }).join('');

  const hitosRows=(R.racha.hitos||[]).map((h,i)=>`
    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--qb-border);color:var(--qb-text)">
      <span>${reglaNumInput(`racha.hitos.${i}.n`,h.n,44)} aciertos seguidos</span>
      <span class="muted">→</span>
      <span>+${reglaNumInput(`racha.hitos.${i}.pts`,h.pts,44)}pts</span>
    </div>`).join('');

  // v1.6 — hitos de la racha de DESACIERTOS, mismo patrón visual que los
  // de aciertos de arriba, pero con su propio path ("rachaDesaciertos.
  // hitos.N.*") -- updateReglaValor()/toggleReglaSwitch() ya navegan
  // cualquier path por notación de puntos, así que no hace falta tocar
  // esas dos funciones para que esto guarde.
  const hitosRowsDesaciertos=(R.rachaDesaciertos.hitos||[]).map((h,i)=>`
    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--qb-border);color:var(--qb-text)">
      <span>${reglaNumInput(`rachaDesaciertos.hitos.${i}.n`,h.n,44)} fallos seguidos</span>
      <span class="muted">→</span>
      <span>+${reglaNumInput(`rachaDesaciertos.hitos.${i}.pts`,h.pts,44)}pts</span>
    </div>`).join('');

  return `
    <div class="card">
      <div class="card-title">🎯 Puntos base</div>
      <div class="muted" style="font-size:11.5px;margin-bottom:.5rem">Lo que vale cada predicción, antes de cualquier multiplicador. Estos son los valores de siempre — cambiar un número acá cambia el puntaje de todos a partir de ahora (no recalcula partidos ya jugados de forma distinta a como ya se jugaron, simplemente la fórmula usa el nuevo valor desde este momento).</div>

      ${reglaSwitchRow('grupos.activo',gOn,'⚽ Puntos de Fase de grupos','Si lo apagas, se puede seguir prediciendo grupos pero no suma puntos (también apaga su bono de último lugar).')}
      <div class="reglas-base-fields" style="${gOn?'':'opacity:.5'}">
        <span>Ganador ${reglaNumInput('grupos.ganador',R.grupos.ganador,50,!gOn)}pts</span>
        <span>Empate ${reglaNumInput('grupos.empate',R.grupos.empate,50,!gOn)}pts</span>
        <span>Marcador exacto +${reglaNumInput('grupos.exacto',R.grupos.exacto,50,!gOn)}pts</span>
      </div>

      <div style="margin:.75rem 0;border-top:1px solid var(--qb-border)"></div>

      ${reglaSwitchRow('elim.activo',eOn,'🏆 Puntos de resultado en Eliminatoria','Ganador/Empate/Marcador exacto de cada partido de eliminatoria. La Llave y el Clasificado de cada fase se manejan abajo, en "Puntos por fase".')}
      <div class="reglas-base-fields" style="${eOn?'':'opacity:.5'}">
        <span>Ganador ${reglaNumInput('elim.ganador',R.elim.ganador,50,!eOn)}pts</span>
        <span>Empate ${reglaNumInput('elim.empate',R.elim.empate,50,!eOn)}pts</span>
        <span>Marcador exacto +${reglaNumInput('elim.exacto',R.elim.exacto,50,!eOn)}pts</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">🎯 Preguntas avanzadas</div>
      <div class="muted" style="font-size:11.5px;margin-bottom:.5rem">Campeón, goleador del torneo, etc. -- puntos fijos (no editables), pero cada una se puede apagar por separado sin tocar las demás. Apagar una la oculta del formulario de cada participante (v2.8.2) y deja de sumar sus puntos.</div>
      ${arulesRows}
    </div>

    <div class="card">
      <div class="card-title">🏅 Puntos por fase</div>
      <div class="muted" style="font-size:11.5px;margin-bottom:.625rem">Clasificado = predijiste un equipo que de verdad avanzó de esa fase. Llave = adivinaste los 2 equipos del cruce. Último lugar = bono de consuelo al cerrar la fase. El switch de cada fase apaga SOLO sus puntos (clasificado+llave+último) — la fase sigue existiendo y se puede seguir prediciendo. Solo se muestran las fases activas.</div>
      ${faseRows}
    </div>

    <div class="card">
      <div class="card-title">⭐⭐⭐⭐⭐ Multiplicador por ronda</div>
      ${reglaSwitchRow('multiplicador.activo',!!R.multiplicador.activo,'Activar multiplicador','Mientras más avanza el torneo, más valen los puntos de Ganador/Empate + Marcador exacto de cada partido de eliminatoria (NO afecta llave/cruce ni clasificado).')}
      ${R.multiplicador.activo?`<div style="margin-top:.5rem">${multRows}</div>`:""}
    </div>

    <div class="card">
      <div class="card-title">⭐⭐⭐⭐⭐ Racha de aciertos</div>
      ${reglaSwitchRow('racha.activo',!!R.racha.activo,'Activar racha','Bono extra al llegar a cada hito de aciertos CONSECUTIVOS (grupos + eliminatoria, en orden cronológico). Si la racha se corta, vuelve a empezar desde 0.')}
      ${R.racha.activo?`<div style="margin-top:.5rem">${hitosRows}</div>`:""}
    </div>

    <div class="card">
      <div class="card-title">😅 Racha de desaciertos</div>
      ${reglaSwitchRow('rachaDesaciertos.activo',!!R.rachaDesaciertos.activo,'Activar racha de desaciertos','Bono de consuelo (con humor) al llegar a cada hito de FALLOS CONSECUTIVOS -- para que fallar duela menos y a nadie se le quiten las ganas de seguir jugando. Hitos independientes de la racha de aciertos. Si acierta uno, la racha de fallos se corta y vuelve a empezar desde 0.')}
      ${R.rachaDesaciertos.activo?`<div style="margin-top:.5rem">${hitosRowsDesaciertos}</div>`:""}
    </div>

    <div class="card">
      <div class="card-title">⭐⭐⭐⭐⭐ MVP de la ronda</div>
      ${reglaSwitchRow('mvp.activo',!!R.mvp.activo,'Activar MVP','El que más puntos acumule en un mismo día de partidos recibe un bono extra. Si varios quedan empatados en el máximo, todos reciben el bono.')}
      ${R.mvp.activo?`<div style="margin-top:.5rem;display:flex;align-items:center;gap:8px">
        <span>Bono por día ganado</span>
        <span>+${reglaNumInput('mvp.pts',R.mvp.pts,44)}pts</span>
      </div>`:""}
    </div>

    <div class="card">
      <div class="card-title">⚔️ Batallas y Royal Rumble</div>
      ${reglaSwitchRow('batallas.activo',!!R.batallas.activo,'Activar bono de victoria','Bono extra para quien GANE una Batalla 1v1 o el Royal Rumble (resetBattle()/resetRumble(), Batallas → 🎁 Bonos). Un empate no otorga este bono a nadie. Cuenta como Bono, igual que último lugar/racha/MVP -- no Eliminatoria ni Avanzado.')}
      ${R.batallas.activo?`<div style="margin-top:.5rem;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="flex:1">🥊 Por ganar una Batalla 1v1</span>
          <span>+${reglaNumInput('batallas.ganadorDuelo',R.batallas.ganadorDuelo,44)}pts</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="flex:1">👑 Por ganar el Royal Rumble</span>
          <span>+${reglaNumInput('batallas.ganadorRumble',R.batallas.ganadorRumble,44)}pts</span>
        </div>
      </div>`:""}
    </div>
  `;
}

function updateReglaValor(el){
  const path=el.dataset.reglasPath.split('.');
  let obj=DB.configGlobal.reglas;
  for(let i=0;i<path.length-1;i++){
    if(obj[path[i]]===undefined||obj[path[i]]===null)obj[path[i]]={};
    obj=obj[path[i]];
  }
  const v=Math.max(0,parseInt(el.value,10)||0);
  obj[path[path.length-1]]=v;
  el.value=v;
  saveData(DB);
  if(typeof renderRank==="function")renderRank();
  if(typeof renderBonosPanel==="function")renderBonosPanel();
  if(typeof renderRules==="function")renderRules();
  toast("✓ Guardado");
}

function toggleReglaSwitch(path){
  const parts=path.split('.');
  let obj=DB.configGlobal.reglas;
  for(let i=0;i<parts.length-1;i++){
    if(obj[parts[i]]===undefined||obj[parts[i]]===null)obj[parts[i]]={};
    obj=obj[parts[i]];
  }
  const key=parts[parts.length-1];
  obj[key]=!obj[key];
  saveData(DB);
  renderTorneoConfig();
  if(typeof renderRank==="function")renderRank();
  if(typeof renderBonosPanel==="function")renderBonosPanel();
  if(typeof renderRules==="function")renderRules();
  toast(obj[key]?"✓ Activada":"🔒 Desactivada");
}

function toggleFaseActiva(key){
  if(!DB.configGlobal.fasesActivas)DB.configGlobal.fasesActivas={};
  const cur=DB.configGlobal.fasesActivas[key]!==false;
  DB.configGlobal.fasesActivas[key]=!cur;
  // Si se desactiva la única fase de eliminatoria que tenía equipos
  // cargados a mano para la fase que ahora arranca, no hace falta migrar
  // nada: getManualTeamPids() se recalcula solo en cada render contra la
  // fase activa vigente — S.elimTeams nunca se borra, solo se deja de
  // leer para fases que ya no existen (no rompe nada si se reactivan).
  saveData(DB);
  renderTorneoConfig();
  if(typeof syncTabsWithFasesActivas==="function")syncTabsWithFasesActivas();
  if(typeof renderRank==="function")renderRank();
  if(typeof renderBonosPanel==="function")renderBonosPanel();
  if(typeof renderRules==="function")renderRules();
  if(document.getElementById("t-fix")?.style.display==="block"&&typeof renderElim==="function")renderElim();
  if(document.getElementById("pred-bracket")?.style.display==="block"&&typeof renderBracket==="function")renderBracket();
  toast(`${cur?"🔒 Desactivada":"✓ Activada"}: ${getPhaseByKey(key)?.label||key}`);
}

// ══════════════════════════════════════════════════════════════
