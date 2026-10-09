# Arapy

El nombre público de la app es **Arapy**. La animación de apertura dibuja al sapito de Darwin y el nombre en `src/presentation/components/StartupExperience.tsx`. Los PNG del ícono y del splash se generan con `node scripts/gen-icons.mjs` desde `assets/images/arapy-icon-master.png` y `arapy-logo-master.png`; el dibujo de trazos vive en `assets/images/arapy-mark.json`. El `slug`, el esquema OAuth y los identificadores de paquete conservan sus valores anteriores para mantener compatibles los enlaces y las instalaciones.

Para un APK remoto, ejecutar primero `npm run data:audio-assets`: copia los audios aprobados a `assets/audio/` (ignorado por Git). El `.easignore` de la raíz Git los incluye únicamente en el archivo que se envía a EAS; sin ese paso Metro no puede resolver `audioMap.ts`. Después, usar `npx eas-cli build --platform android --profile preview --non-interactive`. La sesión de Expo debe tener acceso al proyecto EAS `19da2ae0-b85c-4ed8-9dbc-f26fe80c6a8e` de `rafardousdocente`. El perfil `preview` produce APK; `production` produce AAB.

`npm run data:catalog-all` genera la SQLite móvil schema 14/data 4. Verifica por SHA-256 las fotos familiares de `guia-aves`, las prioriza en 309 aves y conserva hasta dos por especie; si faltan objetos o correspondencia, usa la selección externa de iNaturalist/Wikimedia. Las plantas y los artrópodos aplican automáticamente las fotos externas con licencia y atribución válidas. El catálogo deja origen desconocido y fallback visual donde las fuentes no permiten resolverlos. `data:catalog-db-preview`/`data:catalog-verify-preview` quedan disponibles para ensayos aislados en versión 5.

El 24/09/2026 se creó el proyecto separado [@rafardous/arapy-preview](https://expo.dev/accounts/rafardous/projects/arapy-preview), ID `de838898-c903-4937-ab09-a927de89c64b`, con paquete Android `uy.arapy.preview` para intentar un APK de prueba sin alterar la firma principal. Expo aceptó el archivo, pero rechazó el build porque la cuenta `rafardous` agotó su cupo Android gratuito hasta el 01/10/2026. No se contrató un plan pago ni se dejó `app.json` apuntando al proyecto de prueba.

Guía de campo de la biodiversidad uruguaya. App React Native (Expo) para Android e iOS, con un catálogo offline de 902 especies consolidadas desde 1006 registros de entrada. El pipeline también deja preparada la expansión de artrópodos de Uruguay.

## Requisitos

- Node 20+
- Para Android: Android Studio + un emulador, o un dispositivo con depuración USB
- Para iOS: Xcode + CocoaPods (solo macOS)

```bash
npm install
```

> **JDK 17 o 21 para Android.** Con JDK 26 el build falla (`jlink` no procesa
> `core-for-system-modules.jar` de android-36). Usá el JDK que trae Android Studio:
>
> ```bash
> export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
> ```

> **La carpeta del proyecto no puede tener espacios (build local de iOS).**
> CocoaPods genera esta fase de build para expo-constants:
>
> ```sh
> bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"
> ```
>
> La ruta va sin comillas dentro de `bash -c`, así que un espacio la parte en dos
> y el build muere con `bash: /ruta/con: No such file or directory`. Android no se
> ve afectado (Gradle maneja espacios bien) y **EAS tampoco**, porque clona el repo
> en una ruta sin espacios. Solo afecta a `npx expo run:ios` en local: mové el
> proyecto a una ruta sin espacios (por ejemplo `uruguay-natura`) y funciona.

> **Simulador iOS: usá un runtime iOS 26.x, no 27.0.** En iOS 27 la app compila e
> instala pero no arranca: `UIScene life cycle is required for apps built with this
> SDK` ([TN3187](https://developer.apple.com/documentation/technotes/tn3187)). El
> template nativo de Expo SDK 57 todavía no adoptó UIScene, así que es una brecha
> upstream y no del código de la app. Verificado funcionando en iOS 26.5.

## Correr la app

La app necesita la base de datos y las miniaturas generadas (ver [Pipeline de datos](#pipeline-de-datos)). Si es la primera vez:

```bash
npm run data:all
```

Después:

```bash
npm run android    # emulador o dispositivo Android
npm run ios        # simulador iOS
npm start          # solo el bundler (Expo Dev Client)
```

### Cuenta y actualizaciones

Google se abre en el navegador seguro con PKCE y vuelve por `naturauy://auth/callback`; el mismo OAuth Client ID de tipo Web configurado en Supabase sirve para web y móvil. En Supabase agregá `naturauy://**` a las URL de redirección permitidas y configurá en Google únicamente el callback alojado de Supabase (`https://xbnbfekcxrkgteuijbzh.supabase.co/auth/v1/callback`).

Las variables públicas de Expo/EAS son `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `EXPO_PUBLIC_CATALOG_MANIFEST_URL`. Definilas en los entornos `development`, `preview` y `production` antes de compilar (son públicas; nunca uses una `service_role`):

```powershell
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://xbnbfekcxrkgteuijbzh.supabase.co --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value TU_CLAVE_PUBLISHABLE --visibility plaintext
eas build --platform android --profile preview
```

El callback nativo requiere una build de desarrollo, preview o producción; Expo Go no es una prueba válida del retorno `naturauy://`. Nunca incluyas secretos de Google ni `service_role` en la app.

El catálogo remoto se descarga a `natura.next.db`, se valida (HTTPS, SHA-256, tamaño, esquema e integridad SQLite) y se activa recién en el siguiente arranque. Favoritos, récords y preferencias permanecen en `user.db`.

### Puzzle

Desde Juegos → Puzzle podés elegir una grilla 3×3 o 4×4, una categoría y el nivel de conocimiento de las especies. Es un puzzle deslizante: una casilla queda vacía y al tocar una ficha adyacente ésta ocupa el hueco. Las partidas se mezclan siempre con movimientos legales, funcionan con las miniaturas incluidas aun sin conexión y los mejores tiempos/movimientos se guardan offline por categoría, grilla y nivel. Al iniciar sesión se sincronizan de forma privada mediante `sync_puzzle_records` y se recuperan con `get_personal_mobile_progress`.

Desde Explorar → Aprender hay cinco recorridos para público general 12+: taxonomía, redes ecológicas, historias de especies, caza y convivencia, y evaluación de amenaza. Los 21 módulos funcionan offline, enlazan sus fuentes y usan preguntas de selección simple/múltiple, orden y clasificación. El primer intento alimenta una cola de repaso a 1, 3, 14 o 45 días; el progreso vive en `user.db` y se sincroniza de forma privada al iniciar sesión.

### Dificultad, trivia y fichas enriquecidas

Los juegos usan `easy`, `medium` y `hard` de manera acumulativa: medio incluye las especies fáciles y difícil puede incluirlas a todas. El nivel expresa familiaridad esperable, no dificultad taxonómica, rareza ni conservación. Identificación, Nombrar y Puzzle guardan récords separados por nivel. Trivia publica preguntas de cuatro opciones con una sola respuesta correcta; las preguntas vinculadas heredan el nivel de su especie y las generales aparecen siempre.

Las fichas distinguen abundancia experta de observabilidad pública. La segunda se calcula sobre diez años completos de registros georreferenciados y muestra método/período; nunca se presenta como estimación poblacional. Cuando hay varias curiosidades aprobadas, la ficha rota una por día de forma determinista.

## Pipeline de datos

El pipeline histórico (`data:all`) convierte `resources/outputSNAP.json` en artefactos iniciales. Para el catálogo editorial vigente se usa el pipeline schema 14 descrito abajo; los endpoints sólo se consultan durante refresh y la app sigue funcionando offline con SQLite.

```bash
npm run data:all
```

Cada etapa se puede correr suelta y todas son **reanudables** (cachean en `scripts/.cache/`):

| Comando | Qué hace |
|---|---|
| `npm run data:normalize` | Limpia los 2021 registros del SNAP |
| `npm run data:taxonomy`  | Resuelve nombres contra GBIF (corrige tipeos y sinónimos) |
| `npm run data:media`     | Busca fotos CC0/CC BY en iNaturalist y Wikimedia · **~35 min** (límite de 1 req/s) |
| `npm run data:thumbs`    | Genera miniaturas WebP de 96px y `src/data/assets/thumbMap.ts` |
| `npm run data:accent`    | Extrae el color de cada foto y arma su paleta tonal |
| `npm run data:db`        | Escribe `assets/db/natura.db` (SQLite + FTS5) |
| `npm run data:verify`    | **Compuerta de calidad**: cobertura + contraste WCAG AA |

`data:media` acepta `--limit N` para una corrida de prueba:

```bash
npx tsx scripts/03-fetch-media.ts --limit 20
```

> Solo se descargan imágenes CC0 y CC BY. CC BY exige atribución: el fotógrafo aparece en cada ficha y en la pantalla de Créditos. No cambies el filtro de licencias sin revisar eso.

Antes de normalizar la expansión de artrópodos se puede actualizar el backlog
de descubrimiento en GBIF. La faceta de ocurrencias devuelve hasta 1.000
taxones ordenados por cantidad de registros; por defecto sólo prioriza 150
para revisión editorial. Los detalles se cachean por lote y quedan como
`candidate_only`, sin entrar automáticamente a `data/catalog/`:

```bash
npm run data:arthropod-discovery -- --batch=50
npm run data:arthropod-discovery -- --refresh --batch=50
npm run data:arthropod-discovery -- --max-taxa=250 --batch=50
```

El resultado queda en `data/reports/arthropod-discovery-candidates.json` y la
respuesta reproducible en `data/cache/gbif/arthropod-discovery.json` sólo
después de una corrida exitosa. El inventario se pagina cuando la faceta
alcanza 1.000 taxones; no se toma ese límite como total y los snapshots
truncados anteriores fueron retirados. El backlog editorial se limita por
lote para revisión, pero nunca se publica automáticamente. La promoción al
catálogo exige resolver el nombre, comprobar presencia en Uruguay, conseguir
medios con licencia válida y aprobar la ficha en el panel.

### Catálogo editorial por grupos (`data/catalog`, schema 14)

El catálogo nuevo combina fuentes locales, resuelve nombres con GBIF v2 y
busca una imagen redistribuible por nombre científico aceptado. La jerarquía ya
no está limitada a animales: parte de `Animalia` y `Plantae`, conserva Chordata/Arthropoda y selecciona 100 plantas de interés de Uruguay.

```bash
npm run data:catalog-all
```

El flujo se divide en dos comandos reproducibles: `data:catalog-refresh`
descarga snapshots con checksum en `data/raw/<proveedor>/`, pagina GBIF,
consulta fotos y datos candidatos de las 100 plantas y actualiza cachés de
resolución/medios; `data:catalog-build` trabaja
exclusivamente offline desde esos snapshots y cachés fijados. Los tres datasets abiertos de artrópodos quedan
en `raw/udelar/`, `raw/gbif/` y `raw/biodiversidata/`; sus DOI y endpoints están
registrados en `data/raw/sources.json`. La planilla de EcoRegistros se conserva
únicamente en `raw/ecoregistros.org/insectos-uruguay/restricted/`, ignorada por
Git y usada sólo para contraste editorial. El parser reconoce la planilla HTML
Latin-1 (1.221 filas: 876 nombres binomiales y 344 entradas incompletas o
inciertas) y nunca convierte sus filas en especies publicables.

La selección vive en `data/raw/curated-plants/seed-100.json`; `baseline-evidence-100.json` conserva la evidencia taxonómica y ecológica. El snapshot completo de 3157 plantas fue retirado. `data:plants` genera 100 registros y toma las fotos válidas del caché externo. Asigna origen nativo sólo cuando Flora Uruguaya muestra explícitamente «Nativa» o «Endémica regional» en la ficha correspondiente; mantiene origen desconocido para las demás. Las alturas y fenologías sin evidencia precisa no se inventan. `data:plant-taxonomy` contrasta nombres con WFO y deja conflictos taxonómicos para revisión editorial.

La etapa de imágenes consulta iNaturalist primero y Wikimedia como respaldo.
En iNaturalist sólo acepta CC0, porque el código genérico `cc-by` de su API no
demuestra una versión concreta; en Wikimedia acepta CC0 o CC BY 4.0 verificable. Conserva la licencia original exacta,
rechaza CC BY-NC/SA/ND, licencias ausentes y dimensiones insuficientes, y guarda
URL mediana y grande, atribución, fuente, página, checksum/ID cuando existe.
El resultado reanudable queda en
`data/cache/media/species-media.json`. `data:plants` utiliza automáticamente las
imágenes con licencia, dimensión y atribución válidas; si faltan, la app usa su
fallback visual.
Luego `data:catalog-db` consolida las apariciones repetidas por especie, conserva
los códigos históricos que reconoce y genera `assets/db/natura.db`. La última
etapa (`data:catalog-verify`) prueba integridad, búsqueda FTS, filtros, paginado y
la consulta del juego antes de dar el pipeline por terminado.

Las descripciones editoriales de órdenes se guardan por clase en
`data/taxonomy/*-orders.json`. El generador incorpora automáticamente todos los
archivos con `rank: "order"` a `taxon_content`; para sumar otra clase alcanza con
crear su JSON y publicar el contenido equivalente mediante una migración de
Supabase. La compatibilidad de GBIF para Reptilia normaliza únicamente
`Crocodylia`, `Squamata` y `Testudines` cuando llegan en el campo de clase.

La corrida histórica contiene 49 registros de artrópodos (42 Arachnida, 5
Insecta y 2 Malacostraca). Los nombres sin epíteto específico, incluido
`Bothriurus`, se preservan en `data/reports/incomplete-name-candidates.json` para
decisión editorial. `data/fixtures/arthropods.schema11.json` cubre los casos de
prueba `Aedes aegypti`, `Grammostola anthracina`, `Ligia exotica`, `Neomysis
americana` y el incompleto.

La ilustración de la tarjeta `Arthropoda` se acompaña de una verificación GBIF
separada en `data/reports/arthropoda-illustration-verification.json`: los cinco
taxones representados tienen coincidencia taxonómica exacta y registros de
ocurrencia en Uruguay. Esa evidencia sólo valida la selección de la lámina; no
se usa como media de especie ni publica automáticamente candidatos.

El registro de fuentes y licencias vive en `data/catalog-source-registry.json`. Para los grupos objetivo, el flujo genera diferencias por campo y una lista explícita de posibles exclusiones; no borra ni rectifica especies automáticamente:

```bash
npm run data:enrichment-candidates
npm run data:observability -- --batch=25
npm run data:external-discovery -- --batch=25
```

Los resultados quedan en `data/reports/target-group-enrichment-candidates.json`,
`data/reports/observability-snapshots.json` y
`data/reports/external-enrichment-candidates.json`. Catalogue of Life y WoRMS
pueden proponer identificadores; BOLD sólo informa cobertura de barcodes/BINs.
FishBase, iNaturalist taxonómica y cualquier fuente sin licencia redistribuible
se usan sólo para revisión, nunca como contenido copiado automáticamente al
catálogo.

El modelo schema 14 separa `measurements` y `ecology`, normaliza conservación en `species_conservation` y retira los campos legados combinados. Conserva raíces por reino, navegación por nodos estables e identificadores. La galería conserva hasta dos imágenes con
rol editorial implícito (principal, diagnóstica, etapa o detalle) y los filtros
offline incluyen metamorfosis, rol trófico y microhábitat cuando hay datos.

Para validar una muestra pequeña antes de procesar todo el catálogo:

```bash
npm run data:catalog-media -- --limit=20
npm run data:build-catalog
npm run data:catalog-db
npm run data:catalog-verify
```

Las plantas se procesan por separado dentro de `data:catalog-refresh`. Estos comandos permiten repetir sólo sus etapas y guardar el informe de faltantes. `data:plants` incorpora automáticamente las fotos válidas halladas:

```bash
npm run data:plants
npm run data:plant-enrichment
npm run data:plant-taxonomy -- --batch=20
npm run data:plant-media -- --limit=20
```

Las especies ya consultadas no se vuelven a pedir. Para reintentar únicamente
las que no tuvieron resultado:

```bash
npm run data:catalog-media -- --retry-missing
npm run data:build-catalog
```

## Tests

```bash
npm test
```

Cubre el motor del juego, los mappers y el contrato de contraste (todos los pares de color deben superar WCAG AA 4.5:1 en tema claro y oscuro).

## Builds

Requiere [EAS CLI](https://docs.expo.dev/eas/): `npm i -g eas-cli && eas login`.

### APK (Android)

```bash
eas build -p android --profile preview
```

Expo SDK 57 soporta Android 7 (API 24) o posterior. El APK `preview` conserva
las arquitecturas nativas predeterminadas de Expo, incluida `armeabi-v7a` para
teléfonos de 32 bits y `arm64-v8a` para los actuales. Al iniciar, la app valida
integridad, esquema y contenido de `natura.db`; si la copia instalada está vacía
o dañada intenta restaurar automáticamente el catálogo incluido sin tocar
`user.db`. Si tampoco pudiera abrirlo, muestra una acción de reintento en vez de
una pantalla vacía.

Después de actualizar Expo o cualquier módulo nativo hay que generar un APK
nuevo: una development build anterior no incorpora esos binarios aunque Metro
entregue el JavaScript actualizado.

Build local, sin pasar por la nube (necesita Android SDK + JDK):

```bash
eas build -p android --profile preview --local
```

### AAB para Google Play

```bash
eas build -p android --profile production
```

### IPA (iOS)

```bash
eas build -p ios --profile production
```

Para simulador (no requiere cuenta de Apple Developer):

```bash
eas build -p ios --profile preview
```

### Proyectos nativos

`ios/` y `android/` no se versionan. Para generarlos y buildear con Xcode/Gradle directo:

```bash
npx expo prebuild --clean
```

## Estructura

```
app/                     Rutas (expo-router)
src/
  domain/                Entidades y reglas puras (quizEngine, sin imports de RN)
  data/                  SQLite, repositorios y mappers
  presentation/          Tema, componentes y pantallas
  shared/                Utilidades (contraste WCAG, hooks)
scripts/                 Pipeline de datos (01→07)
assets/db, assets/thumbs Generados por el pipeline
```

Las pantallas nunca ven filas SQL: los repositorios devuelven entidades de dominio a través de los mappers.

## Sistema de tema

Dos capas:

1. **Tema base** (`src/presentation/theme/tokens.ts`) — paletas clara y oscura. El array `CONTRAST_CONTRACT` lista los pares que deben cumplir AA; los tests y `data:verify` los verifican.
2. **Acento por especie** — cada especie guarda una paleta tonal derivada de su propia foto. Los tonos se eligen en build time recorriendo la rampa hasta superar 4.5:1 contra la superficie real, así que el contraste está garantizado por construcción y no hay cálculo de color en runtime.

## Créditos

Datos: SNAP y fuentes locales uruguayas · Taxonomía inicial: GBIF, con revisión de Catalogue of Life/WoRMS · Fotos: iNaturalist y Wikimedia Commons sólo con licencia publicada y verificable.
