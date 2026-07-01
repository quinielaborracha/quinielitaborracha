# v1.5.1 — Backup integral (Integridad) + Exportar/Importar info de participantes (JSON)

## Cómo aplicar esto
Reemplazá estos 4 archivos: `app-live-sync.js`, `participantes.js`, `app-admin-tools.js`,
`registro.js`, y también `index.html` (cache-busting bumpeado + textos actualizados + versión
visible a v1.5.1). Todo lo demás sigue igual.

Se agregan además 2 archivos de test nuevos/actualizados (no los carga `index.html`, viven en el
repo solo como harness de verificación, igual que los demás `test_*.js`):
- `test_import_correos_claves.js` — actualizado para el rename de función y el formato nuevo.
- `test_backup_integral_v1_5_1.js` — nuevo, cubre específicamente el escenario de más riesgo
  (reemplazo total + borrado de huérfanos).

## ⚠️ Antes de restaurar un backup real: leé esto
"Importar backup" ahora hace **reemplazo total**: cualquier participante, predicción, o dato de
configuración que exista hoy en Firestore y **no** esté en el archivo que importás **se borra**.
Por eso, antes de aplicar nada, el propio botón descarga automáticamente una copia de seguridad del
estado actual (`backup_antes_de_restaurar_...json`) — si algo sale mal, ese archivo es tu vuelta
atrás. Recomiendo probar el flujo completo una vez en un participante de prueba antes de confiar en
él con datos reales.

## 1. Backup integral (antes solo respaldaba resultados/bonos/batallas)

**El problema que reportaste**: `Exportar backup` / `Importar backup` (pestaña Admin → 🔒
Integridad) solo tocaban el documento `quiniela/estado` (resultados, bonos, batallas, snapshots).
Si restaurabas ese backup en un sitio nuevo, se perdían **todos** los participantes, sus
predicciones, la papelera y la configuración del torneo (fases activas, reglas de puntaje) — no
había forma de recuperar el sistema completo con un solo archivo.

**Qué cambia**: el JSON exportado ahora trae las dos mitades del sistema:
- `quiniela`: el mismo payload de siempre (`buildStatePayload()`, ya existía en `app-live-sync.js`)
  — ahora es la ÚNICA fuente de verdad para el export, en vez de una lista de campos copiada a mano
  en `app-admin-tools.js`. De paso corrige un bug chico: el export manual nunca incluía `hiddenPL`
  (participantes ocultos del ranking) aunque el import sí sabía leerlo — invisible mientras nadie
  restauraba un backup viejo, pero real.
- `registro`: `participants` + `predictions` + `papelera` + `nextSeq` + `configGlobal` — todo lo
  que antes vivía únicamente en Firestore, sin ningún respaldo.

**Qué NO incluye, a propósito**:
- `quiniela/estado-test` (el espejo de "🧪 Modo Prueba"): es efímero, no es la quiniela real.
- `registro/admin2fa` (secreto TOTP + navegadores de confianza del admin): es un secreto
  equivalente a una contraseña. Meterlo en un JSON descargable (que puede terminar copiado,
  compartido por correo, guardado en un Drive, etc.) es un riesgo real para un beneficio chico — si
  hace falta reconfigurar el 2FA alguna vez, ya existe el flujo normal para eso. **Restaurar un
  backup nunca toca este documento**, bajo ningún escenario, así que jamás te vas a quedar afuera
  de tu propia sesión de admin por restaurar un backup viejo.

**Modo de restauración — reemplazo total** (decisión tuya, confirmada antes de programar esto):
restaurar dejar el sitio **idéntico al archivo**. Cualquier participante que exista hoy en
Firestore y no esté en el backup se borra (documento público + privado) — no alcanza con
agregar/actualizar los que sí están, porque el resto de la app (el listener en vivo de
`participantes.js`) reconstruye `DB.participants` desde Firestore en cada cambio; si no se borran
los huérfanos ahí mismo, "vuelven" solos unos segundos después de la restauración. La función nueva
`rgRestoreFullBackup()` (`participantes.js`) calcula la diferencia contra el último snapshot real
de Firestore y arma los `delete` correspondientes en el mismo batch, con el mismo criterio que ya
usaba `rgResetAll()` ("Borrar TODO") para el mismo problema.

**Compatibilidad hacia atrás**: un backup del formato viejo (`scores`/`elimScores` sueltos en la
raíz, sin `quiniela`/`registro`) se sigue pudiendo importar — solo toca resultados/bonos/batallas,
nunca participantes, exactamente como se comportaba antes.

**Archivos tocados**: `app-live-sync.js` (nueva `applyStatePayload()`, contraparte de
`buildStatePayload()`), `participantes.js` (nueva `rgRestoreFullBackup()`), `app-admin-tools.js`
(`exportBackupJSON()`/`importBackupJSON()` reescritas, nuevas `buildFullBackupPayload()` /
`descargarJSON()`), `index.html` (texto del panel de Backup/Restore actualizado).

## 2. "Exportar/Importar correos y claves" → "Exportar/Importar info de participantes" (JSON)

**Antes**: el botón exportaba un `.csv` con solo Nombre/Correo/Código/Clave/Estado — menos de lo
que ya se ve en la propia tabla del panel Admin.

**Ahora**: exporta un `.json` con **todo** lo que se ve en esa tabla — Código, Nombre, Correo,
Ubicación (como `ciudad`+`pais` por separado, más útil que un solo string concatenado), Clave,
Creado, Enviado, Estado y Avance. El botón nuevo (`⬇️ Exportar info de participantes`) reemplaza al
viejo (`⬇️ Exportar correos y claves`) — mismo lugar, panel Admin.

**Importar** (`⬆️ Importar info de participantes`) matchea por Código (igual que antes) y
actualiza: correo, ciudad, país, clave, estado y las fechas de creado/enviado — solo los campos que
el archivo realmente traiga para cada participante, igual de conservador que antes.

**Dos exclusiones a propósito, documentadas en el código**:
- **"Avance" no se reimporta**: no es un campo guardado en Firestore, es un cálculo (% de la
  quiniela contestada) que se recalcula solo, siempre, a partir de las predicciones reales. Viaja
  en el export como dato informativo nada más.
- **"Nombre" tampoco se reimporta**, aunque viaja en el JSON: cambiar el nombre de un participante
  también tiene que migrar `S.hiddenPL` y `S.adv` (que lo usan como clave) — eso ya lo hace
  correctamente `saveEditParticipant()` (el botón ✏️ "Editar" de cada fila), y meter esa migración
  también acá hubiera significado que `registro.js` empiece a escribir el objeto `S` directamente,
  algo que hoy no hace en ningún otro lado. Para renombrar a alguien, seguí usando "Editar".

**Compatibilidad hacia atrás**: el `.csv` que generaba la versión anterior de "Exportar correos y
claves" se sigue pudiendo importar sin problema (mismo parser `_parseCSV()` de siempre), igual que
el backup `.json` de la migración vieja.

**Archivo tocado**: `registro.js` (`exportarCorreosClaves`→`exportarInfoParticipantes`,
`importarCorreosClaves`→`importarInfoParticipantes`, botones/IDs del panel Admin renombrados).

## Pruebas hechas antes de entregar esto

- `node --check` en los 4 archivos `.js` tocados — sintaxis OK.
- `test_import_correos_claves.js` (actualizado): valida el import con el `.json` nuevo (incluyendo
  que ciudad/país/estado se apliquen y que "nombre" **no** se toque a propósito) y con el `.csv`
  viejo (compatibilidad hacia atrás) — ambos casos, sin romper nada de lo que ya probaba (2FA,
  mezcla de clave/correo privado en la tabla, caso roto con `PRIVADO_COL` undefined).
- `test_backup_integral_v1_5_1.js` (nuevo): arma 3 participantes "en Firestore" y restaura un
  backup con solo 2 — confirma que el 3ro se borra (documento público + privado) en el mismo batch,
  que los 2 que sí están se escriben completos (público+privado, con su clave/correo), que
  `registro/meta` y `registro/papelera` se reescriben con lo del backup, que `quiniela/estado`
  queda idéntico al backup (no mezcla nada de lo viejo, ver `S.battles` en el test), que
  `registro/admin2fa` nunca se toca, y que un backup del formato viejo sigue funcionando sin tocar
  participantes.
- Corridos también los demás tests existentes del repo (`test_login_reclaim.js`,
  `test_participantes_security.js`, `test_evolucion_v1_5.js`, `test_sw_routing_v74.js`) — sin
  regresiones.

**Dos hallazgos preexistentes, no relacionados con este pedido, que dejo señalados y NO toqué**
(confirmé que fallan igual contra los archivos sin modificar, así que no son algo que haya
introducido esta entrega):
- `test_full_page_load.js` espera una variable `_lastPushedStateJSON` que no existe en
  `app-live-sync.js` (que sigue usando la bandera `_suppressNextFirestoreEcho`), y su DOM mínimo de
  prueba no tiene todos los elementos que hoy necesita `renderRank()`/`registro.js` para arrancar
  sin excepciones.
- `test_registro_creacion_confirmada.js` falla al no encontrar el elemento `#r_name` en el DOM que
  arma.

Si querés, en otra entrega puedo mirar estos dos por separado.
