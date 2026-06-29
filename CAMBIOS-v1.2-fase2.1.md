# v1.2 (Fase 2.1) — Contraste, switches por etapa, sin spinners, Reglas en vivo

## Cómo aplicar esto
Reemplaza estos 7 archivos: `participantes.js`, `scoring.js`, `app-admin-tools.js`,
`app-batallas.js`, `app-predicciones.js`, `index.html`, `styles.css`. Todo lo demás de las fases
anteriores sigue igual.

Sí, se entendió todo. Te cuento exactamente qué hice en cada punto, y una cosa que encontré mientras
revisaba que vale la pena que sepas.

## 1. Contraste + switch por etapa en "Puntos por fase"

El problema de contraste era real: esa tabla no tenía ningún color de texto explícito, así que
dependía de heredarlo correctamente — y en ese contenedor en particular no lo heredaba bien. La
rediseñé completa: cada fase es ahora su propia fila con colores fijos (no heredados), y le agregué un
switch a CADA fase de eliminatoria (Dieciseisavos, Octavos, Cuartos, Semifinales, Final, Tercer lugar)
que apaga SOLO los puntos de esa fase (Clasificado + Llave + Último lugar juntos) — la fase sigue
existiendo, la gente sigue prediciendo normal, solo deja de puntuar. Cuando lo apagas, los 3 números de
esa fila se ven atenuados para que sea obvio que no están contando.

(Fase de Grupos no tiene su propio switch en esta tabla porque ya tiene uno arriba, en "Puntos base"
— ver punto 3 — y sería redundante repetirlo acá. Esa fila solo te deja ajustar su "Último lugar".)

## 2. Sin flechitas ↑↓

Quitadas de TODOS los números de esta sección (Puntos base, Puntos por fase, Multiplicador, Racha,
MVP) — los 25 inputs de la pantalla pasan por una sola función que ahora aplica una clase con esa
regla, así que no hay que repetirlo en cada uno ni queda ninguno suelto.

## 3. Switches de Grupos / Eliminatoria en "Puntos base"

Agregados. "Eliminatoria" apaga específicamente Ganador/Empate/Marcador exacto (el resultado del
partido) — Llave y Clasificado de cada fase los sigue gobernando el switch de esa fase puntual (punto
1), para que tengas control fino si quieres. "Grupos" apaga sus 3 puntos Y su bono de último lugar
juntos (no tiene sentido dejar el bono de consuelo si los puntos del día a día están apagados).

## 4. La pestaña "Reglas" ahora se actualiza en vivo — confirmado con pruebas

Esta era la delicada. Antes "Reglas" pintaba 4 listas fijas, escritas a mano, sin ninguna conexión con
lo que configuraras. La reescribí completa: ahora lee EN VIVO exactamente el mismo dato que edita
"Configuración del torneo" — no hay dos copias del puntaje en el sistema, hay una sola, y Reglas solo
la muestra. Cualquier número que cambies, o cualquier switch que apagues, se refleja ahí al toque,
incluso si nadie tiene esa pestaña abierta en ese momento (apenas la abran, ven lo último). También le
agregué 3 secciones nuevas (Multiplicador/Racha/MVP) que solo aparecen si las activaste, y de paso dejé
que respete qué fases están activas (antes esto no estaba filtrado tampoco).

Lo probé de punta a punta, no solo que "se vea bien": apagué el switch de Grupos y confirmé que
`calcPts()` (el motor real, no solo la pantalla) pasó de 5 a 0 puntos; cambié "Ganador" de Eliminatoria
a 99 y la pestaña Reglas lo mostró al toque; apagué el switch de Octavos y confirmé que
`calcClassifiedPtsForPhase()` (el cálculo real de puntos de clasificado) también pasó a 0, no solo el
texto en pantalla.

## Algo que encontré y corregí de paso (avísame si lo querías distinto)

Mientras revisaba el contraste, noté que el campo "Llave/Cruce" que había puesto en "Puntos base →
Eliminatoria" en la entrega anterior **no hacía nada** — lo guardaba, pero el motor de puntaje nunca lo
leía (el valor real de "Llave" siempre salía de la tabla "Puntos por fase", no de ahí). Lo quité de
"Puntos base" para no tener un campo fantasma que parece editable pero no afecta nada. El valor real de
Llave por fase sigue 100% editable en "Puntos por fase", como siempre.

## Qué NO toqué
- Los puntos de "Avanzado" (Campeón, Goleador, etc.) siguen fuera de esta pantalla — la sección
  "Reglas avanzadas" sigue mostrando esos valores fijos de siempre, sin switch ni edición. Dímelo si
  quieres que entren también.

## Cómo lo verifiqué
- `node --check` en los 5 archivos `.js` tocados, balance de llaves en `styles.css` y de `<div>` en
  `index.html` — todo correcto (el único "desbalance" que salió en un chequeo automático era un
  `<div>` mencionado dentro de un comentario HTML, no HTML real).
- Harness de carga completa del proyecto (22 archivos, orden de producción) — sin errores nuevos.
- Prueba dirigida confirmando, contra el motor real (no solo la pantalla): los 3 switches nuevos
  existen y funcionan; el campo fantasma de Llave/Cruce ya no está; los 25 inputs de número tienen la
  clase sin flechitas; apagar Grupos lleva `calcPts()` de 5 a 0; cambiar un valor con
  `updateReglaValor()` se refleja al toque en Reglas; apagar Octavos se refleja en Reglas Y en
  `calcClassifiedPtsForPhase()` real.
