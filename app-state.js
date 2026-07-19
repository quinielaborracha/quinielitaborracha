/* ════════════════════════════════════════════════════════════
   app-state.js
   ════════════════════════════════════════════════════════════
   Declara S, el objeto de estado mutable compartido de toda la app
   (resultados reales, checksums, bonos, batallas, snapshots, etc.) — lo
   que se guarda en quiniela/estado (o quiniela/estado-test en Modo
   Prueba, ver app-live-sync.js) y lo que scoring.js lee/escribe para
   calcular puntos.

   v1.7 — Extraído de app-admin-auth.js: S vivía ahí por accidente
   histórico (así estaba ordenado en el app.js monolítico original, justo
   después del bloque de 2FA), sin ninguna relación real con
   autenticación de admin. scoring.js — el mayor consumidor de S, con
   diferencia — lo necesita disponible ANTES de que se invoque cualquiera
   de sus funciones; como carga justo después de utils.js y antes de
   scoring.js, eso queda garantizado. Cero cambios de lógica: es el mismo
   objeto, con los mismos campos, solo que ahora vive en el archivo que
   le corresponde por responsabilidad en vez de por casualidad de layout.

   Carga como script clásico (no ES module), igual que el resto del
   proyecto: comparte el scope global del navegador con los demás
   archivos — mismo patrón que ya usan participantes.js/partidos-
   grupos.js/utils.js entre sí.
   ════════════════════════════════════════════════════════════ */

let S={scores:{},checksums:{},elimScores:{},elimTeams:{},scorers:[],matchTimes:{},elimTimes:{},
  // v3.9.4 — "Torneo Real" (Estadísticas → Torneo Real) mostraba equipos vía
  // getRealElimTeams()/S.elimTeams -- el MISMO dato que usa el motor de
  // predicciones/puntaje. Si ese dato quedaba mal (ej. una llave generada
  // automáticamente con un resultado de grupos incompleto en ese momento,
  // BUG REPORTADO: Sudáfrica vs Bosnia cuando en la realidad jugó contra
  // Canadá), "Torneo Real" heredaba el mismo error aunque no tuviera nada
  // que ver con predicciones de nadie. realElim es una copia INDEPENDIENTE,
  // que fetchESPNElim() (app-bracket-espn-sync.js) llena siempre con lo
  // último que diga ESPN para ese gameId, sin pasar por ninguna protección
  // de "no pisar una predicción ya hecha" (acá no hay ninguna prediccion
  // que proteger, es un visor de hechos) -- {[pid]:{h,a,hs,as,state,ts}}.
  realElim:{},

  bonos:{lastPlace:{},classified:{},llaves:{},closed:{}},
  tieBreakers:{},  // {pid: "h"|"a"} — quién avanzó en caso de empate
  autoClose:false,
  hiddenPL:{},  // {name: true} — participantes ocultos del ranking  // si true, cierra fases automáticamente al completarse
  snapshots:[],    // [{id, label, ts, positions:{name:pos,...}}]
  // v4.5 — topCountry2/topCountry3 (v4.6): 2do y 3er país "más goleador"
  // para el escenario de empate (doble o triple) en goles entre países --
  // si están cargados, calcAdv() (scoring.js) acepta la predicción del
  // participante contra CUALQUIERA de los que estén llenos, no solo
  // topCountry. Vacío = sin empate en ese puesto, se ignora.
  reality:{champ:"",runner:"",third:"",topScorer:"",topScorerGoals:0,topCountry:"",topCountry2:"",topCountry3:"",topCountryGoals:0,mostConceded:""},adv:{},
  battles:{},  // {1:{p1,p2,groupMids,elimMids,startedAt,closed}, 2:{...}} — duelos diarios v5.0
  battleHistory:[],  // [{name,p1,p2,pts1,pts2,winner,date}] — historial de duelos cerrados, v5.4
  // v3.4 — Historial de cambios de resultados (Admin → 🔒 Integridad),
  // solo para consulta del propio admin. [{ts,fase,id,label,before,after,live}],
  // más nuevo primero, tope de entradas en _clAppendChangeLogEntries()
  // (app-live-sync.js) para no crecer sin límite dentro de este mismo doc.
  changeLog:[],
  // v3.6 — Historial de comparaciones contra un respaldo offline de
  // predicciones (Admin → 🔒 Integridad, ver compararRespaldoOffline() en
  // app-integridad.js). Solo guarda un RESUMEN de cada corrida
  // ([{ts,archivo,totalComparados,numConCambios,numFaltantes,numNuevos,
  // afectados:[{codigo,nombre,numCambios}]}], más nuevo primero) -- el
  // detalle campo por campo de qué cambió se muestra en pantalla en el
  // momento pero no se persiste, para no hacer crecer este documento con
  // el contenido completo de las predicciones en cada corrida manual.
  integrityChecks:[],
  // v4.2 — Hall de la fama (Estadísticas → 👑 Hall de la fama): premios
  // de ediciones anteriores del torneo, cargados a mano por el admin. Un
  // elemento por AÑO/edición (v4.4.1): [{id,year,addedAt, champ?,runner?,
  // third?,ambulance?,cinderella?}] — cada una de esas 5 claves opcionales
  // es {name,photo} y solo existe si esa categoría (ver HOF_CATEGORIES,
  // app-estadisticas.js) ya se cargó para ese año. `photo` es un dataURL
  // JPEG ya comprimido en el cliente (ver hofCompressPhoto(),
  // app-estadisticas.js), no una referencia a Storage (el proyecto no usa
  // Firebase Storage). A propósito NO se resetea en ningún flujo de "nuevo
  // torneo"/clearReality(): es un registro histórico permanente, no algo
  // propio de la edición en curso.
  hallOfFame:[]
};
