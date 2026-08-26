# Natura UY — contexto para agentes

## Propósito

Natura UY es un catálogo de biodiversidad de Uruguay. El repositorio contiene:

- Una aplicación móvil Expo/React Native que funciona offline con SQLite.
- Un panel editorial privado React/Vite para que administradores y colaboradores mantengan el catálogo.
- Infraestructura como código para Supabase, Cloudflare Pages y GitHub Actions; R2 es una ampliación futura opcional.

La interfaz y la documentación del proyecto se escriben en español rioplatense, salvo nombres técnicos y código.

## Estado actual

- El proyecto Supabase `xbnbfekcxrkgteuijbzh` está vinculado: las tres migraciones, Auth config y cuatro Edge Functions fueron desplegadas, el linter remoto no reporta errores y existe un primer administrador activo con MFA obligatorio. **Todavía faltan Google OAuth, importación, secretos de GitHub y Cloudflare Pages**. R2 no forma parte del primer despliegue.
- El panel editorial sí puede ejecutarse hoy en modo demostración local: sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` usa datos y sesión simulados; no confundir esa demo con una conexión editorial real.
- Por ahora, los datos existentes siguen en `NaturaUY-source/data/catalog/` y `NaturaUY-source/assets/db/natura.db`.
- Después de realizar la importación inicial a Supabase, la fuente editorial definitiva pasa a ser PostgreSQL. Los JSON y `natura.db` serán artefactos derivados y versionados.
- Los JSON actuales tienen 1006 registros de entrada que se consolidan en 902 especies únicas. No asumir que “registro JSON” y “especie” son equivalentes.

### Panel web disponible actualmente

El panel vive en `NaturaUY-admin/` y está implementado con React + Vite. La demo local se inicia así:

```powershell
cd "C:\Users\rafar\Documents\2026 - proyects\uruguay-natura-data\NaturaUY-admin"
npm install
Copy-Item .env.example .env.local
npm run dev
```

Se abre en `http://localhost:5173`. El archivo `.env.local` puede quedar con sus valores vacíos para la demo. Sólo al completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se intenta usar Supabase real; nunca colocar allí una `service_role` key.

Rutas que existen en el router actual:

- `/`: dashboard con métricas, actividad y estado de publicación.
- `/species`: listado, búsqueda y filtros.
- `/species/new`: alta de especie.
- `/species/:id`: editor, revisiones, fuentes y validación.
- `/media`: medios y trabajos de procesamiento.
- `/releases`: publicaciones y solicitud de catálogo.
- `/reports`: reportes autenticados enviados desde la app móvil.
- `/users`: usuarios; sólo se muestra para perfiles administradores.
- `/login`: la pantalla de acceso se muestra cuando no hay sesión real.

La demo no persiste cambios en Supabase ni reemplaza las pruebas de RLS, MFA, RPCs o workflows.

### Diagrama de arquitectura

El SVG horizontal `Natura UY Editorial` representa la arquitectura objetivo y sus flujos (acceso, medios, publicación, distribución offline y respaldo). Es documentación conceptual, no evidencia de que los servicios estén desplegados. La fuente operativa sigue siendo este archivo, `NaturaUY-admin/docs/deployment.md` y el código; si el diagrama contradice al repositorio, revisar primero esos documentos y marcar el SVG para actualizarlo.

## Mapa del repositorio

| Ruta | Responsabilidad |
| --- | --- |
| `NaturaUY-source/` | App móvil Expo, catálogo SQLite incluido y pipeline histórico de datos. |
| `NaturaUY-source/app/` | Rutas y pantallas Expo Router. |
| `NaturaUY-source/src/data/db/` | SQLite, catálogo descargable atómico y base local de usuario. |
| `NaturaUY-source/data/catalog/` | JSON de catálogo actual; fuente previa a la migración editorial. |
| `NaturaUY-admin/` | Panel editorial React/Vite e infraestructura operativa. |
| `NaturaUY-admin/src/` | UI, autenticación, páginas y cliente Supabase. |
| `NaturaUY-admin/supabase/migrations/` | Esquema PostgreSQL, RLS, buckets, vistas y RPCs. |
| `NaturaUY-admin/supabase/functions/` | Edge Functions con operaciones privilegiadas. |
| `NaturaUY-admin/scripts/` | Importación, catálogo, medios, publicación y respaldos. |
| `NaturaUY-admin/functions/` | Cloudflare Pages Functions: manifiesto y URLs estables `/m/*`. |
| `.github/workflows/` | Procesamiento de medios, publicación programada y mantenimiento. |

## Invariantes de arquitectura

1. No editar `natura.db` a mano. Se genera y se valida desde datos editoriales.
2. El ID UUID de Natura UY y `catalog_code` son estables; no romper favoritos, navegación ni enlaces al rectificar taxonomía.
3. Una edición crea una revisión nueva. Nunca sobrescribir ni borrar revisiones ni especies físicamente.
4. `abundanceStatus` no es conservación. Conservar separados abundancia, conservación, origen, establecimiento, estacionalidad y certeza.
5. Las fuentes son por campo (`taxonomy.order`, `description`, etc.), no sólo una lista genérica de especie.
6. Favoritos, preferencias y juegos tienen fuente offline en `user.db`; nunca se mezclan con `natura.db`. Si hay cuenta Google, se sincronizan con Supabase sin volver al backend un requisito de arranque.
7. Cada medio nuevo debe registrar autoría y derechos. Sólo aceptar CC0, CC BY 4.0 o autorización verificable; las licencias heredadas se preservan como históricas.
8. Los medios procesados se verifican en Supabase Storage antes de eliminar el original temporal. Si en el futuro se configura R2, también se verifica allí. Las URLs públicas siguen `/m/{assetId}/{variant}`.
9. Las imágenes definitivas usan lado mayor de 1600 px y miniatura de 480 px. Los audios definitivos duran como máximo 15 s, son mono, MP3 96 kbps y 48 kHz.
10. No incluir secretos, archivos `.env`, medios, builds, `node_modules` ni backups en Git.

## Reglas de seguridad

- No habilitar registro público **editorial**. Google OAuth se admite para cuentas móviles; una identidad sólo entra al panel si además tiene una fila activa en `editor_memberships` creada por invitación.
- Administradores requieren MFA TOTP; no quitar esta condición en frontend, RLS o Edge Functions.
- Las escrituras editoriales usan las RPCs existentes (`save_species`, bajas/restauraciones, validación, rollback, medios y publicación). No abrir escrituras directas de tablas desde el navegador.
- No exponer `SUPABASE_SERVICE_ROLE_KEY`, tokens de GitHub ni evidencia privada de permisos. La URL y publishable key sí son públicas y dependen de RLS.

## Flujo de datos y publicación

1. La app funciona offline y sincroniza favoritos/récords sólo cuando hay sesión. Un editor guarda una revisión o medio en Supabase; se registra auditoría y el catálogo queda `dirty`.
2. GitHub Actions procesa el medio o genera catálogo JSON/SQLite, manifiesto e informe de calidad.
3. Cloudflare Pages sirve el manifiesto y resuelve URLs de medios.
4. La app abre primero la base local válida; consulta el manifiesto sin bloquearse, descarga una actualización a `natura.next.db`, valida SHA-256/esquema/SQLite y la activa en el siguiente inicio. Ante error conserva o restaura la base anterior.

## Comandos de verificación

Ejecutar desde el directorio correcto y no aplicar fixes automáticos de dependencias sin revisar el impacto en Expo.

```powershell
# Panel editorial
cd NaturaUY-admin
npm run build
npm run typecheck:automation
npm run catalog:import -- --dry-run

# Aplicación móvil
cd ../NaturaUY-source
npx tsc --noEmit
npm run lint
npm test -- --runInBand
```

## Convenciones de cambio

- Revisar `git status` antes de editar: el repositorio puede contener trabajo local del usuario. Preservar cambios no relacionados.
- Actualizar pruebas y documentación cuando se cambie un contrato de datos, un script de publicación, una migración o el proceso de actualización móvil.
- Si cambia arquitectura, estado de despliegue, rutas clave, comandos o invariantes, actualizar este archivo y `NaturaUY-admin/README.md` / `NaturaUY-admin/docs/deployment.md` en el mismo cambio.
- Antes de desplegar o importar datos reales, leer `NaturaUY-admin/docs/deployment.md` completo.

## Lecturas de referencia

- `NaturaUY-admin/README.md`: alcance y uso del panel.
- `NaturaUY-admin/docs/deployment.md`: aprovisionamiento y operación.
- `NaturaUY-admin/supabase/migrations/`: contrato real de base, cuentas unificadas, sincronización, medios, permisos y RPCs.
- `NaturaUY-source/src/data/db/catalogUpdater.ts`: contrato de actualización móvil.
