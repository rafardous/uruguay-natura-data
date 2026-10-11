# Arapy · App móvil

En desarrollo: Puzzle incorpora Encastrar (arrastrar/rotar, 3 × 3 y 4 × 4) y Adiviá ofrece cinco pistas progresivas con buscador u opciones. Sus récords funcionan offline y quedan separados por modalidad, selección y cuenta. La migración y las 40 pistas están aplicadas en producción; la vista previa se deriva de PostgreSQL. La aceptación Android y un APK nuevo quedan pendientes. Ver [games.md](docs/games.md).

Catálogo offline de biodiversidad de Uruguay, desarrollado con Expo y React Native. La fuente editorial es PostgreSQL en Supabase; los JSON de `data/catalog/` y `assets/db/natura.db` son derivados publicados.

El catálogo incluido v9/schema 14 contiene 1048 especies: 948 animales y las 100 plantas de `data/raw/curated-plants/seed-100.json`. Las otras 3057 plantas y sus revisiones permanecen archivadas en Supabase. Los registros históricos y candidatos externos se conservan para auditoría; no alimentan un catálogo alternativo.

## Desarrollo

Usar Node.js 24 y las dependencias de este directorio.

```powershell
npm ci
npm start
# Teléfono por USB; usar el puerto que informe Expo
adb reverse tcp:8081 tcp:8081
npm run android
```

Expo Go permite revisar la interfaz sin reemplazar Arapy instalada. Las pruebas de firma y actualización requieren un APK con la firma EAS existente. No desinstalar la app para actualizarla.

## Verificación

```powershell
npx tsc --noEmit
npm run lint
npm test -- --runInBand
npm run data:catalog-verify
npm run data:thumbnail-map           # informe sin escritura
npm run data:thumbnail-map -- --write
```

El verificador abre SQLite sólo para lectura y comprueba esquema, integridad, UUID/códigos, selección exacta de plantas, taxonomía, búsqueda y medios. El mapa de miniaturas sólo conserva referencias a códigos del catálogo incluido; sus archivos históricos no se modifican.

## Datos y publicación

La publicación se realiza desde `../NaturaUY-admin/`, mediante `catalog:build` y el workflow editorial. Una edición crea una revisión y requiere aprobación. El importador inicial sólo admite bases vacías; no sirve para actualizar una base en uso.

Se retiraron los generadores locales de catálogo, el importador masivo de Flora y la aplicación automática de rasgos sobre JSON. Los comandos de descubrimiento, taxonomía, medios y enriquecimiento que permanecen producen evidencia para revisión humana. `data:plant-media`, `data:plant-taxonomy` y `data:plant-enrichment` trabajan sobre las plantas seleccionadas; no restauran las archivadas. CC0, CC BY 4.0 y autorizaciones verificables conservan sus condiciones; una autorización no convierte un medio en libre.

El publicador genera las paletas desde las fotos principales aprobadas. No editar SQLite a mano ni reemplazar las paletas por un color fijo. La documentación operativa está en [deployment.md](../NaturaUY-admin/docs/deployment.md); los perfiles y medios de aves, en [AVES_AZPIROZ_2003.md](data/AVES_AZPIROZ_2003.md).

## Funcionamiento móvil

- `natura.db`: catálogo, fuentes, taxonomía, fotos, audio y documentos de Aprender.
- `user.db`: favoritos, preferencias, récords y progreso de Aprender; funciona sin cuenta y se sincroniza al iniciar sesión.
- El actualizador descarga una base nueva, verifica compatibilidad y SHA-256, y la activa al siguiente inicio. Ante un fallo conserva la anterior.
- Las listas conservan páginas por conexión SQLite y filtros; descartan respuestas atrasadas. Las imágenes usan caché y reinician el fallback al cambiar de especie.
- Modo claro, colores de cada foto y barra flotante con transparencia glass.
- Las fichas animales comparten tamaño, abundancia, presencia, alimentación y apartados ecológicos separados. Las plantas mantienen su ficha botánica.
- Los nombres alternativos se abren al tocar; las fuentes científicas se consultan en tres puntitos → Fuentes.
- Las tarjetas de juegos muestran nombre e ilustración. Las reglas y la descripción se muestran al entrar.
- Aprender incluye 21 lecturas revisadas para niñas y niños, 47 preguntas e ilustraciones del catálogo. No muestra tiempos estimados; las descripciones se leen dentro de cada recorrido. Contrato de contenido, fotos y preservación de progreso en [learning.md](docs/learning.md).

## Android

`eas build -p android --profile field-guide` genera el APK interno con la firma existente. Revisar [eas.json](eas.json), el informe de aceptación y la documentación de operación antes de publicar una versión.

Las comprobaciones de Arapy 1.3.1/build 7 están en `data/reports/arapy-*-verification.json` y `arapy-native-acceptance.json`. Los cambios de interfaz en desarrollo no forman parte de ese APK publicado.
