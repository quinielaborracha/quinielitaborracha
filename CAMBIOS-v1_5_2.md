# v1.5.2 — Endurecimiento de Firestore Rules (creación de participantes)

## Cómo aplicar esto
Este cambio toca **un solo archivo**: `firestore.rules`. No requiere tocar ningún `.js` ni
`index.html` (no hay cache-busting que bumpear, porque ningún archivo cargado por la app cambió).

Para publicarlo: Firebase Console → proyecto "quinielitaborracha" → Firestore Database → pestaña
"Reglas" → pegar el `firestore.rules` completo de este paquete (reemplazando lo que haya) →
"Publicar". Como siempre, esto no tiene efecto hasta que se publique ahí.

Se actualizan además 2 archivos de test existentes (no los carga `index.html`, viven en el repo
como harness de verificación):
- `sim_firestore_rules.js` — simulador manual de la lógica de reglas, con los casos nuevos.
- `test_participantes_security.js` — el harness funcional que carga `participantes.js` real
  (jsdom) se actualizó para que su réplica local de las reglas siga siendo fiel a las reglas
  reales, y se agregó un caso (CASO 8c) que prueba `rgCreateParticipantConfirmed()` de verdad
  contra un registro cerrado.

## ⚠️ Alcance de esta versión
Se evaluó un conjunto más amplio de endurecimiento (tabla de permisos por colección, Cloud
Functions, log de auditoría, restringir al admin la escritura de predicciones) y se decidió, en
conversación, dejar todo eso fuera de v1.5.2:
- El resto de las colecciones (`quiniela/estado`, `registro/meta`, `registro/papelera`,
  `registro/admin2fa`, `registro_privado`) ya estaban correctamente aseguradas — no se tocaron.
- Cloud Functions queda descartado por ahora (el proyecto se mantiene en plan Spark, gratuito, a
  propósito).
- El admin mantiene el mismo acceso de escritura sobre `registro_participants` que tenía hasta
  hoy (incluidas las predicciones de cualquiera) — sin cambios ahí.
- Un log de auditoría de acciones del admin queda pendiente para una versión aparte (no es un
  endurecimiento de algo existente, es una funcionalidad nueva).

## El problema que se cierra
`allow create` en `registro_participants/{pid}` solo exigía que `ownerUid` fuera el UID de quien
escribe. Como cualquier visitante recibe una sesión anónima de Firebase con solo abrir la página
(sin ninguna acción de su parte), alguien con las devtools abiertas podía llamar directo al SDK de
Firestore (sin pasar por la app) y crear documentos con **cualquier contenido**, en **cualquier
cantidad**, incluso con el registro ya cerrado por el admin. El riesgo concreto no es solo
"participantes falsos en el Ranking": a volumen, podía agotar la cuota gratis diaria de escrituras
de Firestore (plan Spark) y tumbar la app para los 27 participantes reales hasta el día siguiente.

## Qué cambia
Se agregan dos condiciones al camino **no-admin** de `allow create` (el camino admin —restaurar
desde la papelera, dar de alta "a nombre de" alguien— queda exactamente igual que antes):

1. **`isRegistroAbierto()`** — igual patrón que el ya existente `isPastDeadline()`. Si
   `registro/meta` no existe, o existe pero nunca declaró `registroAbierto`, se trata como
   ABIERTO (mismo comportamiento de siempre para cualquier instalación existente). Solo un
   `registroAbierto == false` **explícito** (el admin cerró el registro desde su panel) bloquea
   altas nuevas. Esto por sí solo cierra la mayor parte de la ventana de exposición, porque
   durante casi todo el torneo el registro ya está cerrado.

2. **`esAltaValidaDeParticipante()`** — valida la forma mínima de una alta real: `name` string no
   vacío (≤200 caracteres), `codigo` string (≤50 caracteres), `estadoQuiniela == 'borrador'`, y
   `predictions` como mapa (no exige que venga vacío a propósito — ver nota abajo). No es una
   lista blanca exhaustiva de todos los campos del documento: eso acoplaría la regla a cada
   cambio futuro de forma del participante. Es un piso mínimo contra basura evidente (tipos
   incorrectos, strings gigantes).

**Nota de diseño — por qué `predictions` no se exige vacío**: la primera implementación de este
cambio sí lo exigía, pero rompía un camino legítimo ya cubierto por `test_participantes_security.js`
(CASO 1): alguien que completó su quiniela offline y recién ahí sincroniza por primera vez con
Firestore (vía `rgPushToFirestore`, el autoguardado normal) puede crear el documento **con**
predicciones ya cargadas, no solo vía el wizard (`rgCreateParticipantConfirmed`, que sí crea
siempre con predicciones vacías). Exigir vacío hubiera bloqueado ese caso real. La protección
contra spam masivo la da sobre todo el punto 1 (registro cerrado), no este campo.

## Cobertura de tests
- `sim_firestore_rules.js`: 46/46 casos pasan (7 nuevos: registro cerrado admin/no-admin, nombre
  vacío, nombre desmesuradamente largo, `estadoQuiniela` inválido en alta nueva, `predictions` no
  vacío permitido, `predictions` de tipo inválido rechazado, falta `codigo`).
- `test_participantes_security.js`: todos los casos pasan, incluido el nuevo CASO 8c
  (`rgCreateParticipantConfirmed()` real rechazado con `permission-denied` cuando el registro está
  cerrado, sin dejar documentos huérfanos ni en `registro_participants` ni en `registro_privado`).
- `test_full_page_load.js` y `test_registro_creacion_confirmada.js`: mismas 2 fallas preexistentes
  ya conocidas (no relacionadas con este cambio, confirmadas también contra los archivos
  originales sin tocar).
