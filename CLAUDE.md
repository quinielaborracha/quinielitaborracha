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
participantes.js → torneo-mundial2026.js → torneo-copaamerica.js → torneo-euro.js → torneo-resolver.js → partidos-grupos.js → utils.js → paises.js →
app-static-data.js → app-state.js → scoring.js → totp.js →
app-core-data.js → app-admin-auth.js → app-live-sync.js → app-tabs.js →
app-eliminatoria-data.js → app-batallas.js → app-bracket-render.js →
app-bracket-annexc.js → app-bracket-compute.js → app-bracket-espn-sync.js → app-bracket-view.js →
app-bracket-espn-live.js → app-integridad.js → app-predicciones.js →
app-estadisticas.js → app-admin-tools.js → app-admin-tenants.js → app-bootstrap.js → registro.js
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

- **Sprint 8 (retomando la hoja de ruta comercial tras Fase 3 milestone
  1, 2026-08-04): "🎭 Participantes ficticios".** Para poder probar
  Ranking/Estadísticas/Batallas sin esperar altas reales, nueva tarjeta
  en el panel Admin (`registro.js`, `renderAdmin()`) que crea/borra
  participantes de prueba. Descubrimiento clave: no hizo falta ninguna
  regla nueva de `firestore.rules` — el `create` de
  `registro_participants`/`registro_privado` ya tenía `isAdmin()` como
  rama incondicional (el mismo camino que usa "restaurar desde la
  papelera"), así que el admin ya podía escribir con cualquier
  `ownerUid` sintético sin pasar por `isRegistroAbierto()`/
  `esAltaValidaDeParticipante()`. `rgCreateFakeParticipants(n)`/
  `rgDeleteFakeParticipants()` (`participantes.js`) hacen un solo
  `writeBatch` cada una; los ficticios llevan `esFicticio:true` y un
  código propio `FAKE-NNNN` (no consumen el `nextSeq` real) y arrancan
  con `estadoQuiniela:'enviada'` + predicciones random de fase de
  grupos (mismo generador 0-3 que `simularMarcadores()`). Test:
  `test_participantes_ficticios.js`.

- **Sprint 9 (mismo día, Fase 3 — selector de plantilla en runtime,
  primer paso): registro compartido de torneos.** Hasta acá nunca se
  cargaban dos `torneo-<nombre>.js` a la vez (Sprint 5) — ahora
  `index.html` carga `torneo-mundial2026.js` Y `torneo-copaamerica.js`
  juntos (esta última deja de ser solo un archivo de test) más un
  `torneo-resolver.js` nuevo, cargado después de ambos y antes de
  `partidos-grupos.js`. Cada `torneo-<nombre>.js` se registra en
  `window.TORNEOS_DISPONIBLES[id]` (además de seguir declarando
  `TORNEO_ACTUAL` como siempre — **ahora con `var`, no `const`**: dos
  `const TORNEO_ACTUAL` en `<script>` distintos del mismo documento
  chocan con un `SyntaxError` real, `var` no). `torneo-resolver.js`
  resuelve `TORNEO_ACTUAL` de forma SÍNCRONA (sin `await`/Firestore,
  porque `partidos-grupos.js` lee `TORNEO_ACTUAL.groupMatches` en una
  asignación de nivel superior) leyendo, en orden: `?torneo=` de la URL
  → `localStorage.qb_torneo_activo` → lo que haya quedado por simple
  orden de carga (hoy, `torneo-mundial2026.js` siempre gana por default,
  al cargar primero). Limitación aceptada: un dispositivo nuevo sin
  `?torneo=` ni caché siempre cae en ese default hasta el próximo load
  (recién se corrige cuando el boot real cachee
  `registro/meta.configGlobal.torneoId`, milestone futuro). Test:
  `test_torneo_resolver.js`.

- **Sprint 11 (mismo día, Fase 3 -- checkpoint del selector de
  plantilla): `torneo-euro.js`, el primer torneo SIN fase de grupos**
  (`groupMatches:[]`, `groupKeys:[]`) -- mismo espíritu que Copa América
  probó en su momento (Sprint 4c): un segundo caso concreto confirma
  que el registro compartido (Sprint 9) generaliza de verdad. La
  primera fase de `bonusPhases` ya es de eliminatoria (Semifinales,
  `prevPhase:null`); sus equipos se cargan a mano (mecanismo YA
  EXISTENTE, "✏️ Editar llaves", para "empezar en una fase que no es
  Dieciseisavos") o con "🎲 Simular". **Hallazgo real al escribir este
  checkpoint** (no anticipado en el plan original): `bracketFormat`
  tiene que ser `"direct"` (con `directCrosses:{}`), NO el default
  "best-thirds" — `generarLlavesDieciseisavos()`
  (`app-bracket-compute.js`) solo delega en `generarLlavesDirecto()`
  cuando el formato es `"direct"`; en cualquier otro caso corre su rama
  "mejores terceros", que tiene los pids 73-88 y las letras A-L del
  Mundial 2026 HARDCODEADOS en el cuerpo de la función (no derivados de
  `TORNEO_ACTUAL`) — con `groupKeys:[]` esa rama no explota, pero
  contaminaría `S.elimTeams` con datos ajenos a este torneo si el admin
  aprieta "Generar llaves" (que además queda habilitado de entrada:
  `updateGenerarBtn()` considera "0 de 0 partidos" como fase de grupos
  completa). Con `bracketFormat:"direct"` y `directCrosses:{}`, esa
  rama nunca se ejecuta y `generarLlavesDirecto()` no encuentra nada
  que resolver — verificado explícitamente en `test_euro_e2e.js`
  (confirma que `S.elimTeams` queda vacío después de "Generar llaves",
  sin pids 73/74 contaminados). Se cargó también en `index.html` junto
  a los otros 2 templates, ya elegible desde `TORNEOS_DISPONIBLES` para
  cuando exista el picker (Sprint 12).

- **Sprint 12 (mismo día, Fase 3 -- última pieza): "🏗️ Crear nueva
  quiniela", el formulario real.** Junta 9+10+11: nuevo
  `app-admin-tenants.js` (slice de responsabilidad única, mismo criterio
  que el resto de `app-*.js`) agrega una tarjeta a la sub-pestaña
  "⚙️ Configuración del torneo" (`#torneo-content`, el mismo container
  que ya llena `renderTorneoConfig()`) con input de nombre + selector de
  plantilla poblado de `Object.values(TORNEOS_DISPONIBLES)`. Al
  confirmar: `setDoc(tenants/{id}, {adminEmail, createdAt, torneoId})`
  (permitido por la regla de auto-servicio del Sprint 10) → **espera esa
  confirmación** → recién ahí `setDoc` semilla de
  `tenants/{id}/registro/meta` (su `create` exige `isAdmin()`, que
  necesita que el tenant YA exista en el servidor -- por eso es
  secuencial, nunca un batch/`Promise.all`) → redirect completo a
  `?tenant=<id>&torneo=<templateId>`. `app-tabs.js`
  (`adminSubTab('torneo')`) ganó una línea nueva (mismo chequeo
  defensivo `typeof fn==="function"` que ya usaba para
  `renderTorneoConfig()`) para llamar a `renderTenantsCard()` justo
  después, sin tocar `app-admin-tools.js`. Test:
  `test_crear_quiniela_admin.js` (el redirect se separó en
  `_tenantRedirectTo(url)` solo para poder espiarlo -- jsdom no
  implementa navegación real, asignar `location.href` ahí es un no-op
  silencioso).

  Con esto, el roadmap de este bloque (menú para crear quiniela nueva +
  participantes ficticios + simulación end-to-end, Sprints 8-12) queda
  completo. Plan detallado (contexto original, decisiones de diseño) en
  `C:\Users\eldio\.claude\plans\atomic-popping-leaf.md`.

- **CORRECCIÓN URGENTE (mismo día, 2026-08-04, post-deploy) -- 2 bugs
  reales encontrados apenas se usó "Crear nueva quiniela" contra
  Firebase real, ambos ya en producción antes de detectarse:**
  1. **El default de plantilla sin `?torneo=` NO era el Mundial real.**
     `torneo-resolver.js` (Sprint 9), sin `?torneo=` en la URL, dejaba
     `TORNEO_ACTUAL` "tal cual había quedado por el simple orden de
     carga de los `<script>` anteriores" -- eso funcionaba por
     casualidad mientras `torneo-mundial2026.js` fuera el ÚLTIMO
     `torneo-<nombre>.js` en cargar, pero dejó de ser cierto en el
     mismo Sprint 9 (se agregó `torneo-copaamerica.js` después) y
     empeoró en el Sprint 11 (`torneo-euro.js` después de ese). El
     default silencioso pasó a ser el ÚLTIMO template ficticio
     agregado, aplicado sobre los datos REALES del tenant de
     producción, para cualquier visitante sin `?torneo=` en su link --
     es decir, todos los participantes reales. Fix: `torneo-resolver.js`
     ahora tiene un `DEFAULT_TORNEO_ID = 'mundial2026'` explícito,
     inmune al orden de carga de los demás templates.
  2. **El cacheo en `localStorage` "secuestraba" el navegador de quien
     probara un link de otro tenant/torneo.** Tanto `TENANT_ID`
     (`index.html`, Sprint 10) como `torneo-resolver.js` (Sprint 9)
     cacheaban la elección de `?tenant=`/`?torneo=` en `localStorage`
     "para recordarla entre visitas". En la práctica, esto le pasó al
     propio admin real el mismo día: visitar UNA VEZ un link de prueba
     (`?tenant=euro-2028&torneo=euro-ficticio`) dejó ese navegador
     entrando silenciosamente al tenant de prueba incluso al volver a
     la URL real sin ningún parámetro -- el 2FA de la quiniela real
     "dejó de funcionar" porque en realidad se estaba autenticando
     contra el tenant equivocado. Fix: se sacó TODO el cacheo en
     `localStorage` de los 3 lugares que lo tenían (`index.html`,
     `torneo-resolver.js`, y el cacheo de `configGlobal.torneoId` en
     `_rgApplyCombinedSnapshot()`, `participantes.js`) -- sin
     `?tenant=`/`?torneo=` explícitos en el link, el comportamiento es
     100% predecible: SIEMPRE el tenant/torneo real, sin excepciones ni
     memoria de visitas anteriores en ese dispositivo. El único costo
     es repetir el parámetro cada vez que se quiera un tenant/torneo
     distinto del real (o guardarse el link completo) -- precio bajo
     comparado con el riesgo de romper el sitio real.

  Ambos fixes verificados con casos de test dedicados (no solo
  ajustados los existentes): `test_torneo_resolver.js` CASO 2 confirma
  el default explícito con los 3 templates cargados juntos, CASO 4
  confirma que un `localStorage` "contaminado" de una visita anterior
  no afecta una visita nueva; mismo criterio en `test_tenant_runtime.js`
  CASO 3. Suite completa verde (66 harnesses) después del fix.

- **Sprint 13 (un día después de los Sprints 8-12, 2026-08-05): "📋 Mis
  quinielas".** El usuario, ya usando "Crear nueva quiniela" contra
  Firebase real, preguntó dónde ver las quinielas (tenants) que ya
  había creado -- no existía ninguna vista para eso (Sprint 12 solo
  construyó "crear", nunca "listar"), y `tenants/{tenantId}` tenía
  `allow read: if false` sin excepción (ni el propio admin podía leer
  su tenant desde el cliente). Nueva regla: `allow read: if
  request.auth != null && resource.data.adminEmail ==
  request.auth.token.email` (Firestore evalúa esto POR DOCUMENTO tanto
  en `get()` como en `list()`/query -- una query sin filtro sobre
  `tenants` simplemente devuelve los que coinciden, no falla entera;
  aun así `app-admin-tenants.js` usa un `where('adminEmail','==',...)`
  explícito para que la query esté acotada desde el pedido mismo, no
  solo confiando en el filtrado de la regla). `update`/`delete` siguen
  en `if false`, sin cambios.

  `renderMisQuinielasCard()` (`app-admin-tenants.js`, nueva, arriba de
  "🏗️ Crear nueva quiniela" en el mismo container `#torneo-content`,
  mismo hook defensivo en `app-tabs.js`) usa `onSnapshot()` (no un
  `getDocs()` de una sola vez -- mismo criterio reactivo que el resto
  de la app) sobre `query(collection(db,'tenants'),
  where('adminEmail','==', fb.auth.currentUser.email))`. Todo lo que
  necesitó (`query`/`where`/`collection`/`onSnapshot`) ya estaba
  expuesto en `window.__fb` desde el bloque de Firebase de
  `index.html` -- no hizo falta agregar ningún import nuevo. Cada fila
  muestra el id del tenant, el nombre real de su plantilla (buscado en
  `TORNEOS_DISPONIBLES`, no el id crudo), fecha de creación, y un badge
  "actual" en el que coincide con `fb.TENANT_ID` (sin link de
  "Entrar" ahí -- ya estás adentro); el resto trae un link a
  `?tenant=<id>&torneo=<torneoId>`. Test: bloque "MIS QUINIELAS" en
  `sim_firestore_rules.js` (la regla en sí) + `test_mis_quinielas.js`
  (el render, con el mock de Firestore capturando el filtro real que
  se le pasa a `where()`). Suite completa verde (69 harnesses).

  **Pendiente manual, igual que cualquier cambio de `firestore.rules`**:
  esta regla nueva todavía no está publicada en Firebase Console al
  cerrar esta sesión -- sin publicarla, "Mis quinielas" muestra el
  mensaje de error ("puede que falte publicar la regla nueva") en vez
  de la lista.

- Cache-busting: cada archivo modificado necesita su contenido cambiado **y**
  el `?v=` correspondiente bumpeado en `index.html`, o el Service Worker
  (`sw.js`) sigue sirviendo la versión vieja desde caché para pedidos con
  `?v=` (esos se sirven cache-first a propósito; `index.html` sin `?v=` es
  siempre network-first).

### Modelo de seguridad / datos (Firestore)

- **Fase 3, milestone 1 (hoja de ruta comercial -- multi-tenant,
  2026-07-24):** todos los paths de Firestore quedaron anidados bajo
  `tenants/{tenantId}/...` (antes eran planos: `registro_participants`,
  `quiniela/estado`, etc.). `TENANT_ID` es una constante nueva en
  `index.html` (junto a `firebaseConfig`) — sigue siendo "un checkout
  estático por cliente" (un futuro cliente nuevo es clonar el repo y
  cambiar 2 constantes), NO un selector de tenant en runtime (eso es un
  milestone futuro). Los 8 refs de Firestore se construyen una sola vez
  ahí y se exponen en `window.__fb`; ningún otro archivo construye un
  path por su cuenta (excepción histórica ya corregida: el fallback de
  `_admin2faDocRef()` en `app-admin-auth.js` reconstruía el path viejo
  sin tenant — se sacó, ahora usa directo `fb.ADMIN2FA_DOC`).
  - Nuevo documento `tenants/{tenantId}` (`adminEmail`, `createdAt`) —
    reemplaza el email de admin que antes vivía hardcodeado como string
    literal en 7 bloques de `firestore.rules`. Se crea A MANO en
    Firebase Console (`allow read, write: if false` — nadie lo toca
    desde el cliente todavía). Si se borra por accidente, el admin
    queda bloqueado hasta recrearlo — mismo riesgo ya aceptado hoy con
    `registro/admin2fa`, ahora extendido a un documento más.
  - `firestore.rules` ganó un helper compartido `isAdmin()` (dentro de
    `match /tenants/{tenantId}`) que resuelve el email de admin vía
    `get()` contra ese documento, en vez de comparar un literal — cada
    tenant puede tener su propio admin sin tocar la lógica de las
    reglas. Cuesta 2 lecturas extra (`exists()`+`get()`) por escritura
    de admin; sin impacto real a esta escala (para un participante
    normal editando lo suyo, `isAdmin()` ni se evalúa por el short-circuit
    del `||`).
  - `sim_firestore_rules.js` ahora simula por tenant (`simIsAdmin(auth,
    tenantId)`, mapa `TENANTS` con un segundo tenant ficticio
    `"cliente-demo"`) y suma un bloque "AISLAMIENTO MULTI-TENANT" que
    prueba que el admin de un tenant nunca puede actuar como admin de
    otro (papelera, admin2fa, quiniela/estado, editar la quiniela de un
    participante ajeno) — mismo espíritu que el checkpoint de Copa
    América en Fase 1 (un segundo caso concreto prueba la
    generalización).
  - **Migración de datos: no se migró nada.** Los documentos en los
    paths viejos (planos) quedaron huérfanos a propósito — esta
    instancia es secundaria/de pruebas, sin participantes reales en
    juego, así que no valía la pena un script de migración (Admin SDK)
    ni el export/import de Firebase Console (que además requiere plan
    Blaze, contradice seguir en Spark). Para retomar las pruebas:
    recrear a mano `tenants/quinielitaborracha` (`adminEmail`,
    `createdAt`) y `tenants/quinielitaborracha/registro/admin2fa` (2FA
    nuevo) en Firebase Console ANTES de publicar `firestore.rules` — si
    las reglas nuevas se publican antes de que exista el documento
    tenant, `isAdmin()` da `false` para todos, admin incluido.
  - Explícitamente fuera de alcance de este milestone (futuros, no
    tocar todavía): Cloud Functions, alta automática/pago, custom claims
    de Auth, namespacing de `localStorage` (innecesario hasta que 2
    tenants puedan compartir un mismo origen).
  - **Sprint 10 (mismo roadmap, 2026-08-04): `TENANT_ID` en runtime.**
    `TENANT_ID` (`index.html`) dejó de ser el literal fijo
    `"quinielitaborracha"` — ahora resuelve por `?tenant=` de la URL →
    `localStorage.qb_tenant_activo` → ese mismo default, mismo patrón
    que ya usa `TEST_MODE`. Sin `?tenant=` ni caché, el comportamiento
    es idéntico al de siempre (cero riesgo para producción). El
    documento `tenants/{tenantId}` ganó una regla de auto-servicio:
    `allow create` (nuevo) exige que quien escribe se declare a sí
    mismo como `adminEmail` — una sesión anónima nunca tiene
    `request.auth.token.email`, así que nunca puede pasar esta
    condición; `read`/`update`/`delete` siguen en `if false` como
    siempre, así que nadie puede leer, recrear ni secuestrar un tenant
    ajeno con esto. `registro/meta.configGlobal` sumó `torneoId` (qué
    `torneo-<nombre>.js` usa este tenant, ver Sprint 9) —
    `_rgApplyCombinedSnapshot()` (`participantes.js`) lo cachea en
    `localStorage.qb_torneo_activo` apenas llega, para que el próximo
    load de ese dispositivo (sin `?torneo=` en la URL) ya resuelva la
    plantilla correcta. Tests: bloque "AUTO-SERVICIO DE TENANTS" en
    `sim_firestore_rules.js`, `test_tenant_runtime.js`.
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
