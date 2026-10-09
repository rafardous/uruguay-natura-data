# Despliegue y cutover

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

Las migraciones schema 9–12 están aplicadas en el proyecto remoto. Schema 12 agrega perfiles vegetales, nombres y cierre taxonómico, raíces por reino, el scope de juegos `plants` y fuerza publicaciones nuevas a schema 12/min app 1.2.0. La importación inicial se completó el 2026-09-13 con 4105 especies, 3157 perfiles botánicos, 2113 nodos y 2132 nombres taxonómicos; futuras corridas del importador son idempotentes.

Schema 13 y schema 14 están preparados localmente pero no desplegados. Schema 13 agrega Aprender; `20260922222302_catalog_schema_14_measurements_ecology_conservation.sql` agrega mediciones, ecología y evaluaciones de conservación y fuerza releases schema 14. Aplicar en orden y verificar RLS/RPC antes de publicar. La migración `202609230001_media_only_catalog_publish.sql` va después de ambas, `202609230002_curated_plant_profile.sql` sincroniza altura y fenología, `20260924034900_replace_guide_bird_media.sql` habilita la sustitución familiar y `20260924050000_reconcile_guide_bird_media.sql` permite mezclar fotos familiares y externas. No usar un `db push` general sin revisar antes el plan completo. El respaldo automático del 2026-09-23 no es válido: el workflow tenía vacíos `SUPABASE_DB_URL` y `BACKUP_ENCRYPTION_PASSWORD` y produjo un artefacto de 220 bytes. Configurar ambos secretos, volver a ejecutarlo y comprobar un respaldo cifrado mayor a 1 KiB antes de cualquier migración o archivo masivo.

Las evaluaciones nacionales se importan desde un archivo oficial indicado por `NATIONAL_RED_LIST_PATH`. La consulta de UICN exige `IUCN_RED_LIST_TOKEN` y la confirmación explícita `IUCN_CACHE_PERMISSION_CONFIRMED=true`; el token es secreto local/CI y nunca se guarda en Git. `npm run data:conservation` genera candidatos para revisión humana y no publica automáticamente.

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

El importador inicial registró 4209 entradas y 4105 especies. La línea base animal conserva 948 códigos. El nuevo `data:plants` genera 100 plantas; `data:catalog-refresh` también produce candidatos de origen/hábito, taxonomía y foto para esas 100. El archivo bruto del catálogo anterior ya no alimenta el pipeline, y las etapas de medios y construcción rechazan un `plantae.json` distinto de `seed-100.json`. Las candidatas no equivalen a aprobación. `catalog:import` omite plantas ya existentes para no pisar sus revisiones. Antes de archivar las otras 3057, ejecutar `catalog:curate-plants` sin `--apply` con una sesión de administrador y revisar `data/reports/plant-cutover-diff.json`. Tras verificar el respaldo cifrado, configurar `EDITORIAL_BACKUP_VERIFIED=true` y ejecutar `catalog:curate-plants -- --apply`; se puede reanudar y usar `--limit=N`. El comando bloquea el recorte mientras cualquiera de las 100 no tenga origen nativo documentado y foto aprobada con atribución, derechos y objetos en Storage. Requiere `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_EDITOR_ACCESS_TOKEN` en el entorno local, nunca en Git. El recorte usa `submit_species_change` y `review_species_change`, conserva UUID/códigos y no borra revisiones.

## 5. Panel, Storage y publicación

Antes de importar enriquecimiento, generar y revisar los artefactos locales. `data:observability` procesa 25 especies por defecto y conserva checkpoint; repetir hasta que el informe indique `complete: true`. La importación requiere `--apply` y nunca aprueba candidatos taxonómicos automáticamente.

```powershell
cd ../NaturaUY-source
npm run data:arthropod-discovery -- --batch=50
npm run data:enrichment-candidates
npm run data:traits
npm run data:catalog-media -- --reelect-all
npm run data:plant-media -- --limit=100
npm run data:plant-enrichment
npm run data:plant-taxonomy -- --batch=100
npm run data:plants
npm run data:observability -- --batch=25
npm run data:external-discovery -- --batch=25
cd ../NaturaUY-admin
npm run catalog:import-enrichment
npm run catalog:import-enrichment -- --apply
```

Antes de publicar, revisar `data/reports/arthropod-discovery-candidates.json`, `data/reports/trait-enrichment-candidates.json`, `common-name-report.json`, `image-selection-report.json`, `plant-image-selection-report.json`, `plant-enrichment-candidates.json`, `plant-taxonomy-candidates.json` y `external-enrichment-candidates.json`. El discovery de GBIF es candidate-only: aunque encuentre miles de taxones, no se importan al catálogo sin una decisión editorial. Los sinónimos, órdenes e IDs de WFO, valores imputados, IDs de Catalogue of Life/WoRMS y fuentes `review_only` deben permanecer como conflictos hasta su aprobación; BOLD sólo se conserva como evidencia de cobertura. Las 100 plantas requieren origen nativo documentado y al menos una foto procesada y aprobada antes de publicar; los animales sin imagen válida usan el fallback visual. La consulta botánica se hace en lotes y sólo propone CC0 de iNaturalist o CC0/CC BY 4.0 exacta de Wikimedia.

El panel se hospeda como frontend estático en Cloudflare Pages desde la rama `main` del repositorio `rafardous/uruguay-natura-data`. Use `NaturaUY-admin` como directorio raíz, `npm run build` como comando y `dist` como salida. Configure `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` únicamente en Production; el panel no tiene fallback de datos demo y muestra un error de configuración si faltan. Nunca colocar una `service_role` key en Cloudflare.

Los derivados generales se guardan en `media-public`; las fotos de la guía de aves están en el bucket público `guia-aves`, con claves `NNN/01.webp` y sus miniaturas. El catálogo editorial genera URLs directas a `guia-aves` para estos medios y conserva `/m/*` para los demás; la Pages Function también redirige rutas antiguas `/m/guia-aves/*` al bucket nuevo. El manifest estable se lee desde `catalog-public/manifest.json`.

Las fotos familiares de la guía se preparan con `media:prepare-guide-assigned` en `C:\Users\rafar\Pictures\NaturaUY\assigned`. El 24/09/2026 se subieron sus 1188 objetos a la raíz de `guia-aves` y se verificaron por SHA-256. `media:reconcile-guide -- --apply` comprobará otra vez los objetos, registrará la declaración privada de autorización en `media-evidence` y vinculará las fotos cuando estén aplicadas las migraciones pendientes. Completa los cupos libres con fotos externas de licencia admitida, conserva el máximo de dos imágenes y archiva los medios sustituidos mediante una RPC transaccional. Seguir [importacion-fotos-guia-aves.md](importacion-fotos-guia-aves.md). El pipeline móvil `data:guide-media` verifica las fotos del bucket antes de incorporarlas al SQLite; el catálogo editorial comprueba Storage antes de crear un Release.

El panel sube originales únicamente a rutas reservadas por `reserve_species_media_upload`, con `upsert=false`, MIME/tamaño validados y declaración de derechos. GitHub Actions escribe los derivados con `service_role`.

La publicación es manual y admin-only. El Release contiene únicamente DB, DB comprimida, JSON públicos, manifest e informe. `build-metadata.json` no se adjunta.

## 6. Mobile y piloto

La app utiliza claves públicas y continúa operativa sin login. La versión 1.3.0 soporta hasta schema de catálogo 14, conserva `user.db` y transforma catálogos 12/13 al modelo nuevo en memoria. Releases schema 14 deben declarar `min_app_version: 1.3.0`. Antes de reabrir escrituras:

```powershell
cd ../NaturaUY-source
npx tsc --noEmit
npm run lint
npm test -- --runInBand
npm run data:catalog-db
npm run data:catalog-verify
```

Verificar en dos cuentas editoriales: aprobación normal, autovalidación confirmada, rechazo, conflicto; dos imágenes y un audio por especie; favorito y partida offline; checksum inválido, DB inválida, esquema incompatible y restauración de la copia anterior. Publicar primero un piloto y comparar conteos/SHA antes de descongelar el panel.

Si algo falla antes de reabrir escrituras, restaurar frontend, grants/RPCs anteriores y el backup. Después de aceptar solicitudes nuevas, preferir roll-forward para no perder cambios posteriores al corte.
