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
     2) DEFAULT_TORNEO_ID ("mundial2026", el torneo real de producción),
        EXPLÍCITO -- nunca "lo que haya quedado cargado último".

   CORRECCIÓN URGENTE (2026-08-04, reemplaza el diseño original de este
   archivo -- BUG REAL encontrado en producción, no un ajuste cosmético):
   la versión original de este archivo, sin `?torneo=`, dejaba
   TORNEO_ACTUAL "tal cual había quedado por el simple orden de carga de
   los <script> anteriores" -- eso funcionaba por casualidad mientras
   torneo-mundial2026.js fuera el ÚLTIMO torneo-<nombre>.js en cargar,
   pero dejó de ser cierto apenas se agregó torneo-copaamerica.js
   (Sprint 9) y después torneo-euro.js (Sprint 11) DESPUÉS en el orden
   de <script> de index.html: el "default sin pistas" pasó a ser
   silenciosamente el ÚLTIMO template ficticio agregado, aplicado sobre
   los datos REALES del tenant de producción, para CUALQUIER visitante
   que entrara sin `?torneo=` en el link (es decir, todos los
   participantes reales). Ahora el default es un id EXPLÍCITO
   (`DEFAULT_TORNEO_ID`), inmune a en qué orden se carguen los demás
   templates.

   Esta misma corrección también sacó el cacheo en `localStorage`
   (`qb_torneo_activo`) que tenía la versión anterior: persistir
   `?torneo=` entre visitas sonaba conveniente, pero en la práctica
   "secuestraba" el navegador del admin -- visitar UNA VEZ un link de
   prueba con `?tenant=`/`?torneo=` de otro tenant dejaba ese mismo
   navegador entrando silenciosamente a la plantilla equivocada incluso
   al volver a la URL real sin ningún parámetro (mismo problema, mismo
   día, que motivó sacar el cacheo de TENANT_ID en index.html -- ver la
   nota ahí). Sin persistencia, el comportamiento es 100% predecible:
   sin `?torneo=` en el link, SIEMPRE es `DEFAULT_TORNEO_ID`, sin
   excepciones ni memoria de visitas anteriores en ese dispositivo. El
   único costo real: el admin tiene que repetir `?torneo=` cada vez que
   quiera esa plantilla no-default (o guardarse el link completo) -- un
   precio bajo comparado con el riesgo de romper el sitio real.
   ════════════════════════════════════════════════════════════ */

(function(){
  const DEFAULT_TORNEO_ID = 'mundial2026';
  const disponibles = window.TORNEOS_DISPONIBLES || {};

  const porUrl = new URLSearchParams(window.location.search).get('torneo');
  if (porUrl && disponibles[porUrl]) {
    TORNEO_ACTUAL = disponibles[porUrl];
    return;
  }

  TORNEO_ACTUAL = disponibles[DEFAULT_TORNEO_ID] || TORNEO_ACTUAL;
})();
