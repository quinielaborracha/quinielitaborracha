# Quinielita Borracha

Instancia nueva y limpia de la quiniela del Mundial 2026, basada en el motor
de "Quiniela Borracha 2026" v7.2 — mismo código, sin participantes
precargados ni herramientas de migración (arranca desde cero para registrar
gente nueva).

## Archivos que el sitio realmente carga (los únicos referenciados por `index.html`)

```
participantes.js → torneo-mundial2026.js → partidos-grupos.js → utils.js → paises.js →
  app-static-data.js → app-state.js → scoring.js → totp.js →
  app-core-data.js → app-admin-auth.js → app-live-sync.js → app-tabs.js →
  app-eliminatoria-data.js → app-batallas.js → app-bracket-render.js →
  app-bracket-annexc.js → app-bracket-compute.js → app-bracket-espn-sync.js → app-bracket-view.js →
  app-bracket-espn-live.js → app-integridad.js → app-predicciones.js →
  app-estadisticas.js → app-admin-tools.js → app-bootstrap.js →
  registro.js
```

- `index.html` — estructura, `firebaseConfig`, loader, modales (login + 2FA)
- `styles.css` — estilos
- `participantes.js` — capa de datos compartida (`DB.participants`), Mi Quiniela
- `torneo-mundial2026.js` — **la config del torneo en curso**: un solo objeto `TORNEO_ACTUAL` (nombre genérico desde el Sprint 5, 2026-07-23 — antes `TORNEO_MUNDIAL_2026`; la identidad del torneo vive en sus campos `id`/`nombre`, no en el nombre de la variable) con el fixture completo del Mundial 2026. `groupMatches` (72 entradas `{id,g,a,b}`) es la fuente ÚNICA de los partidos de grupos — `matchLabels`/`mgmap` se derivan de ahí mismo (antes eran diccionarios paralelos + una tercera copia en `registro.js`, coincidentes por disciplina manual, no por construcción). También trae `espnAbbrMap`/`midAbbrs`/`ges`/`arules`/`espnGameIdToPid`/`bracketFormat`/`groupKeys`/`elimRounds`/`elimTree`/`bonusPhases`. Sprints 2/3b/4a/4b/5 de la hoja de ruta comercial: consolida lo que antes vivía repartido entre `partidos-grupos.js`, `app-static-data.js`, `app-eliminatoria-data.js`, `registro.js` y `app-live-sync.js`. Un futuro segundo torneo (Copa América, Euro — ver `torneo-copaamerica.js`) trae su propio objeto `TORNEO_ACTUAL` en su propio archivo, sin tocar `scoring.js`/`utils.js`/`app-bracket-*.js`/`registro.js` — nunca se cargan dos archivos `torneo-*.js` a la vez.
- `partidos-grupos.js` — reasigna `MATCH_LABELS` desde `TORNEO_ACTUAL.matchLabels` (re-export delgado; el dato en sí vive en `torneo-mundial2026.js`). Reemplaza al viejo `legacy-migracion.js` del proyecto original, que sí traía datos personales de 27 participantes — por diseño, **no se incluye acá**.
- `utils.js` — helpers puros (validación, checksums)
- `paises.js` — datos de país agnósticos de torneo: `TEAM_NAMES`, `ESPN_NAME_ES`, `ALL_FLAGS`, `AVATAR_MAP`. Sprint 1 de la hoja de ruta comercial: separado de `app-static-data.js` para que un futuro segundo torneo reuse esta misma base sin duplicarla. Carga temprano porque `utils.js` ya depende de estos globals en `abbr2name()`/`espnNameES()`.
- `app-static-data.js` — reasigna `ESPN_ABBR_MAP`/`MID_ABBRS`/`MGMAP`/`GES`/`ARULES` desde `TORNEO_ACTUAL` (mismo patrón que `partidos-grupos.js`). `FLAGS2`/`ABBR`/`BGCOL` quedan con su valor literal acá — un set más chico, no específico del fixture del torneo en curso.
- `app-state.js` — declara `S`, el objeto de estado mutable compartido (resultados reales, checksums, bonos, batallas, snapshots — lo que persiste en `quiniela/estado`). Va justo antes de `scoring.js`, su mayor consumidor.
- `scoring.js` — cálculo de puntos / standings / bracket
- `totp.js` — funciones puras de TOTP (2FA admin, RFC 6238)
- `app-*.js` (16 archivos) — lógica principal: ranking, estadísticas, panel admin, Batallas. **v8.0** — hasta la v7.x esto era un único `app.js` de 3906 líneas; se dividió en 16 módulos de responsabilidad única (Sprint 1, roadmap de arquitectura), cada uno un slice contiguo y literal del `app.js` anterior, sin cambios de lógica (verificado byte a byte). Cargan en el mismo orden relativo exacto en que estaban dentro del archivo único — ese orden importa: comparten el scope global del navegador entre sí, igual que ya hacían participantes.js/utils.js/scoring.js/totp.js. **`app-bootstrap.js` debe ser siempre el último**: hace el primer render llamando funciones definidas en todos los módulos anteriores. **v1.7** — el `app.js` monolítico se borró del repo (ya no lo cargaba nada; historial completo vía `git log`) y `S`/`mmT`/`mmS`/colas de conflicto ESPN, que vivían sueltas en `app-admin-auth.js` por accidente de orden del monolito original, se movieron a `app-state.js`/`app-bracket-espn-live.js`/`app-bracket-espn-sync.js` respectivamente. El detalle de qué contiene cada uno:
  - `app-core-data.js` — construye los globales dinámicos `PL`/`PM`/`MD`/`MIDS` (`rebuildDynamicData()`/`flagOfChampion()`); los datos de referencia que antes vivían acá se movieron a `app-static-data.js`
  - `app-admin-auth.js` — Firebase Auth (admin) + 2FA TOTP
  - `app-live-sync.js` — sincronización Firestore en vivo, Modo Prueba, guardar resultado (validación + checksum)
  - `app-tabs.js` — navegación entre pestañas
  - `app-eliminatoria-data.js` — datos/constantes de la fase eliminatoria + config de Bonos
  - `app-batallas.js` — duelos diarios 1 vs 1
  - `app-bracket-render.js` — fixture de eliminatoria + editor manual de llaves + simulación
  - `app-bracket-annexc.js` — declara `ANNEX_C`, la tabla oficial de FIFA con las 495 combinaciones de terceros de grupo. Puro dato, sin funciones; va justo antes de `app-bracket-compute.js`, su único consumidor.
  - `app-bracket-compute.js` — cálculo automático de llaves de dieciseisavos
  - `app-bracket-espn-sync.js` — sync ESPN de eliminatoria + conflicto de llave
  - `app-bracket-view.js` — render del bracket por participante
  - `app-bracket-espn-live.js` — sync ESPN en vivo con protección de conflictos
  - `app-integridad.js` — panel de integridad (checksums, validación de rangos)
  - `app-predicciones.js` — predicciones/avanzado/reglas + goleadores
  - `app-estadisticas.js` — export imagen, snapshots, estadísticas
  - `app-admin-tools.js` — editar participante (admin) + backup/restore JSON
  - `app-bootstrap.js` — toggle de tema, atajo Escape, y el bootstrap final (primer render + listeners + arranque de Firebase)
- `registro.js` — wizard de registro + "Mi Quiniela"

Soporte: `manifest.json`, `sw.js` (PWA), `favicon.png`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`.

`firestore.rules` **no se sube a GitHub Pages** — se pega en Firebase Console
→ Firestore Database → Reglas.

## Qué NO incluye (intencional)

- Ningún dato de participantes reales (ni nombres, ni predicciones, ni links).
- El panel admin no tiene "Migración del sistema anterior", "Corregir
  Campeón/Subcampeón/3er lugar" ni "Migración de privacidad" — eran
  herramientas de mantenimiento del proyecto original que no aplican a una
  instancia que arranca limpia.
- Tests (`test_*.js`, `sim_firestore_rules.js`): no los carga `index.html`,
  viven en el repo solo como harness de verificación para desarrollo futuro.
- `torneo-copaamerica.js`: tampoco lo carga `index.html` (esta instancia
  sigue siendo Mundial 2026). Es el checkpoint del Sprint 4c de la hoja
  de ruta comercial (ver `CLAUDE.md`) — un segundo torneo completo con
  datos ficticios (16 equipos, formato "directo a cuartos") que prueba
  que el motor soporta un formato de bracket distinto al del Mundial,
  ejercitado por `test_copa_america_e2e.js`.

## Antes de que funcione

1. Reemplazar los placeholders de `firebaseConfig` en `index.html` (línea
   ~33) con los valores reales del proyecto Firebase `quinielitaborracha`.
2. Publicar `firestore.rules` en Firebase Console.
3. Habilitar Authentication → Sign-in method → **Email/Password** y
   **Anonymous**.
4. Crear el usuario admin (correo+contraseña) en Authentication.
5. Crear a mano el documento `registro/admin2fa` en Firestore con el
   secreto TOTP (ver detalle completo en la conversación con Claude que
   armó este pack).
6. Habilitar GitHub Pages en este repo (rama `main`, carpeta raíz).

## Tests

**v1.5.6** — el proyecto tiene `package.json` (jsdom como devDependency) y
un workflow de GitHub Actions que corre en cada push/PR contra `main`. Antes
de esto había que instalar `jsdom` a mano en un scratch directory para poder
correr los `test_*.js` — ya no.

```bash
npm install       # una sola vez (o cuando cambie package-lock.json)
npm run check     # node --check en todos los .js del proyecto
npm test          # los 10 harnesses (9 test_*.js + sim_firestore_rules.js), con resumen final
npm run verify    # check + test, uno atrás del otro (lo mismo que corre CI)
```

Los tests son harnesses funcionales con `jsdom`: cargan los archivos de
producción reales como `<script>`, en el mismo orden y scope global que
`index.html`, contra un mock de Firebase en memoria — no son mocks
superficiales de "existe la función", ejercitan el flujo real (batches
atómicos, reglas de `registro_privado`, 2FA, etc.). `sim_firestore_rules.js`
es aparte: reimplementa a mano la lógica booleana de `firestore.rules` para
verificar que el razonamiento de cada regla es consistente (no reemplaza
probarlo con el emulador real o tráfico real antes de publicar reglas
nuevas).

CI (`.github/workflows/tests.yml`) corre `npm run check` y `npm test` en
cada push/PR a `main` — gratis en repos públicos. Esto es lo que habría
atrapado automáticamente, en su momento, el incidente de código
desactualizado que rompió una entrega anterior.

## Convenciones del proyecto (igual que el original)

- Cache-busting: cada archivo modificado necesita su contenido cambiado
  **y** el `?v=` en `index.html` bumpeado, o el Service Worker (v1.0+, ver
  `sw.js`) seguirá sirviendo la versión vieja desde caché.
- Todo el código, comentarios, toasts y textos de UI están en español.
- `npm run verify` (`node --check` en todo + los 10 harnesses jsdom) es el
  gate de verificación antes de cualquier entrega — corren los 22 archivos
  de producción en el mismo orden y scope global que el navegador real. CI
  corre lo mismo automáticamente en cada push/PR a `main`.
