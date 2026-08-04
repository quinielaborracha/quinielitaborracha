/* ════════════════════════════════════════════════════════════
   torneo-resolver.js
   ════════════════════════════════════════════════════════════
   Sprint 9 (hoja de ruta comercial, Fase 3 -- selector de plantilla en
   runtime). Hasta acá, "elegir plantilla" era un paso de setup manual
   (Sprint 5/6 de este mismo roadmap): index.html cargaba UN SOLO
   torneo-<nombre>.js, y ese archivo declaraba TORNEO_ACTUAL directo --
   nunca había más de uno para elegir en la misma carga de página.

   Ahora index.html carga TODOS los torneo-<nombre>.js disponibles (cada
   uno se registra en TORNEOS_DISPONIBLES, ver el final de esos
   archivos) y este resolver, cargado después de todos ellos, decide
   cuál es el TORNEO_ACTUAL real para esta sesión. Tiene que resolver
   de forma SÍNCRONA (nada de await/getDoc acá): partidos-grupos.js lee
   TORNEO_ACTUAL.groupMatches en una asignación de nivel superior, que
   se ejecuta al parsear ESE archivo -- no hay forma de posponerlo a
   después de una consulta async a Firestore sin romper esa asignación
   (Sprints 3b/3c). Por eso la fuente de verdad acá es, en orden:

     1) ?torneo= en la URL de esta carga (más específico, gana siempre).
     2) localStorage.qb_torneo_activo (lo último elegido en este
        dispositivo/navegador).
     3) el id que ya haya quedado en TORNEO_ACTUAL por el simple orden
        de carga de los <script> anteriores (hoy, torneo-mundial2026.js
        siempre carga primero) -- default de siempre si no hay nada más.

   Si (1) trae un id válido, se persiste a (2) para que el próximo load
   SIN el parámetro en la URL (ej. alguien reabre una pestaña vieja)
   siga en el mismo torneo -- ver la limitación aceptada más abajo.

   LIMITACIÓN ACEPTADA, no bug: un dispositivo nuevo, sin ?torneo= en la
   URL ni caché de localStorage, siempre cae en el default de arriba
   (torneo-mundial2026.js, que siempre carga primero). Recién se
   corrige en el SIGUIENTE load, después de que el boot real lea
   registro/meta.configGlobal.torneoId (Sprint 10) y lo cachee acá.
   Aceptable porque quien de verdad navega entre plantillas es el admin,
   con ?torneo= explícito en la URL que él mismo genera (Sprint 12), no
   un participante saltando entre torneos por su cuenta.
   ════════════════════════════════════════════════════════════ */

(function(){
  const disponibles = window.TORNEOS_DISPONIBLES || {};

  const porUrl = new URLSearchParams(window.location.search).get('torneo');
  if (porUrl && disponibles[porUrl]) {
    TORNEO_ACTUAL = disponibles[porUrl];
    try { localStorage.setItem('qb_torneo_activo', porUrl); } catch(e){}
    return;
  }

  let porCache = null;
  try { porCache = localStorage.getItem('qb_torneo_activo'); } catch(e){}
  if (porCache && disponibles[porCache]) {
    TORNEO_ACTUAL = disponibles[porCache];
    return;
  }

  // Sin ?torneo= válido ni caché: se deja TORNEO_ACTUAL tal cual quedó
  // (el último torneo-<nombre>.js cargado antes que este resolver) --
  // ese es el default real hoy, sin necesidad de nombrarlo dos veces acá.
})();
