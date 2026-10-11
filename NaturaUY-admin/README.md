# Arapy · Panel editorial

Las pistas de Adiviá se administran en Contenido y juegos mediante propuestas y revisión. La migración `20261011191403_enriched_games.sql` está aplicada en producción desde el 11/10/2026; las 40 pistas de ocho especies quedaron aprobadas y auditadas, con autorización específica y respaldo verificado. La vista previa se deriva de esos datos; el catálogo público y el APK continúan en v9/1.3.1. Contrato, puntajes y progreso offline en [games.md](../NaturaUY-source/docs/games.md).

Panel privado para mantener el catálogo aprobado de Arapy. Supabase conserva identidades, permisos, fichas actuales, solicitudes y auditoría. GitHub Actions procesa medios y genera los artefactos públicos; Supabase Storage sirve derivados y el manifiesto estable. El repositorio, dominio e identificadores internos conservan nombres anteriores por compatibilidad.

Las aves incorporan 432 perfiles de Azpiroz 2003 con fuentes por campo, UUID/códigos estables e historial editorial. El procedimiento está en [AVES_AZPIROZ_2003.md](../NaturaUY-source/data/AVES_AZPIROZ_2003.md). Schema 13/14 ya están aplicados; Arapy 1.3.1/build 7 incluye el catálogo público v9.

## Arquitectura

- `profiles` representa cualquier cuenta; `editor_access` agrega una invitación o permiso editorial, sin tablas de usuarios duplicadas.
- `species` contiene únicamente la ficha aprobada; `species_changes` conserva propuesta, validación e historial en una sola entidad. La autovalidación exige confirmación explícita.
- Los administradores son los únicos que pueden solicitar una publicación manual. Durante la etapa inicial ingresan con Google OAuth y una autorización activa en `editor_access`; MFA queda postergado.
- `species_media` limita cada especie a dos imágenes y un audio. Las imágenes nuevas exigen CC0, CC BY 4.0 o autorización verificable y guardan origen, identificador externo, dimensiones, checksum y puntaje; las heredadas ambiguas nunca se publican como fallback.
- La app conserva `user.db`, modo invitado y funcionamiento offline. Favoritos y resultados se sincronizan sólo al iniciar sesión.
- Bugs, sugerencias y solicitudes de revisión entran en la bandeja única `feedback`.
- La migración `202609060003_mobile_feedback_sync.sql` agrega las áreas `species`, `general`, `app` y `games`, contexto de plataforma/versión y los contratos RPC que usa la app (`submit_feedback`, `sync_favorites`, `record_game_result`, `get_game_leaderboard`). La bandeja permite filtrar y cerrar con nota.
- La publicación genera SQLite/JSON/manifest con schema 14. Separa `measurements` y `ecology`, normaliza conservación y conserva el árbol taxonómico, fuentes por campo, galería, trivia y Aprender.
- Las migraciones de Aprender (schema 13), modelo biológico (schema 14) y compatibilidad de medios están aplicadas en Supabase. La galería toma su imagen principal de `species_media.is_primary`; no existe `species.primary_image_id`.
- La revisión móvil de Aprender en desarrollo conserva los 21 módulos bootstrap y agrega lecturas para niñas y niños, 47 preguntas e ilustraciones con fotos del catálogo. No modifica PostgreSQL ni publica derivados. Compatibilidad de contenido y progreso en [learning.md](../NaturaUY-source/docs/learning.md).
- La taxonomía publicada contempla `Arthropoda`, `Arachnida`, `Insecta` y `Malacostraca`. Catalogue of Life y WoRMS llegan como candidatos revisables; BOLD queda limitado a cobertura molecular y no alimenta texto ni medios.
- `catalog_sources`, `enrichment_runs` y `enrichment_candidates` registran procedencia, versión, checksum y diferencias por campo. Una coincidencia automática nunca modifica la ficha aprobada.
- Abundancia experta (`species.abundance_status`) y observabilidad pública (`species_observability_snapshots`) son conceptos separados. La abundancia admite también `fairly_common` (BC) y `rare` (R) de Azpiroz, exige fuente editorial y nunca se deriva de observaciones automáticas. Dificultad, reglas por juego, curiosidades y trivia pasan por `content_changes`.
- `/content` permite proponer y aprobar abundancia, nivel de conocimiento, datos curiosos y preguntas de cuatro opciones. La publicación sólo consume contenido aprobado.
- El actualizador mobile valida versión, compatibilidad, tamaño, SHA-256 e integridad SQLite antes de activar la DB al siguiente inicio.
- El respaldo PostgreSQL se cifra y se conserva como artefacto privado temporal. R2 sigue fuera del primer despliegue; `/m/*` aporta una URL pública estable y redirige al proveedor configurado.
- La importación familiar de aves convierte todos los originales compatibles sin modificarlos, exige correspondencias UUID y autorización revisadas, limita el total a dos imágenes activas por especie y verifica cada carga por SHA-256.

El catálogo activo tiene 1048 especies: 948 animales y exactamente las 100 plantas del JSON seleccionado. Las otras 3057 plantas quedaron archivadas mediante RPCs, con revisiones intactas. De las 100 plantas originales, 96 tenían foto CC0 y cuatro usan el fallback; 71 tienen origen nativo documentado y 29 conservan origen sin determinar. No inventar procedencia ni fotos para superar la validación. Las 594 fotos familiares de 309 aves y los 177 clips ya aprobados de Pedro Rinaldi están en Storage con autorización privada y hashes verificados.

## Desarrollo y verificación

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev

npm run build
npm run typecheck:automation
npm run catalog:import -- --dry-run
npm run catalog:export-json
npm run catalog:import-enrichment        # dry-run
npm run catalog:import-enrichment -- --apply
npm run media:test-guide-selection
# Conversión sin carga; --out debe quedar fuera de --photos
npm run media:import-guide-photos -- --photos 'D:\Fotos\Aves' --out 'D:\Fotos-reducidas'
npm run media:prepare-guide-assigned # prepara Pictures/NaturaUY/assigned para carga manual
# Las carpetas de assigned/guia-aves están en la raíz del bucket guia-aves:
npm run media:reconcile-guide        # plan sin escrituras
npm run media:reconcile-guide -- --apply

cd ../NaturaUY-source
npm run data:arthropod-discovery -- --batch=50  # backlog candidate-only de GBIF
npm run data:traits
npm run data:catalog-media -- --reelect-all
npm run data:external-discovery -- --batch=25
```

El panel requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para funcionar. No existe un fallback de datos demo: si faltan esas variables, muestra un error de configuración. En Cloudflare Pages deben configurarse únicamente para el entorno Production; nunca colocar una `service_role` key en el frontend.

Los tests SQL viven en `supabase/tests/` y se ejecutan con `npx supabase test db` cuando Docker/Supabase local está disponible.

## Directorios

- `src/`: panel, autenticación y flujos de solicitudes/revisión.
- `supabase/migrations/`: esquema, RLS, Storage y RPCs transaccionales.
- `supabase/functions/`: invitaciones y dispatch seguro a GitHub Actions.
- `supabase/tests/`: pgTAP para RLS, permisos, conflictos, autovalidación y límites de medios.
- `scripts/`: importación, medios, export JSON y publicación.
- `../.github/workflows/`: medios, publicación manual y respaldo/limpieza.

La operación de cutover está documentada en [docs/deployment.md](docs/deployment.md).
El catálogo publicado conserva la clasificación editorial y sus ancestros en SQLite y `taxonomy.json`; el publicador bloquea especies sin vínculos y la app rechaza schema 14 sin sus tablas taxonómicas.
La preparación, carga manual y reconciliación de fotos familiares están documentadas en [docs/importacion-fotos-guia-aves.md](docs/importacion-fotos-guia-aves.md). La reconciliación verifica los objetos en Storage, da prioridad a las fotos familiares y completa automáticamente los lugares libres con imágenes externas de licencia admitida. Conserva el historial y deja como máximo dos imágenes activas por especie.

## Recuperación del catálogo aprobado

`catalog:audit-arapy -- --write` coteja todos los perfiles contra el Excel normalizado y actualiza la correspondencia editorial. Los comandos `catalog:archive-unselected-plants`, `catalog:restore-selected-plants`, `media:restore-approved-images` y `media:restore-approved-audio` son dry-run por defecto; `--sql` genera transacciones para una conexión administrativa autorizada. Los workers sólo marcan derivados verificados como `ready`; aprobar por `review_species_change` antes de publicar. El importador inicial sólo admite bases vacías y rechaza una base en uso; el dry-run verifica las 1048 especies actuales sin escribir.

`catalog:prepare-release` usa schema 14/min app 1.3.1 y elige una versión mayor que el catálogo remoto y el incluido en la app. `CATALOG_DATA_VERSION_FLOOR` permite superar versiones de prueba anteriores. La selección de 100 plantas se valida tanto al cargar como al construir. No ejecutar el pipeline histórico de Flora masiva para preparar una publicación.

El publicador deriva las paletas desde la miniatura de cada foto principal aprobada, conserva su identidad/hash en JSON y usa los mismos colores en SQLite. Necesita lectura de Storage durante `catalog:build`; un error de descarga o extracción bloquea la publicación, sin sustituir silenciosamente el color por verde. El informe incluye cobertura y cantidad de acentos distintos. No ejecutar `npm run build` del panel mientras se genera el catálogo: Vite limpia `dist/`, que también contiene `dist/catalog/`.
Las páginas del panel se cargan por ruta para reducir el JavaScript inicial. El publicador filtra especies activas, medios aprobados y evaluaciones vigentes en PostgreSQL, ordena su paginación y agrupa filas por especie antes de construir el catálogo. Los generadores alternativos locales y la aplicación automática de rasgos sobre JSON fueron retirados. `data:catalog-verify` y `data:thumbnail-map` en la app comprueban los derivados incluidos.
