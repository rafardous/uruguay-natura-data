# Aves: Azpiroz 2003, ficha de campo y recuperación

La fuente editorial es Supabase. Los JSON y `assets/db/natura.db` son derivados versionados. El contrato actual es schema 14; Arapy 1.3.1 usa el catálogo v8 publicado con 1048 especies: 948 animales y exactamente las 100 plantas seleccionadas. Esta documentación conserva las decisiones, referencias y comandos necesarios para recuperar el trabajo.

## Fuente, originales e identidades

Azpiroz, A. B. (2003). *Aves del Uruguay. Lista e introducción a su biología y conservación*. Aves Uruguay — GUPECA, 104 pp. Es una referencia histórica, no una evaluación actual de taxonomía ni conservación.

El Excel `Indice_aves_Uruguay_1-435_BORRADOR.xlsx` contiene 435 entradas y la fotografía de las páginas 50–51 aporta la leyenda. El usuario revisó los datos y autorizó ignorar las marcas de `revision`. Se usan datos factuales y referencia bibliográfica; no se atribuye licencia abierta al libro ni se reproducen sus descripciones.

Los archivos bajo `reference/azpiroz-2003/` conservan:

- `original.json`, `original.csv` y `manifest.json`: celdas originales y hashes del Excel/fotografía.
- `legend.json`, `corrections.json`, `normalized.json` y `report.json`: leyenda, correcciones explícitas, perfiles y celdas ilegibles.
- `crosswalk.json`: correspondencia histórica original por identificador local.
- `crosswalk-editorial.json`: las mismas 435 entradas, con código estable y UUID editorial para las 432 asociaciones inequívocas.

Se conservan sin asignar 126 (duplicada de 125 en el Excel), 160 (identidad ilegible) y 387 (*Sporophila zelichi*, que converge con 385). No crear especies ni cambiar taxonomía para forzar esos cruces. La exportación actual consolida las antiguas 564 filas de aves en 475 especies únicas, con 432 perfiles enriquecidos.

## Cobertura por campo

La auditoría compara cada perfil completo contra `normalized.json`, no sólo su cantidad. Un campo ilegible no impide recuperar los demás y nunca se completa por intuición.

| Campo recuperado | Perfiles con valor | Uso |
| --- | ---: | --- |
| Número/año de guía | 432 | Tres puntitos → Fuentes |
| Nombre común histórico | 432 | Identificación y otros nombres |
| Nombre inglés | 417 | Identificación |
| Nombre científico histórico legible | 373 | Identificación, separado del actual |
| Página registrada | 417 | Procedencia por campo |
| Largo corporal válido | 422 | Tarjeta Tamaño |
| Envergadura | 27 | Magnitud separada, en Tamaño |
| Medidas por sexo | 4 | Macho/hembra; nunca un rango |
| Presencia | 346 | Presencia y calendario |
| Hábitat | 357 | Dónde vive |
| Alimentación | 345 | Qué come |
| Abundancia histórica | 325 | Fila propia, fuera de Tamaño |

`data/reports/arapy-release-audit.json` conserva conteos, cobertura y faltantes. Las celdas `#NAME?`, fórmulas y OCR dañado permanecen en el informe original; `=BC` se recupera sólo mediante la corrección documentada. Los campos generales del catálogo siguen disponibles como alternativa identificada por sus propias fuentes.

## Leyenda e interpretación

**Tamaño:** largo total aproximado en cm. El segundo valor entre paréntesis de las aves marinas es envergadura, no largo de un ala. Otras dos medidas corresponden a macho (superior) y hembra (inferior). Se mantienen separados los valores y sexos. La ⓘ explica esas distinciones. OCR inferior a 5 o superior a 300 cm se informa y no se publica. Masa, ala, cola y tarso son información técnica secundaria; no sustituyen el tamaño de Azpiroz.

**Presencia:** RN residente anual y estimado nidificante; RV residente de verano y nidificante, setiembre–marzo; VV visitante de verano, incluye paso principalmente setiembre–noviembre y marzo–mayo; VI visitante de invierno, abril–setiembre; V visitante sin estacionalidad clara; DR registro reciente respecto de 2003; IN introducido o asilvestrado desde cautiverio; O ocasional; Ex extinto según esa edición. El asterisco en RV/VV/VI admite observaciones fuera del período habitual. DR/IN/Ex no reemplazan origen o conservación actuales. Los meses no indican ausencia absoluta ni probabilidad de avistamiento.

**Hábitat:** C costa; I islas y océano; P pastizales/praderas; M bosques autóctonos/palmares; PM pastizales con árboles; A ambientes acuáticos; H ambientes antrópicos. PM es indivisible.

**Abundancia:** C común; BC bastante común (`fairly_common`); PC poco común; R raro (`rare`). Abundancia, conservación y observabilidad permanecen separadas.

**Alimentación:** Hb vegetales verdes; Se semillas/granos; Fr frutos; Ne néctar; In insectos; Ib invertebrados litorales/bentónicos; Ps peces, crustáceos y otras presas acuáticas; Tp pequeños vertebrados; Cñ carroña. Ps no se reduce a peces.

## Ficha y galería

Se reutilizan Manrope y colores propios de cada especie. La app usa exclusivamente modo claro, aunque el sistema tenga modo oscuro; Configuración no ofrece selección de apariencia. La información secundaria se agrupa donde corresponde, en lugar de una lista de desplegables al final:

- Tocar el nombre abre los otros nombres comunes, inglés, nombre aceptado e histórico disponibles. La taxonomía aparece al final, inmediatamente antes del reporte de errores, como un recorrido vertical con conexiones curvas y desplazamiento gradual hacia la derecha. Cada rango conserva su atajo y el color de acento. La ⓘ destacada abre la información relevante inmediatamente debajo de los nombres, antes del resto de los datos.
- Origen y conservación actual diferenciados; evaluaciones expandibles junto a ese bloque.
- Tamaño con ⓘ y **Medidas técnicas** dentro de la misma tarjeta.
- Abundancia en una fila independiente.
- Presencia/calendario y observabilidad dentro de ese contexto. Meses de tres letras; dos filas con texto grande.
- Hábitat y dieta muestran hasta tres elementos; “Ver más” amplía cada conjunto. Ecología adicional siempre visible junto a ellos.
- Descripción breve, hasta tres líneas, con “Leer más”. Sin descripciones generadas ni probabilidades inventadas.

Todas las fuentes científicas, incluyendo AVONET, Azpiroz y su número de guía, están en **tres puntitos → Fuentes**. No mostrar una etiqueta de fuente debajo de cada medida. La autoría/licencia de medios acompaña a la fotografía seleccionada y es tocable.

La galería compartida se aplica a todas las especies: marco 5:3 (20% menos alto que 4:3), foto que llena el marco sin márgenes (`cover`), swipe horizontal paginado, sin miniaturas inferiores, avance automático ni recorrido circular. El visor ampliado conserva la imagen completa (`contain`). Imagen principal primero, deduplicación por identidad/URL. Puntos pequeños y flechas discretas sólo con varias fotos; sin contador numérico. Créditos más pequeños y pegados a la imagen, con acceso a derechos completos. El visor se abre en la foto seleccionada y devuelve esa posición al cerrar. Tiene swipe, doble toque para alternar zoom 1×/2×, pinch y controles accesibles; transiciones suaves sin rebote; el zoom bloquea el cambio de foto. Sin imagen se conserva el fallback.

Las tarjetas de las demás clases reutilizan el fondo `palette.container`, las esquinas `radius.lg` y la presentación compacta de las medidas del tamaño enriquecido de aves. Ecología, perfiles botánicos, historia natural y evaluaciones conservan sus contenidos con esa misma superficie de acento.

## Contrato de datos y medios

`natural_history.bird` / `naturalHistory.bird` conserva `guide`, `measurements`, `presence`, `habitat`, `diet` y `abundanceCode`; los faltantes son `null` o listas vacías. Las fuentes siguen siendo por campo. Schema 14 conserva además `measurements`, `ecology`, conservación estructurada, taxonomía, trivia y Aprender. `species_media.is_primary` es la autoridad de foto principal; `species.primary_image_id` no existe.

Pedro Rinaldi autorizó sus medios según la confirmación explícita del titular del proyecto. Se recuperaron 594 fotos para 309 aves: 285 tienen dos imágenes y 24 una. Los hashes de objetos/miniaturas y la declaración se verifican antes de aprobar; la evidencia privada queda en `media-evidence`, nunca en Git. `media:recover-guide-manifest` reconstruye el manifiesto desde las asignaciones revisadas y no inventa nombres de archivos originales de cámara.

`reference/media/approved-audio-baseline.json` documenta los 177 clips previamente incluidos en la app, autoría, ID XC y licencia original. Se recuperan como autorización verificable, con MP3 offline y copia pública comprobada por SHA-256. `approved-image-baseline.json` conserva sólo fotos CC0/CC BY 4.0 del catálogo aprobado anterior; la recuperación no busca ni aprueba candidatos nuevos. Medios de derechos ambiguos siguen archivados.

Las plantas son exactamente las 100 de `raw/curated-plants/seed-100.json`. Las otras 3057 se archivaron mediante revisiones, sin borrado físico. El JSON seleccionado tenía 96 fotos CC0 y cuatro faltantes; 71 plantas tienen origen nativo documentado y 29 conservan origen sin determinar. No inventar fotos/origen para cumplir una validación. El selector y builder protegen la selección aunque se vuelva a consultar el remoto.

## Comandos de comprobación y recuperación

Desde `NaturaUY-source`:

```powershell
npm run test:azpiroz
npm run data:azpiroz-verify
npx tsc --noEmit
npm run lint
npm test -- --runInBand
```

`data:azpiroz` reconoce los UUID editoriales, verifica las 432 correspondencias y da cero cambios al repetir. No modifica directamente un derivado editorial distinto: exige aplicar la diferencia mediante RPCs y publicar. No regenerar el catálogo vigente con el pipeline histórico de Flora masiva.

Desde `NaturaUY-admin`, con credenciales administrativas cargadas exclusivamente en la sesión:

```powershell
npm run catalog:audit-arapy -- --write
npm run catalog:import-azpiroz                      # dry-run
npm run catalog:import-azpiroz -- --sql --batch=0  # lotes 0–14
npm run catalog:archive-unselected-plants -- --sql
npm run catalog:restore-selected-plants -- --sql
npm run media:restore-approved-audio -- --sql
npm run media:restore-approved-images -- --sql
npm run media:process-selected-photos
npm run catalog:prepare-release
npm run catalog:build
npm run catalog:verify-guide
npm run build
npm run typecheck:automation
```

El SQL generado exige un editor administrador identificado; `submit_species_change` y `review_species_change(..., true, true)` preservan revisiones y la autovalidación autorizada. Los workers sólo marcan `ready` después de verificar los objetos; aprobar por RPC antes de publicar. Ante conflicto de una propuesta exclusivamente de medios, conservar el rechazo anterior y crear otra propuesta sobre la versión actual, manteniendo la referencia de revisión previa. No sobrescribir revisiones ni falsificar MFA/grants.

La publicación manual genera JSON/SQLite desde PostgreSQL, con schema 14/min app 1.3.1. `CATALOG_DATA_VERSION_FLOOR=7` supera los derivados de prueba anteriores. Verificar manifiesto público, descarga real, SHA-256 y activación al reiniciar; copiar ese mismo DB publicado a la app. La preparación local por sí sola no prueba una publicación.

## Validación, versiones y reversión

El 10/10/2026 pasaron 143 pruebas pgTAP en Docker sobre una copia del catálogo real, los 102 tests móviles en 24 suites, TypeScript/lint, ocho pruebas del normalizador y exportación taxonómica y el cotejo JSON/SQLite de los 432 perfiles. Las 435 entradas, excepciones y hashes originales permanecen versionados. Se preservó un respaldo PostgreSQL cifrado descargado y verificado antes de migrar.

Arapy 1.3.1 se entrega como APK interno con la firma EAS existente y versión Android superior. Instalar mediante `adb install -r`, conservar favoritos/preferencias/progreso en `user.db` y comprobar primero por USB. El Pixel 9 Pro XL volvió a conectarse y es el dispositivo de verificación final. La publicación en tiendas queda fuera del cambio.

Para revertir una ficha, crear y aprobar otra revisión a partir de `species_changes.before_values`. Regenerar y publicar con versión mayor; no borrar especies, revisiones o datos personales. Conservar versiones públicas anteriores y preferir roll-forward después de nuevas ediciones.

## Paletas y navegación: revisión del 10/10/2026

El publicador tenía una paleta verde fija. `NaturaUY-admin/scripts/photo-palettes.ts` deriva ahora el acento de la miniatura de la foto principal aprobada y registra ID, ruta y SHA-256 en el JSON. Comparte con el pipeline histórico el cálculo de tonos con contraste mínimo 4,5:1; sin foto usa una semilla estable por familia. SQLite recibe exactamente esos seis colores del JSON. Una nueva publicación vuelve a calcularlos: no depende de un cache local ni modifica registros editoriales.

La isla de navegación conserva visibles Inicio, Descubrir y Juegos, con icono arriba y etiqueta debajo; la selección usa fondo oscuro y texto blanco. Su altura es 80 dp y el espacio inferior de las pantallas reserva esa altura y el área segura.

Catálogo público v8 verificado: workflow 38075399204, SQLite de 13.897.728 bytes, SHA-256 `8b974b00ad4fd9cba32e9e574a0538077b6d0f13e43c8b2da1cd2ccc0170e907`; descarga gzip y sin comprimir idénticas. 432 perfiles históricos, 1048 especies, 100 plantas, 865 paletas desde fotos y 770 acentos distintos. Esta versión histórica fue reemplazada por v9 al recuperar la clasificación completa.

### Corrección de distribución taxonómica: v9

`SpeciesEcologyTags` aplica a aves y demás clases: combina hábitat/formación vegetal sin duplicados, muestra tres etiquetas inicialmente y permite ver el resto. La información ecológica adicional permanece visible. EAS administra el build Android remoto; no mantener un `versionCode` local que pueda quedar desfasado. Se retiró también la configuración específica de splash oscuro.

Los 177 audios aprobados conservan `external_id` en SQLite y `externalId` al mapear al dominio. La app resuelve ese ID Xeno-canto contra el mapa de clips incluidos, manteniendo las URLs públicas y la autoría editorial. Antes sólo reconocía `bundled://`, por lo que los clips incluidos no se encontraban después de publicar URLs remotas. El generador del mapa también preserva esta resolución; no se deducen IDs desde URLs arbitrarias.

La prueba nativa detectó que v8 omitía las tablas de navegación taxonómica aunque declaraba schema 14. v9 lo reemplaza, con 998 nodos editoriales, 1013 nombres, 6234 vínculos y cierre de ancestros. No se reconstruyen IDs ni se incorporan plantas archivadas. `data/catalog/taxonomy.json` conserva este derivado; el publicador y la app bloquean contratos incompletos.

Workflow [38078077829](https://github.com/rafardous/uruguay-natura-data/actions/runs/38078077829), SQLite público de 19.599.360 bytes, SHA-256 `25e396dbb8eabce6112168ddb5bb9e16475e71049cd98b2baf395e00f1f1918a`. Descargas normal/gzip, integridad, claves foráneas, 1048 especies, 100 plantas, 432 perfiles y las 1048 paletas JSON/SQLite verificadas. El binario publicado se copia sin modificaciones a la app.

La actualización nativa 1.3.0 → 1.3.1 preservó cuatro favoritos y el progreso de Aprender (0/21 módulos completos y una idea pendiente de repaso). Se comprobaron las fichas de ñandú (150 cm), albatros (80/220 cm), gavilán alilargo (48/60 cm por sexo, BC), ayuda de tamaño, otros nombres, carrusel, doble toque y configuración exclusivamente clara. A 150 % de texto el calendario usa dos filas y las etiquetas de navegación siguen visibles; se restauró el tamaño original del teléfono.

### Entrega Android final

Se instaló Arapy 1.3.1/build 7 sobre la app existente del Pixel, con la misma firma, sin desinstalar ni borrar datos. El APK contiene exactamente el SQLite público v9 y los 177 audios aprobados comprobados por hash. La prueba después de un arranque sin Wi-Fi ni datos reprodujo el audio del gavilán alilargo. Se confirmaron nuevamente cuatro favoritos y el progreso conservado; Marcela muestra tres hábitats y permite ampliar los cuatro restantes sin duplicados.

El [APK publicado](https://github.com/rafardous/uruguay-natura-data/releases/download/catalog-v9/Arapy-1.3.1.apk) se descargó realmente desde GitHub y coincide con SHA-256 `235fba8f44000326bb6529191d8eeee024da43910c9f7a886cc787d7cd3e8a82`. `data/reports/arapy-android-build-verification.json` registra firma, commit de compilación y contenido; `arapy-native-acceptance.json` registra aceptación sin datos personales. El teléfono recuperó su conectividad y preferencias originales. Los binarios, capturas y credenciales permanecen fuera de Git.
