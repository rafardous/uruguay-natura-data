# Despliegue y cutover

## Gestión web ampliada — 11/10/2026

`20261011231526_editorial_frontend_management.sql` incorpora revisiones inmutables, gestión admin de `learning_paths`, calendario de Inicio, estadísticas agregadas privadas, edición de medios y relaciones de ambientes. Corrige la reserva al reemplazar medios archivados y admite nuevos autores de audio con derechos verificados. Está aplicada en producción desde el 11/10/2026. El respaldo cifrado del workflow `38183187752` se descargó y se verificó con SHA-256 `bf7bb467b0974df218a05557ae9799bd35321ef59d201de72bcbd4775765a286`; los dispatch manuales ya no ejecutan limpieza de medios. Pasaron 39 pruebas editoriales, la instalación sobre columnas/restricciones/funciones del esquema real y las comprobaciones remotas de RPCs/RLS con rollback. Se conservaron 1048 especies activas (948 animales/100 plantas), 3057 plantas archivadas y 9047 revisiones de especies; ninguna fila de prueba quedó persistida. Se ejecutaron los asesores de seguridad: las RPCs nuevas exigen administrador y el calendario público expone sólo fecha, tipo y código de especie. No repetir importaciones históricas ni publicar automáticamente lecturas bootstrap.

El catálogo exporta historias aprobadas o marcas de archivo, y el calendario como tabla SQLite opcional compatible con schema 14/15. Se detectan cambios editoriales publicables mediante `catalog_management_dirty` además del estado previo. `/learning` y `/home` son admin-only; RLS impide lectura de borradores y estadísticas privadas a cuentas móviles. Las escrituras usan RPCs y conservan revisiones. Las pantallas móviles nuevas leen el catálogo offline, refrescan favoritos y consultan programación sin bloquear el arranque; su aceptación necesita un APK nuevo. Ver [frontend-management.md](frontend-management.md).

## Juegos en desarrollo — 11/10/2026

La migración `20261011191403_enriched_games.sql` agrega pistas editoriales y RPCs privadas de récords para Adiviá/Encastrar. Está aplicada en `xbnbfekcxrkgteuijbzh` desde el 11/10/2026, luego de autorización específica y pruebas en PostgreSQL local. El respaldo cifrado del workflow `38164442217` fue descargado y su digest comprobado antes del cambio. Se conservaron 1048 especies activas (948 animales/100 plantas) y 3057 plantas archivadas.

`npx tsx scripts/seed-guess-clues.ts` genera SQL sin aplicarlo. Las 40 pistas se propusieron y aprobaron en una transacción bajo un editor autorizado, con `request.jwt.claims` configurado; cada pista conserva evidencia y valores auditados. El generador es idempotente para textos iguales y rechaza sobrescribir pistas diferentes. Se verificaron RLS, permisos, lectura editorial y sincronización vacía con rollback; los asesores no informaron hallazgos nuevos. Regenerar con `catalog:preview`, comprobar el informe y usar `catalog:install-preview` sólo para desarrollo; nunca guardar credenciales en Git. La vista previa actual proviene íntegramente de PostgreSQL de producción. El manifiesto remoto y el APK publicado siguen en v9/1.3.1.

El catálogo exporta `species_game_clues` y `game.clues`; los lectores anteriores ignoran la tabla adicional. El estado `dirty` utiliza las revisiones aprobadas existentes. Los nuevos récords se sincronizan por `sync_enriched_game_records` / `get_enriched_game_records`, con RLS por cuenta; no alteran Puzzle deslizante ni sus récords. Ver [games.md](../../NaturaUY-source/docs/games.md). No ejecutar el build de Vite al mismo tiempo que el publicador.

Proyecto Supabase objetivo: `xbnbfekcxrkgteuijbzh`. El panel productivo está publicado en `https://uruguay-natura-data.pages.dev`. No guardar secretos en Git ni en archivos versionados.

## 1. Preflight y respaldo

La migración aborta si las tablas experimentales ya contienen catálogo, medios, datos móviles, reportes o releases. Antes de aplicarla:

1. Congelar escrituras del panel.
2. Confirmar otra vez los conteos remotos.
3. Ejecutar manualmente el workflow `Mantenimiento editorial` y descargar el artefacto PostgreSQL cifrado.
4. Conservar la DB/JSON públicos actuales y no eliminar releases ni tags.

```powershell
npm ci
npx supabase link --project-ref xbnbfekcxrkgteuijbzh
npx supabase db push --linked --dry-run --include-all
```

Con Docker Desktop activo, validar primero desde cero:

```powershell
npx supabase db reset
npx supabase test db
```

Sólo después de estas pruebas:

```powershell
npx supabase db push --linked
npx supabase config push
```

Las migraciones hasta `202610100001_guide_primary_media_compatibility.sql` están aplicadas. Schema 14/min app 1.3.1 es el contrato actual. La importación histórica tuvo 4105 especies; el 10/10/2026 se archivaron por RPC las 3057 plantas no seleccionadas. El catálogo activo tiene 1048 especies: 948 animales y 100 plantas. No repetir el importador inicial sobre la base en uso.

Schema 13 está desplegado desde el 10/10/2026. `20260913162759_learning_content_and_progress.sql` agrega `learning_paths`, progreso privado de módulos/objetivos, `sync_learning_progress` y amplía `get_personal_mobile_progress`; al aplicarse fuerza los releases nuevos a schema 13. Verificar las pruebas RLS/RPC antes de publicar.

## 2. Identidad editorial

Google sigue disponible para cuentas mobile. El registro por correo editorial sólo se habilita si existe una fila activa en `editor_access`; entrar al panel requiere esa misma fila.

La URL de sitio productiva es `https://uruguay-natura-data.pages.dev`. El cliente OAuth web de Google debe usar `https://xbnbfekcxrkgteuijbzh.supabase.co/auth/v1/callback` como URI de redirección autorizada. La redirección del panel termina en `/login`.

Antes de ejecutar `npx supabase config push`, cargar el Client ID y el Client Secret de Google únicamente en la sesión local. Si faltan, configurar Google desde `Authentication > Sign In / Providers` en el Dashboard y no empujar la configuración hasta disponer de ambos valores.

```powershell
$env:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID = 'CLIENT_ID_DE_GOOGLE'
$env:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET = 'CLIENT_SECRET_DE_GOOGLE'
npx supabase config push
Remove-Item Env:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
Remove-Item Env:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET
```

Promoción inicial:

```sql
insert into public.editor_access(email,user_id,role,active,accepted_at)
select lower(email),id,'admin',true,now() from auth.users where email='ADMIN@EJEMPLO.COM'
on conflict(email) do update set user_id=excluded.user_id,role='admin',active=true,accepted_at=now();
```

Durante la etapa inicial, los administradores ingresan con Google OAuth y una fila activa con rol `admin` en `editor_access`. MFA TOTP no se exige todavía y deberá reactivarse en frontend, RLS y Edge Functions cuando el proyecto avance. Los colaboradores posteriores se invitan desde `/users`.

## 3. Edge Functions y GitHub

```powershell
npx supabase functions deploy invite-user
npx supabase functions deploy set-user-active
npx supabase functions deploy request-media-processing
npx supabase functions deploy request-catalog-publish
npx supabase secrets set GITHUB_REPOSITORY=rafardous/uruguay-natura-data
npx supabase secrets set GITHUB_DISPATCH_TOKEN=TOKEN_INGRESADO_LOCALMENTE
npx supabase secrets set PUBLIC_APP_ORIGIN=https://TU_PANEL
```

GitHub Actions necesita `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `EDITORIAL_SYSTEM_USER_ID` y `BACKUP_ENCRYPTION_PASSWORD`. No requiere claves R2.

## 4. Importación inicial

```powershell
$env:SUPABASE_URL = 'https://xbnbfekcxrkgteuijbzh.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'INGRESAR_LOCALMENTE'
$env:EDITORIAL_BOOTSTRAP_USER_ID = 'UUID_ADMIN'
$env:EDITORIAL_SYSTEM_USER_ID = 'UUID_ADMIN'
npm run catalog:import -- --dry-run
npm run catalog:import
npm run media:migrate-external -- --dry-run
npm run media:migrate-external
```

El importador inicial verifica las 1048 especies únicas del catálogo aprobado: 948 animales y exactamente las 100 plantas seleccionadas. Sólo permite escribir en una base vacía; para una base en uso se deben crear revisiones mediante RPCs. La importación histórica de 4105 especies se conserva por auditoría, con 3057 plantas archivadas; no repetirla.

## 5. Panel, Storage y publicación

Antes de importar enriquecimiento, generar y revisar los artefactos locales. `data:observability` procesa 25 especies por defecto y conserva checkpoint; repetir hasta que el informe indique `complete: true`. La importación requiere `--apply` y nunca aprueba candidatos taxonómicos automáticamente.

```powershell
cd ../NaturaUY-source
npm run data:arthropod-discovery -- --batch=50
npm run data:enrichment-candidates
npm run data:traits
npm run data:catalog-media -- --reelect-all
npm run data:plant-media -- --limit=100
npm run data:plant-taxonomy -- --batch=100
npm run data:observability -- --batch=25
npm run data:external-discovery -- --batch=25
cd ../NaturaUY-admin
npm run catalog:import-enrichment
npm run catalog:import-enrichment -- --apply
```

Antes de publicar, revisar `data/reports/arthropod-discovery-candidates.json`, `data/reports/trait-enrichment-candidates.json`, `common-name-report.json`, `image-selection-report.json`, `plant-image-selection-report.json`, `plant-taxonomy-candidates.json` y `external-enrichment-candidates.json`. El discovery de GBIF es candidate-only: aunque encuentre miles de taxones, no se importan al catálogo sin una decisión editorial. Los sinónimos, órdenes e IDs de WFO, valores imputados, IDs de Catalogue of Life/WoRMS y fuentes `review_only` deben permanecer como conflictos hasta su aprobación; BOLD sólo se conserva como evidencia de cobertura; una especie sin imagen válida usa el fallback visual. La consulta botánica se hace en lotes para no bloquear el pipeline y sólo acepta CC0 de iNaturalist o CC0/CC BY 4.0 exacta de Wikimedia.

El panel se hospeda como frontend estático en Cloudflare Pages desde la rama `main` del repositorio `rafardous/uruguay-natura-data`. Use `NaturaUY-admin` como directorio raíz, `npm run build` como comando y `dist` como salida. Configure `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` únicamente en Production; el panel no tiene fallback de datos demo y muestra un error de configuración si faltan. Nunca colocar una `service_role` key en Cloudflare.

Los derivados se leen directamente desde el bucket público `media-public`; el manifest estable, desde `catalog-public/manifest.json`.

El panel sube originales únicamente a rutas reservadas por `reserve_species_media_upload`, con `upsert=false`, MIME/tamaño validados y declaración de derechos. GitHub Actions escribe los derivados con `service_role`.

La publicación es manual y admin-only. El Release contiene únicamente DB, DB comprimida, JSON públicos, manifest e informe. `build-metadata.json` no se adjunta.

## 6. Mobile y piloto

La revisión de Aprender en desarrollo (octubre de 2026) cambia lecturas y UI bootstrap, sin migración ni importación editorial. Conserva 21 IDs de módulos, agrega preguntas y sólo incrementa la versión de `tax-purpose`. Verificar reintentos, avance entre módulos, fotos del catálogo y conservación de progreso según [learning.md](../../NaturaUY-source/docs/learning.md). No forma parte del APK ya publicado; necesita una actualización de la app.

El enriquecimiento Azpiroz usa `natural_history.bird` y conserva fuentes por campo. Consultar `../../NaturaUY-source/data/AVES_AZPIROZ_2003.md`. El publicador y `prepare-release` usan schema 14/min app 1.3.1; la versión debe superar tanto la remota como la incluida. Arapy 1.3.1 incluye el catálogo público data_version 9. Sólo cargar fichas y medios aprobados; validar 100 plantas, 432 perfiles, 309 vínculos familiares y 594 fotos antes de publicar.

La app utiliza claves públicas y continúa operativa sin login. Soporta hasta schema de catálogo 14 y conserva `user.db`; schema 13 agrega documentos de Aprender al catálogo y mantiene el progreso exclusivamente en la base personal. Antes de reabrir escrituras:

```powershell
cd ../NaturaUY-source
npx tsc --noEmit
npm run lint
npm test -- --runInBand
npm run data:catalog-verify
```

Verificar en dos cuentas editoriales: aprobación normal, autovalidación confirmada, rechazo, conflicto; dos imágenes y un audio por especie; favorito y partida offline; checksum inválido, DB inválida, esquema incompatible y restauración de la copia anterior. Publicar primero un piloto y comparar conteos/SHA antes de descongelar el panel.

Si algo falla antes de reabrir escrituras, restaurar frontend, grants/RPCs anteriores y el backup. Después de aceptar solicitudes nuevas, preferir roll-forward para no perder cambios posteriores al corte.

## 7. Operación verificada del 10/10/2026

Se descargó y comprobó el SHA-256 del respaldo PostgreSQL cifrado del workflow de mantenimiento antes de migrar. Además se conservó una copia local completa protegida con Windows DPAPI. El workflow usa PostgreSQL 17 y el pooler IPv4 para compatibilidad con el servidor; no guardar volcados ni contraseñas en Git.

Se validó una copia real del esquema y catálogo en Docker: 143 pruebas pgTAP, 12 archivos, aprobadas. Las migraciones históricas de datos no se pueden probar simplemente contra una base vacía sin sus fixtures de taxonomía; `db reset` solo no reproduce el estado productivo. Se aplicaron schema 13/14 y las migraciones de medios después de ese respaldo y prueba. No se ampliaron grants ni se fingió MFA.

La fuente versionada de selección es `seed-100.json`; los otros 3057 registros se preservan archivados. Se recuperaron 96 fotos CC0 y los nombres/origen documentado de las 100 plantas. Cuatro plantas sin foto y 29 sin origen documentado generan advertencias; derechos inválidos, autoría incompleta u objetos de una foto aprobada ausentes siguen bloqueando.

Para retomar una publicación construida localmente, volver el release todavía no publicado a `pending` antes de ejecutar el workflow con su UUID. Conservar las versiones y tags anteriores. Después verificar la URL pública `/catalog/manifest.json`, descargar el SQLite real y cotejar SHA-256/esquema/conteos; copiar ese mismo binario publicado a `assets/db/natura.db`.

Android: `eas build -p android --profile field-guide` genera un APK interno con versión de build incrementada y la firma EAS existente. `.easignore` en la raíz excluye credenciales, volcados, caches y nativos locales, e incluye los clips aprobados para uso offline, conforme a la [documentación de Expo](https://docs.expo.dev/build-reference/easignore/). Verificar firma y usar `adb install -r`; nunca desinstalar ni borrar `user.db` para probar una actualización.

Para audio offline, comprobar además la resolución de `species_media.external_id` hasta el dominio móvil y el mapa de assets. Contar MP3 dentro del APK no demuestra que una URL pública encuentre su clip local. Los 177 clips aprobados conservan identidad Xeno-canto y se resuelven sin modificar la URL del catálogo.

El publicador deriva las paletas desde la miniatura de cada foto principal aprobada, conserva su identidad/hash en JSON y usa los mismos colores en SQLite. Necesita lectura de Storage durante `catalog:build`; un error de descarga o extracción bloquea la publicación, sin sustituir silenciosamente el color por verde. El informe incluye cobertura y cantidad de acentos distintos. No ejecutar `npm run build` del panel mientras se genera el catálogo: Vite limpia `dist/`, que también contiene `dist/catalog/`.

La exportación también incluye `taxa`, `species_taxa`, `taxon_names` y `taxon_closure`, con los IDs editoriales y todos los ancestros de las especies seleccionadas. Los nodos exclusivos de plantas archivadas quedan fuera. Se publica `taxonomy.json` y se bloquean árboles incompletos, ciclos, especies sin clasificación o errores de claves foráneas. La app valida estas tablas antes de activar un schema 14: un número de esquema y un checksum correctos no bastan para aceptar un contrato incompleto.

Entrega verificada: catálogo público v9/schema 14 y [APK Arapy 1.3.1/build 7](https://github.com/rafardous/uruguay-natura-data/releases/download/catalog-v9/Arapy-1.3.1.apk). Se comprobó la descarga real, firma compatible, SQLite incluido idéntico al público, actualización del Pixel sin pérdida de datos y reproducción offline. Los informes públicos están en `NaturaUY-source/data/reports/arapy-*-verification.json` y `arapy-native-acceptance.json`. La publicación en tiendas queda fuera de esta entrega.
## Mantenimiento del código y consultas

Se retiraron los generadores locales de catálogo, la importación masiva de Flora y la aplicación automática de rasgos sobre JSON. PostgreSQL es la única fuente editorial; `catalog:build` deriva el catálogo aprobado. `data:catalog-verify` abre SQLite en modo lectura y valida 1048 identidades, la selección seed-100, medios y taxonomía. `data:thumbnail-map -- --write` depura referencias de miniaturas, conservando archivos históricos.

La migración `20261011001225_streamline_catalog_queries.sql` optimiza las políticas de lectura con funciones evaluadas una vez por consulta, combina políticas SELECT equivalentes y agrega cuatro índices por especie. No modifica fichas, revisiones, fuentes ni RPCs. Antes de aplicarla, conservar las definiciones anteriores de políticas y probar la reversión sobre una copia local real. La suite incluye aislamiento de favoritos/récords y acceso a noticias para cuentas móviles. Registrar por separado la prueba local y su aplicación remota.
El 10/10/2026 se aplicó la optimización de consultas en `xbnbfekcxrkgteuijbzh`, con autorización explícita del responsable. Se respaldaron las 31 políticas originales y se probó su restauración en Docker antes de reaplicar la migración local. Pasaron 148 pruebas pgTAP en 12 archivos. Después de la aplicación remota permanecen 948 animales y 100 plantas activos, 3057 plantas archivadas y 8354 revisiones; los cuatro índices están presentes. El asesor dejó de informar evaluación RLS por fila y políticas SELECT múltiples equivalentes. No se eliminaron índices históricos por falta de uso reciente.
