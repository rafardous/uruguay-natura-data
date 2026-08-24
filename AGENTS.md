# Natura UY — contexto para agentes

## Propósito

Natura UY es un catálogo de biodiversidad de Uruguay. El repositorio contiene:

- Una aplicación móvil Expo/React Native que funciona offline con SQLite.
- Un panel editorial privado React/Vite para que administradores y colaboradores mantengan el catálogo.
- Infraestructura como código para Supabase, Cloudflare Pages/R2 y GitHub Actions.

La interfaz y la documentación del proyecto se escriben en español rioplatense, salvo nombres técnicos y código.

## Estado actual

- El panel y la infraestructura están implementados localmente, pero **Supabase, R2, Cloudflare Pages y los secretos de GitHub aún no fueron aprovisionados**.
- Por ahora, los datos existentes siguen en `NaturaUY-source/data/catalog/` y `NaturaUY-source/assets/db/natura.db`.
- Después de realizar la importación inicial a Supabase, la fuente editorial definitiva pasa a ser PostgreSQL. Los JSON y `natura.db` serán artefactos derivados y versionados.
- Los JSON actuales tienen 1006 registros de entrada que se consolidan en 902 especies únicas. No asumir que “registro JSON” y “especie” son equivalentes.

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
6. Favoritos, preferencias y juegos van en `user.db`; nunca se mezclan con el catálogo reemplazable `natura.db`.
7. Cada medio nuevo debe registrar autoría y derechos. Sólo aceptar CC0, CC BY 4.0 o autorización verificable; las licencias heredadas se preservan como históricas.
8. Los medios procesados se verifican en Supabase Storage y R2 antes de eliminar el original temporal. Las URLs públicas deben seguir el patrón estable `/m/{assetId}/{variant}`.
9. No incluir secretos, archivos `.env`, medios, builds, `node_modules` ni backups en Git.

## Reglas de seguridad

- No habilitar registro público. Las cuentas se crean por invitación.
- Administradores requieren MFA TOTP; no quitar esta condición en frontend, RLS o Edge Functions.
- Las escrituras editoriales usan las RPCs existentes (`save_species`, bajas/restauraciones, validación, rollback, medios y publicación). No abrir escrituras directas de tablas desde el navegador.
- No exponer `SUPABASE_SERVICE_ROLE_KEY`, credenciales R2, tokens de GitHub ni evidencia privada de permisos.

## Flujo de datos y publicación

1. Un editor guarda una revisión o medio en Supabase; se registra auditoría y el catálogo queda `dirty`.
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
- `NaturaUY-admin/supabase/migrations/202608230001_editorial_foundation.sql`: contrato real de base, permisos y RPCs.
- `NaturaUY-source/src/data/db/catalogUpdater.ts`: contrato de actualización móvil.
