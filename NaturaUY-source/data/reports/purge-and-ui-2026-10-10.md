# Purga y ajustes de interfaz — 10/10/2026

## Alcance

- Se retiraron 19 archivos de código sin uso: generadores alternativos del catálogo, importador botánico histórico y pantallas/componentes provisionales. PostgreSQL y el publicador editorial quedan como único camino de publicación.
- El mapa estático de miniaturas pasó de 1634 a 802 referencias pertenecientes al catálogo publicado. Se conserva el archivo histórico de medios; no se borraron fotos originales ni revisiones.
- El verificador móvil ahora comprueba el artefacto actual en modo de sólo lectura. El importador inicial rechaza una base editorial que ya tenga registros y exige los 1048 UUID y las 100 plantas seleccionadas.
- Las listas conservan páginas por conexión y filtros, evitan solicitudes duplicadas y descartan respuestas atrasadas. Las fotos reinician su estado al reciclar filas, usan caché y no hacen una transición al aparecer.
- El corazón de favoritos del catálogo compacto queda dentro de la fila, con área táctil de 44 × 44; antes aparecía fuera de sus límites y quedaba recortado. No se dibujan insignias vacías cuando falta el estado de conservación. Se probó guardar y quitar una especie, conservando los favoritos previos.
- Las fichas animales comparten el orden de tamaño, presencia, hábitat, alimentación y campos ecológicos separados. La abundancia se muestra por fuera del recuadro de Tamaño, arriba a la derecha, como «Especie …». Los nombres completos se abren al tocar; los meses usan ✓ y la taxonomía tiene conectores cortos alineados. En la exploración taxonómica, los nombres científicos y comunes ocupan líneas separadas y pueden crecer sin truncarse.
- Las plantas conservan su perfil botánico. No se muestra una presencia «Unknown» o «uncertain» como información confirmada.
- Juegos mantiene las tarjetas ilustradas: se retiraron las descripciones y «Jugá ahora» de las vistas previas. Las instrucciones están dentro de cada juego.
- La navegación inferior conserva desenfoque/transparencia, con un botón seleccionado redondeado. Se retiraron enlaces laterales provisionales y se simplificaron Acerca de y Créditos.
- Inicio utiliza el avance automático del propio carrusel, que repite el ciclo y se pausa fuera de Inicio o al pasar la app a segundo plano. Se eliminó el temporizador que avanzaba sólo una vez.
- El reproductor descarta descargas atrasadas y evita pausar un objeto de audio que Expo ya liberó al desmontarse.
- El panel carga sus páginas por separado y el publicador agrupa datos por especie una vez, con filtros en las consultas y paginación determinista.

## Supabase

La migración `20261011001225_streamline_catalog_queries.sql` se aplicó en producción con autorización explícita del responsable. Optimiza la evaluación de funciones de permisos, reúne políticas SELECT equivalentes y agrega cuatro índices por especie. Se respaldaron las 31 definiciones originales de políticas y se probó su restauración en la copia local real antes de aplicar el cambio remoto.

Se conservaron 948 animales y 100 plantas activos, 3057 plantas archivadas y 8354 revisiones. No se eliminaron RPCs utilizadas ni índices históricos basándose solamente en su falta de uso reciente. Las fuentes editoriales históricas se mantienen como evidencia de auditoría.

## Validación

- Aplicación: TypeScript y lint sin errores; 112 pruebas Jest en 27 suites.
- Regresiones nuevas: cambios rápidos de filtros, caché por base, carga de páginas, respuestas de audio atrasadas y liberación del reproductor; separación de campos ecológicos, presencia desconocida y calendario accesible.
- Catálogo incluido v9/schema 14: 1048 UUID/códigos, 948 animales y las 100 plantas exactas del seed; integridad SQLite, claves foráneas, taxonomía, búsqueda, licencias y 177 audios comprobados. No se editó ni regeneró `natura.db`.
- Panel: build, `typecheck:automation`, importación `--dry-run` y seis pruebas del publicador/taxonomía correctos. El JS principal del build pasó de aproximadamente 597 kB a 442 kB; las páginas se descargan como módulos separados.
- PostgreSQL local: 148 pruebas pgTAP en 12 archivos; aplicación y reversión de políticas probadas.
- Pixel 9 Pro XL mediante USB y Expo Go: navegación entre Inicio y Juegos, carrusel con vuelta completa y avance después de deslizar/volver de pestaña, tarjetas de juegos sin textos retirados, botón activo redondeado y vidrio translúcido, nombres completos de Capibara, ficha de mamífero con campos separados, calendario del Pato Gargantilla y conectores taxonómicos; perfil botánico de Marcela conservado.

La validación visual se hizo en Expo Go. Estos cambios no generan un APK nuevo ni reemplazan la instalación habitual de Arapy 1.3.1/build 7. El panel web tampoco se desplegó como parte de esta revisión; la migración de Supabase sí está aplicada.
