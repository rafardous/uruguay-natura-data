# Hoja de ruta de Juegos

La primera entrega implementa **Nombrar · Imagen** con diez preguntas sin tiempo, autocompletado offline por nombre común y científico, confirmación obligatoria y persistencia de puntaje/racha. **Sonido** queda visible como “Próximamente” hasta contar con audios aprobados.

## Puzzle

El puzzle jugable adopta la mecánica deslizante de [`react-native-picture-puzzle`](https://github.com/cawfree/react-native-picture-puzzle) (MIT), reimplementada sobre las APIs actuales de Expo 57 para evitar depender de su runtime React Native 0.63. Hay una casilla vacía y cada toque mueve únicamente una ficha ortogonal adyacente. La mezcla se construye mediante movimientos legales desde el tablero resuelto, por lo que toda partida tiene solución. Ofrece grillas 3×3 y 4×4, categorías del catálogo, cronómetro pausable y récords personales en `user.db`. La ruta `/game/puzzle-setup` recuerda la última elección.

## Clasificar

La primera versión jugable usa recuperación activa con devolución inmediata y funciona completamente offline. Cada ronda presenta ocho especies reales con foto ampliable y cuatro opciones. La dificultad determina el rango consultado: clase en Fácil, orden en Medio y familia en Difícil. No guarda récords porque su objetivo es practicar el parentesco, no competir.

Las consignas se generan desde el catálogo publicado y respetan `species_game_rules.game_key = classify`. Una rectificación taxonómica aprobada llega así al juego con la siguiente versión del catálogo, sin mantener respuestas duplicadas.

## Dificultad común y Trivia

Identificar, Nombrar, Puzzle y Trivia comparten tres niveles de conocimiento acumulativos (`easy ⊂ medium ⊂ hard`) asignados editorialmente por especie, con opción de deshabilitar o elevar el mínimo por juego. Los récords de Identificar/Nombrar y Puzzle se separan por nivel.

Trivia ya es jugable offline. Usa preguntas aprobadas de cuatro opciones, exactamente una correcta, explicación opcional y fuente obligatoria. No asigna dificultad a la pregunta: una pregunta vinculada hereda la elegibilidad de la especie y una pregunta general aparece en cualquier nivel. Puzzle sincroniza sus récords mediante `sync_puzzle_records`; `get_personal_mobile_progress` recupera el progreso privado al cambiar de cuenta o dispositivo.
