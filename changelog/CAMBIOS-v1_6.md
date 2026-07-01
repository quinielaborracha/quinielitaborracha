# v1.6 — Racha de Desaciertos, botón Salir, saludo con cuenta regresiva

## Cómo aplicar esto
Modificados: `participantes.js`, `scoring.js`, `app-admin-tools.js`, `registro.js`, `styles.css`,
`index.html` (bump de versión visible a v1.6 y de los `?v=` de los 5 archivos de arriba). Nuevo:
`test_v1_6_ajustes.js`. No toca `firestore.rules` — nada de esto necesita permisos nuevos ni cambia
qué puede escribir cada quien, solo agrega una regla de puntaje (cliente) y ajustes de UI.

## 1. Racha de Desaciertos
Espejo exacto de la Racha de Aciertos que ya existía (`reglas.racha`), pero contando **fallos**
consecutivos en vez de aciertos — mismo motor cronológico (`buildChronologicalResults`), mismo
criterio de "acierto/fallo" que ya usa el resto del sistema (no inventé un segundo criterio).

- `reglas.rachaDesaciertos` — hitos **propios e independientes** de los de aciertos (según lo que
  definiste), editables aparte en el panel de Reglas. Por defecto: `{n:3,pts:1},{n:5,pts:2},{n:8,pts:4}`
  — menos generosos que los de aciertos (1/2/4 vs 3/6/10), para que siga siendo un premio de
  consuelo con humor y no una razón para fallar a propósito. Arranca **desactivada**, como toda
  regla nueva: nadie nota nada hasta que la prendas.
- Un acierto (aunque sea uno solo) corta la racha de fallos y la vuelve a 0 — igual que un fallo
  corta la racha de aciertos.
- Nueva tarjeta "😅 Racha de desaciertos" en Admin → ⚙️ Configuración del torneo → Reglas, con el
  mismo patrón visual y de guardado que la de aciertos (mismo `updateReglaValor`/`toggleReglaSwitch`
  genéricos, no hizo falta tocar esas dos funciones).
- Sin mensaje/emoji especial en pantalla (solo suma puntos, como pediste) — si más adelante quieres
  agregarle un mensaje visible en Mi Quiniela o Bonos, es un cambio acotado a un solo lugar.

## 2 y 3. Botón "✕ Salir" + saludo con cuenta regresiva en vivo
Arriba del formulario de registro (wizard), en una sola fila nueva (`.wiz-topbar`):
- **Izquierda**: "👋 Hola, *{nombre de pila}* — tienes **{contador en vivo}** para completar tu
  registro". Solo aparece mientras el registro sigue editable Y hay una fecha de cierre configurada
  (si no hay cierre configurado, o si ya se cerró/enviaste tu quiniela, no aplica y no se muestra —
  ya hay otro aviso para esos casos, ver más abajo).
- **Derecha**: botón "✕ Salir", siempre presente en el wizard. Reusa exactamente el mismo patrón
  que ya existía para el botón de logout del Dashboard (`dash_logout_btn`): si hay cambios sin
  guardar, primero pregunta (mismo modal de "cambios sin guardar" de siempre); si no, sale directo.
  No borra nada en Firestore ni el `ownerUid` de tu dispositivo — solo cierra el wizard y vuelve a
  la pantalla de inicio.
- El contador (`d h min s`) tickea cada segundo **sin re-renderizar todo el wizard** — solo toca el
  texto de un `<span>`, para no interrumpir a alguien que esté escribiendo un marcador al mismo
  tiempo. El cierre automático en sí lo sigue decidiendo el chequeo de 30s que ya existía.

## 4. Confirmación: el cierre automático sí aplica a quien ya empezó
Lo revisé a fondo y esto **ya funcionaba correctamente**, con doble candado:
- **Cliente** (`isLocked()`/`isGloballyClosed()` en `registro.js`): bloquea sin importar cuándo la
  persona empezó su registro, y hay un chequeo cada 30s que re-renderiza automáticamente en el
  instante exacto del cierre, sin necesidad de recargar la página.
- **Servidor** (`firestore.rules`, desde v6.8): la regla de `update` exige `!isPastDeadline()`
  del lado de Firestore, así que aunque alguien fuerce un `write` desde la consola del navegador
  después del cierre, el servidor lo rechaza igual.

El único matiz (no un bug, solo lo dejo anotado): el servidor interpreta `fechaCierre`+`horaCierre`
en UTC, mientras que el cliente los compara contra la hora local del navegador de quien mira la
pantalla — una diferencia de minutos/horas según el huso, no algo que cause bloqueos inesperados en
el uso normal (el cierre siempre se configura con margen de horas antes del primer partido).

Agregué un test nuevo (`test_v1_6_ajustes.js`) que deja esto documentado explícitamente: confirma
que alguien que ya había empezado a llenar su quiniela ANTES de que se configurara el cierre queda
igual de bloqueado que cualquiera, en el instante en que el plazo se cumple.

## Cómo lo verifiqué
- `node --check` en los 5 archivos tocados — sin errores de sintaxis (`npm run check`: 38/38 OK).
- Suite completa (`npm test`): 11/11 archivos de test pasan, incluidos `test_full_page_load.js` y
  `test_registro_creacion_confirmada.js` (las 2 fallas que tenías anotadas como pendientes de v1.5.1
  ya no aparecen — no las causó nada de esta entrega, ya estaban resueltas).
- Test nuevo (`test_v1_6_ajustes.js`), con datos sintéticos:
  - Racha de Desaciertos: una racha de 8 fallos seguidos + otra de 3 suma 1+2+4+1=8pts con los
    hitos default; da 0 con la regla apagada; los hitos de desaciertos se pueden editar sin tocar
    los de aciertos (y viceversa); el bono entra correctamente al total de `calcBonos()`.
  - Panel de Reglas: la tarjeta nueva aparece, sus inputs solo se muestran con la regla prendida, y
    la tarjeta de aciertos sigue intacta y separada.
  - Wizard: el botón Salir aparece siempre (con y sin cierre configurado); el saludo+contador solo
    aparece con cierre configurado y el registro todavía abierto; desaparece correctamente tanto sin
    fecha de cierre como con la quiniela ya enviada; el click en Salir sin cambios pendientes limpia
    el draft y vuelve al inicio.
  - Cierre automático: confirma el escenario del punto 4 (alguien que ya había empezado antes de
    que se configurara el cierre queda bloqueado igual que cualquiera en el instante del cierre, y
    cae en el Dashboard de solo-lectura, no en el wizard editable).
