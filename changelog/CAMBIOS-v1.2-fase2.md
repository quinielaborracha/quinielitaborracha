# v1.2 (Fase 2) — Menos botones + Reglas de puntaje editables

## Cómo aplicar esto
Reemplaza estos 6 archivos (mismos nombres de siempre):
`participantes.js`, `scoring.js`, `app-tabs.js`, `app-batallas.js`, `app-admin-tools.js`, `index.html`.

Los demás archivos de la Fase 1 (`app-bracket-render.js`, `app-bracket-espn-sync.js`,
`app-bracket-view.js`, `app-bootstrap.js`, `registro.js`) **no cambiaron en esta fase** — sigue usando
las versiones que ya te entregué. `firestore.rules` tampoco necesitó ningún cambio (la regla de
`registro/meta` ya cubre cualquier sub-clave nueva dentro de `configGlobal`, incluida `reglas`).

## 1-3. Menos botones en el menú principal

"🎁 Bonos", "🔒 Integridad" y "⚙️ Configuración del torneo" ya no son pestañas del menú principal —
ahora viven **dentro de "🛠️ Admin"**, como sub-pestañas (mismo patrón que ya usan Fixture/Predicciones
con sus propias sub-pestañas). El menú principal pasó de 12 botones a 9.

No reescribí ningún panel: cada uno sigue siendo exactamente la misma función de siempre
(`renderBonosPanel()`, `renderIntegPanel()`, `renderTorneoConfig()`) — solo cambié **dónde cuelgan**
en el HTML y quién las muestra/oculta (`adminSubTab()`, nueva, en `app-tabs.js`). Si entras a Admin y
vuelves a salir, recuerda en qué sub-pestaña te quedaste.

## 4-5. Reglas de puntaje, editables con switches y números

Dentro de "Admin → ⚙️ Configuración del torneo" ahora hay 5 tarjetas nuevas:

- **🎯 Puntos base** — Ganador/Empate/Exacto de Grupos, y Llave/Ganador/Empate/Exacto de Eliminatoria.
  Son los valores de SIEMPRE (2/3/3 y 2/2/3/3) — ahora editables, no nuevos.
- **🏅 Puntos por fase** — Clasificado, Llave y Último lugar de cada fase activa. También eran valores
  fijos de siempre (ej. Octavos clasificado=4, Cuartos clasificado=6) — ahora editables por fase.
- **⭐⭐⭐⭐⭐ Multiplicador por ronda** — NUEVO, switch (apagado por defecto). Multiplica los puntos de
  "Ganador/Empate" + "Marcador exacto" de cada partido de eliminatoria. **Importante: no multiplica
  llave/cruce ni clasificado** — esos premian otra cosa (adivinar el cruce / adivinar quién avanza),
  no el marcador.
- **⭐⭐⭐⭐⭐ Racha de aciertos** — NUEVO, switch (apagado por defecto). 3 hitos editables (3/5/8 por
  defecto, con sus puntos). Ver nota de interpretación abajo.
- **⭐⭐⭐⭐⭐ MVP de la ronda** — NUEVO, switch (apagado por defecto). 1 bono editable por día ganado.

Todo guarda al toque (mismo mecanismo de siempre: local + Firestore, protegido por las reglas
existentes), y todo arranca con el comportamiento de **antes de este cambio** — nadie nota nada hasta
que tú toques un número o prendas un switch.

## Decisiones que tomé (avísame si querías otra cosa)

**Multiplicador — la tabla que me diste no calza con el puntaje actual.** Tu ejemplo dice "marcador
correcto en Octavos = 5pts", pero hoy un marcador exacto en Octavos ya da 2(llave)+2(ganador)+3(exacto)=7,
u 8 si fue empate. No quise reinventar la escala de puntos para forzar que el ejemplo cuadre exacto —
en cambio, el multiplicador se aplica sobre los puntos base que YA configuraste arriba (Ganador/Empate
+ Exacto). Si quieres que un marcador exacto en Octavos sea literalmente 5 y en la Final 25, juega con
los puntos base de Eliminatoria + el multiplicador hasta que la cuenta te cierre (ej. base
Ganador+Exacto=5 con multiplicador Octavos×1 = 5; Final×5 = 25) — o dime y lo ajusto por ti.

**Racha — interpreté que los hitos se ACUMULAN dentro de la misma racha**, no que solo cuenta el
último alcanzado. Con los valores por defecto, una racha de 8 aciertos seguidos da 3+6+10=19pts en
total (al llegar a 3 suma 3, sigue, al llegar a 5 suma 6 más, sigue, al llegar a 8 suma 10 más). Si
cae a 0 y vuelve a subir, se vuelve a contar desde el hito 3. Avísame si querías que solo se pague el
hito MÁS ALTO alcanzado (no acumulado) y lo cambio — es un ajuste de una sola función
(`calcRachaBonos`, `scoring.js`).

**"Acierto" para la racha** = igual criterio que ya usa el motor para dar puntos de "Ganador/Empate":
en grupos, pegarle a ganador/empate/visita (no exige marcador exacto); en eliminatoria, además
necesita llave o cruce correcto. Los partidos sin resultado todavía simplemente no cuentan (ni suman
ni cortan la racha) — para cuando se jueguen, sí entran en su lugar cronológico.

**MVP — "jornada" lo interpreté como día de calendario** (no como una fase completa), usando la hora
real de cada partido (`S.matchTimes`/`S.elimTimes`, las mismas que ya usa "⚡ En vivo"/Batallas). Si
varios quedan empatados en el máximo de puntos de un día, **todos** reciben el bono completo (no se
reparte). Un día sin ningún partido jugado, o donde el máximo es 0pts, no otorga MVP a nadie.

## Qué NO toqué (a propósito)
- Los puntos de "Avanzado" (Campeón, Goleador, etc.) — no estaban en tu lista de reglas a mover, y
  tienen su propio set de 6 valores que no mencionaste. Si los quieres en el mismo panel, lo agrego
  en una próxima pasada.
- El texto fijo de la pestaña "Reglas" (visible para todos) sigue mostrando los valores VIEJOS en
  prosa, no los editables — sigue siendo contenido descriptivo, no afecta el cálculo. Dímelo si
  quieres que se actualice dinámicamente con lo que configures acá.

## Cómo lo verifiqué
- `node --check` en los 5 archivos `.js` tocados — sin errores de sintaxis.
- Harness de carga completa del proyecto (22 archivos, orden real de producción) — sin errores nuevos
  respecto a la entrega de Fase 1.
- Prueba dirigida con 3 participantes simulados confirmando, en este orden: puntos base de grupos
  (ganador/empate/exacto) calculan igual que antes; racha de aciertos otorga 3+6=9pts en una racha de
  5 seguidos (hitos default); MVP otorga el bono a quien lidera cada día, incluso con empate; y el
  multiplicador ×5 en una fase aplica solo a Ganador (2→10) y Marcador exacto (3→15), dejando la Llave
  intacta en 2 — total 27pts en vez de 7.
