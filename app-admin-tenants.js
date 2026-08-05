/* ════════════════════════════════════════════════════════════
   app-admin-tenants.js
   ════════════════════════════════════════════════════════════
   Sprint 12 (hoja de ruta comercial, Fase 3 -- selector de plantilla en
   runtime, última pieza): "🏗️ Crear nueva quiniela". Junta lo que
   construyeron los 3 sprints anteriores en un formulario real:
     - Sprint 9: TORNEOS_DISPONIBLES (torneo-resolver.js elige entre
       ellos vía ?torneo=/localStorage).
     - Sprint 10: TENANT_ID en runtime (?tenant=/localStorage) + la
       regla de auto-servicio en firestore.rules (`allow create` en
       tenants/{tenantId}, exige adminEmail==auth.token.email).
     - Sprint 11: un tercer template real (torneo-euro.js) para que el
       selector tenga más de 2 opciones.

   Slice de responsabilidad única, mismo criterio que el resto de los
   app-*.js -- no infla app-admin-tools.js con algo que no es
   "configuración de ESTE torneo" sino "crear OTRA quiniela entera".
   Carga después de participantes.js (necesita RG_DEFAULT_CONFIG) y de
   app-admin-tools.js, antes de app-bootstrap.js.

   Dónde vive en el DOM: hasta el Sprint 15, adentro de la sub-pestaña
   "⚙️ Configuración del torneo" (#torneo-content) -- ver esa nota más
   abajo para dónde vive ahora.

   Sprint 13 (mismo roadmap, un día después): "📋 Mis quinielas" --
   sumó renderMisQuinielasCard(), arriba de la de crear. Necesitó una
   regla nueva de firestore.rules (`allow read` en tenants/{tenantId},
   scoped a resource.data.adminEmail==auth.token.email -- antes ERA
   `if false` sin excepción, ni el propio admin podía leer su tenant
   desde el cliente). Usa query()+where()+onSnapshot() sobre
   collection(db,'tenants') -- todos ya venían expuestos en
   window.__fb desde el bloque de Firebase de index.html, no hizo
   falta importar nada nuevo.

   Sprint 14 (mismo día que el 13): "🗑️ Eliminar" en cada fila de "Mis
   quinielas" (nunca en la actual -- primero hay que cambiarse a otra).
   `_tenantDeleteFully()` enumera con getDocs() (ÚNICO import nuevo de
   Firebase en toda esta hoja de ruta -- todo lo demás ya estaba
   expuesto) las 2 colecciones de tamaño variable
   (registro_participants/registro_privado) del tenant a borrar, y
   junta todo en un solo writeBatch con los documentos fijos conocidos
   (registro/meta, registro/admin2fa, registro/papelera,
   quiniela/estado(-test)) y el propio documento tenants/{tenantId} al
   final -- permitido por una regla `allow delete` nueva, scoped a
   adminEmail (misma condición que `allow read`, NO isAdmin(): borrar
   el documento es justo lo que haría que isAdmin() dejara de poder
   resolverse para ese tenant).

   Sprint 15 (mismo roadmap, un día después): "📋 Mis Quinielas" se saca
   de adentro de "Configuración del torneo" a su propia sub-pestaña
   (pedido directo del usuario -- son 2 cards sobre OTRAS quinielas,
   no configuración de ESTA). `renderMisQuinielasCard()`/
   `renderTenantsCard()` ahora apuntan a `#quinielas-content` (antes
   `#torneo-content`) -- mismas 2 funciones, mismo
   `insertAdjacentHTML('beforeend')`, un solo `getElementById` distinto
   en cada una. `app-tabs.js` (`adminSubTab()`) las llama para
   `id==="quinielas"` en vez de `id==="torneo"`.
   ════════════════════════════════════════════════════════════ */

// Convierte lo que el admin escribió en un id de tenant válido para
// Firestore (letras/números/guiones, sin espacios ni tildes) -- mismo
// criterio de slug que cualquier URL amigable.
function _tenantSlugify(raw){
  return String(raw||'')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca tildes
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// "📋 Mis quinielas" (Sprint 13): lista, en vivo, todos los tenants
// donde el admin logueado ES el adminEmail -- onSnapshot en vez de un
// getDocs() de una sola vez, mismo criterio reactivo que el resto de
// la app (si creás una quiniela nueva en otra pestaña, esta lista se
// actualiza sola, sin recargar).
function renderMisQuinielasCard(){
  const c = document.getElementById('quinielas-content');
  if(!c) return;
  if(typeof isAdmin!=='function' || !isAdmin()) return;

  const html = `
    <div class="card" id="mis_quinielas_card" style="border:1px solid var(--qb-blue)">
      <div class="card-title">📋 Mis quinielas</div>
      <div class="note">Todas las quinielas creadas con esta cuenta de admin (incluida esta misma). Tocá "Entrar" para cambiar a otra, o "🗑️ Eliminar" para borrar una que ya no uses -- no se puede eliminar la que estás usando ahora mismo (cambiá a otra primero).</div>
      <div id="mis_quinielas_list" class="muted">Cargando...</div>
    </div>
  `;
  c.insertAdjacentHTML('beforeend', html);

  const fb = window.__fb;
  const listEl = () => document.getElementById('mis_quinielas_list');
  if(!fb || !fb.db || !fb.auth.currentUser){
    if(listEl()) listEl().innerHTML = '<div class="muted">Todavía estamos preparando tu sesión...</div>';
    return;
  }

  const q = fb.query(fb.collection(fb.db, 'tenants'), fb.where('adminEmail', '==', fb.auth.currentUser.email));
  fb.onSnapshot(q, (snap)=>{
    const el = listEl();
    if(!el) return; // el panel pudo haberse cerrado/re-renderizado mientras tanto
    const tenants = [];
    snap.forEach(docSnap => tenants.push({ id: docSnap.id, ...docSnap.data() }));
    tenants.sort((a,b)=> (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
    if(!tenants.length){
      el.innerHTML = '<div class="muted">No se encontró ninguna todavía.</div>';
      return;
    }
    el.innerHTML = tenants.map(t=>{
      const esActual = t.id === fb.TENANT_ID;
      const disponibles = window.TORNEOS_DISPONIBLES || {};
      const nombrePlantilla = (disponibles[t.torneoId] && disponibles[t.torneoId].nombre) || t.torneoId || '(sin plantilla)';
      const fecha = (t.createdAt && typeof t.createdAt.toDate === 'function') ? t.createdAt.toDate().toLocaleDateString() : '';
      return `<div class="switch-row" style="align-items:center">
        <div>
          <div style="font-weight:700">${esc(t.id)}${esActual ? ' <span class="badge badge-muted">actual</span>' : ''}</div>
          <div class="muted" style="font-size:11.5px">${esc(nombrePlantilla)}${fecha ? ' · creada ' + esc(fecha) : ''}</div>
        </div>
        <div style="display:flex;gap:6px">
          ${esActual ? '' : `<a class="rg-btn rg-btn-ghost" href="?tenant=${encodeURIComponent(t.id)}&torneo=${encodeURIComponent(t.torneoId||'')}">Entrar</a>`}
          ${esActual ? '' : `<button class="rg-btn rg-btn-danger" data-delete-tenant="${esc(t.id)}">🗑️ Eliminar</button>`}
        </div>
      </div>`;
    }).join('');
  }, (err)=>{
    console.error('Error al listar "Mis quinielas":', err);
    const el = listEl();
    if(el) el.innerHTML = '<div class="muted">No se pudo cargar -- puede que falte publicar la regla nueva de lectura en Firebase Console.</div>';
  });

  // Delegación de eventos en el contenedor (no en cada botón): la lista
  // se reconstruye entera en cada onSnapshot -- wirear una sola vez acá
  // afuera evita tener que re-wirear cada botón después de cada
  // actualización en vivo.
  listEl().addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-delete-tenant]');
    if(!btn) return;
    const tenantId = btn.getAttribute('data-delete-tenant');
    if(!confirm(`¿Eliminar la quiniela "${tenantId}"? Se borran TODOS sus datos (participantes, resultados, configuración) -- no se puede deshacer.`)) return;
    if(!confirm(`Última confirmación: "${tenantId}" y todo lo que tenga adentro se pierde para siempre. ¿Seguro?`)) return;
    btn.disabled = true; btn.textContent = 'Eliminando...';
    _tenantDeleteFully(tenantId).then(()=>{
      toast(`✓ "${tenantId}" eliminada`);
      // No hace falta tocar el DOM a mano: en cuanto el batch confirma,
      // el onSnapshot de arriba recibe el cambio solo (el tenant ya no
      // matchea el where(), Firestore lo saca del resultado) y repinta
      // la lista sin este ítem.
    }).catch(err=>{
      console.error(`Error al eliminar la quiniela "${tenantId}":`, err);
      toast('No se pudo eliminar: ' + (err && err.message ? err.message : 'error desconocido'), true);
      btn.disabled = false; btn.textContent = '🗑️ Eliminar';
    });
  });
}

// Borra un tenant AJENO a la sesión activa (nunca el actual, ver el
// guard en el botón de arriba) de punta a punta: primero enumera y
// borra sus colecciones (registro_participants/registro_privado --
// las únicas de tamaño variable, todo lo demás son documentos únicos
// conocidos de antemano), después los documentos fijos, y al final el
// documento tenants/{tenantId} en sí (permitido por la regla nueva del
// Sprint 14 -- create/read ya existían, delete scoped a
// adminEmail==auth.token.email, igual que read). Un solo writeBatch:
// para una quiniela de prueba (el caso real de uso) nunca se acerca al
// límite de 500 operaciones de un batch.
function _tenantDeleteFully(tenantId){
  const fb = window.__fb;
  const participantsCol = fb.collection(fb.db, 'tenants', tenantId, 'registro_participants');
  const privadoCol = fb.collection(fb.db, 'tenants', tenantId, 'registro_privado');

  return Promise.all([
    fb.getDocs(participantsCol),
    fb.getDocs(privadoCol),
  ]).then(([participantsSnap, privadoSnap])=>{
    const batch = fb.writeBatch(fb.db);
    participantsSnap.forEach(d => batch.delete(d.ref));
    privadoSnap.forEach(d => batch.delete(d.ref));
    [
      fb.doc(fb.db, 'tenants', tenantId, 'registro', 'meta'),
      fb.doc(fb.db, 'tenants', tenantId, 'registro', 'admin2fa'),
      fb.doc(fb.db, 'tenants', tenantId, 'registro', 'papelera'),
      fb.doc(fb.db, 'tenants', tenantId, 'quiniela', 'estado'),
      fb.doc(fb.db, 'tenants', tenantId, 'quiniela', 'estado-test'),
      fb.doc(fb.db, 'tenants', tenantId),
    ].forEach(ref => batch.delete(ref));
    return batch.commit();
  });
}

// Separado en su propia función solo para que un test pueda espiarla
// sin pelear contra jsdom (que no implementa navegación real: asignar
// location.href ahí queda en un no-op silencioso, sin forma de leer
// qué se intentó). En producción es exactamente un reload completo a
// la URL nueva -- más simple y más seguro que reconectar Firestore en
// caliente, dado que TENANT_ID/los refs de window.__fb se arman una
// sola vez al cargar el módulo inline de index.html.
function _tenantRedirectTo(url){
  window.location.href = url;
}

function renderTenantsCard(){
  const c = document.getElementById('quinielas-content');
  if(!c) return;
  if(typeof isAdmin!=='function' || !isAdmin()) return; // renderTorneoConfig() ya deja el mensaje de acceso restringido en este mismo container

  const disponibles = window.TORNEOS_DISPONIBLES || {};
  const opciones = Object.values(disponibles)
    .map(t=>`<option value="${esc(t.id)}">${esc(t.nombre)}</option>`)
    .join('');

  const html = `
    <div class="card" id="tenants_card" style="border:1px solid var(--qb-blue)">
      <div class="card-title">🏗️ Crear nueva quiniela</div>
      <div class="note">Arma una quiniela de prueba nueva (Fase 3 -- multi-tenant): mismo backend de Firebase, datos completamente aislados de esta. Sirve para probar un torneo/plantilla distinto sin tocar nada de acá. Al crearla, este dispositivo te lleva directo a la nueva -- para volver a esta, reabrí el link de siempre (sin <code>?tenant=</code>).</div>
      <div class="field" style="margin-bottom:.6rem">
        <label>Nombre de la quiniela nueva</label>
        <input type="text" id="a_tenant_id" placeholder="ej. Mi Quiniela Champions" autocomplete="off">
      </div>
      <div class="field" style="margin-bottom:.6rem">
        <label>Plantilla de torneo</label>
        <select id="a_tenant_torneo">${opciones}</select>
      </div>
      <div class="rg-btn-row">
        <button class="rg-btn rg-btn-primary" id="a_tenant_crear">➕ Crear quiniela</button>
      </div>
    </div>
  `;
  c.insertAdjacentHTML('beforeend', html);

  document.getElementById('a_tenant_crear').addEventListener('click', ()=>{
    const btn = document.getElementById('a_tenant_crear');
    const tenantId = _tenantSlugify(document.getElementById('a_tenant_id').value);
    const torneoId = document.getElementById('a_tenant_torneo').value;
    if(!tenantId){ toast('Poné un nombre válido (al menos una letra o número)', true); return; }
    if(!torneoId){ toast('Elegí una plantilla de torneo', true); return; }

    const fb = window.__fb;
    if(!fb || !fb.db || !fb.auth.currentUser){
      toast('Todavía estamos preparando tu sesión -- esperá un segundo y volvé a intentar', true);
      return;
    }

    btn.disabled = true; btn.textContent = 'Creando...';

    // 1) tenants/{tenantId}: permitido por la regla de auto-servicio del
    //    Sprint 10 (create-only, exige adminEmail===auth.token.email).
    // 2) tenants/{tenantId}/registro/meta: SECUENCIAL, no en paralelo --
    //    su regla de create exige isAdmin(), que a su vez necesita que
    //    el documento del paso 1 YA exista en el servidor (get()/exists()
    //    contra tenants/{tenantId}). Si esto se mandara junto en un
    //    batch/Promise.all, Firestore podría evaluar ambas reglas antes
    //    de que el paso 1 se confirmara, y el paso 2 se rechazaría.
    // 3) tenants/{tenantId}/registro/admin2fa: CORRECCIÓN (2026-08-05,
    //    pedido real del usuario -- "por qué me pide 2FA de nuevo si ya
    //    entré como admin"): cada tenant tenía su PROPIO secreto TOTP,
    //    creado a mano en Firebase Console -- una quiniela nueva
    //    quedaba sin 2FA configurado hasta ese paso manual, y aunque se
    //    configurara, "recordar este navegador" (trustedDevices) vive
    //    ADENTRO de cada admin2fa por tenant, así que nunca se
    //    heredaba. Ahora, al crear una quiniela nueva, se copia
    //    TAL CUAL el admin2fa del tenant DESDE EL QUE SE ESTÁ CREANDO
    //    (fb.ADMIN2FA_DOC ya apunta ahí -- es donde la sesión actual ya
    //    pasó el 2FA para llegar a este formulario) -- mismo secreto Y
    //    mismos navegadores de confianza. Permitido por la MISMA regla
    //    de siempre (`registro/admin2fa`: `allow read,write: if
    //    isAdmin()`) -- isAdmin() del tenant nuevo ya resuelve `true`
    //    en este punto (su documento ya existe, con nuestro propio
    //    email como adminEmail). Si el tenant actual no tuviera 2FA
    //    configurado (no debería pasar nunca en la práctica), este paso
    //    simplemente no copia nada -- no bloquea la creación por eso.
    const tenantDocRef = fb.doc(fb.db, 'tenants', tenantId);
    const metaDocRef = fb.doc(fb.db, 'tenants', tenantId, 'registro', 'meta');
    const nuevoAdmin2faRef = fb.doc(fb.db, 'tenants', tenantId, 'registro', 'admin2fa');
    fb.setDoc(tenantDocRef, {
      adminEmail: fb.auth.currentUser.email,
      createdAt: fb.serverTimestamp(),
      torneoId,
    }).then(()=> fb.setDoc(metaDocRef, {
      nextSeq: 1,
      configGlobal: { ...RG_DEFAULT_CONFIG, torneoId },
      updatedAt: fb.serverTimestamp(),
    })).then(()=> fb.getDoc(fb.ADMIN2FA_DOC)).then(snap=>{
      if(!snap.exists()) return; // el tenant actual no tiene 2FA configurado -- no bloquea la creación
      return fb.setDoc(nuevoAdmin2faRef, snap.data());
    }).then(()=>{
      toast('✓ Quiniela creada, entrando...');
      setTimeout(()=>{
        _tenantRedirectTo(location.pathname
          + '?tenant=' + encodeURIComponent(tenantId)
          + '&torneo=' + encodeURIComponent(torneoId));
      }, 500);
    }).catch(err=>{
      console.error('Error al crear la quiniela nueva:', err);
      const mensaje = (err && err.code === 'permission-denied')
        ? 'el servidor lo rechazó -- puede que ya exista una quiniela con ese nombre'
        : ((err && err.message) || 'error desconocido');
      toast('No se pudo crear: ' + mensaje, true);
      btn.disabled = false; btn.textContent = '➕ Crear quiniela';
    });
  });
}
