# Editor visual

## Recuperación de altas y revisiones — 12/10/2026

Revisiones ofrece «Corregir alta y cargar medios» al autor y al administrador. La RPC `revise_pending_species_create` bloquea la propuesta pendiente, compara sus valores originales y crea una propuesta nueva; conserva la anterior como rechazada, con referencia a su reemplazo, y transfiere los medios asociados con sus derechos. No modifica una ficha aprobada. La aprobación propia sigue exigiendo confirmación; el rechazo propio no exige autovalidación.

El alta valida fuente de abundancia y de cada medida antes de enviar. Los errores PostgREST se presentan con su motivo y quedan visibles aunque cierre el modal de aprobación. Si `createImageBitmap` no decodifica un JPG, el original pasa al procesador habitual, que verifica formato y produce WebP/miniatura; el fallback nunca aprueba archivos inválidos.

Verificación: 32 pruebas visuales, 49 editoriales, `npx tsx --test scripts/prepare-image.test.ts`, build y typecheck de automatización. En producción se probó rechazo propio, corrección y aprobación de alta bajo rol `authenticated`, con rollback completo. El alta `F_catus` conserva sus valores originales y su estado pendiente. Se verificó el respaldo cifrado del workflow `38239080036`, SHA-256 `bc8a4268870fc7673b9d3e988d22fa1fa6b68a355757241f71904283abf17c3f`, antes de aplicar `20261012144431_review_rejection_and_upload_recovery.sql`.

La especie se consulta y edita en una ficha: galería, audio, nombres, origen/conservación, presencia/abundancia, tamaño, ecología, descripción y perfil del grupo. Cada bloque tiene su edición; fuentes e historial permanecen plegados. Código y UUID de registros existentes son estables.

Las fotos se ordenan con botones accesibles; la primera es principal. Tres fotos y un audio son el máximo aprobado. Los aportes primero se reservan y procesan; «Usar en la ficha» incorpora un archivo verificado a la propuesta. Un reemplazo fallido conserva el vigente. «Quitar» archiva; una referencia externa retirada explícitamente no vuelve a ser fallback. Restauraciones pasan por la misma verificación y auditoría.

El administrador revisa un resumen y confirma la aplicación; colaboradores envían propuestas a Revisiones. Una ficha o galería cambiada desde la lectura inicial causa conflicto. El borrador no reemplaza lo aprobado. Para enlazar medios usar archivos HTTPS públicos o páginas soportadas de Wikimedia Commons, observaciones de iNaturalist con CC0 y Xeno-canto; derechos y autoría requieren verificación editorial. Una página de origen es distinta del archivo reproducible.

El perfil de aves comparte tipos y presentación con la app: alimentación, abundancia, presencia y tamaño históricos conservan prioridad documentada y su procedencia; no se mezclan con medidas técnicas u observabilidad. Las opciones abiertas reutilizan términos existentes sin modificar los anteriores; ambientes, origen y conservación conservan sus vocabularios.

`/content`: curiosidades, descripciones e historias/lecturas (estas últimas sólo admin). `/games`: dificultad, reglas por especie, trivia y pistas. `/reviews` centraliza solicitudes. `/media` usa consultas paginadas de 30 filas y filtros de procesamiento; `/media?species=…` abre la especie. `/learning` conserva acceso a historias dentro de Contenido.

Ambientes se presenta en tarjetas con filtros de estado; las fichas tienen fotos, jerarquías, bloques de contenido, fuentes por campo y especies asociadas paginadas. El editor conserva datos adicionales y comprueba versión/ausencia de ciclos mediante las RPCs existentes. Foto: editar pie, archivar/restaurar mediante revisión admin; archivo e identidad se conservan.

Verificación: `npm run build`, `npm run typecheck:automation`, `npm run test:editorial` (39 comprobaciones) y `npm run test:visual` (19 comprobaciones en PostgreSQL embebido con las funciones reales de atributos/reserva). `npm run catalog:test-media` y `npm run media:test-external` prueban límite, orden, URLs, destinos y derechos. Las pruebas móviles cubren galería, mapeo y la prioridad compartida de la guía.

Aceptación real: usar una sesión editorial, cargar un fixture sintético CC0 identificado como prueba, esperar procesamiento, verificar Storage/filas, aplicar desde la ficha, recargar y retirar antes de publicar. Conservar historial de prueba; no borrar especies ni modificar user.db.

Aceptación realizada el 12/10/2026 con la cuenta administrativa del responsable: foto y audio subidos desde el navegador, filas persistidas y derivados verificados por los workflows `38204635950` y `38204766279`. Se aplicaron juntos mediante confirmación en la ficha de achará: tres fotos y un audio. Después de recargar, los medios seguían vigentes y el reproductor reprodujo el audio de dos segundos. Se retiraron ambos fixtures desde la ficha antes de publicar; quedan archivados con archivos/checksum e historial, mientras las dos fotos originales conservan orden y principal. Las dos revisiones de prueba sólo cambiaron la fecha de ficha; atributos científicos intactos. Conteos: 1048 activas (948 animales/100 plantas), cero archivadas, 2935 revisiones.

La migración `20261012050316_visual_editor_snapshot_rights.sql` incluye autorización, licencia original e ID externo en la comparación de galería, impidiendo sobrescribir permisos cambiados durante una edición. Se verificó que no hubiera propuestas visuales pendientes al actualizar este contrato.

La lectura administrativa de fotos de ambientes usa `get_editor_habitat_media`, definida en `20261012063500_habitat_editor_media_read.sql`. Incluye archivadas y evidencia privada sólo después de `require_admin`, sin ampliar la vista pública ni los grants de tabla. La suite editorial verifica lectura administrativa y rechazo móvil/anónimo (43 comprobaciones).
