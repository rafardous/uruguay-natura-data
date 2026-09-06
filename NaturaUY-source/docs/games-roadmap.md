# Hoja de ruta de Juegos

La primera entrega implementa **Nombrar · Imagen** con diez preguntas sin tiempo, autocompletado offline por nombre común y científico, confirmación obligatoria y persistencia de puntaje/racha. **Sonido** queda visible como “Próximamente” hasta contar con audios aprobados.

## Puzzle

Recomendamos un spike con [React Native Skia](https://shopify.github.io/react-native-skia/docs/getting-started/installation/) para recortar piezas y Gesture Handler/Reanimated para arrastre, encastre y hápticos. Skia es compatible con React 19 y Reanimated 4; no se instala en esta entrega.

## Clasificar

Evaluar [`react-native-reanimated-dnd`](https://github.com/entropyconquers/react-native-reanimated-dnd) para zonas y grillas, pero exigir un spike con Expo 57 / React Native 0.86 antes de adoptarlo. La compatibilidad publicada se verificó con versiones anteriores. La interacción final debería contemplar agrupación visual, teclado/lector de pantalla y feedback háptico.

Trivia, Puzzle y Clasificar se presentan como futuras, sin rutas jugables engañosas. Aprender anticipa contenidos de taxonomía, estadísticas y curiosidades con niveles de dificultad.
