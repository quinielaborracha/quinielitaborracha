# v1.5.3 — Fase 0 de seguridad: XSS almacenado vía nombre/ciudad/país de participante

## Cómo aplicar esto
Este cambio toca **7 archivos `.js`** y `index.html` (bump de `?v=` de cache-busting de cada uno
+ número de versión visible). **No toca `firestore.rules`** — no hace falta volver a publicar
reglas en Firebase Console para este cambio.

Archivos modificados:
- `utils.js` — nueva función `esc()` (movida desde `registro.js`).
- `registro.js` — se quitó la definición local de `esc()` (ahora la provee `utils.js`, que carga
  antes). Las 110 llamadas existentes a `esc()` en este archivo siguen funcionando sin tocarse.
- `app-bracket-view.js`, `app-estadisticas.js`, `app-batallas.js`, `app-predicciones.js`,
  `app-bracket-espn-live.js` — se aplicó `esc()` en todos los renders que insertaban
  nombre/ciudad/país/notas de participante (o texto libre cargado por el admin: nombres de
  batallas, goleadores) directo en `innerHTML` sin escapar.

Se agrega además un archivo de test nuevo:
- `test_xss_escape_v1_5_3.js` — harness funcional (jsdom) que registra un participante con un
  nombre que contiene `<`, `>`, `"` y `'` (payload real: `XSS<img src=x onerror=alert(1)>"'`) y
  verifica, en el DOM real de cada vista afectada, que no se haya inyectado ningún elemento vivo
  (`<img onerror>`, `<script>`, `<b>`).

## El problema que se cierra
Existía una función `esc()` (escape de HTML) usada 110 veces, pero **solo dentro de
`registro.js`**. Los otros 20 módulos que carga `index.html` insertaban `p.name`,
`cityCountry(p)` y otros campos de texto libre directo en `innerHTML`, sin pasar por ella.

El campo `name` de un participante lo controla **cualquier visitante anónimo** al registrarse —
`firestore.rules` valida tipo y tamaño (`size() <= 200`), no contenido (no es su trabajo). No hay
tampoco ningún filtro de caracteres del lado del cliente en el formulario de registro. Un nombre
como `<img src=x onerror="...">` se ejecutaba para cualquiera que abriera el Ranking,
Estadísticas, Batallas o Predicciones — **admin incluido**, con su sesión de Firebase Auth ya
autenticada en esa misma pestaña.

Un segundo problema, independiente pero relacionado: los botones ✏️ (editar) y 🙈/👁 (ocultar) del
Ranking armaban su `onclick` interpolando el nombre directo dentro del atributo con
`.replace(/'/g,"\'")` — ese `replace` no escapaba nada de verdad (`"\'"` en JS es literalmente el
carácter `'`), así que un nombre con una comilla simple rompía el atributo `onclick` y abría una
vía de inyección adicional.

## Qué cambia
1. **`esc()` es ahora una utilidad global** (vive en `utils.js`, que carga antes que cualquier
   otro módulo) en vez de estar atada a `registro.js`.
2. **Se aplicó `esc()`** en cada punto donde un módulo insertaba nombre/ciudad/país de un
   participante, o texto libre cargado por el admin (nombre de batalla, goleador), vía
   `innerHTML`: Ranking (`app-bracket-view.js`), Exportar imagen y tarjetas de Estadísticas
   (`app-estadisticas.js`), Batallas activas/historial/banner (`app-batallas.js`), Predicciones/
   Avanzado/Goleadores (`app-predicciones.js`), y los chips de predicciones en vivo
   (`app-bracket-espn-live.js`).
3. **Los botones ✏️/👁 del Ranking y ✕ de Goleadores** ya no arman `onclick` interpolando el
   nombre en el atributo: ahora llevan el nombre en un `data-*` (pasado por `esc()`, no puede
   romper el atributo) y un único listener delegado en `document` hace la llamada real
   (`openEditParticipant`, `toggleHideParticipant`, `rmS`). Esto elimina la clase de vector de
   raíz, no solo el caso puntual que se encontró.
4. **De paso**, el link opcional de participante (`p.link`, hoy sin ningún código que lo escriba
   todavía) quedó también escapado y restringido a `http(s)://` para que no se pueda colar un
   `javascript:` en el `href` el día que algo empiece a poblarlo.

**Nota de diseño — por qué se escapa en cada sitio de render y no dentro de `sn()`/`cityCountry()`**:
esas dos funciones son transformaciones de datos puras (viven en `utils.js` junto con el resto,
sin acceso a `document`, según su propio criterio original) y se usan también en contextos que no
son HTML (`toast()`, que usa `.textContent`, no interpreta HTML nunca). Escapar ahí adentro habría
sido trabajo de más en esos casos, y mezclaría una responsabilidad de "transformar datos" con una
de "esto va a parar a innerHTML" — más fácil de auditar a futuro si el escape queda pegado al
punto exacto donde el texto entra al DOM.

## Cobertura de tests
- `test_xss_escape_v1_5_3.js` (nuevo): registra un participante con el payload de arriba y
  renderiza Ranking, Exportar imagen, Estadísticas (tarjetas), Batallas (activa + historial +
  banner), Predicciones, Avanzado y Goleadores. 34/34 checks pasan. Corrido también contra el
  código **sin** este fix (para confirmar que el test realmente detecta el problema): 20/34
  checks fallan, como se espera.
- Resto de la suite (`test_backup_integral_v1_5_1.js`, `test_evolucion_v1_5.js`,
  `test_login_reclaim.js`, `test_participantes_security.js`, `test_sw_routing_v74.js`): sin
  cambios de comportamiento, siguen pasando igual que antes de este fix.
- `test_full_page_load.js`, `test_import_correos_claves.js`, `test_registro_creacion_confirmada.js`:
  mismas fallas preexistentes ya conocidas, confirmadas también contra el código sin tocar — no
  las causó ni las arregló este cambio.

## Qué NO cambia
- `firestore.rules` — el modelo de permisos queda exactamente igual. Este fix es enteramente del
  lado del render (cómo se muestra el dato), no de quién puede escribirlo.
- El campo `name`/`city`/`country` sigue sin ningún filtro de caracteres al escribirse — a
  propósito: la defensa correcta contra XSS es escapar al mostrar (lo que hace este cambio), no
  intentar adivinar de antemano qué caracteres "no debería" tener un nombre.
