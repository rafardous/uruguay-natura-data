# Editor visual

La especie se consulta y edita en una ficha: galería, audio, nombres, origen/conservación, presencia/abundancia, tamaño, ecología, descripción y perfil del grupo. Cada bloque tiene su edición; fuentes e historial permanecen plegados. Código y UUID de registros existentes son estables.

Las fotos se ordenan con botones accesibles; la primera es principal. Tres fotos y un audio son el máximo aprobado. Los aportes primero se reservan y procesan; «Usar en la ficha» incorpora un archivo verificado a la propuesta. Un reemplazo fallido conserva el vigente. «Quitar» archiva; una referencia externa retirada explícitamente no vuelve a ser fallback. Restauraciones pasan por la misma verificación y auditoría.

El administrador revisa un resumen y confirma la aplicación; colaboradores envían propuestas a Revisiones. Una ficha o galería cambiada desde la lectura inicial causa conflicto. El borrador no reemplaza lo aprobado. Para enlazar medios usar archivos HTTPS públicos o páginas soportadas de Wikimedia Commons, observaciones de iNaturalist con CC0 y Xeno-canto; derechos y autoría requieren verificación editorial. Una página de origen es distinta del archivo reproducible.

El perfil de aves comparte tipos y presentación con la app: alimentación, abundancia, presencia y tamaño históricos conservan prioridad documentada y su procedencia; no se mezclan con medidas técnicas u observabilidad. Las opciones abiertas reutilizan términos existentes sin modificar los anteriores; ambientes, origen y conservación conservan sus vocabularios.

`/content`: curiosidades, descripciones e historias/lecturas (estas últimas sólo admin). `/games`: dificultad, reglas por especie, trivia y pistas. `/reviews` centraliza solicitudes. `/media` usa consultas paginadas de 30 filas y filtros de procesamiento; `/media?species=…` abre la especie. `/learning` conserva acceso a historias dentro de Contenido.

Ambientes se presenta en tarjetas con filtros de estado; las fichas tienen fotos, jerarquías, bloques de contenido, fuentes por campo y especies asociadas paginadas. El editor conserva datos adicionales y comprueba versión/ausencia de ciclos mediante las RPCs existentes. Foto: editar pie, archivar/restaurar mediante revisión admin; archivo e identidad se conservan.

Verificación: `npm run build`, `npm run typecheck:automation`, `npm run test:editorial` (39 comprobaciones) y `npm run test:visual` (18 comprobaciones en PostgreSQL embebido con las funciones reales de atributos/reserva). `npm run catalog:test-media` y `npm run media:test-external` prueban límite, orden, URLs, destinos y derechos. Las pruebas móviles cubren galería, mapeo y la prioridad compartida de la guía.

Aceptación real: usar una sesión editorial, cargar un fixture sintético CC0 identificado como prueba, esperar procesamiento, verificar Storage/filas, aplicar desde la ficha, recargar y retirar antes de publicar. Conservar historial de prueba; no borrar especies ni modificar user.db.
