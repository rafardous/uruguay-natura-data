# Arapy · Panel editorial

Panel privado para mantener el catálogo aprobado de Arapy. Supabase conserva identidades, permisos, fichas actuales, solicitudes y auditoría. GitHub Actions procesa medios y genera los artefactos públicos; Supabase Storage sirve derivados y el manifiesto estable. El repositorio, dominio e identificadores internos conservan nombres anteriores por compatibilidad.

Las aves incorporan 432 perfiles de Azpiroz 2003 con fuentes por campo e historial editorial. `npm run catalog:import-azpiroz` permite verificar los lotes y generar SQL para las RPCs existentes; el procedimiento y las excepciones están en [AVES_AZPIROZ_2003.md](../NaturaUY-source/data/AVES_AZPIROZ_2003.md). No requiere desplegar schema 13.

Las aves incorporan 432 perfiles de Azpiroz 2003 con fuentes por campo e historial editorial. `npm run catalog:import-azpiroz` permite verificar los lotes y generar SQL para las RPCs existentes; el procedimiento y las excepciones están en [AVES_AZPIROZ_2003.md](../NaturaUY-source/data/AVES_AZPIROZ_2003.md). No requiere desplegar schema 13.

## Arquitectura

- `profiles` representa cualquier cuenta; `editor_access` agrega una invitación o permiso editorial, sin tablas de usuarios duplicadas.
- `species` contiene únicamente la ficha aprobada; `species_changes` conserva propuesta, validación e historial en una sola entidad. La autovalidación exige confirmación explícita.
- Los administradores son los únicos que pueden solicitar una publicación manual. Durante la etapa inicial ingresan con Google OAuth y una autorización activa en `editor_access`; MFA queda postergado.
- `species_media` limita cada especie a dos imágenes y un audio. Las imágenes nuevas exigen CC0, CC BY 4.0 o autorización verificable y guardan origen, identificador externo, dimensiones, checksum y puntaje; las heredadas ambiguas nunca se publican como fallback.
- La app conserva `user.db`, modo invitado y funcionamiento offline. Favoritos y resultados se sincronizan sólo al iniciar sesión.
- Bugs, sugerencias y solicitudes de revisión entran en la bandeja única `feedback`.
- La migración `202609060003_mobile_feedback_sync.sql` agrega las áreas `species`, `general`, `app` y `games`, contexto de plataforma/versión y los contratos RPC que usa la app (`submit_feedback`, `sync_favorites`, `record_game_result`, `get_game_leaderboard`). La bandeja permite filtrar y cerrar con nota.
- La publicación genera SQLite/JSON/manifest con schema 14. Separa `measurements` y `ecology`, normaliza conservación y conserva el árbol taxonómico, fuentes por campo, galería, trivia y Aprender.
- Las migraciones de Aprender (schema 13) y del modelo biológico (schema 14) están preparadas localmente. No cambian el estado remoto hasta aplicar las migraciones y publicar un nuevo catálogo.
- La taxonomía publicada contempla `Arthropoda`, `Arachnida`, `Insecta` y `Malacostraca`. Catalogue of Life y WoRMS llegan como candidatos revisables; BOLD queda limitado a cobertura molecular y no alimenta texto ni medios.
- `catalog_sources`, `enrichment_runs` y `enrichment_candidates` registran procedencia, versión, checksum y diferencias por campo. Una coincidencia automática nunca modifica la ficha aprobada.
- Abundancia experta (`species.abundance_status`) y observabilidad pública (`species_observability_snapshots`) son conceptos separados. La abundancia usa cinco valores fijos, exige fuente editorial y nunca se deriva de observaciones automáticas. Dificultad, reglas por juego, curiosidades y trivia pasan por `content_changes`.
- `/content` permite proponer y aprobar abundancia, nivel de conocimiento, datos curiosos y preguntas de cuatro opciones. La publicación sólo consume contenido aprobado.
- El actualizador mobile valida versión, compatibilidad, tamaño, SHA-256 e integridad SQLite antes de activar la DB al siguiente inicio.
- El respaldo PostgreSQL se cifra y se conserva como artefacto privado temporal. R2 sigue fuera del primer despliegue; `/m/*` aporta una URL pública estable y redirige al proveedor configurado.
- La importación familiar de aves convierte todos los originales compatibles sin modificarlos, exige correspondencias UUID y autorización revisadas, limita el total a dos imágenes activas por especie y verifica cada carga por SHA-256.

La línea base animal queda en 1052 registros/948 especies. La nueva selección local conserva 100 plantas; el remoto todavía tiene 3157 plantas activas en schema 12 y el SQLite móvil anterior permanece hasta completar el recorte editorial y verificar 100 fotos aprobadas. Los medios con licencia ambigua quedan archivados para revisión.

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
La preparación, carga manual y reconciliación de fotos familiares están documentadas en [docs/importacion-fotos-guia-aves.md](docs/importacion-fotos-guia-aves.md). La reconciliación verifica los objetos en Storage, da prioridad a las fotos familiares y completa automáticamente los lugares libres con imágenes externas de licencia admitida. Conserva el historial y deja como máximo dos imágenes activas por especie.
