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

Las migraciones mobile `202609060003_mobile_feedback_sync.sql`, `202609060004_mobile_popular_species.sql`, `202609080001_mobile_puzzle_records.sql`, `20260909032434_mobile_progress_pull.sql`, `20260910041400_catalog_enrichment_and_game_content.sql`, `20260910041420_taxon_content_and_trivia_media.sql`, `20260910041725_harden_schema8_rpc.sql` y `20260910163402_reptile_mammal_order_content.sql` deben aplicarse junto con el resto del historial. Las últimas incorporan fuentes, corridas/candidatos de enriquecimiento, abundancia y observabilidad separadas, perfiles de juego, curiosidades, trivia ilustrable, contenido editorial de órdenes/familias, el endurecimiento final de la RPC de publicación y la normalización de órdenes de Reptilia. La app sólo usa las RPC lean `submit_feedback`, `sync_favorites`, `record_game_result`, `sync_puzzle_records`, `get_personal_mobile_progress`, `get_game_leaderboard` y `get_most_favorited_species`; los récords codifican categoría y nivel de conocimiento en el `scope`, y Puzzle además conserva su grilla. Trivia no persiste récords. El pull privado permite hidratar favoritos y récords al cambiar de cuenta sin mezclar el caché local de cada usuario.

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

El importador debe informar 1006 entradas, 902 especies y 902 coincidencias de código. Crea 902 cambios iniciales aprobados de “Importación inicial”. Las imágenes externas quedan archivadas con su metadata hasta confirmar derechos; no se copian por defecto.

## 5. Panel, Storage y publicación

Antes de importar enriquecimiento, generar y revisar los artefactos locales. `data:observability` procesa 25 especies por defecto y conserva checkpoint; repetir hasta que el informe indique `complete: true`. La importación requiere `--apply` y nunca aprueba candidatos taxonómicos automáticamente.

```powershell
cd ../NaturaUY-source
npm run data:enrichment-candidates
npm run data:observability -- --batch=25
cd ../NaturaUY-admin
npm run catalog:import-enrichment
npm run catalog:import-enrichment -- --apply
```

El panel se hospeda como frontend estático en Cloudflare Pages desde la rama `main` del repositorio `rafardous/uruguay-natura-data`. Use `NaturaUY-admin` como directorio raíz, `npm run build` como comando y `dist` como salida. Configure `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` únicamente en Production; el panel no tiene fallback de datos demo y muestra un error de configuración si faltan. Nunca colocar una `service_role` key en Cloudflare.

Los derivados se leen directamente desde el bucket público `media-public`; el manifest estable, desde `catalog-public/manifest.json`.

El panel sube originales únicamente a rutas reservadas por `reserve_species_media_upload`, con `upsert=false`, MIME/tamaño validados y declaración de derechos. GitHub Actions escribe los derivados con `service_role`.

La publicación es manual y admin-only. El Release contiene únicamente DB, DB comprimida, JSON públicos, manifest e informe. `build-metadata.json` no se adjunta.

## 6. Mobile y piloto

La app utiliza claves públicas y continúa operativa sin login. Soporta esquema de catálogo 8: medios, abundancia estructurada, observabilidad, dificultad, reglas de juegos, curiosidades, trivia con imagen opcional y descripciones editoriales de órdenes/familias; conserva `user.db`. Antes de reabrir escrituras:

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
