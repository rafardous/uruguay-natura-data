# Natura UY — contexto para agentes

## Propósito

Natura UY es un catálogo de biodiversidad de Uruguay. El repositorio contiene:

- Una aplicación móvil Expo/React Native que funciona offline con SQLite.
- Un panel editorial privado React/Vite para que administradores y colaboradores mantengan el catálogo.
- Infraestructura como código para Supabase, Cloudflare Pages y GitHub Actions; R2 es una ampliación futura opcional.

La interfaz y la documentación del proyecto se escriben en español rioplatense, salvo nombres técnicos y código.

## Estado actual

- El proyecto Supabase `xbnbfekcxrkgteuijbzh` está operativo con schema 12 y el catálogo inicial importado: 4105 especies, 3157 perfiles botánicos, 2113 nodos y 2132 nombres taxonómicos. El panel está publicado en `https://uruguay-natura-data.pages.dev`; todavía faltan los secretos de GitHub y el despliegue de Edge Functions. R2 no forma parte del primer despliegue.
- La sección móvil Aprender v1 está implementada con cinco recorridos y 21 módulos versionados, fuentes visibles, cuatro tipos de pregunta y repetición espaciada offline. La migración schema 13 agrega documentos editoriales `learning_paths` y sincronización privada del dominio; permanece pendiente de aplicar y publicar en Supabase.
- El panel administrativo ya no usa datos ni sesión simulados. Requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; si faltan, muestra un error de configuración y no permite operar con datos ficticios.
- La línea base animal tiene 1052 registros/948 especies. El catálogo schema 12 agrega el snapshot v1.3 de Flora Uruguaya Online (3157 plantas vasculares) y queda en 4209 registros/4105 especies; el backlog candidate-only externo se mantiene separado.
- La fuente editorial definitiva ya es PostgreSQL. Los JSON y `natura.db` son artefactos derivados y versionados.
- Las aves tienen enriquecimiento histórico de Azpiroz 2003 en `natural_history.bird`: 432 perfiles aprobados, schema 12/data_version 4 en el derivado local. Procedencia, códigos, cruces y comandos están en `NaturaUY-source/data/AVES_AZPIROZ_2003.md`. Preservar el tamaño de la guía al regenerar traits y mantener separados abundancia y conservación. La publicación productiva del nuevo derivado depende del workflow manual y sus secretos.
- La base histórica animal tuvo 1006 entradas/902 especies. El derivado schema 12 actual tiene 4209 registros/4105 especies y conserva los 948 códigos de la línea base animal. No asumir que “registro JSON” y “especie” son equivalentes.

### Panel web disponible actualmente

El panel vive en `NaturaUY-admin/` y está implementado con React + Vite. El panel local se inicia así:

```powershell
cd "C:\Users\rafar\Documents\2026 - proyects\uruguay-natura-data\NaturaUY-admin"
npm install
Copy-Item .env.example .env.local
npm run dev
```

Se abre en `http://localhost:5173`. Para operar contra Supabase hay que completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; nunca colocar allí una `service_role` key. Las variables de producción se configuran únicamente en el entorno Production de Cloudflare Pages.

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

El panel real no reemplaza las pruebas de autenticación, RLS, RPCs o workflows.

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
4. `abundanceStatus` no es conservación. Conservar separados abundancia, conservación, origen, establecimiento, estacionalidad y certeza. La abundancia experta y la observabilidad automática también permanecen separadas; observabilidad no es una estimación poblacional.
5. Las fuentes son por campo (`taxonomy.order`, `description`, etc.), no sólo una lista genérica de especie. Los candidatos automáticos de enriquecimiento nunca se publican sin aprobación humana. Fuentes `review_only` no pueden alimentar texto redistribuido.
6. Favoritos, preferencias, juegos y progreso de Aprender tienen fuente offline en `user.db`; nunca se mezclan con `natura.db`. Si hay cuenta Google, se sincronizan con Supabase sin volver al backend un requisito de arranque.
   El Puzzle deslizante usa `puzzle_records` por categoría y dificultad (3/4), con mínimos independientes, sincronización privada mediante `sync_puzzle_records(jsonb)` y recuperación por cuenta mediante `get_personal_mobile_progress()`.
   El catálogo schema 12 conserva el contrato schema 11 y agrega Plantae/Tracheophyta, perfil botánico, nombres taxonómicos y cierre de ancestros. La navegación usa `taxon_id` y omite rangos vacíos. `knowledge_level` es acumulativo (`easy ⊂ medium ⊂ hard`); los récords incorporan el nivel además de categoría y, en Puzzle, grilla.
   La expansión inicial incorpora `Arthropoda → Arachnida | Insecta | Malacostraca`. Los 49 registros históricos de artrópodos se contabilizan en el pipeline; el registro incompleto `Bothriurus` queda en revisión y no se descarta.
   Aprender guarda finalización por módulo y dominio por objetivo/pregunta. Los errores vuelven al día siguiente y los aciertos se repasan a 3, 14 y 45 días; una nueva versión de pregunta reinicia sólo ese objetivo. El contenido bootstrap vive versionado en la app y `learning_paths` es la fuente editorial prevista para releases schema 13.
7. Cada medio nuevo debe registrar autoría y derechos. Sólo aceptar CC0, CC BY 4.0 o autorización verificable; las licencias heredadas se preservan como históricas.
8. Los medios procesados se verifican en Supabase Storage antes de eliminar el original temporal. Si en el futuro se configura R2, también se verifica allí. Las URLs públicas siguen `/m/{assetId}/{variant}`.
9. Las imágenes definitivas usan lado mayor de 1600 px y miniatura de 480 px. Los audios definitivos duran como máximo 15 s, son mono, MP3 96 kbps y 48 kHz.
10. No incluir secretos, archivos `.env`, medios, builds, `node_modules` ni backups en Git.

## Pipeline de expansión

`NaturaUY-source/scripts/catalog/` ejecuta fuentes locales y endpoints externos durante el pipeline, nunca desde la app offline. `data:catalog-all` fija e importa Flora Uruguaya v1.3, encadena el discovery candidate-only de artrópodos en GBIF, normalización, resolución, auditoría, medios y enriquecimientos antes de construir schema 12. Los medios botánicos se descubren aparte con `data:plant-media` por lotes; iNaturalist sólo es publicable con CC0 y Wikimedia con CC0 o CC BY 4.0 exacta. `data:plant-taxonomy` contrasta por lotes con WFO Plant List 2026-06/ChecklistBank y nunca aplica sinónimos, órdenes o IDs automáticamente. Los candidatos externos requieren revisión humana antes de entrar en Supabase o en un release.

## Reglas de seguridad

- No habilitar registro público **editorial**. Google OAuth se admite para cuentas móviles; una identidad sólo entra al panel si además tiene una fila activa en `editor_memberships` creada por invitación.
- El proveedor de correo permanece habilitado para que los usuarios existentes puedan iniciar sesión. El hook `hook_restrict_new_auth_user` bloquea altas por email fuera de `editor_email_invitations` y permite las altas móviles mediante Google.
- Durante la etapa inicial, administradores ingresan con Google OAuth y una fila activa con rol `admin` en `editor_access`. MFA TOTP está postergado; reactivarlo de forma integral en frontend, RLS y Edge Functions cuando el proyecto madure.
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
