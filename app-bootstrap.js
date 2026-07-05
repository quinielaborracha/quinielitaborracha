/* ════════════════════════════════════════════════════════════
   app-bootstrap.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Toggle de tema claro/oscuro, atajo de teclado Escape, y el bootstrap final de la app: fija el logo, pinta el header, hace el primer render desde caché local (load()+renderRank()+...), aplica la pestaña inicial configurada por el admin, registra el listener de cambios de participantes, y arranca Firebase Auth + sincronización en vivo. DEBE SER EL ÚLTIMO de los archivos derivados de app.js en cargar: llama funciones definidas en todos los anteriores.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): THEME TOGGLE; (bootstrap final, sin encabezado propio en el app.js original)

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

// THEME TOGGLE
// ══════════════════════════════════════════════════════════════
function toggleTheme(){
  const root=document.documentElement;
  const isLight=root.classList.toggle("light");
  const btn=document.getElementById("theme-btn");
  if(btn)btn.textContent=isLight?"🌙 Dark":"☀️ Light";
  try{localStorage.setItem("wb26-theme",isLight?"light":"dark");}catch(e){}
}
function initTheme(){
  try{
    const saved=localStorage.getItem("wb26-theme");
    if(saved==="light"){
      document.documentElement.classList.add("light");
      const btn=document.getElementById("theme-btn");
      if(btn)btn.textContent="🌙 Dark";
    }
  }catch(e){}
}

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    closeExp();closeConflict();
    document.getElementById("login-modal").style.display="none";
    closeEditParticipant();
  }
});
initTheme();
// Logo: misma imagen en ambos modos (light y dark)
// v6.6 — Antes usaba LOGO_SRC (el escudo con espadas). Ahora usa BORRACHI_SRC
// (la mascota) según lo pedido para esta entrega.
const logoEl=document.getElementById("logo-img");
if(logoEl)logoEl.src=BORRACHI_SRC;
// Fecha de hoy para el header mobile (ej. "18 JUN 2026 · 27 participantes")
function setHeaderToday(){
  const el=document.getElementById("hdr-today");
  if(!el)return;
  const today=new Date().toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase().replace(/\./g,"");
  el.textContent=`${today} · ${PL.length} participantes`;
}
setHeaderToday();
load();renderRank();renderSnapshotPanel();renderRules();updateGenerarBtn();updateElimBtns();renderBonosPanel();
applyAdminUI();
if(typeof syncTabsWithFasesActivas==="function")syncTabsWithFasesActivas(); // v1.2

// v6.6 — Switch admin "Usar Mi Quiniela como página inicial". Por defecto
// la app abre en el Ranking (tab "rank", como siempre); si el admin activó
// el flag, abre en "Mi Quiniela" (tab "registro") en su lugar. Se aplica
// como máximo UNA vez (la primera vez que DB.configGlobal esté disponible
// con un valor confiable: al boot con la caché de localStorage, o más tarde
// si esa caché todavía no tenía el valor real y recién llega por Firestore)
// para no "secuestrar" a alguien que ya navegó a otra pestaña, y para que
// prender/apagar el switch en vivo no salte la pestaña de quien ya está
// usando la app.
let _tabInicialAplicado = false;
function aplicarTabInicialSiCorresponde(){
  if(_tabInicialAplicado) return;
  if(!DB || !DB.configGlobal) return;
  if(DB.configGlobal.usarMiQuinielaComoInicio){
    _tabInicialAplicado = true;
    tab("registro");
  }
}
aplicarTabInicialSiCorresponde();

// v6.2 — Cada vez que cambian los participantes/predicciones (alguien se
// registra, edita su quiniela, o se corre la migración de los 27
// antiguos), reconstruimos PL/PM/MD/MIDS y volvemos a pintar todo lo que
// depende de ellos. Mismo patrón reactivo que ya usa Mi Quiniela.
onParticipantesChange(()=>{
  // v3.3 — Modo Mantenimiento: configGlobal.mantenimientoActivo llega acá
  // como cualquier otro cambio remoto de configGlobal (fasesActivas,
  // fechaCierre, etc.) -- re-evaluar el guard en CADA disparo de este
  // hook es lo que hace que activar/desactivar el switch desde el panel
  // Admin bloquee/desbloquee a todos los demás conectados al instante,
  // sin que nadie tenga que refrescar la página.
  if(typeof applyMaintenanceGuard==="function")applyMaintenanceGuard();
  // v3.7 — Aviso a Participantes: mismo motivo que el guard de arriba --
  // si el admin activa el switch o guarda un texto nuevo mientras hay
  // gente conectada, les aparece el popup al instante.
  if(typeof applyAvisoGuard==="function")applyAvisoGuard();
  rebuildDynamicData();
  setHeaderToday();
  renderRank();
  renderSnapshotPanel();
  renderBonosPanel();
  aplicarTabInicialSiCorresponde();
  if(typeof syncTabsWithFasesActivas==="function")syncTabsWithFasesActivas(); // v1.2
  if(typeof renderStatCards==="function")renderStatCards();
  if(document.getElementById("t-pred")?.style.display==="block"){
    if(typeof renderPred==="function")renderPred();
    if(typeof renderBracket==="function")renderBracket();
    if(typeof renderAdv==="function")renderAdv();
  }
  // v1.7 — FIX: el panel de Postulados (Fase 1 de Batallas) solo se
  // pintaba al cambiar A la pestaña Batallas (tab("battles")) o al
  // llegar un cambio de quiniela/estado con esa pestaña ya abierta (ver
  // el otro hook en app-live-sync.js). Pero quierePelear vive en
  // registro_privado -- un documento DISTINTO -- así que si el admin ya
  // tenía Batallas abierta cuando alguien se postuló, nunca se enteraba
  // sin cambiar de pestaña y volver. Mismo patrón que el bloque de #t-pred
  // de arriba: si la pestaña ya está abierta, repintarla también acá.
  if(typeof renderBattlesPanel==="function"&&document.getElementById("t-battles")?.style.display==="block"){
    renderBattlesPanel();
  }
});

// Arrancamos Firebase Auth + sincronización en vivo en cuanto el módulo esté listo.
// Si ya cargó antes de llegar aquí (window.__fb ya existe), conectamos de inmediato.
if(window.__fb){
  wireFirebaseAuth();
}else{
  window.addEventListener("firebase-ready",wireFirebaseAuth,{once:true});
}

