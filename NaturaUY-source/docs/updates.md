# Actualizaciones de Arapy y del catálogo

Implementado para el piloto Android de Arapy 1.4.0. Todavía requiere una build nueva, aceptación en dispositivos y despliegue del manifiesto de app; no es una característica del APK 1.3.1/build 7 ya distribuido. El manifiesto inicial contiene `{"android":null}`: no anuncia automáticamente builds experimentales ni el código bootstrap en desarrollo.

El responsable pidió el 12/10/2026 no solicitar todavía una build a Expo mientras se editan otras partes de la app. Esta entrega se limita a código y verificaciones locales; el procedimiento de build/promoción se ejecutará cuando indique retomarlo.

## Comportamiento

Al iniciar una sesión de la app se consultan dos manifiestos independientes sin exigir cuenta ni bloquear la navegación offline. La consulta de app sólo se realiza en Android instalado, con build nativa conocida; Expo Go y web no ofrecen instalar APKs. Los fallos de una consulta no bloquean la otra. Las búsquedas de catálogo automática y manual comparten la misma operación.

Configuración muestra versión/build reales del APK, versión del catálogo activo, publicación disponible y descarga pendiente. **Buscar actualización del catálogo** busca y descarga una publicación compatible con cualquier conexión, incluidos datos móviles. La descarga muestra tamaño en MB y fases, sin porcentaje inventado. La vista web conserva su catálogo incluido y deshabilita la descarga nativa.

**Actualizar Arapy** abre el archivo APK directo de Expo en el navegador, sin pasar por la página de la build ni elegir Download. El navegador puede pedir confirmar la descarga. Después hay que abrir el archivo y tocar Actualizar; Android puede solicitar permiso para instalar desde ese navegador. Arapy no instala APKs ni pide permisos de instalador propios. Se conserva el paquete `uy.naturauy.app` y la firma existente para actualizar sin desinstalar ni perder favoritos/progreso. La app se descarga sólo al tocar el botón.

El aviso automático se registra por build en `user.db.settings` y no se repite antes de 24 horas; Más adelante, el botón Atrás y abrir la descarga cuentan como aviso mostrado. Configuración conserva el acceso al enlace. Si el catálogo requiere otra app, sólo se ofrece una build que cumpla versión mínima y esquema soportado; si no está anunciada, se conserva el catálogo activo.

La descarga de catálogo no cambia la DB abierta. **Catálogo actualizado; se aplicará al volver a abrir Arapy** significa cerrar completamente la app y abrirla nuevamente; volver desde segundo plano conserva la sesión y el catálogo activo. No hay reinicio forzado, cierre automático, ni reemplazo de conexiones SQLite activas.

## Contratos y recuperación

- Catálogo: se mantiene `/catalog/manifest.json`, con `data_version`, `schema_version`, `min_app_version`, URLs, tamaño y SHA-256 existentes. `EXPO_PUBLIC_CATALOG_MANIFEST_URL` puede sobrescribir su dirección.
- App: `/updates/app.json`, estático en Cloudflare Pages y con `Cache-Control: no-store`. `EXPO_PUBLIC_APP_RELEASE_MANIFEST_URL` puede sobrescribir su dirección. Contiene `android: null` o un objeto con `version`, `build`, `download_url`, `apk_size`, `catalog_schema` y `published_at`. La URL debe tener la forma `https://expo.dev/artifacts/eas/IDENTIFICADOR.apk`, sin credenciales ni parámetros. No hay tokens Expo en el dispositivo ni migraciones Supabase.
- La build nativa Android decide si hay actualización, incluyendo nuevas compilaciones de la misma versión. No se ofrecen versiones inferiores ni actualizaciones de build desconocida.
- Cada manifiesto tiene un límite de 8 segundos que incluye su JSON. El catálogo tiene un límite de descarga independiente de 120 segundos, con AbortSignal enviado al descargador nativo. Se reintenta manualmente; las consultas no bloquean el arranque.
- El archivo `natura.download.db` es temporal. Tras tamaño, hash, integridad SQLite, metadatos y tablas obligatorias, se mueve a `natura.pending-VERSION-SHA256.db`. El recibo `natura.pending.json` se prepara aparte y mantiene un recibo anterior durante el reemplazo. Una nueva descarga fallida conserva la pendiente anterior. Los metadatos se vuelven a comprobar al arrancar, sin red.
- Las operaciones de archivos se serializan incluso entre remontajes del provider. Antes de abrir SQLite se descartan temporales, se recupera `natura.previous.db` si el arranque anterior se interrumpió durante el reemplazo y se aplica únicamente una pendiente compatible. Una build nueva puede aportar un catálogo incluido más reciente; nunca se activa una pendiente que lo degrade.
- El legado `natura.next.db` no tiene recibo de hash: se descarta y, si corresponde, se vuelve a descargar. Los archivos ajenos a los candidatos del catálogo y `user.db` se preservan.
- Se distinguen falta de conexión, servidor inaccesible, interrupción, espacio insuficiente, archivo inválido y error local de almacenamiento. La actualización pendiente sigue visible aunque falle una nueva consulta.

## Anunciar una build probada

El anuncio es independiente del workflow editorial y manual. No se elige la última build de EAS automáticamente. La primera build con esta función se entrega a los testers por enlace manual.

1. Crear una build `field-guide` con el paquete y firma actuales, sin publicar automáticamente contenido bootstrap. Obtener sus metadatos: `eas build:view ID --json` y guardar la salida fuera de Git.
2. Descargar su APK. Instalar con `adb install -r`, sin desinstalar, y verificar favoritos, progreso, récords, arranque offline, cambio de catálogo sólo al nuevo arranque y la descarga directa desde Arapy en un teléfono de tester.
3. Registrar aceptación en un JSON fuera de Git. Campos: `buildId`, `appVersion`, `androidVersionCode`, `catalogSchema`, `apkSha256`, `sourceCommit`, `verifiedAt` (ISO), `deviceModel`, `testerDeviceModel`; además, todos estos resultados deben ser `true`: `installedAsUpdate`, `favoritesPreserved`, `learningProgressPreserved`, `gameRecordsPreserved`, `offlineColdStart`, `foregroundKeepsInstalledCatalog`, `coldStartAppliesPendingCatalog`, `directExpoDownloadFromArapyVerified`. Nunca inventar resultados pendientes.
4. Desde `NaturaUY-admin`, ejecutar la validación sin cambios:

```powershell
npm run app:prepare-release -- --build-json ../.tmp/eas-build.json --apk ../.tmp/arapy.apk --acceptance ../.tmp/arapy-acceptance.json
```

El comando comprueba proyecto EAS, estado FINISHED, perfil, versión/build, aceptación para el APK exacto, paquete Android y firma contra el informe histórico. Descarga anónimamente desde Expo y compara bytes/tamaño/SHA-256 con el APK probado. Requiere Android SDK build-tools y Java; respeta `ANDROID_HOME`, `ANDROID_SDK_ROOT` y `JAVA_HOME`.

5. Sólo tras aceptación completa, repetir con `--write`; revisar el diff del manifiesto y desplegar Cloudflare Pages desde `main`. Verificar `/updates/app.json` y el enlace desde el teléfono sin login Expo. Conservar la build anunciada en EAS: si se elimina o vence, preparar una nueva publicación válida o retirar el anuncio con `android: null`.

El script no crea builds, no publica catálogos, no instala en dispositivos ni despliega Cloudflare. Para retirar un anuncio, publicar `android: null`; los APK existentes siguen funcionando offline.

## Verificación local

Desde la app: `npx tsc --noEmit`, `npm run lint`, `npm test -- --runInBand`. Las pruebas de actualización cubren competencia automática/manual, independencia de manifiestos, descarga pendiente reutilizada, cancelación, espacio insuficiente, checksum, compatibilidad y recuperación de archivos. Los mocks no sustituyen la aceptación Android real ni la prueba del navegador de un tester.

Desde el panel: `npm run typecheck:automation`, `npm run build`, `npm run app:prepare-release -- --help`. El build web y `catalog:build` nunca se ejecutan simultáneamente.
