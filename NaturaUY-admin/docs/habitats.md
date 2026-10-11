# Ambientes de Uruguay

Implementación editorial v1 aplicada en Supabase el 11/10/2026 (UTC). Son 65 nodos: ocho familias, 45 subtipos y 12 agrupaciones históricas. PostgreSQL es la autoridad; `ecology.habitats` es una proyección canónica sincronizada por trigger en la misma transacción. Los códigos y UUID son estables. Las relaciones forman un grafo sin ciclos: consultar descendientes no expande las asociaciones almacenadas de una especie.

Las fichas del panel están en `/habitats` y `/habitats/:id`. El editor selecciona hábitats aprobados mediante el catálogo; guarda por la RPC editorial existente. Las fichas se consultan en la app desde Descubrir y desde «Dónde vive». Schema 15 agrega seis tablas SQLite y `habitats.json`; las revisiones quedan sólo en PostgreSQL. Schema 14 sigue admitido y su publicador traduce códigos a categorías compatibles sin alterar la autoridad editorial.

## Evidencia y cobertura

La clasificación es editorial de Arapy, basada en PPR–CIEDUR 2011, SNAP DT20, inventario de humedales 2014, bosque nativo, vegetación costera y evaluación marina 2024. La matriz versionada vive en `scripts/habitat-seed.ts`, se genera para el panel en `src/data/habitatCoverage.json` y se distribuye dentro de `habitats.json`. Sus 69 entradas distinguen cubierto, agrupado, condición y pendiente. No representa una nueva cartografía oficial: clases físicas y taxonómicas pueden solaparse.

Los textos conservan fuentes por campo. Las dos métricas son históricas y explicitan año, método, denominador, fuente y alcance; no se suman ni se presentan como superficie actual. Las agrupaciones amplias conservan la incertidumbre original. La salinidad se separa de los paisajes, las formaciones vegetales y los microhábitats. Los registros de Azpiroz permanecen intactos.

## Carga y reanudación

Leer primero `deployment.md`. Respaldar y restaurar una copia real antes de aplicar migraciones. Configurar las credenciales únicamente en la terminal privada; nunca en variables VITE ni en Git. `EDITORIAL_SYSTEM_USER_ID` debe corresponder a un administrador activo real.

```powershell
npm run habitats:plan
npm run habitats:seed-sql > seed.sql
npm run habitats:normalize-sql > normalize.sql
npm run habitats:coverage
```

El primer comando simula y escribe el informe antes/después. Los SQL se ejecutan con un cliente administrativo seguro: establecen identidad JWT para que las RPC comprueben permisos, crean revisiones y auditan el actor. No publicar ni guardar estos temporales en Git. La normalización comprueba timestamp y valores originales; un conflicto o una equivalencia ambigua queda sin aplicar. Repetir tras revisar el informe permite reanudar: códigos ya canónicos no reintroducen formaciones históricas eliminadas por un editor. La versión 1 de equivalencias conserva valor original, campo, fuente y regla en `species_habitats.evidence`.

Las RPC `save_habitat`, `load_habitat_catalog`, `normalize_species_habitats`, `save_habitat_metric` y `save_habitat_media` requieren administrador. Las revisiones son inmutables. Las revisiones de ambiente activan el estado pendiente del dashboard y la preparación de releases. El navegador carece de escrituras directas.

## Fotos

`scripts/habitat-photo-selection.json` registra selección, lugar, pertinencia y derechos verificados individualmente. `npm run habitats:photos` vuelve a contrastar los metadatos de Commons, procesa mediante `media-image.ts` (1600/480 px), verifica por hash las dos variantes en Storage y prepara el SQL auditado de registro. La evidencia privada y originales temporales quedan en `.tmp/habitats/photos`, fuera de derivados y Git. Los enlaces públicos usan `/m/*`; las miniaturas necesarias para la app se incluyen como assets en EAS, aunque permanecen fuera de Git. Regenerarlos antes de construir desde una máquina limpia.

La cobertura actual es 12 nodos con fotos, mediante cuatro fotografías reales CC0 o CC BY 4.0. Los otros 53 muestran explícitamente un recurso gráfico. No asignar una imagen por semejanza si no documenta Uruguay o el subtipo.

## Catálogo de prueba y publicación

```powershell
npm run catalog:preview
npm run catalog:install-preview
```

Ejecutar secuencialmente desde el panel, con acceso administrativo de sólo lectura usado por el publicador. El preview exporta a `dist/catalog-preview`, valida y no crea un release ni actualiza el manifiesto. El instalador conserva el derivado anterior en `.tmp/habitats/bundled-before-preview`, instala SQLite/JSON y genera `bundledCatalogVersion.ts`. Expo web usa una identidad por esquema y versión; `user.db` permanece separada. El build Vite borra `dist`: conservar los informes y terminar la instalación antes de compilar el panel.

El manifiesto público continúa en v9/schema 14. La build interna 1.4.0/build 8 incluye v10/schema 15; este número es un derivado de prueba, no un release publicado. Para una publicación futura, usar explícitamente schema 15 con app mínima 1.4.0, verificar los assets y seguir el flujo normal de releases. El publicador adjunta `habitats.json` cuando corresponde. No ejecutar el importador inicial sobre producción.

## Comprobación

Ejecutar las suites pgTAP en la copia restaurada, el build y typecheck de automatizaciones, importación dry-run, TypeScript/lint/Jest móviles y `npm run data:catalog-verify`. La prueba de repositorios consulta el SQLite real y comprueba conteos de familias, paginación sin duplicados y que una asociación amplia no implica un subtipo. El informe de entrega está en `NaturaUY-source/data/reports/HABITATS_SCHEMA15_EXPO_WEB_2026-10-11.md`.
