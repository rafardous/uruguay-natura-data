# Hoja de ruta de Juegos

La primera entrega implementa **Nombrar · Imagen** con diez preguntas sin tiempo, autocompletado offline por nombre común y científico, confirmación obligatoria y persistencia de puntaje/racha. **Sonido** queda visible como “Próximamente” hasta contar con audios aprobados.

## Puzzle

El puzzle jugable usa `react-native-svg` (`ClipPath`) y `PanResponder`/Animated para mantener compatibilidad con Expo 57 y funcionar offline. Ofrece grillas 3×3 y 4×4, categorías del catálogo, encastre al 18 %, cronómetro pausables y récords personales en `user.db`. La ruta `/game/puzzle-setup` recuerda la última elección. Skia queda como fallback si el renderer SVG 4×4 no alcanza fluidez en dispositivos objetivo.

## Clasificar

Evaluar [`react-native-reanimated-dnd`](https://github.com/entropyconquers/react-native-reanimated-dnd) para zonas y grillas, pero exigir un spike con Expo 57 / React Native 0.86 antes de adoptarlo. La compatibilidad publicada se verificó con versiones anteriores. La interacción final debería contemplar agrupación visual, teclado/lector de pantalla y feedback háptico.

Trivia y Clasificar siguen en preparación; Puzzle ya es jugable y sus récords se sincronizan con `sync_puzzle_records` cuando hay sesión.
