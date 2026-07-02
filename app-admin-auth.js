/* ════════════════════════════════════════════════════════════
   app-admin-auth.js — extraído de app.js (Sprint 1, división en módulos)
   ════════════════════════════════════════════════════════════
   Autenticación de admin (Firebase Auth email/password) + 2FA (TOTP + dispositivo de confianza).

   v1.7 — Antes también declaraba el objeto de estado compartido S y unas
   variables de UI de ESPN (mmT/mmS, colas de conflicto), que quedaron
   físicamente acá solo porque así estaban ordenadas en el app.js
   original, justo después del bloque de 2FA — sin ninguna relación con
   autenticación. Se movieron a donde corresponde: S a app-state.js
   (carga antes que scoring.js, su mayor consumidor), mmT/mmS y la cola
   de conflictos de grupos a app-bracket-espn-live.js, y la cola de
   conflictos de llaves de eliminatoria a app-bracket-espn-sync.js (los
   únicos archivos que las leen o escriben). Este archivo ahora es
   responsabilidad única: login + 2FA del admin.

   Secciones originales incluidas (encabezados tal cual estaban en
   app.js): ADMIN AUTH; ADMIN 2FA

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

// ADMIN AUTH — Firebase Auth (email/password) v5.5.5
// ══════════════════════════════════════════════════════════════
// v1.5.4 — Fase 1 de rendimiento: estas 3 constantes ANTES contenían las
// imágenes incrustadas como texto Base64 (866 KB en total — este archivo
// completo pesaba 868 KB, casi todo imagen, no lógica de auth). Ahora son
// rutas a archivos .webp reales (junto al resto de assets del proyecto:
// favicon.png, icon-*.png). Se eligió .webp sobre .png porque el ahorro
// es grande y gratis en este caso puntual: borrachi.png (mascota, la más
// pesada de las 3) pasa de 543 KB a 93 KB, logo.png de 48 a 10 KB,
// logo-simple.png de 43 a 18 KB — sin pérdida visible de calidad (se
// generó con calidad 90). WebP tiene soporte universal en navegadores
// modernos (incluido Safari/iOS desde 2020) — si algún día hiciera falta
// soportar un navegador realmente viejo sin WebP, los .png originales
// quedan disponibles como master para regenerar u ofrecer como fallback.
//
// Efecto total: (1) este archivo pasa de 868 KB a ~20 KB de JS real;
// (2) las imágenes ahora se benefician del cache HTTP de imágenes del
// navegador (antes, como texto dentro de un .js versionado con ?v=, se
// re-descargaban completas cada vez que cambiaba CUALQUIER cosa en este
// archivo, aunque las imágenes en sí no hubieran cambiado). El resto del
// código que usa estas constantes (ej. `logoEl.src = BORRACHI_SRC` en
// app-bootstrap.js, o `<img src="${BORRACHI_SRC}">` en
// app-estadisticas.js) no necesitó tocarse: siguen siendo strings
// asignables a un atributo src, antes con forma
// "data:image/png;base64,..." y ahora con forma "archivo.webp?v=1".
const LOGO_SRC="logo.webp?v=1";
const BORRACHI_SRC="borrachi.webp?v=1";
const LOGO_SIMPLE_SRC="logo-simple.webp?v=1";

// ── Lockout cliente — fricción de UX, NO es seguridad real ─────
// IMPORTANTE: este contador vive en localStorage del navegador. Cualquiera
// puede evadirlo en 2 segundos abriendo una pestaña de incógnito o
// ejecutando localStorage.clear() en la consola. Su único propósito real
// es frenar a un usuario LEGÍTIMO que se equivoca de contraseña varias
// veces seguidas (evita que golpee "Entrar" 20 veces sin pensar).
// La defensa real e inevadible contra fuerza bruta es Firebase Auth del
// lado del servidor: ver el manejo de err.code "auth/too-many-requests"
// en submitLogin(). Ese rate-limit lo aplica Google en el backend y no
// depende de nada que el cliente pueda manipular.
// Si en algún momento se necesita un lockout que SÍ sea inevadible, hace
// falta moverlo a un Cloud Function (requiere plan Blaze, con tarjeta
// vinculada aunque el costo real sea $0 para este volumen de uso).
const LOCK_KEY="wb26_admin_lock";

function getLockout(){
  try{const l=JSON.parse(localStorage.getItem(LOCK_KEY)||"{}");return l;}catch(e){return {};}
}
function setLockout(obj){localStorage.setItem(LOCK_KEY,JSON.stringify(obj));}
// ───────────────────────────────────────────────────────────────

// Estado de admin, controlado por Firebase Auth (onAuthStateChanged)
let _isAdmin=false;
let _fbUser=null;
// v7.1 — 2FA admin: mientras esto es true, YA sabemos que el correo+
// contraseña son correctos (Firebase Auth los validó), pero todavía NO
// se concede isAdmin()==true: falta el código de Authenticator (o que el
// navegador ya esté marcado como de confianza, ver checkTrustedDevice2FA).
let _pending2FA=false;

// v7.2 — Modo Prueba: asegura que el auto-copiado de datos reales (ver
// _afterAdminStatusResolved) se intente como máximo una vez por carga de
// página, sea cual sea el resultado (incluso si falla).
let _testModeAutoSeedAttempted=false;

function isAdmin(){return _isAdmin;}
function isPending2FA(){return _pending2FA;}

// v6.4 — Antes, _isAdmin = !!user asumía que CUALQUIER sesión de Firebase
// Auth era el admin. Eso deja de ser cierto al introducir Auth Anónima para
// participantes (necesaria para que las reglas de Firestore puedan exigir
// "solo el dueño de este documento puede editarlo", sin pagar Cloud
// Functions). user.isAnonymous distingue ambos casos de forma nativa del
// SDK: el admin entra con correo+contraseña real (isAnonymous=false); un
// participante entra con signInAnonymously() (isAnonymous=true). Sin este
// chequeo, cualquier participante habría aparecido como admin completo.
//
// Además: este es el ÚNICO listener de onAuthStateChanged de toda la app
// (tanto admin como participantes dependen de él). Si nadie está logueado
// (primera carga de cualquier visitante, o justo después de que el admin
// cierra sesión), nos autenticamos anónimamente de inmediato — sin esto,
// "Mi Quiniela" no podría escribir nada en registro_participants (las
// reglas de Firestore exigen request.auth != null para cualquier escritura).
//
// v7.1 — Antes, isPasswordAuth (correo+contraseña real validados por
// Firebase) implicaba isAdmin()=true de inmediato. Ahora es un paso
// intermedio: dispara resolveAdmin2FA(), que decide en milisegundos (sin
// pedir nada) si este navegador ya es "de confianza" para el segundo
// factor, o si hace falta mostrar el modal de código. _isAdmin solo pasa
// a true cuando ese segundo paso (sincrónico o vía modal) se resuelve.
function wireFirebaseAuth(){
  const fb=window.__fb;
  fb.onAuthStateChanged(fb.auth,(user)=>{
    _fbUser=user;
    const isPasswordAuth = !!user && user.isAnonymous===false;
    if(!user){
      _isAdmin=false; _pending2FA=false;
      applyAdminUI();
      fb.signInAnonymously(fb.auth).catch(err=>{
        console.error("Error al iniciar sesión anónima:",err);
      });
      return; // onAuthStateChanged se vuelve a disparar solo cuando esa sesión anónima quede lista
    }
    if(!isPasswordAuth){
      // Sesión anónima normal de participante -- nunca pasa por 2FA.
      _isAdmin=false; _pending2FA=false;
      applyAdminUI();
      _afterAdminStatusResolved();
      return;
    }
    // Correo+contraseña correctos -- falta el segundo factor.
    _isAdmin=false;
    _pending2FA=true;
    applyAdminUI();
    resolveAdmin2FA();
  });
}

// v7.1 — Lo que antes corría siempre justo después de saber isAdmin() (la
// sincronización con Firestore y el auto-reconocimiento de Mi Quiniela)
// ahora vive acá aparte, porque para una sesión de admin real hay que
// esperar a que el 2FA se resuelva (de un lado u otro) antes de llamarlo
// -- si no, rgWirePapeleraSyncIfAdmin()/rgWirePrivadoSyncIfAdmin() ven
// isAdmin()===false en ese instante (correcto: todavía está pendiente) y
// nunca se conectan, aunque dos segundos después sí se confirme el admin.
function _afterAdminStatusResolved(){
  wireFirestoreSync();
  if(typeof rgWirePapeleraSyncIfAdmin==="function") rgWirePapeleraSyncIfAdmin();
  // v6.9.3 — Fix: rgWireFirestoreSync() solo intenta wirear el listener
  // de registro_privado UNA vez (la primera vez que se llama, casi
  // siempre durante el login anónimo, cuando isAdmin() todavía es
  // false). Sin este reintento explícito acá, una sesión de admin real
  // nunca llegaba a escuchar registro_privado: la tabla del panel
  // Admin mostraba correo/clave en blanco para todos, y cualquier
  // guardado masivo (ej. importar correos y claves) terminaba
  // empujando un batch con fb.PRIVADO_COL no inicializado del lado de
  // esa sesión -- mismo patrón que rgWirePapeleraSyncIfAdmin arriba.
  if(typeof rgWirePrivadoSyncIfAdmin==="function") rgWirePrivadoSyncIfAdmin();
  // v6.7 — Auto-reconocimiento de Mi Quiniela por ownerUid: si este
  // dispositivo (su UID anónimo) ya es el dueño reconocido de una
  // quiniela existente, entra directo a su dashboard sin pedir
  // correo+Clave de nuevo. Ver el comentario grande en registro.js
  // (tryAutoLoginByOwnerUid) para el detalle completo.
  if(typeof tryAutoLoginByOwnerUid==="function") tryAutoLoginByOwnerUid();
  // v7.2 — Modo Prueba: si entré como admin con ?test=1 y el documento
  // quiniela/estado-test todavía no existe, lo poblamos UNA SOLA VEZ con
  // una copia de los datos reales de producción (decisión explícita de
  // Tato: automático la 1ra vez, después solo con el botón del panel
  // Admin). No depende de wireFirestoreSync/onSnapshot a propósito: esa
  // suscripción solo se conecta una vez por carga de página, así que si
  // el admin entra ya logueado (no recién anónimo) nunca llegaría un
  // snapshot "nuevo" que dispare esto.
  if(TEST_MODE&&isAdmin()&&!_testModeAutoSeedAttempted){
    _testModeAutoSeedAttempted=true;
    maybeAutoSeedTestState();
  }
}

// ══════════════════════════════════════════════════════════════
// ADMIN 2FA — segundo factor (TOTP) + "recordar este navegador" v7.1
// ══════════════════════════════════════════════════════════════
// Usa las funciones puras de totp.js (cargado antes de este archivo en
// index.html). El secreto vive en Firestore en registro/admin2fa, de
// lectura/escritura exclusiva del admin (mismo patrón que registro/
// papelera en firestore.rules: request.auth.token.email == correo admin).
//
// "Recordar este navegador": tras validar el código una vez, se genera un
// token aleatorio que se guarda CRUDO en localStorage de este navegador y
// HASHEADO (con fecha de expiración) en Firestore. Login siguientes desde
// ESTE MISMO navegador, dentro de TRUST_DAYS días, no vuelven a pedir
// código -- pero el secreto sigue siendo indispensable para CUALQUIER otro
// navegador o dispositivo nuevo, y el token nunca viaja "en claro" por
// Firestore (solo su hash, igual que el código de respaldo).
const ADMIN2FA_TRUST_KEY="wb26_admin2fa_trust";
const ADMIN2FA_TRUST_DAYS=30;

function _admin2faDocRef(){
  const fb=window.__fb;
  return fb.ADMIN2FA_DOC || fb.doc(fb.db,"registro","admin2fa");
}

// Limpia entradas vencidas del mapa de navegadores de confianza antes de
// reescribirlo -- evita que el documento crezca indefinidamente con el uso.
function _pruneTrustedDevices(map){
  const now=Date.now();
  const cleaned={};
  Object.keys(map||{}).forEach(hash=>{
    const entry=map[hash];
    if(entry && typeof entry.expiresAt==="number" && entry.expiresAt>now) cleaned[hash]=entry;
  });
  return cleaned;
}

// Decide, sin pedirle nada al admin, si este navegador ya quedó marcado
// como de confianza (token guardado localmente + hash todavía vigente en
// Firestore). Cualquier problema (sin red, doc no existe, regla no
// publicada aún) se trata como "no confiable" -- nunca como error fatal:
// en el peor caso, se termina pidiendo el código, que es lo seguro.
async function checkTrustedDevice2FA(){
  try{
    const token=localStorage.getItem(ADMIN2FA_TRUST_KEY);
    if(!token) return false;
    const fb=window.__fb;
    const snap=await fb.getDoc(_admin2faDocRef());
    if(!snap.exists()) return false;
    const trusted=snap.data().trustedDevices||{};
    const hash=await sha256Hex(token);
    const entry=trusted[hash];
    return !!(entry && typeof entry.expiresAt==="number" && entry.expiresAt>Date.now());
  }catch(err){
    console.error("Error revisando navegador de confianza (2FA):",err);
    return false;
  }
}

// Se llama SOLO después de validar el código (o el código de respaldo)
// correctamente. Genera un token nuevo, lo guarda hasheado+con expiración
// en Firestore (de paso, purga los vencidos) y crudo en este navegador.
async function establishTrustedDevice2FA(){
  try{
    const fb=window.__fb;
    const bytes=new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token=Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
    const hash=await sha256Hex(token);
    const ref=_admin2faDocRef();
    const snap=await fb.getDoc(ref);
    const current=_pruneTrustedDevices(snap.exists()?snap.data().trustedDevices:{});
    current[hash]={expiresAt:Date.now()+ADMIN2FA_TRUST_DAYS*24*60*60*1000,createdAt:Date.now()};
    await fb.setDoc(ref,{trustedDevices:current},{merge:true});
    localStorage.setItem(ADMIN2FA_TRUST_KEY,token);
  }catch(err){
    // No bloquea el login si falla -- en el peor caso, la próxima vez
    // vuelve a pedir el código en este navegador.
    console.error("Error guardando navegador de confianza (2FA):",err);
  }
}

// Punto de entrada tras un login con correo+contraseña correctos: decide
// entre saltar el código (navegador de confianza) o mostrar el modal.
async function resolveAdmin2FA(){
  let trusted=false;
  try{
    trusted=await checkTrustedDevice2FA();
  }catch(err){
    console.error("Error resolviendo 2FA:",err);
  }
  if(trusted){
    _pending2FA=false;
    _isAdmin=true;
    applyAdminUI();
    _afterAdminStatusResolved();
    toast("✓ Acceso de administrador activado");
  }else{
    open2FAModal();
  }
}

function open2FAModal(){
  const modal=document.getElementById("login-2fa-modal");
  if(!modal){
    // Sin el modal (HTML no actualizado todavía) no podemos pedir el
    // código -- por seguridad, NO se concede admin solo por tener la
    // contraseña correcta.
    console.error("Modal de 2FA no encontrado en el HTML.");
    return;
  }
  document.getElementById("login-modal").style.display="none";
  modal.style.display="flex";
  const codeInput=document.getElementById("login-2fa-code");
  if(codeInput){codeInput.value="";setTimeout(()=>codeInput.focus(),100);}
  const backupInput=document.getElementById("login-2fa-backup");
  if(backupInput)backupInput.value="";
  const backupWrap=document.getElementById("login-2fa-backup-wrap");
  if(backupWrap)backupWrap.style.display="none";
  const err=document.getElementById("login-2fa-error");
  if(err)err.textContent="";
}

function close2FAModal(){
  const modal=document.getElementById("login-2fa-modal");
  if(modal)modal.style.display="none";
}

function toggleBackupCodeInput(){
  const backupWrap=document.getElementById("login-2fa-backup-wrap");
  if(backupWrap)backupWrap.style.display=backupWrap.style.display==="none"?"block":"none";
}

// Cancelar el modal de 2FA cierra también la sesión de Firebase Auth ya
// iniciada (correo+contraseña ya quedaron validados en ese punto) -- así
// no queda una sesión "a medio camino" colgada en este navegador.
function cancel2FALogin(){
  close2FAModal();
  _pending2FA=false;
  adminLogout();
}

async function submit2FACode(){
  const fb=window.__fb;
  const codeInput=document.getElementById("login-2fa-code");
  const backupInput=document.getElementById("login-2fa-backup");
  const errEl=document.getElementById("login-2fa-error");
  const btn=document.getElementById("login-2fa-submit-btn");
  const code=codeInput?codeInput.value.trim():"";
  const backupCode=backupInput?backupInput.value.trim():"";
  if(!code && !backupCode){
    if(errEl)errEl.textContent="Ingresa el código de tu app o un código de respaldo.";
    return;
  }
  if(btn){btn.disabled=true;btn.textContent="Verificando...";}
  try{
    const ref=_admin2faDocRef();
    const snap=await fb.getDoc(ref);
    if(!snap.exists()){
      if(errEl)errEl.textContent="No hay 2FA configurado en este proyecto.";
      if(btn){btn.disabled=false;btn.textContent="Verificar";}
      return;
    }
    const data=snap.data();
    let ok=false;
    let usedBackup=false;
    if(backupCode){
      const cleanBackup=backupCode.toUpperCase().replace(/\s+/g,"");
      const backupHash=data.backupCodeHash;
      if(backupHash){
        const enteredHash=await sha256Hex(cleanBackup);
        ok=(enteredHash===backupHash);
        usedBackup=ok;
      }
    }else{
      ok=await verifyTOTPCode(data.secret,code);
    }
    if(!ok){
      if(errEl)errEl.textContent="Código incorrecto. Intenta de nuevo.";
      if(btn){btn.disabled=false;btn.textContent="Verificar";}
      return;
    }
    if(usedBackup){
      // Código de respaldo es de un solo uso -- se invalida apenas se usa.
      await fb.setDoc(ref,{backupCodeHash:fb.deleteField()},{merge:true});
    }
    await establishTrustedDevice2FA();
    _pending2FA=false;
    _isAdmin=true;
    close2FAModal();
    applyAdminUI();
    _afterAdminStatusResolved();
    toast(usedBackup?"✓ Acceso activado con código de respaldo":"✓ Acceso de administrador activado");
  }catch(err){
    console.error("Error verificando 2FA:",err);
    if(errEl)errEl.textContent="Error al verificar. Intenta de nuevo.";
  }
  if(btn){btn.disabled=false;btn.textContent="Verificar";}
}

function adminLogout(){
  const fb=window.__fb;
  fb.signOut(fb.auth).then(()=>{
    toast("Sesión cerrada");
  }).catch(err=>{
    console.error("Error al cerrar sesión:",err);
    toast("Error al cerrar sesión",true);
  });
}

// Apply/hide admin-only elements
function applyAdminUI(){
  const admin=isAdmin();
  document.querySelectorAll(".admin-only").forEach(el=>{
    el.style.display=admin?"":"none";
  });
  document.querySelectorAll(".admin-tab").forEach(el=>{
    el.style.display=admin?"":"none";
  });
  // Update admin indicator icon
  const ind=document.getElementById("admin-indicator");
  if(ind){
    ind.textContent=admin?"🔓":"🔑";
    ind.style.color=admin?"rgba(0,200,83,.8)":"rgba(255,255,255,.5)";
    ind.style.borderColor=admin?"rgba(0,200,83,.4)":"rgba(255,255,255,.2)";
    ind.style.background=admin?"rgba(0,200,83,.1)":"rgba(255,255,255,.08)";
    ind.title=admin?"Cerrar sesión admin":"Admin";
  }
  // Re-render rank to show/hide links
  renderRank();
  // Re-render historial de batallas si está visible, para mostrar/ocultar controles admin
  const histWrap=document.getElementById("battles-history-wrap");
  if(histWrap&&histWrap.style.display!=="none")renderBattleHistory();
}

// Show login modal or logout if already admin
function openLoginModal(){
  if(isAdmin()){
    if(confirm("¿Cerrar sesión de administrador?"))adminLogout();
    return;
  }
  const modal=document.getElementById("login-modal");
  if(!modal){alert("Error: modal no encontrado");return;}
  modal.style.display="flex";
  const pwd=document.getElementById("login-pwd");
  if(pwd){pwd.value="";setTimeout(()=>pwd.focus(),100);}
  const err=document.getElementById("login-error");
  if(err)err.textContent="";
}

async function submitLogin(){
  const email=document.getElementById("login-email")?document.getElementById("login-email").value.trim():"";
  const pwd=document.getElementById("login-pwd").value;
  const errEl=document.getElementById("login-error");
  const btn=document.getElementById("login-submit-btn");
  if(!email||!pwd){errEl.textContent="Ingresa correo y contraseña.";return;}

  // ── Lockout cliente (solo fricción UX, ver comentario arriba) ──
  const lock=getLockout();
  if(lock.until&&Date.now()<lock.until){
    const mins=Math.ceil((lock.until-Date.now())/60000);
    errEl.textContent=`Demasiados intentos. Espera ${mins} minuto(s).`;
    return;
  }
  // ─────────────────────────────────────────────────────────────

  btn.disabled=true;btn.textContent="Verificando...";
  try{
    const fb=window.__fb;
    await fb.signInWithEmailAndPassword(fb.auth,email,pwd);
    setLockout({});  // éxito → reset lockout
    document.getElementById("login-modal").style.display="none";
    toast("✓ Acceso de administrador activado");
  }catch(err){
    // ── Incrementar contador de intentos fallidos ─────────────
    const attempts=(lock.attempts||0)+1;
    const lockUntil=attempts>=5?Date.now()+15*60*1000:null;
    setLockout({attempts,until:lockUntil});
    const remaining=5-attempts;
    const msgs={
      "auth/invalid-email":"Correo inválido.",
      "auth/user-not-found":"Usuario no encontrado.",
      "auth/wrong-password":remaining>0?`Contraseña incorrecta. (${remaining} intentos restantes)`:"Bloqueado por 15 minutos.",
      "auth/invalid-credential":remaining>0?`Correo o contraseña incorrectos. (${remaining} intentos restantes)`:"Bloqueado por 15 minutos.",
      "auth/too-many-requests":"Demasiados intentos. Espera unos minutos."
    };
    errEl.textContent=msgs[err.code]||(remaining>0?`Error al iniciar sesión. (${remaining} intentos restantes)`:"Bloqueado por 15 minutos.");
    // ─────────────────────────────────────────────────────────
    document.getElementById("login-pwd").value="";
  }
  btn.disabled=false;btn.textContent="Entrar";
}

