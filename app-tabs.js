/* ════════════════════════════════════════════════════════════
   app-tabs.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Navegación entre pestañas del menú principal.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): TABS

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

// TABS
// ══════════════════════════════════════════════════════════════
function tab(id){
  // Block non-admin access to admin tabs
  const adminTabs=["fix","pred","admin"];
  if(adminTabs.includes(id)&&!isAdmin()){
    toast("🔒 Acceso restringido — doble clic en el logo para entrar como admin",true);
    return;
  }
  const ALL_TABS=["rank","mm","battles","fix","pred","stats","rules","registro","admin"];
  ALL_TABS.forEach(x=>{
    document.getElementById("t-"+x).style.display=x===id?"block":"none";
  });
  document.querySelectorAll(".tab").forEach((el,i)=>{
    el.classList.toggle("on",ALL_TABS[i]===id);
  });
  if(id==="rank"){renderRank();renderSnapshotPanel();}
  if(id==="mm"){loadMM(true);startMMT();}else stopMMT();
  if(id==="battles"){renderBattlesPanel();}
  if(id==="fix"){fixTab(isFaseActiva("grupos")?"grupos":"elim");} // default al primer sub-tab activo
  if(id==="pred"){predTab(isFaseActiva("grupos")?"grupos":"bracket");} // default al primer sub-tab activo
  if(id==="stats"){renderStatCards();}
  if(id==="rules")renderRules();
  // v6.5 — FIX: este era el ÚNICO tab de los 10 que, al hacer clic, solo
  // cambiaba el display del contenedor (#t-registro) pero nunca volvía a
  // pintar su contenido (#rg-content). Ese contenido se pintaba una sola
  // vez, al cargar la página entera (ver el render() suelto al final de
  // registro.js) — si algo lo dejaba vacío o roto en ese momento (timing
  // de Firebase Auth todavía sin resolver, un DRAFT_PID apuntando a un
  // participante que después cambió, etc.), nunca había una segunda
  // oportunidad de corregirse: el usuario hacía clic en "Mi Quiniela" una
  // y otra vez y siempre veía la misma pantalla en blanco congelada,
  // porque nada volvía a invocar render() de registro.js. Ahora, igual
  // que el resto de los tabs, cada clic fuerza un refresco real.
  if(id==="registro" && typeof render==="function") render();
  // v6.6.1 — Admin ahora es su propia pestaña principal (antes era una
  // sub-pestaña adentro de Mi Quiniela).
  // v1.2 (fase 2) — Admin ahora tiene SUS PROPIAS sub-pestañas (General/
  // Configuración del torneo/Bonos/Integridad — ver adminSubTab()), para
  // no acumular tantos botones en el menú principal. Entrar a "Admin" deja
  // a la persona en la sub-pestaña en la que se quedó la última vez
  // (ADMIN_SUBTAB), no siempre en "General".
  if(id==="admin") adminSubTab(ADMIN_SUBTAB);
  syncTabsWithFasesActivas();
}

// v1.2 (fase 2) — sub-pestaña de Admin en la que está la persona ahora
// mismo (persiste mientras dura la sesión, para que volver a "Admin" no
// siempre reinicie en "General"). "Bonos"/"Integridad"/"Configuración del
// torneo" eran pestañas propias del menú principal hasta acá — ahora
// viven adentro de Admin para reducir botones en la nav principal, sin
// cambiar NINGUNO de sus render()/lógica: cada una sigue siendo
// exactamente la misma función de siempre.
let ADMIN_SUBTAB = 'general';
function adminSubTab(id){
  if(!isAdmin()){toast('🔒 Acceso restringido',true);return;}
  ADMIN_SUBTAB = id;
  ["general","torneo","bonos","integ"].forEach(x=>{
    document.getElementById("admin-"+x).style.display = x===id ? "block" : "none";
    document.getElementById("atab-"+x)?.classList.toggle("on", x===id);
  });
  if(id==="general" && typeof renderAdminTab==="function") renderAdminTab();
  if(id==="torneo" && typeof renderTorneoConfig==="function") renderTorneoConfig();
  if(id==="bonos"){checkAndAwardBonos();renderBonosPanel();}
  if(id==="integ" && typeof renderIntegPanel==="function") renderIntegPanel();
}

// v1.2 — Sincroniza qué botones/sub-tabs se muestran con las fases
// activas del torneo (DB.configGlobal.fasesActivas). Se llama al
// arrancar (app-bootstrap.js), en cada cambio de tab (arriba) y justo
// después de guardar la nueva pestaña "Configuración del torneo" — una
// sola función, para no repetir esta regla en cada lugar que la usa.
// Si una fase está desactivada, "para el usuario simplemente no existe":
// no debe quedar ningún botón de navegación apuntando a ella.
function syncTabsWithFasesActivas(){
  const gruposOn=isFaseActiva("grupos");
  // "⚡ En vivo" muestra SOLO partidos de fase de grupos en tiempo real
  // (parseESPNEvent/ESPN_ABBR_MAP cubren únicamente P1-P72) — si el
  // torneo no usa Grupos, no hay nada que mostrar ahí.
  const mmBtn=document.getElementById("navtab-mm");
  if(mmBtn)mmBtn.style.display=gruposOn?"":"none";
  document.getElementById("ftab-grupos")?.style.setProperty("display",gruposOn?"":"none");
  document.getElementById("ptab-grupos")?.style.setProperty("display",gruposOn?"":"none");
  // Si la pestaña actualmente abierta dejó de existir (ej. apagaron
  // Grupos mientras alguien estaba en "En vivo"), redirigir a Ranking.
  if(!gruposOn && document.getElementById("t-mm")?.style.display==="block"){
    tab("rank");
  }
}

// ── Fixture inner tabs ──
function fixTab(id){if(!isAdmin()){toast('🔒 Acceso restringido',true);return;}
  if(id==="grupos"&&!isFaseActiva("grupos"))id="elim"; // v1.2 — fase de grupos desactivada
  ["grupos","elim"].forEach(x=>{
    document.getElementById("fix-"+x).style.display=x===id?"block":"none";
    document.getElementById("ftab-"+x)?.classList.toggle("on",x===id);
  });
  if(id==="grupos"){renderFix();fetchESPN();}
  if(id==="elim"){renderElim();updateGenerarBtn();updateElimBtns();}
}

// ── Predicciones inner tabs ──
function predTab(id){if(!isAdmin()){toast('🔒 Acceso restringido',true);return;}
  if(id==="grupos"&&!isFaseActiva("grupos"))id="bracket"; // v1.2 — fase de grupos desactivada
  ["grupos","bracket","avanzado"].forEach(x=>{
    document.getElementById("pred-"+x).style.display=x===id?"block":"none";
    document.getElementById("ptab-"+x)?.classList.toggle("on",x===id);
  });
  if(id==="grupos")renderPred();
  if(id==="bracket")renderBracket();
  if(id==="avanzado")renderAdv();
}

function sc(mid){return S.scores[mid]||S.scores[String(mid)]||null;}

// v6.2 — Traduce el "special" dinámico (DB.predictions[pid].special, con
// los nombres de campo de Mi Quiniela) a la forma legacy que ya espera
// calcAdv (champ/runner/third/scorer/...). Antes esto era simplemente
// ELIM_SPEC[name]; ahora hay que buscar al participante por nombre y
// traducir los nombres de campo.
const SPECIAL_FIELD_MAP_V62 = {
  campeon:'champ', subcampeon:'runner', tercer:'third',
  goleador:'scorer', goles_goleador:'scorerGoals',
  pais_goleador:'topCountry', goles_pais:'topCountryGoals',
  pais_goleado:'mostConceded'
};

// ══════════════════════════════════════════════════════════════

// v1.4 — Mejora visual: reproducir el mismo fade-in de .tab-panel (ver
// styles.css) cuando cambia el contenido de "Mi Quiniela". A diferencia
// del resto de los tabs (que hacen display:none↔block sobre divs que ya
// existen, y por eso el navegador redispara la animación solo), registro.js
// arma cada pantalla de Mi Quiniela reemplazando el innerHTML de
// #rg-content entero -- el contenedor nunca sale de display:block, así
// que la animation de .tab-panel no se vuelve a disparar sola. Esto
// observa esos reemplazos de contenido (sin leer ni decidir nada de lo
// que se muestra, es puramente decorativo) y fuerza un reflow para que
// la clase se vuelva a "sentir" nueva cada vez.
(function(){
  const rg = document.getElementById("rg-content");
  if(!rg || typeof MutationObserver !== "function") return;
  const obs = new MutationObserver(()=>{
    rg.classList.remove("tab-panel");
    void rg.offsetWidth; // fuerza reflow para poder re-agregar la clase
    rg.classList.add("tab-panel");
  });
  obs.observe(rg, {childList:true});
})();
