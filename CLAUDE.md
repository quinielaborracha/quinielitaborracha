# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Quinielita Borracha: quiniela del Mundial 2026 (EE.UU./Canadá/México) para un
grupo cerrado de ~27 amigos. Frontend estático 100% vanilla JS/HTML/CSS (sin
bundler, sin framework, sin paso de build) + Firebase (Firestore + Auth) como
backend, servido por GitHub Pages. Todo el código, comentarios y textos de UI
están en español.

## Comandos

```bash
npm install       # una sola vez, o cuando cambie package-lock.json
npm run check     # node --check en todos los .js del repo (sintaxis)
npm test          # corre los 10 harnesses (9 test_*.js + sim_firestore_rules.js)
npm run verify    # check + test, en ese orden — correr esto antes de cualquier entrega
```

Para correr un solo test: `node test_nombre_del_archivo.js` (cada uno es
autocontenido, termina con `process.exit(0/1)` e imprime su propio detalle).

CI (`.github/workflows/tests.yml`) corre `npm run check` y `npm test` en
cada push/PR contra `main`.

No hay build step para producción: GitHub Pages sirve los archivos del repo
tal cual. `package.json` existe únicamente para el tooling de test (jsdom).

## Arquitectura

### Carga de scripts: orden fijo, scope global compartido

`index.html` carga ~23 archivos `<script defer src="...">` (no ES modules,
salvo el bloque inline de Firebase). Todos comparten el mismo scope global
del navegador — no hay imports/exports; una función o variable de nivel
superior declarada en un archivo está disponible en cualquiera que cargue
después. El orden importa y es exactamente este:

```
participantes.js → partidos-grupos.js → utils.js → app-state.js →
scoring.js → totp.js →
app-core-data.js → app-admin-auth.js → app-live-sync.js → app-tabs.js →
app-eliminatoria-data.js → app-batallas.js → app-bracket-render.js →
app-bracket-compute.js → app-bracket-espn-sync.js → app-bracket-view.js →
app-bracket-espn-live.js → app-integridad.js → app-predicciones.js →
app-estadisticas.js → app-admin-tools.js → app-bootstrap.js → registro.js
```

- Los 16 `app-*.js` son slices literales y contiguos de un antiguo `app.js`
  monolítico de 3906 líneas (dividido en v8.0, Sprint 1 del roadmap de
  arquitectura). Cada uno es responsabilidad única, sin cambios de lógica
  respecto al monolito. **El `app.js` monolítico ya no existe en el repo**
  (borrado en v1.7 tras confirmar que ningún archivo lo cargaba ni lo leía
  — el historial completo sigue disponible vía `git log`/`git show` si hace
  falta consultarlo). Si hay que tocar lógica de la app, es en el `app-*.js`
  correspondiente.
- `app-bootstrap.js` debe ser **siempre el último** de los `app-*.js`: hace
  el primer render (`load()`, `renderRank()`, etc.) llamando funciones
  definidas en todos los módulos anteriores, y arranca Firebase Auth +
  sincronización en vivo.
- `participantes.js`, `partidos-grupos.js`, `utils.js`, `app-state.js`,
  `scoring.js`, `totp.js` cargan antes que los `app-*.js` porque son la
  capa de datos/estado/helpers que estos consumen. `app-state.js` declara
  únicamente `S` (el estado mutable compartido: resultados reales,
  checksums, bonos, batallas, snapshots — lo que persiste en
  `quiniela/estado`) y va justo antes que `scoring.js`, su mayor
  consumidor.
- Cache-busting: cada archivo modificado necesita su contenido cambiado **y**
  el `?v=` correspondiente bumpeado en `index.html`, o el Service Worker
  (`sw.js`) sigue sirviendo la versión vieja desde caché para pedidos con
  `?v=` (esos se sirven cache-first a propósito; `index.html` sin `?v=` es
  siempre network-first).

### Modelo de seguridad / datos (Firestore)

- Cada participante obtiene una identidad anónima de Firebase
  (`signInAnonymously`, UID estable por dispositivo/navegador) y es dueño de
  su propio documento en la colección `registro_participants`, con
  `ownerUid` igual a ese UID. Las reglas de Firestore (`firestore.rules`)
  exigen `request.auth.uid === ownerUid` para escribir — la validación real
  vive del lado del servidor, no en el cliente.
- La "clave" de 6 dígitos que ve el usuario ya no es la barrera de
  seguridad; es solo el mecanismo de recuperación para "reclamar" un
  documento desde un dispositivo nuevo (nombre/correo + clave coinciden →
  se actualiza `ownerUid`).
- El admin usa Firebase Auth con email/password real + 2FA TOTP propio
  (`totp.js`, RFC 6238); el secreto vive en el documento
  `registro/admin2fa` de Firestore (se crea a mano, no vía código).
- `firestore.rules` **no se despliega junto con el sitio** — hay que
  pegarlo manualmente en Firebase Console → Firestore Database → Reglas
  cada vez que cambia.
- No hay Cloud Functions (proyecto en plan Spark/gratuito): toda la lógica
  de permisos vive en `firestore.rules`.

### Modo Prueba

`?test=1` en la URL redirige el documento de estado (resultados, bonos,
batallas) a `quiniela/estado-test` en vez de `quiniela/estado`, para poder
simular resultados hipotéticos sin afectar lo que ven los demás
participantes. Las predicciones de los participantes (colección
`registro_participants`/`registro_privado`) nunca cambian de documento.

### Motor de puntaje y sincronización con ESPN

- `scoring.js` concentra el cálculo de puntos/standings/bracket (básicos,
  avanzado, eliminatoria, bonos, batallas, desempates). Lee/escribe el
  estado global mutable (`S`, `DB`, `MD`, `PL`, `BONUS_PHASES`, etc.) que
  viven en los módulos `app-*.js`.
- `app-bracket-espn-sync.js` / `app-bracket-espn-live.js` sincronizan
  resultados reales de partidos de eliminatoria desde la API pública de
  ESPN, con lógica de conflicto (`normalizeAbbr`/`espnToMid` en `utils.js`
  mapean equipos/partidos del formato ESPN al formato interno).

## Tests

Los `test_*.js` son harnesses funcionales con jsdom: cargan los archivos de
producción reales como `<script>`, en el mismo orden y mismo scope global que
`index.html`, contra un mock de Firebase en memoria — ejercitan flujos reales
(batches atómicos, reglas de `registro_privado`, 2FA, XSS, etc.), no mocks
superficiales de "la función existe". `sim_firestore_rules.js` reimplementa
a mano la lógica booleana de `firestore.rules` para verificar que las reglas
son consistentes entre sí; no reemplaza probar con el emulador real antes de
publicar reglas nuevas.

`split.js` fue un script de un solo uso para partir el `app.js` monolítico en
los `app-*.js` actuales — no es parte del flujo normal de desarrollo. Queda
en el repo como referencia histórica de cómo se hizo la división, pero ya no
se puede volver a correr (su input, `app.js`, ya no existe).
