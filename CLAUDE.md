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

El deploy a GitHub Pages corre vía `.github/workflows/deploy-pages.yml`
(`actions/deploy-pages`, en cada push a `main`) — requiere que en Settings →
Pages → Build and deployment → Source esté puesto "GitHub Actions" (no
"Deploy from a branch"; ese método legacy, con Jekyll de por medio pese a
que el sitio no lo necesita, se dejó de usar en v1.7 porque el paso de
publicar empezó a colgarse y fallar de forma repetida sin causa visible).

## Arquitectura

### Carga de scripts: orden fijo, scope global compartido

`index.html` carga ~25 archivos `<script defer src="...">` (no ES modules,
salvo el bloque inline de Firebase). Todos comparten el mismo scope global
del navegador — no hay imports/exports; una función o variable de nivel
superior declarada en un archivo está disponible en cualquiera que cargue
después. El orden importa y es exactamente este:

```
participantes.js → torneo-mundial2026.js → partidos-grupos.js → utils.js → paises.js →
app-static-data.js → app-state.js → scoring.js → totp.js →
app-core-data.js → app-admin-auth.js → app-live-sync.js → app-tabs.js →
app-eliminatoria-data.js → app-batallas.js → app-bracket-render.js →
app-bracket-annexc.js → app-bracket-compute.js → app-bracket-espn-sync.js → app-bracket-view.js →
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
- `participantes.js`, `torneo-mundial2026.js`, `partidos-grupos.js`,
  `utils.js`, `paises.js`, `app-static-data.js`, `app-state.js`,
  `scoring.js`, `totp.js` cargan antes que los `app-*.js` porque son la
  capa de datos/estado/helpers que estos consumen. `paises.js` (Sprint 1
  de la hoja de ruta comercial, 2026-07-22) declara datos de país
  agnósticos de torneo (`TEAM_NAMES`, `ESPN_NAME_ES`, `ALL_FLAGS`,
  `AVATAR_MAP`). `torneo-mundial2026.js` (Sprint 2, mismo roadmap)
  declara `TORNEO_MUNDIAL_2026`, un solo objeto con TODO lo específico
  del fixture del Mundial 2026 (`matchLabels`, `espnAbbrMap`, `midAbbrs`,
  `mgmap`, `ges`, `arules`) — `partidos-grupos.js` y `app-static-data.js`
  ahora solo REASIGNAN sus globals de siempre (`MATCH_LABELS`,
  `ESPN_ABBR_MAP`, etc.) desde ese objeto, sin cambiar de nombre ni de
  forma, para que un futuro segundo torneo (Copa América, Euro) pueda
  traer su propio objeto `TORNEO_<NOMBRE>` sin tocar ningún consumidor.
  Va justo antes que `partidos-grupos.js` porque ese archivo depende de
  `TORNEO_MUNDIAL_2026.matchLabels`. `app-state.js` declara
  únicamente `S` (el estado MUTABLE compartido: resultados reales,
  checksums, bonos, batallas, snapshots — lo que persiste en
  `quiniela/estado`) y va justo antes que `scoring.js`, su mayor
  consumidor. Mismo patrón en `app-bracket-annexc.js`: declara únicamente
  `ANNEX_C` (las 495 combinaciones oficiales de FIFA para asignar los
  mejores terceros de grupo a su cruce de Dieciseisavos) y va justo antes
  que `app-bracket-compute.js`, su único consumidor.
- **Sprint 3a de la hoja de ruta comercial** (2026-07-22): `scoring.js`
  (7 lugares) y `utils.js` (`validateElimScore`) tenían el rango de
  partido de eliminatoria hardcodeado literal (`73`/`104`). Ahora leen
  `ELIM_MID_MIN`/`ELIM_MID_MAX` (`app-eliminatoria-data.js`, derivados
  de `BONUS_PHASES` con `Math.min`/`Math.max`, no hardcodeados a mano) —
  aunque `app-eliminatoria-data.js` carga DESPUÉS de `utils.js`/
  `scoring.js`, funciona porque ambos solo leen esos globals adentro de
  funciones que se invocan mucho después de que todo terminó de cargar
  (mismo patrón ya usado con `BONUS_PHASES` en `scoring.js`).
- **Sprint 3b** (mismo roadmap, 2026-07-22): `registro.js` tenía su
  PROPIA copia estructurada del fixture (`GROUP_MATCHES`, {id,g,a,b}) y
  `app-live-sync.js` tenía el mapeo de IDs de ESPN a partido
  (`ESPN_GAMEID_TO_PID`) hardcodeados — 2 fuentes de dato más que
  coincidían con `torneo-mundial2026.js` por disciplina manual, no por
  construcción (verificado byte a byte antes de consolidar). Ahora
  `torneo-mundial2026.js` es una IIFE que declara `groupMatches` como
  fuente ÚNICA (72 entradas {id,g,a,b}) y DERIVA `matchLabels`/`mgmap`
  de ahí mismo; `registro.js`/`app-live-sync.js` reasignan
  `GROUP_MATCHES`/`ESPN_GAMEID_TO_PID` desde ese mismo objeto.
  `totalMatches()` (registro.js) usaba `72` literal — ahora usa
  `GROUP_MATCHES.length`. 4 tests que cargan `registro.js` aislado (sin
  `index.html` de por medio: `test_autosave_indicador_real.js`,
  `test_envio_quiniela_confirmado.js`, `test_login_reclaim.js`,
  `test_registro_creacion_confirmada.js`) necesitaron sumar la carga de
  `torneo-mundial2026.js` a su harness — sin eso, `GROUP_MATCHES =
  TORNEO_MUNDIAL_2026.groupMatches` explota porque el global no existe
  en ese scope aislado (a diferencia de `ELIM_MID_MIN`/`BONUS_PHASES` en
  Sprint 3a, que se leen adentro de funciones invocadas mucho después;
  esta es una asignación de nivel superior que se ejecuta apenas carga
  el archivo).

- **Sprint 3c** (mismo roadmap, 2026-07-25): `computeBracket()`
  (`registro.js`) tenía 3 bloques casi idénticos (r16/qf/sf), cada uno
  con su tamaño de ronda (8/4/2) y su pid de arranque (89/97/101) +
  `prevBasePid` (73/89/97) escritos a mano — números que solo tienen
  sentido para el bracket de 32 equipos del Mundial 2026. Ahora es un
  solo loop sobre `KO_PHASES[1..3]` que deriva el pid de arranque de
  cada ronda desde `ELIM_ROUNDS[idx].ids[0]` (la MISMA fuente que ya usa
  el motor de puntaje real) — un futuro segundo torneo con menos rondas
  trae su propio `ELIM_ROUNDS`/`KO_PHASES` más cortos, sin tocar este
  loop. `KO_SLOT_IDS` (antes una segunda lista con los mismos tamaños de
  ronda escritos aparte) ahora se deriva de `KO_PHASES` con
  `.flatMap()`. El `total:72` de la fase de grupos en
  `computeCompletionFromPreds()` pasó a `GROUP_MATCHES.length`.
  Verificado con la suite completa, incluyendo
  `test_bracket_cruce_real_wizard.js`/`test_ko_equipos_reales_persistencia.js`
  (los que más de cerca prueban este bracket) — cero cambio de
  comportamiento.

  Con esto, la "hoja de ruta comercial" de motor de datos de torneo
  queda completa por ahora: `scoring.js`/`utils.js` (Sprint 3a) y
  `registro.js` (Sprint 3c) ya no tienen el rango/forma del bracket
  hardcodeado a mano — todo se deriva de `ELIM_ROUNDS`/`BONUS_PHASES`/
  `KO_PHASES` y del objeto `TORNEO_MUNDIAL_2026` (Sprints 1/2/3b). Un
  futuro segundo torneo con distinta forma de bracket (ej. Copa
  América: sin mejores terceros, menos rondas) todavía necesita su
  propio `TORNEO_<NOMBRE>`/`BONUS_PHASES`/`ELIM_ROUNDS`/`ELIM_TREE` — lo
  que se ganó acá es que ARMARLOS ya no exige tocar `scoring.js`/
  `utils.js`/`registro.js`.

- **Sprint 4 (checkpoint real de Fase 1, retomado 2026-07-23): Copa
  América de punta a punta.** Al planificar la Fase 2 (constructor de
  torneo) apareció el motivo por el que hacía falta retomar esto: el
  wizard de Fase 2 necesita elegir entre ≥2 plantillas reales, y solo
  existía una (Mundial 2026). Se partió en 3 sub-sprints:
  - **4a** (este commit): `ELIM_1_16_IDS`/`ELIM_1_16_LABELS`/
    `ELIM_TREE`/`ELIM_ROUNDS`/`BONUS_PHASES`/`WORLD_POOL` eran literales
    Mundial-2026-específicos escritos directamente en
    `app-eliminatoria-data.js` (un módulo `app-*.js` genérico, NO un
    archivo de datos por torneo) — quedaron fuera de la consolidación de
    Sprints 2/3b porque esa vez solo se tocó la fase de grupos, no la
    eliminatoria. Ahora viven en `TORNEO_MUNDIAL_2026`
    (`elim1_16Ids`/`elim1_16Labels`/`elimTree`/`elimRounds`/
    `bonusPhases`/`worldPool`) y `app-eliminatoria-data.js` solo
    reasigna, mismo patrón que Sprint 3b — cero cambio de comportamiento
    (verificado con la suite completa, ningún test tocado). También se
    agregaron `bracketFormat` (`"best-thirds"` por ahora) y `groupKeys`
    (`["A".."L"]`) al objeto, para que Sprint 4b tenga de dónde leerlos.
  - **4b (mismo día): "Sprint 3: motor de bracket con dos formatos"**
    del roadmap original — `generarLlavesDieciseisavos()`
    (`app-bracket-compute.js`) tenía la lógica de "mejores terceros +
    Annex C" escrita a mano con grupos `["A",...,"L"]` literal, y
    `calcGroupStandings()`/`calcH2H()`/`allGroupsComplete()`
    (`scoring.js`) + `rebuildDynamicData()` (`app-core-data.js`) +
    `updateGenerarBtn()`/`simularMarcadores()`
    (`app-bracket-compute.js`) tenían la cantidad de partidos de grupos
    (`72`) hardcodeada en 6 lugares más. Se agregó un alias genérico
    `TORNEO_ACTUAL = TORNEO_MUNDIAL_2026` (`app-static-data.js`) que
    esos 6 lugares ahora leen (`TORNEO_ACTUAL.groupMatches.length`) en
    vez del literal — un futuro segundo torneo con menos partidos de
    grupos (Copa América: 24) no requiere tocarlos. Además,
    `generarLlavesDieciseisavos()` ahora lee
    `TORNEO_ACTUAL.bracketFormat`: si es `"direct"` (Copa
    América/Euro — 2 primeros de cada grupo cruzan directo, sin
    terceros), delega en la función nueva `generarLlavesDirecto()`, que
    resuelve cruces `{pid:{h:"1A",a:"2B"}}` contra
    `TORNEO_ACTUAL.directCrosses` (dato puro por torneo, sin lógica de
    sorteo tipo Annex C que resolver acá); si sigue en `"best-thirds"`
    (Mundial 2026), el camino existente no cambió una línea. `groups`
    (antes `["A",...,"L"]` literal) ahora lee
    `TORNEO_ACTUAL.groupKeys`. Nuevo test
    `test_bracket_formato_direct.js` prueba `generarLlavesDirecto()` en
    aislado (mutando `TORNEO_ACTUAL.directCrosses`/`bracketFormat`
    después del boot real — son propiedades de un objeto, se pueden
    pisar sin recargar nada aunque el binding sea `const`), incluido el
    caso de un cruce con grupo sin datos (cae en `"?"`, no explota).
    Suite completa verde (59 harnesses), Mundial 2026 real sin cambios
    de comportamiento.
  - **4c (mismo día): `torneo-copaamerica.js` — el checkpoint real.**
    Segundo torneo completo con datos ficticios (16 equipos, 4 grupos de
    4, `bracketFormat:"direct"`, `directCrosses` de Cuartos de Final:
    `1A-2B`/`1B-2A`/`1C-2D`/`1D-2C`) que reusa `paises.js` (se agregaron
    Chile/Perú/Bolivia/Venezuela/Costa Rica — los 5 países CONMEBOL/
    invitados que faltaban porque ninguno clasificó al Mundial 2026).
    Sorteo y fixture 100% ficticios (no hay fecha real confirmada de
    próxima edición) — alcanza para probar el motor, que es el objetivo.
    Nuevo `test_copa_america_e2e.js` arma su propio `FILES_IN_ORDER`
    reemplazando `torneo-mundial2026.js` por `torneo-copaamerica.js` +
    un shim de una línea (`const TORNEO_MUNDIAL_2026 =
    TORNEO_COPA_AMERICA;`) y ejercita de punta a punta: fase de grupos
    completa (24 partidos) → `calcGroupStandings()` calcula bien los 4
    grupos → `generarLlavesDieciseisavos()` detecta `bracketFormat:
    "direct"` y arma los 4 cruces de Cuartos correctos → avanza Cuartos
    → Semis → Final → resuelve un campeón → `calcElimMatchPts()` no
    explota con un torneo de 4 rondas de eliminatoria en vez de las 6
    del Mundial. 17/17 checks en verde; suite completa (59 harnesses)
    también verde, Mundial 2026 real sin cambios de comportamiento.

    **Nota importante para la Fase 2 (constructor de torneo):**
    `torneo-copaamerica.js` NO se carga desde `index.html` — sigue
    siendo un archivo de prueba, no una plantilla elegible en runtime.
    `app-static-data.js`/`partidos-grupos.js`/`app-eliminatoria-data.js`
    hoy leen el identificador `TORNEO_MUNDIAL_2026` literal (no uno
    genérico), así que "elegir plantilla" en Fase 2 va a necesitar
    además renombrar ese identificador a algo neutral (`TORNEO_ACTUAL`
    ya existe como alias en `app-static-data.js`, pero declarado
    DESPUÉS de `partidos-grupos.js` en el orden de carga — no alcanza
    todavía) antes de que un selector real pueda simplemente cargar uno
    u otro archivo `TORNEO_<NOMBRE>.js`. Con esto, el motor de datos de
    torneo (Fase 1 completa: Sprints 1/2/3a/3b/3c/4a/4b/4c) queda
    probado con 2 formatos de bracket reales — lo que falta para Fase 2
    es la ergonomía de selección, no el motor en sí.

- **Sprint 5 (prerrequisito de la Fase 2, mismo día 2026-07-23): el
  identificador se volvió genérico.** El global que arma
  `torneo-mundial2026.js` se renombró de `TORNEO_MUNDIAL_2026` a
  `TORNEO_ACTUAL` (nombre neutral, no atado a qué torneo sea). Hasta
  acá, 5 archivos (`app-static-data.js`, `partidos-grupos.js`,
  `app-eliminatoria-data.js`, `registro.js`, `app-live-sync.js`)
  escribían el nombre `TORNEO_MUNDIAL_2026` LITERAL — un futuro
  selector de plantillas no podía simplemente elegir qué archivo
  `torneo-<nombre>.js` cargar, porque esos 5 archivos seguían buscando
  ese nombre puntual por más que el contenido cambiara. Ahora los 5
  leen `TORNEO_ACTUAL`, y `torneo-copaamerica.js` (Sprint 4c) también se
  actualizó para declarar `TORNEO_ACTUAL` directamente (antes
  `TORNEO_COPA_AMERICA` + un shim de una línea en el test) —
  `test_copa_america_e2e.js` ya no necesita ese shim, prueba real de que
  el identificador genérico funciona. La identidad de cada torneo vive
  en los campos `id`/`nombre` DEL OBJETO, nunca en el nombre de la
  variable — nunca se cargan dos archivos `torneo-*.js` a la vez, así
  que no hay colisión posible. `app-static-data.js` además perdió el
  alias intermedio `const TORNEO_ACTUAL = TORNEO_MUNDIAL_2026;` que el
  Sprint 4b había agregado (ya redundante: ahora el objeto se llama así
  desde su declaración). Suite completa verde, cero cambio de
  comportamiento para el Mundial 2026 real.

  **Lo que queda pendiente para Fase 2 (constructor de torneo)** ya NO
  es de motor: es la ergonomía de elegir qué archivo `torneo-<nombre>.js`
  termina cargando `index.html` (hoy es un `<script src>` fijo) — un
  wizard, un build step, o un selector en el panel admin, a diseñar
  cuando arranque esa fase.

- **Sprint 6 (Fase 2 "constructor de torneo" -- primera feature real,
  2026-07-23): marca propia (logo/color).** Investigando el wizard de 3
  decisiones del roadmap original (plantilla / modo de puntaje / marca),
  encontramos que el "modo de puntaje" YA es 100% editable en vivo desde
  siempre (`DB.configGlobal.reglas`, panel Admin → Configuración del
  torneo → Reglas) — no había nada que construir ahí todavía (el
  bloqueo de reglas una vez publicado el torneo queda pendiente, ver
  abajo). Lo que sí faltaba era marca propia, así que se hizo primero
  por ser la más autocontenida (no toca lógica de puntaje ni puede
  romper un torneo en curso):
  - `RG_DEFAULT_CONFIG` (`participantes.js`) suma `logoUrl`/`colorAcento`
    (strings vacíos por defecto — mismo criterio que `whatsappGroupLink`:
    vacío = comportamiento idéntico al de siempre).
  - `applyBrandingConfig()` (`app-bootstrap.js`, nueva) reemplaza las 2
    líneas que fijaban `logo-img.src = BORRACHI_SRC` a mano: ahora usa
    `DB.configGlobal.logoUrl || BORRACHI_SRC`, y aplica
    `colorAcento` sobre la variable CSS `--qb-red` (`style.setProperty`/
    `removeProperty`, según haya valor o no). Se llama al bootear Y
    dentro de `onParticipantesChange()` — mismo patrón reactivo que
    Modo Mantenimiento: si el admin cambia la marca con gente conectada,
    se ve al instante sin refrescar.
  - Nueva tarjeta "🎨 Marca del torneo" en `renderTorneoConfig()`
    (`app-admin-tools.js`, arriba de "⚙️ Fases activas"): URL de logo +
    selector de color nativo (`<input type="color">`) + botón
    "↩️ Restablecer". `updateBrandingCampo()`/`resetBrandingConfig()`
    son las únicas 2 funciones que escriben estos 2 campos (mismo
    criterio que `updateReglaValor()`/`toggleReglaSwitch()` para
    Reglas). El valor de `logoUrl` se escapa con `esc()` (utils.js) al
    insertarlo en el atributo `value=""` del input — mismo criterio XSS
    que el resto del panel.
  - Nuevo `test_marca_torneo.js`: default (sin marca = look de siempre),
    configurar desde el input REAL (evento `change` real, no llamada
    directa), XSS (una URL maliciosa no rompe el HTML del panel), y
    restablecer. 13/13 checks en verde.

  **Selector de plantilla (elegir qué `torneo-<nombre>.js` carga
  `index.html`)** sigue sin programarse — se bajó de alcance a "paso de
  setup" en vez de "feature en la app", porque Fase 2 sigue siendo un
  proyecto Firebase por cliente (no multi-tenant): armar un cliente
  nuevo ya es, gracias al Sprint 5, cambiar una sola línea de
  `<script src>`.

- **Sprint 7 (Fase 2 "constructor de torneo" -- última pieza real,
  2026-07-23): bloqueo de reglas.** Hasta acá, Configuración del torneo
  → Reglas se podía editar en vivo en cualquier momento, incluso a
  mitad de torneo — nada lo impedía. Nueva `isReglasBloqueadas()`
  (`scoring.js`, junto a `allGroupsComplete()`): devuelve `true` en
  cuanto existe AL MENOS un resultado real cargado (`S.scores` o
  `S.elimScores` con algo adentro) — el primer resultado real ES la
  publicación, sin exigirle al admin que se acuerde de apretar un botón
  aparte.
  - `reglaNumInput()`/`reglaSwitchRow()`/`reglaSwitchMini()`
    (`app-admin-tools.js`) son el ÚNICO lugar donde se arma el markup de
    un input/switch de Reglas — agregar el chequeo ahí adentro bloqueó
    TODO el panel (puntos base, por fase, multiplicador, racha,
    preguntas avanzadas, batallas/rumble) sin tocar ninguno de sus
    muchos call sites: inputs quedan `disabled`, switches pierden su
    `onclick` y suman la clase visual `.switch-disabled` (`styles.css`).
  - `buildReglasHtml()` muestra un banner "🔒 Reglas bloqueadas" cuando
    corresponde.
  - `updateReglaValor()`/`toggleReglaSwitch()` (las 2 únicas funciones
    que escriben sobre `reglas`) tienen además un chequeo defensivo
    propio: si alguien las llama con el DOM desactualizado (ej. el
    primer resultado real llegó justo con el panel abierto), no
    escriben nada — no dependen solo del atributo `disabled` del input.
  - Nuevo `test_reglas_bloqueadas.js` (13 checks): editable sin
    resultados, se bloquea con el primer resultado de grupos O de
    eliminatoria, el banner aparece, y la defensa extra corta una
    escritura directa aunque se la fuerce.

  Con esto, la Fase 2 (constructor de torneo) queda completa en su
  alcance actual: marca propia (Sprint 6) + reglas bloqueadas al
  publicar (Sprint 7) + selector de plantilla bajado a paso de setup
  (Sprint 5). Lo que sigue del roadmap original es Fase 3
  (multi-tenant) — gateada por demanda real, no por elegancia de
  arquitectura.

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
