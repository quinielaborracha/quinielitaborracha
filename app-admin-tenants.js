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

   Dónde vive en el DOM: adentro de la sub-pestaña "⚙️ Configuración del
   torneo" (mismo container que renderTorneoConfig(), #torneo-content),
   agregada DESPUÉS de su innerHTML (insertAdjacentHTML, nunca lo pisa).
   app-tabs.js (adminSubTab()) llama a renderTenantsCard() con el mismo
   patrón defensivo (`typeof fn==="function"`) que ya usa para
   renderTorneoConfig() -- un chequeo extra en un archivo que ya conocía
   ese patrón, no una integración nueva rara.

   Sprint 13 (mismo roadmap, un día después): "📋 Mis quinielas" --
   sumó renderMisQuinielasCard(), arriba de la de crear. Necesitó una
   regla nueva de firestore.rules (`allow read` en tenants/{tenantId},
   scoped a resource.data.adminEmail==auth.token.email -- antes ERA
   `if false` sin excepción, ni el propio admin podía leer su tenant
   desde el cliente). Usa query()+where()+onSnapshot() sobre
   collection(db,'tenants') -- todos ya venían expuestos en
   window.__fb desde el bloque de Firebase de index.html, no hizo
   falta importar nada nuevo.
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
  const c = document.getElementById('torneo-content');
  if(!c) return;
  if(typeof isAdmin!=='function' || !isAdmin()) return;

  const html = `
    <div class="card" id="mis_quinielas_card" style="border:1px solid var(--qb-blue)">
      <div class="card-title">📋 Mis quinielas</div>
      <div class="note">Todas las quinielas creadas con esta cuenta de admin (incluida esta misma). Tocá "Entrar" para cambiar a otra.</div>
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
        ${esActual ? '' : `<a class="rg-btn rg-btn-ghost" href="?tenant=${encodeURIComponent(t.id)}&torneo=${encodeURIComponent(t.torneoId||'')}">Entrar</a>`}
      </div>`;
    }).join('');
  }, (err)=>{
    console.error('Error al listar "Mis quinielas":', err);
    const el = listEl();
    if(el) el.innerHTML = '<div class="muted">No se pudo cargar -- puede que falte publicar la regla nueva de lectura en Firebase Console.</div>';
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
  const c = document.getElementById('torneo-content');
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
    const tenantDocRef = fb.doc(fb.db, 'tenants', tenantId);
    const metaDocRef = fb.doc(fb.db, 'tenants', tenantId, 'registro', 'meta');
    fb.setDoc(tenantDocRef, {
      adminEmail: fb.auth.currentUser.email,
      createdAt: fb.serverTimestamp(),
      torneoId,
    }).then(()=> fb.setDoc(metaDocRef, {
      nextSeq: 1,
      configGlobal: { ...RG_DEFAULT_CONFIG, torneoId },
      updatedAt: fb.serverTimestamp(),
    })).then(()=>{
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
