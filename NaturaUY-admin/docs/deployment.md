# Despliegue y operación sin costo

Proyecto Supabase objetivo: `xbnbfekcxrkgteuijbzh`. No pegar secretos en Git, archivos `.env` ni conversaciones. Ejecutar los comandos desde `NaturaUY-admin`, salvo indicación contraria.

## 1. Vincular Supabase

La CLI está fijada como dependencia de desarrollo:

```powershell
npm ci
npx supabase login
npx supabase link --project-ref xbnbfekcxrkgteuijbzh
```

El login se autoriza en el navegador y la contraseña PostgreSQL se introduce sólo en la terminal. Antes de aplicar cambios:

```powershell
npx supabase db push --dry-run
npx supabase db push
npx supabase config push
```

El esquema crea identidades genéricas, membresías editoriales por invitación, especies y revisiones, sincronización móvil, reportes, RLS, RPCs y buckets. Una cuenta Google normal no recibe membresía editorial.

## 2. Auth móvil y acceso editorial

En Google Auth Platform crear un cliente OAuth de tipo **Web application**. Agregar como redirect autorizado:

```text
https://xbnbfekcxrkgteuijbzh.supabase.co/auth/v1/callback
```

En Supabase → Authentication → Providers → Google, habilitar Google y guardar allí el Client ID y Client Secret. En URL Configuration conservar:

```text
naturauy://**
http://localhost:8081/**
http://localhost:5173/**
https://TU_DOMINIO_PAGES/**
```

El proveedor de correo queda habilitado para que las cuentas invitadas puedan iniciar sesión. El Auth Hook `hook_restrict_new_auth_user` rechaza nuevas altas por email salvo que la dirección haya sido agregada por `invite-user` a `editor_email_invitations`; Google se admite para usuarios móviles. El acceso al panel requiere además una fila activa en `editor_memberships`.

Crear el primer usuario desde Authentication → Users y promoverlo una sola vez desde SQL Editor:

```sql
insert into public.editor_memberships(user_id, role, is_active, mfa_required)
select id, 'admin'::public.app_role, true, true
from auth.users
where email = 'ADMIN@EJEMPLO.COM'
on conflict (user_id) do update
set role = 'admin', is_active = true, mfa_required = true, updated_at = now();
```

Ese administrador debe enrolar TOTP al entrar al panel. Los colaboradores posteriores se crean desde `/users`; nunca desde registro público editorial.

## 3. Edge Functions y GitHub Dispatch

Desplegar:

```powershell
npx supabase functions deploy invite-user
npx supabase functions deploy set-user-active
npx supabase functions deploy request-media-processing
npx supabase functions deploy request-catalog-publish
```

Crear en GitHub un token fine-grained limitado a `rafardous/uruguay-natura-data`, con `Contents: write`. Guardarlo directamente como secreto de Edge Functions:

```powershell
npx supabase secrets set GITHUB_REPOSITORY=rafardous/uruguay-natura-data
npx supabase secrets set GITHUB_DISPATCH_TOKEN=TOKEN_INGRESADO_LOCALMENTE
npx supabase secrets set PUBLIC_APP_ORIGIN=https://TU_DOMINIO_PAGES
```

## 4. GitHub Actions

Crear en Settings → Secrets and variables → Actions estos **Secrets**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `EDITORIAL_SYSTEM_USER_ID`
- `BACKUP_ENCRYPTION_PASSWORD`

Crear esta **Variable**:

- `PUBLIC_MEDIA_ORIGIN=https://TU_DOMINIO_PAGES`

No se requieren secretos R2. El procesamiento verifica los derivados en Supabase Storage y elimina el temporal sólo después. El respaldo PostgreSQL se cifra y se conserva como artefacto privado de GitHub durante siete días.

## 5. Importación inicial y fotos externas

Definir las variables administrativas sólo en la terminal activa:

```powershell
$env:SUPABASE_URL = 'https://xbnbfekcxrkgteuijbzh.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'INGRESAR_LOCALMENTE'
$env:EDITORIAL_BOOTSTRAP_USER_ID = 'UUID_DEL_PRIMER_ADMIN'
npm run catalog:import -- --dry-run
npm run catalog:import
```

El importador consolida 1006 entradas en 902 especies únicas. Después inspeccionar la copia de imágenes permitidas:

```powershell
npm run media:migrate-external -- --dry-run
npm run media:migrate-external
```

Sólo se copian automáticamente CC0, CC BY 4.0 y dominio público inequívoco. Las licencias ambiguas o ShareAlike quedan referenciadas y se reportan para revisión. Los archivos se guardan como WebP de 1600 px y miniatura de 480 px, preservando URL, autoría y licencia originales.

## 6. Cloudflare Pages sin R2

Conectar el repositorio de GitHub:

- Root directory: `NaturaUY-admin`
- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Node.js: 24

Variables del frontend:

- `VITE_SUPABASE_URL=https://xbnbfekcxrkgteuijbzh.supabase.co`
- `VITE_SUPABASE_ANON_KEY` o publishable key
- `VITE_PUBLIC_ORIGIN=https://TU_DOMINIO_PAGES`

Variables de Pages Functions:

- `SUPABASE_URL=https://xbnbfekcxrkgteuijbzh.supabase.co`
- `SUPABASE_ANON_KEY` o publishable key
- `MEDIA_PRIMARY=supabase`

No crear binding R2. Las funciones publican `/catalog/manifest.json` y URLs estables `/m/{assetId}/{variant}`.

## 7. Aplicación móvil

Crear `NaturaUY-source/.env` a partir de `.env.example`:

```text
EXPO_PUBLIC_SUPABASE_URL=https://xbnbfekcxrkgteuijbzh.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLICA
```

Estas dos variables son públicas y quedan protegidas por RLS. La app sigue funcionando sin ellas como invitada. Con Google sincroniza favoritos y mejores récords, permite alias público y reportes autenticados.

## 8. Verificación y piloto

```powershell
# Panel e infraestructura
npm run build
npm run typecheck:automation
npm run catalog:import -- --dry-run

# Aplicación móvil
cd ../NaturaUY-source
npx tsc --noEmit
npm run lint
npm test -- --runInBand
```

Antes de importar todo:

1. Crear un administrador y dos colaboradores.
2. Probar que una cuenta Google móvil no pueda abrir el panel.
3. Guardar favoritos offline, iniciar sesión y recuperarlos en otra instalación.
4. Subir una imagen y comprobar 1600 px + miniatura.
5. Elegir un fragmento de audio y comprobar MP3 mono, 48 kHz, 96 kbps y máximo 15 segundos.
6. Enviar y resolver un reporte.
7. Publicar un grupo pequeño y verificar rollback móvil.

Configurar alertas operativas a 750 MB y 850 MB de Storage. Al acercarse a 900 MB, detener nuevas cargas o incorporar un segundo proveedor antes de superar el plan Free.
