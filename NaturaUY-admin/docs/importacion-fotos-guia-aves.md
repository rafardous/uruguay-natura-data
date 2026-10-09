# Importación de fotos de la guía de aves

Este flujo convierte copias derivadas sin modificar, mover ni borrar los originales. Recorre todas las imágenes compatibles (`jpg`, `jpeg`, `png`, `webp`, `heic`, `heif`, `tif`, `tiff`), respeta orientación EXIF y genera WebP de hasta 1600 px sin agrandar imágenes chicas.

Para los números 1–435 selecciona como máximo dos fotos. Prioriza `N` y después `N (1)`, `N (2)`, etc.; si falta la base, usa las dos variantes numeradas más bajas. Las fotos fuera de rango o con otros nombres se convierten en `todas/`, pero no se seleccionan ni se suben. Si dos archivos representan el mismo número y variante, ambos se convierten, el número completo queda pendiente en el manifiesto y la carga se bloquea hasta resolver la ambigüedad.

## Preparación local

Desde `NaturaUY-admin`:

```powershell
npm ci
npm run media:test-guide-selection
npm run media:import-guide-photos -- --photos 'D:\Fotos\Aves' --out 'D:\Fotos-reducidas'
```

La salida debe estar fuera de la carpeta de originales. Se generan:

- `todas/`: un WebP de hasta 1600 px por archivo compatible;
- `miniaturas/`: WebP de hasta 480 px sólo para las seleccionadas;
- `manifest.json`: selección, tamaños, rutas estables y hashes SHA-256.

Si la ejecución se interrumpe, repetí el mismo comando: reutiliza los WebP existentes cuya fecha y formato/dimensiones siguen siendo válidos. Los archivos que Sharp no puede leer se anotan en `manifest.json` bajo `failures` y no detienen la conversión de los demás. La carga queda bloqueada si una foto seleccionada falla o hay ambigüedades sin resolver. Las elecciones revisadas se documentan en `data/guide-birds/selection-overrides.json`; para el número 75 se eligió `75.jpeg` por ser la toma más nítida, sin tocar ninguno de los originales.

## Carpeta `assigned` y carga manual

Con los derivados ya disponibles en `C:\Users\rafar\Pictures\NaturaUY\Aves-reducidas`, ejecutar desde `NaturaUY-admin`:

```powershell
npm run media:prepare-guide-assigned
```

El comando copia, sin mover los originales, las fotos vinculadas a especies a `C:\Users\rafar\Pictures\NaturaUY\assigned\guia-aves\NNN\`. Cada foto tiene su WebP de hasta 1600 px y una miniatura `-480.webp`; `C:\Users\rafar\Pictures\NaturaUY\assigned-manifest.json` queda **fuera** de la carpeta que se sube y registra UUID, rutas y SHA-256. El comando es repetible: verifica los archivos existentes y detiene la corrida si encuentra contenido ajeno o distinto dentro de `assigned`.

El mapeo automático de números pendientes usa únicamente coincidencias únicas y compatibles entre **todas** las etiquetas descriptivas del número y especies activas del catálogo. Los conflictos, las etiquetas insuficientes y las fotos «Foto cedida» se omiten y se informan en el manifiesto. En la corrida local del 24/09/2026 quedaron 594 fotos de 309 aves y 594 miniaturas; los 20 números pendientes no alcanzaron una coincidencia inequívoca. No se deduce la especie por número de guía ni por OCR.

El 24/09/2026 se subió **el contenido** de `assigned/guia-aves` a la raíz del bucket público `guia-aves` en Supabase Storage: el objeto remoto es `001/01.webp`. Se verificaron por SHA-256 las 594 fotos y sus 594 miniaturas. Conservar el manifiesto local para la reconciliación; no se sube al bucket.

La tabla `data/guide-birds/correspondencias_aves_1-435.csv` contiene las 435 filas de la guía. `aves_catalogo_para_correspondencias.csv` es un snapshot auxiliar de las 475 aves que tenía Supabase al preparar esta integración. Hay que contrastarlo con el catálogo remoto vigente. El UUID sólo se completa y `revisado` pasa a `si` después de revisar la especie con evidencia independiente del número; el índice OCR no constituye confirmación.

### Revisión de correspondencias (23/09/2026)

Se revisaron los nombres descriptivos de los archivos originales contra el nombre científico y común del catálogo. El resultado está documentado, número por número, en `data/guide-birds/revision_correspondencias.csv`. De los 329 números con fotos seleccionadas, 309 tienen UUID revisado y 20 permanecen pendientes. Los 309 UUID existen en el Supabase remoto, están activos, son `Aves` y no se repiten. El script `scripts/audit-guide-bird-names.mjs <carpeta-originales> --compact` reproduce el cruce automático de etiquetas; las diferencias de nomenclatura se revisaron aparte. No se usó el número ni el OCR por sí solos para asignar una especie.

Los números pendientes son 14, 18, 42, 46, 50, 75, 108, 113, 119, 128, 158, 184, 200, 214, 277, 283, 297, 304, 364 y 431. El reporte indica si falta una etiqueta identificable, hay conflicto entre etiquetas o falta correspondencia inequívoca en el catálogo. En 113 y 184 aparecen archivos rotulados «Foto cedida»: no debe presumirse que son fotos del autor familiar ni que su autorización las cubra. En 128, el binomio de la etiqueta y el del catálogo difieren de forma que requiere revisión taxonómica específica.

El remoto contiene además un medio de imagen `reserved` en cada una de las especies vinculadas a 97 y 413. La carga nueva archivará esos dos registros y sustituirá los medios de cada especie confirmada de forma transaccional; los registros y objetos viejos se conservan como historial. Los originales y las fotos no elegidas permanecen intactos. Todavía no se modificó ningún medio remoto en esta etapa.

Con el manifiesto y el estado remoto consultados el 23/09/2026, hay 594 fotos seleccionadas de 309 números revisados. Los 20 vínculos pendientes se omiten. El preflight vuelve a consultar Supabase antes de cualquier escritura.

## Autorización y preflight

El titular de Arapy confirmó que Pedro Rinaldi autorizó la publicación de las fotos familiares. El importador puede registrar esa declaración del titular en el bucket privado `media-evidence` con `--record-owner-attestation`; no la presenta como una firma del fotógrafo ni la guarda en Git. También admite `--evidence-path` si existe un documento de permiso. En ambos casos se registra la autoría como Pedro Rinaldi. Las fotos rotuladas «Foto cedida» siguen pendientes y no entran en esta autorización.

La reconciliación verifica las fotos familiares ya cargadas en `guia-aves` y sólo sube derivados externos que falten; nunca sobrescribe objetos con un hash distinto.

La carga queda bloqueada si falta cualquiera de estas condiciones:

- sólo se vinculan números con UUID confirmado o inferido por coincidencia única de nombres; los demás se informan y omiten;
- la autorización está registrada y es descargable;
- cada UUID pertenece a un ave activa y ningún UUID se repite;
- las filas y rutas existentes son compatibles con una repetición idempotente;
- cada especie termina con un máximo total de dos imágenes activas: las anteriores pasan a `archived` dentro de la misma transacción que registra las nuevas;
- los objetos familiares existentes coinciden con el SHA-256 local.

## Reconciliación tras la carga manual

Las credenciales se definen sólo en la sesión local. Nunca se guardan en `.env`, Git o el frontend.

```powershell
$env:SUPABASE_URL = 'https://xbnbfekcxrkgteuijbzh.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = '<sólo en esta sesión>'
$env:EDITORIAL_SYSTEM_USER_ID = '<UUID de profiles>'

npm run media:reconcile-guide
npm run media:reconcile-guide -- --apply

Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

La primera corrida presenta el plan sin escribir; `--apply` registra las fotos. La reconciliación descarga cada foto familiar y miniatura del bucket y compara sus SHA-256 con el manifiesto. Si falta una foto familiar, busca una alternativa externa; si hay una sola foto familiar verificada, intenta añadir una externa como segunda. Usa primero medios externos ya registrados con licencia válida y después el selector actual de iNaturalist (CC0) y Wikimedia (CC0 o CC BY 4.0). Convierte, sube y verifica los derivados externos, guarda autoría y licencia y llama a `reconcile_guide_bird_media` para sustituir hasta dos medios por especie de forma transaccional. Registra la declaración del titular en `media-evidence` antes de vincular fotos familiares. La ejecución repetida evita filas duplicadas y conserva los medios anteriores como historial.

Los números sin identidad inequívoca o derechos confirmados no se vinculan. El reporte de la corrida muestra fotos externas no disponibles y especies que quedaron con menos de dos fotos.

Las rutas lógicas editoriales son `guia-aves/001/01.webp` y `guia-aves/001/01-480.webp`; dentro del bucket se llaman `001/01.webp` y `001/01-480.webp`. El catálogo móvil y el editorial generan URL pública directa a ese bucket. La función de Pages conserva las rutas antiguas `/m/guia-aves/...` mediante redirección.

## Migraciones y publicación

No ejecutar un `supabase db push` general para esta importación. El remoto sigue en schema 12 y las migraciones schema 13 y 14 están pendientes. Primero revisar y aplicar 13, luego 14, después `202609230001_media_only_catalog_publish.sql`, `202609230002_curated_plant_profile.sql`, `20260924034900_replace_guide_bird_media.sql` y `20260924050000_reconcile_guide_bird_media.sql`. Validar el plan con `npx supabase db push --linked --dry-run --include-all`, ejecutar pruebas locales y registrar el estado remoto. La reconciliación `--apply` requiere esta última RPC desplegada.

La migración permite solicitar una publicación cuando el único cambio nuevo son medios aprobados. El workflow también detecta `species_media.processed_at`. La publicación continúa siendo manual y admin-only.
