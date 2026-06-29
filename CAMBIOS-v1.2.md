# v1.2 — Quinielas que comienzan desde cualquier fase

## Cómo aplicar esto
Reemplaza estos 11 archivos en tu repo (mismos nombres, no renombré nada) y publica `firestore.rules`
**sin tocarlo** — no hizo falta ningún cambio ahí, la regla de `registro/meta` ya protege `configGlobal`
completo (incluida la nueva `fasesActivas`) para que solo el admin pueda escribirlo.

Archivos modificados:
`participantes.js`, `scoring.js`, `app-tabs.js`, `app-batallas.js`, `app-bracket-render.js`,
`app-bracket-espn-sync.js`, `app-bracket-view.js`, `app-admin-tools.js`, `app-bootstrap.js`,
`registro.js`, `index.html`.

Subí su `?v=` a `1.2` en `index.html` (ya incluido). Los demás archivos del proyecto (`utils.js`,
`app-core-data.js`, `app-eliminatoria-data.js`, `app-predicciones.js`, `app-estadisticas.js`,
`app-integridad.js`, `app-admin-auth.js`, `app-live-sync.js`, `app-bracket-espn-live.js`,
`partidos-grupos.js`, `totp.js`, `app-bracket-compute.js`) **no se tocaron**.

⚠️ **`app-bracket-compute.js` no estaba entre los archivos que me compartiste** (índex.html lo
referencia pero no estaba en `/mnt/project`), así que no pude revisarlo. Por lo que sí pude inferir
de sus llamadores (`generarLlavesDieciseisavos()`, el botón "🧮 Generar llaves de Dieciseisavos" en
Fixture → Eliminatoria), ese botón depende de `allGroupsComplete()` para habilitarse — si "Fase de
grupos" está desactivada, debería quedar deshabilitado solo, sin romper nada. Pero no puedo
garantizarlo al 100% sin ver ese archivo. Pásamelo si quieres que lo revise.

## Qué se construyó

**Dato nuevo, con migración 100% automática:** `DB.configGlobal.fasesActivas` —
`{grupos, r16, r8, qf, sf, third, final}`, todas en `true` por defecto. Se agregó al
`RG_DEFAULT_CONFIG` de `participantes.js`, que ya se mezcla con lo guardado tanto al cargar de
caché local como al llegar de Firestore — por eso **ningún torneo existente necesita ningún paso de
migración manual**: simplemente no va a tener la clave, y el merge le pone el default (todo activo).

**Pestaña nueva — "⚙️ Configuración del torneo"** (junto a Fixture/Predicciones/Bonos/Integridad/Admin,
solo-admin): el checklist que pediste. Cada fase es un switch; al tocarlo se guarda al toque vía el
mismo mecanismo que ya usan los demás switches del panel Admin (local + Firestore, protegido por las
reglas existentes).

**Una sola fuente de verdad, reutilizada en todas partes** (`scoring.js`):
- `isFaseActiva(key)` — lee `fasesActivas`, default `true` si no existe la clave.
- `getActivePhases()` / `getActiveElimRounds()` — `BONUS_PHASES`/`ELIM_ROUNDS` filtrados.
- `getManualTeamPids()` — antes esto era siempre Dieciseisavos (`ELIM_1_16_IDS`) a fuego; ahora es
  "los partidos de la primera fase de eliminatoria activa". Si todo está activo es exactamente lo
  mismo de siempre. Si Dieciseisavos (y/o Grupos) están apagados, pasa a ser Octavos (o lo que sea
  que arranque) — y **automáticamente** el editor de llaves admin, el ESPN Live, y el cálculo de
  "equipos reales" (`getRealElimTeams`) empiezan a operar sobre esa fase, sin que tuviera que tocar
  esas piezas por separado: todas leen de esta misma función.
- `isPrevPhaseClosed()` ahora trata una fase previa **desactivada** como "ya resuelta" — esto es lo
  que evita que, por ejemplo, Cuartos quede bloqueado para siempre esperando que se "cierre" una
  fase de Octavos que en este torneo no existe.

Con esos cambios, **todo lo demás** (panel de Bonos, fixture admin, bracket por participante,
estadísticas del bracket, ESPN Live, el wizard de Mi Quiniela) los reutiliza sin duplicar nada — solo
tuve que cambiar **dónde leen** "qué fases hay" y "de dónde salen los equipos", no la lógica de
puntaje en sí.

## El wizard de "Mi Quiniela" (lo más delicado)

Esto tiene su propio bracket "simulado" por cada participante (se arma desde SUS PROPIOS marcadores
de grupo). Si Grupos/Dieciseisavos están apagados, no hay marcadores propios de los que armar nada
— así que ahora, para la **primera fase de eliminatoria activa**, el wizard:
- Le muestra al participante los **equipos REALES** del torneo (los mismos que carga el admin en
  Fixture → Eliminatoria, a mano o por ESPN Live) — confirmaste que querías esto.
- Sigue dejando que el participante prediga el **resultado** de cada cruce, normal.
- Todo lo que viene después (Cuartos, Semis, Final) se encadena exactamente igual que siempre, desde
  los ganadores que el participante fue prediciendo.

Los pasos del wizard (Fase de grupos, Dieciseisavos, etc.) que correspondan a una fase desactivada
**desaparecen** del wizard, de la barra de progreso, del PDF, y de "Mi Quiniela" — y los botones
Anterior/Siguiente saltan derecho a los pasos que sí existen.

**Importante para el flujo de trabajo del admin:** si arrancas un torneo en Octavos, cargá los
equipos reales de Octavos (Fixture → Eliminatoria → ✏️ Editar llaves, o ⚡ ESPN Live) **antes** de
que la gente entre a predecir esa fase — si todavía no los cargaste, el wizard les muestra
"Pendiente" en vez de trabarse.

## Qué NO toqué (a propósito, para no agrandar el alcance)

- El texto fijo de la pestaña "Reglas" (las 4 líneas de `ELIMRULES`/`LASTRULES`) sigue mencionando
  todas las fases por nombre, activas o no — es contenido descriptivo, no afecta cálculo de puntos.
  Lo dejo para cuando construyamos los switches de reglas que mencionaste.
- Las tarjetas de "📊 Estadísticas → 🃏 Tarjetas" (Pts grupos, Mejor grupo) — si Grupos está
  desactivada, esos números simplemente quedan en 0 en vez de desaparecer la tarjeta entera. No
  rompe nada ni miente, pero no es 100% prolijo. Aviso si quieres que lo pula también.
- `firestore.rules` — no necesitó ningún cambio.

## Cómo lo verifiqué
- `node --check` en los 11 archivos — sin errores de sintaxis.
- Harness de carga completa del proyecto (`test_full_page_load.js`, los 22 archivos en el orden real
  de producción, mismo scope global que el navegador) — carga limpia, sin errores nuevos respecto a
  la versión sin modificar (los 2 ❌ que aparecen ya existían antes de mis cambios, no son míos).
- Prueba dirigida del motor de puntaje: con Grupos + Dieciseisavos desactivados, `getManualTeamPids()`
  pasa a devolver los partidos de Octavos, `getRealElimTeams()` lee los equipos cargados a mano,
  `isPrevPhaseClosed()` para Cuartos ya no queda bloqueado esperando a Dieciseisavos.
- Prueba dirigida del wizard: con la misma configuración, el bracket del participante arranca en
  Octavos con los equipos reales que "cargó el admin" en la prueba, el participante predice el
  ganador, y Cuartos se encadena solo desde ese resultado — y los pasos de Grupos/Dieciseisavos no
  aparecen en la lista de pasos visibles del wizard.

Si activas todas las fases de nuevo, todo vuelve a comportarse exactamente como hoy — no hay ninguna
ruta de código nueva que se ejecute cuando todo está activo (lo confirmé revisando cada cambio: la
condición "todo activo" siempre cae en el camino de código de siempre, sin pasar por ninguna de las
piezas nuevas).
