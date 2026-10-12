# Aprender: lecturas e ilustraciones

La revisión de octubre de 2026 mantiene cinco recorridos y 21 módulos bootstrap en `src/content/learningContent.ts`. Incluye 48 preguntas: al menos dos por módulo y tres en cada historia del territorio. Las lecturas se escriben para que niñas y niños puedan seguir una idea a la vez, con términos explicados, ejemplos y un cierre que responde a «Antes de seguir» antes de evaluar la comprensión.

Las tarjetas de entrada muestran fotos y progreso. La descripción aparece al entrar al recorrido. No se muestran duraciones estimadas; `minutes` queda opcional sólo para compatibilidad con documentos anteriores. `contentVersion: 2` identifica las lecturas revisadas.

## Imágenes y diagramas

`LearningIllustration` admite comparaciones, secuencias y un árbol taxonómico vectorial. Las fotos de especies se muestran como ilustraciones circulares sin fichas de catálogo; cada ejemplo que nombra especies incluye fotos de esas mismas especies en el módulo. Las flechas indican pasos o niveles; una fila de fotos no afirma por sí sola una interacción entre esas especies. La portada de Taxonomía usa grupos abstractos y deja las especies para sus artículos.

Las fotos se resuelven desde la conexión del catálogo mediante `speciesRepository` y `SpeciesImage`, igual que las fichas. Se conservan autoría, licencia, enlace a la especie, caché y fallback a miniaturas asociadas al catálogo. No se agregan imágenes generadas ni se atribuyen miniaturas históricas a una foto editorial diferente. Las lecturas y el progreso funcionan offline; una foto sin miniatura incluida ni caché previa necesita conexión, igual que en el catálogo.

## Preguntas y progreso

Cada pregunta explica si hay que elegir una opción, varias, ordenar o clasificar. La respuesta se guarda en `user.db` antes de mostrar la devolución. Un error permite volver a intentar; no aumenta el contador de preguntas respondidas dos veces. Tras responder todas las preguntas se puede completar el módulo y avanzar al siguiente.

Se conservan los IDs de recorridos, módulos y objetivos existentes. La pregunta `tax-purpose` pasa a selección única y versión 2: cambia sólo el dominio de ese objetivo, no los demás ni la finalización histórica del módulo. Las preguntas nuevas tienen objetivos propios. Un módulo completado con preguntas faltantes o versiones antiguas se muestra «Para repasar». Una respuesta correcta a una versión nueva comienza con el intervalo de tres días incluso si hubo una respuesta a la versión anterior ese mismo día.

Las fuentes de las historias distinguen fecha del hecho, fecha de evaluación y consulta de normas. El cardenal de copete rojo incorpora la evaluación nacional de 2012, su prioridad de conservación y un caso de tráfico ilegal documentado en 2024, sin convertirlos en un conteo actual ni confundir prioridad con amenaza. Esta revisión es código de la app; no publica contenido en PostgreSQL ni modifica el catálogo derivado.

## Verificación

Desde `NaturaUY-source/`:

```powershell
npx tsc --noEmit
npm run lint
npm test -- --runInBand
```

Las pruebas verifican respuestas válidas de todos los tipos, la regresión de «¿Para qué clasificar?», versiones y repetición espaciada, cobertura de especies ilustradas, fuentes, extensión de historias y preguntas de comprensión. Para aceptación visual revisar también un ancho de teléfono, el reintento tras un error, la finalización, el avance al siguiente módulo y el progreso al volver al recorrido. El rótulo de Ambientes para `importance` es «Cuál es su rol»; la clave de datos permanece estable.
