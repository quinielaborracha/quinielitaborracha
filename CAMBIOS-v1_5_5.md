# v1.5.5 — Fase 2 de accesibilidad: aria-label, teclado, y un bonus de seguridad

## Cómo aplicar esto
Toca `index.html`, `registro.js`, `app-bracket-view.js`, `app-predicciones.js` y
`app-estadisticas.js`. No toca `firestore.rules`.

## 1. `aria-label` en los botones de solo-emoji
Encontré 13 botones cuyo único contenido visible es un emoji/símbolo (sin texto), la mayoría con
`title="..."` pero ninguno con `aria-label`. `title` no es fiable para lectores de pantalla y **no
funciona en absoluto en touch** — que es como la mayoría de los 27 participantes usan esto, según
los propios comentarios del proyecto sobre iPhone. Se agregó `aria-label` a los 13:

- **Ranking** (`app-bracket-view.js`): ✏️ Editar, 👁/🙈 Mostrar/Ocultar — ambos con el nombre del
  participante incluido en el label (ej. `"Editar a Juan Pérez"`), no genérico, para que alguien
  navegando la lista completa con lector de pantalla sepa a quién le está por tocar cada botón.
- **Panel admin de participantes** (`registro.js`, tabla activa): ✏️ Editar, 👁️ Ver como
  participante, 📄 Generar PDF, 🔑 Regenerar clave, 📝/🗒️ Agregar/editar nota, 🗑️ Eliminar.
- **Papelera** (`registro.js`): ♻️ Restaurar, 🗑️ Eliminar para siempre.
- **Goleadores** (`app-predicciones.js`): ✕ Quitar goleador — este ni siquiera tenía `title`, cero
  indicación de qué hacía el botón para nadie que no pudiera ver el ícono.
- **Snapshots** (`app-estadisticas.js`): ✕ Borrar snapshot — mismo caso, sin `title` tampoco.
- **Cerrar modales** (`index.html`): ✕ del editor de equipos, ✕ de exportar tabla.

Los botones que ya tenían texto visible junto al emoji (ej. "✏️ Editar marcador", "🗑️ Borrar" en
Batallas, "⬇ JSON") se dejaron sin tocar — ya tienen nombre accesible desde su propio texto, no son
el problema que describe este punto.

## 2. Teclado en el trigger de login admin
El acceso a login admin tiene dos disparadores: doble clic en el logo, o clic en el 🔑 junto al
título. Ninguno de los dos es nativamente accesible por teclado — un `<div>`/`<span>` con
`onclick`/`ondblclick` no entra en el orden de Tab ni se activa con Enter, a diferencia de un
`<button>` real. Se les agregó `role="button" tabindex="0"` (entran al Tab, el lector de pantalla
los anuncia como botón) y un `onkeydown` que activa el login con Enter o Espacio — el estándar para
elementos con `role="button"`.

Detalle de la decisión: el logo activa con un solo Enter/Espacio, no con "doble Enter". El
doble-clic del mouse ahí es solo fricción para evitar toques accidentales, no un mecanismo de
seguridad — abrir el modal no da acceso a nada, la seguridad real es la contraseña + 2FA que vienen
después — así que no hacía falta complicar la réplica exacta para el teclado.

## 3. Revisión del resto de controles interactivos
Repasé sistemáticamente (con un script, no a ojo, para no confiarme) todos los `<button>`, `<span>`
y `<a>` con `onclick`/`ondblclick`/`data-act` del proyecto buscando cuáles tenían como único
contenido un emoji o símbolo sin `aria-label`. Los 13 de arriba fueron los únicos que calificaban.
También revisé los cierres de modal (login, editar participante, conflictos de equipos): todos usan
botones con texto visible ("Cancelar", "✓ Guardar") salvo los dos ✕ que ya quedaron cubiertos en el
punto 1.

**Nota aparte, no arreglada en esta fase:** las etiquetas (`<label>`) de Nombre/País/Ciudad en el
modal de editar participante no están asociadas a su `<input>` por `for=`/`id=` — un lector de
pantalla no anuncia automáticamente "Nombre" al enfocar ese campo. Es un problema real pero de otra
categoría (formularios, no íconos), y tocarlo bien implicaría revisar todos los formularios del
proyecto, no solo este modal — te lo dejo anotado para una fase de accesibilidad más adelante si
te interesa, no lo metí de prepo en esta sesión corta.

## Bonus fuera de pedido: un gap de escape que quedó afuera en la Fase 0
Al agregar el `aria-label` del botón de borrar snapshot en `app-estadisticas.js`, encontré que el
nombre del snapshot (`S.snapshots[].label`, texto libre que escribe el admin en un input) se
insertaba sin escapar en dos lugares vía `innerHTML`: la lista de snapshots del panel admin, y la
imagen exportada (`buildExp()`, visible para cualquiera que la genere). Es el mismo patrón que se
cerró en la Fase 0 (v1.5.3) para nombre/ciudad/país de participante — ahí no se tocó porque no era
un campo de participante, es un campo que solo el admin escribe, pero el principio es el mismo:
cualquier texto libre que llega a `innerHTML` se escapa, sin excepción. Se agregó `esc()` en los
dos puntos.

## Cobertura de tests
Corrida la suite completa contra los archivos modificados: mismos resultados que en las fases
anteriores — `test_backup_integral_v1_5_1.js`, `test_evolucion_v1_5.js`, `test_login_reclaim.js`,
`test_participantes_security.js`, `test_sw_routing_v74.js` y `test_xss_escape_v1_5_3.js` pasan
igual. Las mismas 3 fallas preexistentes de siempre, sin cambios. `node --check` limpio en los 4
`.js` tocados.

## Qué NO cambia
- Ningún flujo de negocio (scoring, reglas de bonos, backup) se tocó.
- `firestore.rules` no se tocó.
- El comportamiento con mouse/touch es idéntico a antes — todos los cambios son aditivos
  (atributos nuevos), no se quitó ni reemplazó ninguna interacción existente.
