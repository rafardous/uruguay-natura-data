# Encastrar y Adiviná

Implementación en desarrollo para Arapy 1.4.0. No forma parte del APK 1.3.1/build 7 publicado.

## Puzzle → Encastrar

UX revisada del 12/10/2026: sólo Deslizante permite elegir 3×3/4×4. Encastrar usa dieciséis piezas fijas sin selector. Puzzle no ofrece nivel de especies y usa todas las habilitadas de la categoría elegida. Contrato y aceptación en [mobile-ux.md](mobile-ux.md).

Puzzle permite elegir Deslizante o Encastrar y categoría; sólo Deslizante ofrece grilla 3 × 3 / 4 × 4. Encastrar usa todas las piezas de la foto, con bordes complementarios: se arrastran al tablero y se giran con un toque o con Rotar. Una pieza se fija sólo cerca de su lugar y con la orientación correcta. El tiempo empieza con el primer movimiento; arrastrar o girar cuenta como un movimiento. Pasar al segundo plano pausa el tiempo.

Es una implementación propia en React Native y SVG, inspirada en la interacción del [ejemplo de JointJS](https://www.jointjs.com/demos/puzzle). Usa fotos aprobadas y miniaturas incluidas. Deslizante conserva sus récords existentes; Encastrar tiene mínimos independientes de tiempo y movimientos por categoría, nivel y grilla.

## Adiviná

La app ya no ofrece categorías: reúne animales/plantas habilitados. Conserva nivel y forma de respuesta. Los nuevos récords `all:nivel` quedan separados de los históricos; requieren `20261012171935_mixed_guess_scope.sql` antes de distribuir la app. Esa migración se prueba localmente y no se aplica a producción en esta entrega.

Cada partida tiene una especie y hasta cinco respuestas válidas. Escribir o repetir una respuesta no consume intentos. El buscador reconoce nombres comunes, alternativos, científicos y aceptados, sin distinguir mayúsculas o tildes. Se confirma la especie seleccionada. Cada error revela la siguiente pista; acertar o agotar los intentos revela la respuesta y permite abrir su ficha o jugar otra partida.

Buscador otorga 500, 400, 300, 200 o 100 puntos. Fácil · con opciones ofrece seis especies y otorga 250, 200, 150, 100 o 50 puntos. Seis opciones permiten cinco errores sin agotar las respuestas antes del límite; las opciones erradas quedan deshabilitadas. Derrotas: cero puntos. Los récords de ambos modos son independientes y privados.

El nivel de especies es independiente de la forma de respuesta. Conserva `easy ⊂ medium ⊂ hard`, filtros por ancestros taxonómicos y reglas editoriales con claves `guess` y `jigsaw`.

### Pistas

El orden predeterminado avanza de contexto a identificación:

1. Hábitat: ambiente amplio.
2. Alimentación; Nutrición para plantas: recurso o forma de obtener nutrientes.
3. Comportamiento: desplazamiento, actividad o forma de vida; para plantas, crecimiento o reproducción.
4. Apariencia: forma, color o rasgo observable.
5. Pista decisiva: rasgo diagnóstico o curiosidad contrastada.

La app deriva pistas de los atributos publicados y puede usar un dato curioso de fuente redistribuible para la última. No resume automáticamente textos científicos ni inventa atributos ausentes. La apariencia automática se limita a caracteres diagnósticos disponibles. Una pista específica aprobada reemplaza la derivación por tipo.

Sólo participan especies con cinco pistas completas, órdenes únicos y sin nombres que revelen la respuesta. Una selección incompleta muestra un estado vacío; menos de seis candidatas no habilitan opciones. No se muestran fotos antes de terminar.

### Datos editoriales

`species`, `species_facts`, `species_game_profiles` y `species_game_rules` conservan sus responsabilidades. `species_game_clues` guarda exclusivamente pistas específicas: UUID, especie, tipo, texto de 15–600 caracteres, orden, fuente, evidencia, estado y autor/revisor. Hay un tipo y un puesto activos únicos por especie. Para cambiar un orden ocupado, archivar y aprobar primero la pista que lo ocupa y luego proponer su reemplazo; cada paso conserva auditoría.

El panel Contenido y juegos propone, edita y archiva mediante `submit_content_change`; la bandeja aprueba/rechaza mediante `review_content_change`. No escribe tablas directamente. Las revisiones guardan valores anteriores/posteriores y detectan conflictos; autovalidación exige confirmación. Fuentes inactivas o `review_only` no son admitidas para las pistas.

`NaturaUY-admin/scripts/guess-clue-seed.json` contiene 40 textos originales para carpincho, ñandú, pingüino de Magallanes, tero, hornero, tatú, ceibo y sauce criollo, con enlaces de evidencia. `seed-guess-clues.ts` genera SQL revisable que propone y aprueba cada pista bajo la identidad editorial autorizada. No ejecuta SQL por sí mismo ni sobrescribe pistas existentes diferentes. Se atribuye la redacción a `natura_uy_editorial` y se conserva evidencia por pista en `source_record_id`.

El publicador PostgreSQL exporta pistas activas de fuentes redistribuibles a `game.clues` en JSON y `species_game_clues` en SQLite. La tabla adicional es compatible con lectores anteriores; Adiviná también abre catálogos que aún no la tengan. La migración `20261011191403_enriched_games.sql` y las 40 pistas están aplicadas en Supabase de producción desde el 11/10/2026, luego de autorización específica y respaldo cifrado verificado. La vista previa se generó íntegramente desde ese PostgreSQL; el catálogo público continúa en v9/schema 14.

### Progreso offline

`user.db.enriched_game_records` guarda `guess_search`, `guess_choices` y `jigsaw`, separado del catálogo y de los récords anteriores. Claves: `categoría:nivel`, agregando `:grilla` para Encastrar. La fusión conserva máximo puntaje, mínimos independientes de tiempo/movimientos y fechas monotónicas.

Cambiar de cuenta guarda una copia por propietario y restaura sólo su progreso. El primer login adopta los datos offline. Las RPCs `sync_enriched_game_records(jsonb)` y `get_enriched_game_records()` usan `auth.uid()` y RLS; no aceptan dueño enviado por el cliente. Lotes de hasta 24; un fallo de red no borra la partida local.

## Verificación

App: `npx tsc --noEmit`, `npm run lint`, `npm test -- --runInBand`, `npm run data:catalog-verify`. Panel: `npm run build`, `npm run typecheck:automation`, `npm run catalog:import -- --dry-run`.

`NaturaUY-admin/supabase/tests/enriched_games_test.sql` se ejecuta con `psql -v ON_ERROR_STOP=1 -f …` contra una copia local del esquema. Verifica revisión, fuentes, nombres revelados, autovalidación, conflictos, archivo con auditoría, permisos, RLS y fusión de récords. Termina con rollback. Las pruebas SQLite verifican mínimos/máximos y aislamiento entre cuentas.

La aceptación en Android/Pixel y un APK nuevo quedan pendientes.

El informe está en `data/reports/enriched-games-verification.json`: 141 pruebas de app aprobadas, SQL local aprobado y partidas web completas en ambas grillas y ambas formas de respuesta. En producción se verificaron las 40 aprobaciones con auditoría/fuentes, órdenes completos, RLS y permisos de RPC; no hubo nuevos hallazgos del asesor de seguridad. El catálogo conserva 1048 especies/100 plantas y las 40 pistas coinciden entre JSON y SQLite.
