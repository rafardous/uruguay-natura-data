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

## 2. Identidad editorial

Google sigue disponible para cuentas mobile. El registro por correo editorial sólo se habilita si existe una fila activa en `editor_access`; entrar al panel requiere esa misma fila.

La URL de sitio productiva es `https://uruguay-natura-data.pages.dev`. El cliente OAuth web de Google debe usar `https://xbnbfekcxrkgteuijbzh.supabase.co/auth/v1/callback` como URI de redirección autorizada. La redirección del panel termina en `/login`.

Promoción inicial:

```sql
insert into public.editor_access(email,user_id,role,active,accepted_at)
select lower(email),id,'admin',true,now() from auth.users where email='ADMIN@EJEMPLO.COM'
on conflict(email) do update set user_id=excluded.user_id,role='admin',active=true,accepted_at=now();
```

El rol admin deriva el requisito MFA: no existe una columna duplicada. Los colaboradores posteriores se invitan desde `/users`.

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

El panel se hospeda como frontend estático en Cloudflare Pages desde la rama `main` del repositorio `rafardous/uruguay-natura-data`. Use `NaturaUY-admin` como directorio raíz, `npm run build` como comando y `dist` como salida. Configure `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` únicamente en Production; el panel no tiene fallback de datos demo y muestra un error de configuración si faltan. Nunca colocar una `service_role` key en Cloudflare.

Los derivados se leen directamente desde el bucket público `media-public`; el manifest estable, desde `catalog-public/manifest.json`.

El panel sube originales únicamente a rutas reservadas por `reserve_species_media_upload`, con `upsert=false`, MIME/tamaño validados y declaración de derechos. GitHub Actions escribe los derivados con `service_role`.

La publicación es manual y admin-only. El Release contiene únicamente DB, DB comprimida, JSON públicos, manifest e informe. `build-metadata.json` no se adjunta.

## 6. Mobile y piloto

La app utiliza claves públicas y continúa operativa sin login. Soporta esquema de catálogo 6, incluida la tabla `species_media`, y conserva `user.db`. Antes de reabrir escrituras:

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
