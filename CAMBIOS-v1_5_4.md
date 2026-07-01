# v1.5.4 — Fase 1 de rendimiento: imágenes fuera del JS, defer, SRI, limpieza

## Cómo aplicar esto
Toca `index.html` y `app-admin-auth.js`, y **agrega 3 archivos de imagen nuevos** al repo
(`logo.webp`, `logo-simple.webp`, `borrachi.webp`, junto al resto de assets como `favicon.png`).
No toca `firestore.rules` ni ninguna otra regla de seguridad.

Se entregan también los 3 `.png` originales (`logo.png`, `logo-simple.png`, `borrachi.png`) como
**masters** — no los carga la app, quedan por si en algún momento hace falta regenerar el `.webp`
o volver a PNG. Subilos al repo igual, no ocupan lugar donde importa (no los sirve `index.html`).

## El problema que se cierra
`app-admin-auth.js` pesaba **868 KB**, de los cuales **866 KB eran tres imágenes en Base64**
(`LOGO_SRC`, `LOGO_SIMPLE_SRC`, `BORRACHI_SRC`) declaradas como texto plano dentro del `.js`. Eso
significaba:
- El navegador tenía que descargar y parsear 868 KB de JavaScript — no de imagen cacheable — antes
  de que ese archivo terminara de ejecutar, empujando hacia atrás a `app-bootstrap.js` (el que hace
  el primer render) y a `registro.js`, que cargan después.
- Esas imágenes **nunca se beneficiaban del cache HTTP de imágenes** del navegador: al vivir dentro
  de un `.js` versionado con `?v=`, cualquier cambio de versión del script (aunque no cambiara ni
  un byte de las imágenes) las volvía a descargar por completo.
- El "LOADER TEMÁTICO" que ya tienen en `index.html` (comentario v7.4, *"para que el arranque en
  frío en iPhone no se sienta como pantalla en blanco"*) es un parche de UX sobre esta causa raíz.

Además, los 22 `<script>` del proyecto cargaban sin `defer`, bloqueando el parseo del HTML uno
detrás del otro, y los dos scripts de terceros (`html2canvas`, `jsPDF`) no tenían protección contra
un CDN comprometido.

## Qué cambia

### 1. Las 3 imágenes salen de `app-admin-auth.js` a archivos reales
`LOGO_SRC`, `LOGO_SIMPLE_SRC` y `BORRACHI_SRC` pasan de `"data:image/png;base64,..."` a rutas
(`"logo.webp?v=1"`, etc.). El resto del código que las usa (`logoEl.src = BORRACHI_SRC` en
`app-bootstrap.js`, `<img src="${BORRACHI_SRC}">` en `app-estadisticas.js`) **no se tocó**: siguen
siendo strings asignables a un atributo `src`, solo cambia la forma del string.

Se eligió `.webp` en vez de `.png` porque el ahorro es grande y gratis en este caso puntual:

| Archivo | Antes (Base64 en el .js) | .png real | .webp real (calidad 90) |
|---|---|---|---|
| `logo` | 65 KB (texto) | 48 KB | **10 KB** |
| `logo-simple` | 58 KB (texto) | 43 KB | **18 KB** |
| `borrachi` (mascota) | 742 KB (texto) | 543 KB | **93 KB** |

`app-admin-auth.js` pasa de **868 KB a ~20 KB** de JS real — que es todo lo que ese archivo
debería pesar dado su nombre y propósito (auth + 2FA).

### 2. `defer` en los 22 `<script>` del proyecto + los 2 de cdnjs
Con esto, el navegador descarga los scripts en paralelo mientras sigue parseando el HTML, y recién
los ejecuta (en el mismo orden relativo entre sí, que sigue importando exactamente igual que antes)
justo antes de `DOMContentLoaded`. `html2canvas`/`jsPDF` también llevan `defer`: no hacían falta
para el primer render (recién se usan al tocar "Exportar imagen" o "Generar PDF"), y el código ya
tenía un chequeo defensivo por si no habían cargado todavía (`typeof html2canvas !== 'function' ||
!window.jspdf...` en `registro.js`).

**Ojo con esto — es el detalle no trivial de este cambio:** `defer` cambia *cuándo* corren los
scripts con `src`, pero **no afecta a los `<script>` inline** (sin `src`) — esos siguen ejecutando
exactamente en su posición del documento, sin esperar a nada. Había un `<script>` inline justo
después de `registro.js` que ocultaba el loader temático asumiendo que, para cuando el parser
llegaba hasta ahí, los 22 scripts bloqueantes ya habían corrido de verdad. Con `defer`, en ese
mismo instante los scripts deferred **todavía no habían corrido** — ocultar el loader ahí habría
sido prematuro y habría hecho reaparecer la pantalla en blanco que el loader existe para evitar. Se
corrigió reemplazando ese chequeo directo por un listener de `DOMContentLoaded`, que el navegador
garantiza que solo se dispara después de que todos los scripts deferred (incluido
`app-bootstrap.js`) ya terminaron — mismo efecto que antes, ahora robusto frente al cambio de
`defer`. Se revisó el resto de `index.html` buscando otros `<script>` inline con la misma
suposición implícita (había solo dos más: el que define `__qbHideLoader`, que no depende de los 22
scripts, y el del Service Worker, que ya esperaba el evento `load`, más tardío todavía) — ninguno
más tenía este problema.

### 3. `integrity` + `crossorigin` en los 2 scripts de cdnjs
`html2canvas` (1.4.1) y `jsPDF` (2.5.1) ahora llevan Subresource Integrity: si cdnjs alguna vez
sirviera un archivo alterado en esas URLs (CDN comprometido), el navegador se niega a ejecutarlo en
vez de correrlo sin más. Los hashes (SHA-384) se calcularon contra el archivo real de estas
versiones exactas, descargado del propio repo espejo de cdnjs en GitHub
(`github.com/cdnjs/cdnjs`) — no se inventaron ni se copiaron de un generador de terceros, para no
arriesgarse a un hash incorrecto que bloquee la carga en producción. Si en algún momento se
actualiza la versión de cualquiera de las dos librerías, hay que recalcular el hash para el archivo
nuevo — un hash SRI es específico byte a byte del contenido exacto de esa versión.

### 4. Limpieza de repo: `app.js` y `split.js`
Confirmado (de nuevo, en el código ya actualizado) que ninguno de los dos aparece en ningún
`<script src="...">` de `index.html` — las únicas coincidencias que quedan son menciones en
comentarios de otros archivos explicando de dónde salió cada módulo (`"extraído de app.js"`), no
referencias reales. No puedo borrar archivos del repositorio de GitHub por vos — hay que sacar
`app.js` (1.1 MB) y `split.js` de la rama principal a mano. Quedan en el historial de git por si
algún día hace falta volver a compararlos.

## Cobertura de tests
Corrida la suite completa contra los archivos ya modificados: mismos resultados que antes de esta
fase — `test_backup_integral_v1_5_1.js`, `test_evolucion_v1_5.js`, `test_login_reclaim.js`,
`test_participantes_security.js`, `test_sw_routing_v74.js` y `test_xss_escape_v1_5_3.js` (el nuevo
de la Fase 0) pasan igual. Las mismas 3 fallas preexistentes de siempre siguen ahí, sin cambios.

`node --check` limpio en `app-admin-auth.js` (el único `.js` que cambió de contenido en esta fase).

## Peso total antes / después
Sumando los 22 archivos que carga `index.html` (sin contar `app.js`/`split.js`, que están
muertos): de **~1.44 MB a ~600 KB** de JS servido en cada carga de página — una baja de más del
55%, casi toda explicada por sacar las imágenes del medio.

## Qué NO cambia
- El orden de carga de los 22 scripts sigue siendo el mismo, y sigue importando por el mismo motivo
  de siempre (comparten scope global) — `defer` preserva ese orden, no lo altera.
- Ningún archivo de lógica de negocio (scoring, reglas, backup) se tocó en esta fase.
- `firestore.rules` no se tocó.
