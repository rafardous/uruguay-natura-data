# Natura UY

Guía de campo de la biodiversidad uruguaya. App React Native (Expo) para Android e iOS, con las 2021 especies del listado SNAP.

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

## Pipeline de datos

Convierte `resources/outputSNAP.json` en `assets/db/natura.db` + `assets/thumbs/`. Se corre una sola vez; el resultado se versiona.

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

### Catálogo por grupos (`data/catalog`)

El catálogo nuevo combina las fuentes públicas, resuelve nombres con GBIF y
busca una imagen redistribuible por nombre científico aceptado:

```bash
npm run data:catalog-all
```

La etapa de imágenes consulta iNaturalist primero y Wikimedia como respaldo.
Solo acepta licencias reutilizables, guarda URL mediana y grande, licencia,
atribución, fuente y página original. El resultado reanudable queda en
`data/cache/media/species-media.json` y se integra en `media.image` dentro de
los JSON de `data/catalog/` sin reemplazar los campos enriquecidos existentes.
Luego `data:catalog-db` consolida las apariciones repetidas por especie, conserva
los códigos históricos que reconoce y genera `assets/db/natura.db`. La última
etapa (`data:catalog-verify`) prueba integridad, búsqueda FTS, filtros, paginado y
la consulta del juego antes de dar el pipeline por terminado.

Para validar una muestra pequeña antes de procesar todo el catálogo:

```bash
npm run data:catalog-media -- --limit=20
npm run data:build-catalog
npm run data:catalog-db
npm run data:catalog-verify
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

Datos: SNAP (Ministerio de Ambiente, Uruguay) · Taxonomía: GBIF · Fotos: iNaturalist y Wikimedia Commons (CC0 / CC BY).
