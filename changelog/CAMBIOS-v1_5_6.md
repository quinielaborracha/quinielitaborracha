# v1.5.6 — Fase 3: proceso, CI, y las 3 fallas de test resueltas de verdad

## Cómo aplicar esto
Archivos nuevos: `package.json`, `package-lock.json`, `check-syntax.js`, `run-tests.js`,
`.gitignore`, `.github/workflows/tests.yml`. Modificados: `app-live-sync.js`, `index.html`,
`README.md`, `test_full_page_load.js`, `test_import_correos_claves.js`,
`test_registro_creacion_confirmada.js`. No toca `firestore.rules` — el fix de `app-live-sync.js`
tampoco requiere republicar reglas, es lógica de cliente.

Después de subir esto: `npm install` una vez (baja jsdom, ~1s), y listo — `npm run verify` corre
lo mismo que corre CI.

## 1 y 3 primero, porque se descubrieron en el orden inverso al pedido
Arranqué por el punto 3 (diagnosticar las fallas) antes que el 1 (`package.json`), porque no tenía
sentido escribir `npm test` sin saber todavía qué tests iban a quedar rotos a propósito y cuáles
no. Van los tres, en orden de lo que encontré:

### `test_full_page_load.js` — ruido de fixture, no un bug real
Dos problemas, los dos de la fixture del test (el HTML mínimo que arma para simular la página),
no del código de producción:
- Le faltaba `#em_continue` (y varios elementos más que `registro.js` toca al cargar) — mismo tipo
  de problema que ya había resuelto en mi propio test de la Fase 0 (`test_xss_escape_v1_5_3.js`).
  Completé el HTML mínimo con el mismo set de elementos ya validado ahí.
- Dos checks (`_suppressNextFirestoreEcho`/`_lastPushedStateJSON`) fallaban de verdad — ver
  siguiente sección, esto no era ruido.

### `_suppressNextFirestoreEcho` → `_lastPushedStateJSON` (`app-live-sync.js`) — esto sí era un bug real
El test documentaba explícitamente (con ese mismo nombre de variable, y un comentario que dice
"mecanismo de eco por contenido") un rediseño que evidentemente se planeó y se dejó probado, pero
**nunca se implementó** en el código real. Encontré la bandera vieja todavía viva en producción.

El diseño viejo (`_suppressNextFirestoreEcho`, una bandera booleana) asumía *"el próximo snapshot
que llegue después de que yo escribo es mi propio eco"* — una suposición basada en **orden**, y
ese supuesto es frágil con Firestore real: el SDK dispara `onSnapshot` **dos veces** por cada
escritura propia (una desde el caché local, con `hasPendingWrites:true`; otra cuando el servidor
confirma), y si llegaba una escritura genuina de otro admin justo en el medio de esas dos, la
bandera podía terminar suprimiendo el snapshot equivocado — o dejando pasar sin aplicar un cambio
remoto real.

Implementé el mecanismo que el test ya esperaba: `_lastPushedStateJSON` guarda el JSON exacto que
acabamos de escribir; cuando llega un snapshot, se compara su contenido contra eso — si coincide
byte a byte, es nuestro propio eco (sin importar el orden ni cuál de los dos disparos del SDK sea);
si no coincide, es un cambio remoto genuino y se aplica. Comparación por **contenido**, no por
**orden** — estrictamente más robusto, y además cierra el caso del doble-disparo del SDK sin
re-renderizar de más. Tocó 3 puntos de `app-live-sync.js`: `pushStateToFirestore()`,
`seedTestStateFromProduction()` (Modo Prueba) y el listener de `wireFirestoreSync()`.

### `test_import_correos_claves.js` — la función se renombró y el test no se actualizó
`importarCorreosClaves()` ya no existe — se renombró a `importarInfoParticipantes()` en la v1.5.1,
cuando "Exportar correos y claves" (.csv, solo correo+clave) pasó a ser "Exportar info de
participantes" (.json, con compatibilidad hacia atrás para leer el .csv viejo). El test seguía
llamando al nombre viejo.

Lo interesante: **los mocks que hacían falta para el comportamiento nuevo ya estaban puestos** en
el test (`window.confirm`, `window.URL.createObjectURL`, `window.Blob` — todo lo que
`importarInfoParticipantes()` necesita porque ahora pide confirmación y descarga un backup
automático antes de aplicar el import, cosas que la función vieja no hacía). Alguien —
probablemente en una sesión anterior — ya había dejado el test listo para el rename y no llegó a
terminarlo. Solo hizo falta cambiar las 4 referencias al nombre de la función; verifiqué a mano
que el formato CSV que arma el test (columnas `Nombre/Correo/Codigo/Clave/Estado`) sigue siendo
exactamente el que `importarInfoParticipantes()` acepta por compatibilidad hacia atrás.

De paso reemplacé el `console.error` esperable de un mensaje de jsdom no relacionado
("Not implemented: navigation a otro Document", por el `<a href="blob:...">.click()` del backup
que jsdom no sabe simular) por un `VirtualConsole` con `jsdomErrors: "none"` — dejaba pasar
igual cualquier `console.error` real del código de la app, pero no ese ruido puntual de jsdom.

### `test_registro_creacion_confirmada.js` — un campo se dividió en dos
`#r_name` ya no existe — se dividió en `#r_nombre` + `#r_apellido` (el "split Nombre/Apellido" que
ya está documentado como cambio de v1.1). Actualicé `fillForm()` para llenar los dos campos,
reusando `splitName()` — la misma función que ya usa el resto de la app para ir de nombre completo
a {nombre, apellido} — en vez de inventar una regla de partido propia del test que se desincroniza
de la real con el tiempo.

**Resultado: los 9 `test_*.js` + `sim_firestore_rules.js` (10 en total) pasan, todos, por primera
vez en la historia documentada del proyecto.**

## 1. `package.json` + `package-lock.json`
`jsdom` como devDependency, **fijado a la versión exacta ya validada** (`29.1.1`, sin `^`) — no un
capricho: arreglando el punto anterior me encontré en carne propia con que la API de
`VirtualConsole` cambió de nombre de método entre versiones de jsdom (`sendTo` en versiones viejas,
`forwardTo` en la 29.x) — un `npm install` futuro con rango abierto podría actualizar jsdom solo y
romper un test sin que nadie tocara una línea de código de la app. `package-lock.json` incluido
para que la instalación sea reproducible byte a byte y para que el cache de npm en el workflow de
CI tenga algo determinístico contra qué cachear.

Scripts:
- `npm run check` → `node check-syntax.js` (`node --check` en todos los `.js` del proyecto,
  detecta el archivo automáticamente por glob, no por una lista a mano que hay que acordarse de
  actualizar)
- `npm test` → `node run-tests.js` (los 10 harnesses, resumen final)
- `npm run verify` → los dos anteriores, uno atrás del otro (lo mismo que corre CI)

Ambos runners (`check-syntax.js`, `run-tests.js`) son scripts de Node chicos, no una línea de shell
con `for`/`&&` en `package.json` — así corren igual en Windows/Mac/Linux/CI sin depender de qué
shell esté disponible.

## 2. GitHub Actions (`.github/workflows/tests.yml`)
Corre `npm run check` + `npm test` en cada push a `main` (lo pedido) **y también en cada pull
request contra `main`** (agregado): así un cambio se valida antes de mezclarse, no después. Gratis
en repos públicos. Esto es exactamente lo que habría atrapado automáticamente, en su momento, el
incidente de código desactualizado que rompió una entrega anterior — la razón original por la que
este punto está en el roadmap.

## `.gitignore`
El proyecto no tenía ninguno — nunca había hecho falta hasta que apareció `node_modules` con este
cambio. Si ya subiste `node_modules` a git antes de bajarte este `.gitignore`, hace falta sacarlo
del historial a mano una vez (`git rm -r --cached node_modules`) — el archivo por sí solo no
retroactivamente deja de trackear algo que ya estaba commiteado.

## README.md
Sección nueva "Tests" con los comandos de arriba, y la sección de Convenciones actualizada para
referenciar `npm run verify` en vez de la instalación manual de jsdom en un scratch directory que
hacía falta hasta ahora.

## Cobertura de tests
Los 10 harnesses (9 `test_*.js` + `sim_firestore_rules.js`) pasan. `node --check` limpio en los 37
`.js` del proyecto (`npm run check`). Verificado también en un entorno limpio de verdad (`npm
install` desde cero en un directorio nuevo, sin nada cacheado) para confirmar que lo que va a
correr en CI corre igual acá.

## Qué NO se hizo
- No se tocó `firestore.rules`.
- No se agregó un linter (ESLint/Prettier) ni un bundler — fuera de lo pedido para esta sesión, y
  el proyecto sigue siendo vanilla JS sin build step a propósito (decisión ya tomada, documentada
  en `README.md`).
- `app.js`/`split.js` (recomendado borrar en la Fase 1) no se re-tocaron acá — si todavía siguen en
  el repo, `check-syntax.js` los va a revisar igual (son `.js` válidos, no rompen nada), pero es
  buen momento para terminar de sacarlos si no se hizo todavía.
