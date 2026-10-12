# UX móvil — octubre de 2026

Cambios en desarrollo; esta entrega no publica un APK.

## Ficha y galería

El nombre común admite múltiples líneas y conserva espacio para descendentes. El científico comparte una fila adaptable con «Otros nombres: »; tocar los alternativos conserva el detalle completo. Tamaño sólo muestra la «i» cuando hay medidas; las explicaciones corresponden a los datos presentes.

La foto completa mantiene zoom 1×–3× y arrastre limitado a los bordes de la imagen contenida. Conserva pinch/doble toque y controles Acercar, Alejar y Restablecer. La galería se bloquea al ampliar y vuelve a habilitarse en 1×. Cambiar imagen o cerrar reinicia el encuadre. La foto inline conserva zoom momentáneo.

«Enviar a chequear fotos» requiere fotos, sesión y acceso editorial activo confirmado por `has_editor_access`. Revalida el permiso y usa `submit_feedback` con tipo `review`, área `species`, código estable, versión y plataforma. Su texto es «Revisar fotos de esta especie: calidad o pertinencia de las imágenes.»; aparece en Reportes con enlace a la ficha. No crea revisiones ni requiere migraciones para reportes. El aviso de éxito/error dura cuatro segundos. Los fallos permiten reintentar manualmente; no hay envíos simultáneos ni cola automática.

## Navegación y juegos

Inicio, Descubrir y Juegos comparten `MAIN_HEADER_GRADIENT`. La barra de 80 px usa radio exterior de 40 px y botones de 58 px con radio de 29 px. Los seis juegos comparten grilla de dos columnas y altura base de 140 px, que aumenta uniformemente con títulos ampliados. Adiviná reutiliza una foto aprobada; ¿Dónde vive? usa la primera foto de ambiente disponible y prioriza miniaturas incluidas. Se conservan alternativas gráficas ante falta/error de medios.

Puzzle ya no ofrece «Especies que pueden aparecer»: usa todas las habilitadas de la categoría elegida. Sólo Deslizante permite elegir 3×3/4×4 y guarda esa preferencia. Encastrar usa dieciséis piezas fijas (`JIGSAW_GRID_SIZE=4`), sin selector ni grilla en el título, independiente de la preferencia de Deslizante.

Adiviná conserva forma de respuesta y nivel, pero elimina categorías y mezcla animales/plantas habilitados con cinco pistas. Los nuevos récords usan `all:nivel` y aparecen como «Animales y plantas»; los históricos permanecen separados. Antes de distribuir esta app, aplicar con respaldo `20261012171935_mixed_guess_scope.sql`: habilita esa clave exclusivamente para Adiviná. Está preparada/probada localmente, sin aplicar a producción.

## Acerca de y créditos

Acerca de usa el ícono oficial de la app y el lema «Nuestra naturaleza en un solo lugar». Se organiza en catálogo vivo, aprendizaje, funcionamiento offline, fuentes y colaboración; los avistamientos se presentan como una función futura. Favoritos, récords y progreso se guardan localmente; la conexión permite sincronizar la cuenta, actualizar el catálogo y descargar medios pendientes.

Los cuadros de introducción de Acerca de, Créditos y Colaborar usan el degradado verde de Inicio. Los encabezados de las secciones conservan fondo neutro, título y cierre de 48 px a la derecha. Los otros visores y paneles también cierran desde la derecha; el cajón lateral conserva su diseño.

Créditos lista a Rafael Rinaldi, Pedro Rinaldi y Agustín Morelle en ese orden. Azpiroz figura separado bajo Datos y referencias, con reconocimiento por el armado y organización de aves. Las demás fuentes del catálogo se resumen por su aporte; el detalle y las licencias permanecen en cada ficha y medio.

## Verificación

- App: `npx tsc --noEmit`, `npm run lint`, `npm test -- --runInBand`.
- Panel: `npm run test:mobile-ux` prueba RPCs/migraciones reales en PostgreSQL embebido con fixtures aislados: reporte, vínculo, RLS y separación de récords. `npm run test:mobile-ux -- --serve` muestra la página real de Reportes con ese fixture en `http://127.0.0.1:5175/__ux_test`, sin sesión/datos de producción.
- Revisar nombres largos/descendentes, ancho reducido y fuentes ampliadas; fotos verticales/horizontales, zoom, arrastre, reset y galerías de una/tres fotos; configuración de Puzzle y Adiviná.
- La aceptación Android requiere un dispositivo conectado. Las pruebas JS o web no verifican por sí solas los gestos nativos.
