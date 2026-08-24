# Despliegue y operación

Esta guía aprovisiona la primera versión sin introducir secretos en Git. Ejecutar los comandos desde `NaturaUY-admin`, salvo que se indique lo contrario.

## 1. Supabase

1. Crear un proyecto y conservar su `project ref`, URL, clave pública/anon, clave `service_role` y cadena PostgreSQL.
2. Desactivar el registro público. La configuración incluida ya usa `enable_signup = false` para desarrollo local.
3. Aplicar y desplegar:

```powershell
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
npx supabase functions deploy invite-user
npx supabase functions deploy set-user-active
npx supabase functions deploy request-media-processing
npx supabase functions deploy request-catalog-publish
```

4. Crear manualmente el primer usuario desde Authentication > Users. El trigger crea su perfil como colaborador. Promoverlo una sola vez desde SQL Editor:

```sql
update public.profiles
set role = 'admin', mfa_required = true
where id = (select id from auth.users where email = 'ADMIN@EJEMPLO.COM');
```

5. Guardar secretos de Edge Functions:

```powershell
npx supabase secrets set GITHUB_REPOSITORY=OWNER/REPO
npx supabase secrets set GITHUB_DISPATCH_TOKEN=TOKEN_FINE_GRAINED
npx supabase secrets set PUBLIC_APP_ORIGIN=https://TU_DOMINIO_PAGES
```

El token de GitHub sólo necesita permiso para disparar workflows en este repositorio. `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` son provistos automáticamente a las funciones.

6. Configurar Auth URL con el dominio definitivo de Pages y agregar como redirect URL tanto `/login` como el dominio local.

## 2. Importación inicial

Definir temporalmente en la terminal las variables administrativas y ejecutar primero la inspección:

```powershell
$env:SUPABASE_URL = 'https://PROJECT.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = '...'
$env:EDITORIAL_BOOTSTRAP_USER_ID = 'UUID_DEL_PRIMER_ADMIN'
npm run catalog:import -- --dry-run
npm run catalog:import
```

El importador combina `../NaturaUY-source/data/catalog` con `../NaturaUY-source/assets/db/natura.db`, mantiene el `catalog_code`, evita duplicar especies y registra la importación como revisión/auditoría.

## 3. R2

1. Activar R2, habilitar alertas de facturación y crear el bucket privado `natura-uy-media-backup`.
2. Crear un API token limitado a lectura/escritura de ese bucket.
3. Obtener:
   - `R2_ENDPOINT`: `https://ACCOUNT_ID.r2.cloudflarestorage.com`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET=natura-uy-media-backup`
4. Configurar alertas operativas al 70% y 85%. Al superar 700 MB almacenados o 4 GB de egreso mensual en Supabase, cambiar `MEDIA_PRIMARY` a `r2`; las URLs `/m/{assetId}/{variant}` no cambian.

## 4. Cloudflare Pages

Conectar el repositorio de GitHub y configurar:

- Root directory: `NaturaUY-admin`
- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Node.js: 24
- Variables del frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_ORIGIN`
- Variables de Pages Functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MEDIA_PRIMARY=supabase`
- Binding R2: `MEDIA_BACKUP` → `natura-uy-media-backup`

Las funciones publican:

- `/catalog/manifest.json`: última versión válida.
- `/m/{assetId}/{variant}`: resolución estable hacia Supabase o R2.

Si el nombre/dominio de Pages no es `natura-uy-admin.pages.dev`, actualizar `expo.extra.catalogManifestUrl` en `../NaturaUY-source/app.json` antes de distribuir la siguiente app.

## 5. GitHub Actions

Crear estos **Secrets** del repositorio:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `EDITORIAL_SYSTEM_USER_ID` (UUID de un perfil de sistema activo)
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `BACKUP_ENCRYPTION_PASSWORD` (guardar también una copia fuera de GitHub)

Crear esta **Variable**:

- `PUBLIC_MEDIA_ORIGIN=https://TU_DOMINIO_PAGES`

Los workflows son:

- `publish-catalog.yml`: cada 15 minutos y manual; no publica si el catálogo no está sucio.
- `process-media.yml`: un trabajo por medio solicitado.
- `editorial-maintenance.yml`: respaldo/limpieza diarios y verificación de medios mensual.

Ejecutar manualmente la publicación una vez después de importar. El control técnico bloquea duplicados, referencias o medios rotos, esquema inválido e integridad SQLite fallida. Los faltantes editoriales quedan en el informe como advertencias.

## 6. Aplicación móvil

La app consulta el manifiesto en segundo plano y siempre abre primero la última base local válida. Una descarga queda preparada para el siguiente inicio sólo después de validar tamaño, SHA-256, versión de esquema y `PRAGMA integrity_check`; conserva una copia anterior para rollback.

Comprobarla antes de producir el APK:

```powershell
cd "C:\Users\rafar\Documents\2026 - proyects\uruguay-natura-data\NaturaUY-source"
npx tsc --noEmit
npm test -- --runInBand
```

Favoritos y preferencias permanecen en `user.db`, separados del catálogo reemplazable `natura.db`.

## 7. Piloto y recuperación

Antes de cargar el archivo grande:

1. Invitar un administrador y dos colaboradores.
2. Editar, validar, retirar/restaurar y publicar un grupo reducido de aves.
3. Subir una imagen y un audio con cada modalidad de derechos aceptada.
4. Interrumpir una descarga móvil y confirmar que la app conserva su base anterior.
5. Restaurar el último `pg_dump` en un proyecto temporal y comparar inventario/checksums de Supabase y R2.
6. Documentar el resultado y repetir la prueba trimestralmente.

Los planes gratuitos no ofrecen SLA. Revisar cuotas y políticas periódicamente, mantener MFA TOTP obligatorio para administradores y conservar fuera de los proveedores tanto la contraseña de backups como originales multimedia de máxima calidad.
