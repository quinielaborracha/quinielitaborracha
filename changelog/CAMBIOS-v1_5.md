# v1.5 — Mi Evolución reparado + Mi Quiniela ya no se corrompe al cambiar de pestaña

## Cómo aplicar esto
Reemplazá estos 3 archivos: `scoring.js`, `registro.js`, `index.html`. Todo lo demás sigue igual.

## Lo que estaba pasando (los dos bugs son la misma causa)

`registro.js` (el módulo de "Mi Quiniela") ya tenía escrito el panel **Mi Evolución**, pero las 5
funciones de cálculo de las que depende (`getChronoMatchEvents`, `buildHistoricalSnapshots`,
`groupSnapshotsByJornada`, `getTendenciaStats`, `getLogrosStats` — todas pensadas para vivir en
`scoring.js`, v6.6 "Fase B") no estaban en ningún `scoring.js` disponible. Cada vez que alguien entraba
a la sub-pestaña "Evolución", esas 5 funciones no existían → excepción → pantalla rota.

Y acá está la conexión con el otro bug: **la sub-pestaña activa de Mi Quiniela (`DASH_TAB`) es una
variable que nunca se resetea sola** al cambiar de pestaña principal (Ranking, Estadísticas, etc.). Si
en algún momento entraste a "Evolución" y explotó, esa sub-pestaña rota quedó "pegada" en memoria.
Además, el clic en las sub-pestañas de ADENTRO de Mi Quiniela (Perfil/Predicciones/Evolución) llamaba a
`renderParticipantDashboard()` directo, **sin ninguna red de seguridad** (a diferencia del camino por
el menú principal, que sí tenía un `try/catch` desde v6.5). Entonces: cualquier intento posterior de
volver a "Mi Quiniela" — desde cualquier camino — volvía a pisar el mismo error, una y otra vez, con la
vista a mitad de pintar. Único escape: refrescar toda la página (lo único que reinicia `DASH_TAB`).

## 1. Mi Evolución — las 5 funciones que faltaban (`scoring.js`)

Las escribí reutilizando al 100% el mismo motor ya probado que usás para la racha de aciertos y el MVP
de la jornada (`buildChronologicalResults`, `getPlayedDaysList`, `calcPtsForDay`, `calcElimMatchPts`) —
mismo criterio de "qué partido cuenta y cuándo", gateado por fase activa (`isFaseActiva`) partido por
partido, no una sola vez al principio. Por eso el panel ahora sigue funcionando sin cortes al pasar de
Grupos a Eliminatoria: es el mismo mecanismo que ya usás para MVP, que nunca tuvo ese problema.

Un detalle a propósito, documentado en el comentario grande que dejé en `scoring.js`: el ranking
"histórico" del gráfico de Evolución cuenta solo puntos de partidos (Básicos + Eliminatoria), igual que
ya hace `calcPtsForDay()` para el MVP — NO incluye predicciones especiales (campeón, goleador) ni bonos
de racha/último lugar, porque esos no tienen una fecha de partido puntual a la que atribuirse. Puede
hacer que la posición "histórica" del gráfico difiera un poquito de la posición oficial de HOY (que sí
incluye esos bonos) — es esperado, no un bug.

## 2. Mi Quiniela ya no queda pegada — recuperación automática (`registro.js`)

Moví el `try/catch` (mismo patrón que ya usás en `renderInicio`, v6.5) para que viva DENTRO de
`renderParticipantDashboard()`, envolviendo el cálculo de cada sub-pestaña (Perfil/Predicciones/
Evolución) — así protege **cualquier camino** que llegue ahí, incluidos los clics en las sub-pestañas
de adentro que antes no tenían ninguna protección. Y lo más importante: si algo explota, ahora
**resetea `DASH_TAB` a `'perfil'` automáticamente**, así que el cartel de "Reintentar" (o simplemente
volver a entrar a Mi Quiniela desde el menú) realmente recupera la sección en vez de repetir el mismo
choque en bucle. Ya no hace falta refrescar la página.

Esto arregla el síntoma que reportaste directamente, y además deja una red de seguridad genérica para
cualquier error futuro en el Dashboard del participante (no solo el de Evolución).

## 3. Número de versión visible (`index.html`)

El badge del header (`Quinielita Borracha vX.X`, al lado del logo) ya existía — solo lo actualicé a
`v1.5`. Cache-busting (`?v=`) bumpeado en `scoring.js` y `registro.js`, los dos archivos que cambiaron.

## Pruebas hechas antes de entregar esto

- `node --check` en ambos archivos — sintaxis OK.
- Harness de carga completa (`test_full_page_load.js`, los 22 archivos en orden de producción,
  scope compartido) — sin errores nuevos respecto a la versión sin este fix.
- Test funcional nuevo (`test_evolucion_v1_5.js`, incluido junto a este changelog): arma 5
  participantes, 6 partidos de Grupos + 2 de Eliminatoria jugados, y confirma en el DOM real:
  - `getChronoMatchEvents()` no explota con Grupos+Eliminatoria mezclados.
  - El panel de Evolución se pinta bien justo después de la transición de fase (el repro exacto
    de tu reporte).
  - Con un error forzado a propósito, ya NO queda pantalla corrupta: aparece el cartel de
    "Reintentar", `DASH_TAB` se resetea solo, y el siguiente render ya funciona — sin refrescar
    la página.

Igual, dado que no pude confirmar 1:1 contra tu `scoring.js` real de producción (no lo tenía
disponible), probá esto primero en tu sitio en **"🧪 MODO PRUEBA"** antes de darlo por definitivo —
sobre todo el panel de Evolución con datos reales de varios participantes.
