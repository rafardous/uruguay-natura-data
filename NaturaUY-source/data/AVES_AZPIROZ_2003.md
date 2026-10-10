# Aves: referencia Azpiroz 2003 y ficha de campo

Este documento conserva procedencia, decisiones y comandos. La fuente editorial actual es Supabase; JSON y SQLite son derivados. El perfil nuevo usa `natural_history.bird` en PostgreSQL y `naturalHistory.bird` en JSON/TypeScript, compatible con schema 12.

## Fuente y cobertura

Azpiroz, A. B. (2003). *Aves del Uruguay. Lista e introducción a su biología y conservación*. Aves Uruguay — GUPECA, 104 pp. El año corresponde a la edición indicada por el usuario y coincide con la [bibliografía de Aves Uruguay](https://www.avesuruguay.org.uy/wp-content/uploads/2018/05/Achara-Revista-N-3-Agosto-2013.pdf). Es una referencia histórica, no una evaluación actual de taxonomía o conservación.

El Excel `Indice_aves_Uruguay_1-435_BORRADOR.xlsx` aporta 435 entradas numeradas; la foto de páginas 50–51 aporta la leyenda. El usuario revisó el archivo y autorizó ignorar las marcas de la columna `revision`. Los datos originales y hashes de ambos archivos quedan en `reference/azpiroz-2003/`, sin depender de Downloads. No se incorpora el Excel binario ni la foto a Git ni se atribuye licencia abierta al libro: se utilizan datos factuales y referencia bibliográfica, sin reproducir sus textos descriptivos.

Se enriquecen 432 de las 475 especies de aves. Las 564 filas JSON incluyen duplicados del mismo ID: se aplica un perfil consistente a todas y SQLite las consolida. Se conservan sin asignar las entradas 126 (duplicada de la 125 en el Excel), 160 (identidad ilegible) y 387 (Sporophila zelichi converge con la entrada 385 al mismo ID actual). No se crean especies ni se cambia identidad, código, taxonomía o conservación para forzar los cruces.

Archivos de respaldo: `original.json` y `original.csv` conservan celdas; `corrections.json` explica correcciones y alias explícitos; `crosswalk.json` registra cada asociación; `normalized.json` contiene perfiles; `legend.json` los códigos; `manifest.json` los hashes y `report.json` los campos ilegibles. Una celda ilegible no bloquea los demás campos válidos ni se completa por intuición.

## Interpretación

**Tamaño:** largo total aproximado en cm. El segundo valor entre paréntesis de las aves marinas es envergadura, no longitud de un ala. Otras dos medidas corresponden a macho (superior) y hembra (inferior); no son un rango. La ficha muestra magnitudes separadas y una ⓘ con explicación y fuente. AVONET conserva masa, ala, cola y tarso como datos técnicos secundarios. Valores OCR de largo corporal inferiores a 5 o superiores a 300 cm se informan sin publicarse ni estimarse.

**Presencia:** RN residente anual, estimado nidificante; RV residente de verano, nidifica, setiembre–marzo; VV visitante de verano, setiembre–marzo, incluye paso principalmente setiembre–noviembre y marzo–mayo; VI visitante de invierno, abril–setiembre; V visitante sin estacionalidad clara; DR registro reciente respecto de 2003; IN introducido o asilvestrado desde cautiverio; O ocasional; Ex extinto según la guía. Un asterisco en RV/VV/VI admite observaciones fuera del período habitual. El calendario no indica ausencia absoluta ni probabilidad de avistamiento. DR, IN y Ex no reemplazan evaluaciones actuales de origen o conservación.

**Hábitat:** C costa; I islas y océano, especies pelágicas; P pastizales y praderas; M bosques autóctonos y palmares; PM pastizales con árboles; A ambientes acuáticos; H ambientes antrópicos. PM es indivisible, no P + M.

**Abundancia histórica:** C común; BC bastante común; PC poco común; R raro. BC se representa como `fairly_common`. Abundancia, conservación y observabilidad permanecen separadas.

**Dieta:** Hb vegetales verdes; Se semillas y granos; Fr frutos; Ne néctar; In insectos; Ib invertebrados litorales y bentónicos; Ps peces, crustáceos y otras presas acuáticas; Tp pequeños vertebrados; Cñ carroña. Ps no se reduce a peces.

## Contrato y experiencia

`bird` contiene `guide` (fuente, año, número, página y nombres históricos), `measurements` (`kind: body_length | wingspan`, `valueCm`, `sex` opcional), `presence` (código, etiqueta, meses, nota, excepción), `habitat`, `diet` y `abundanceCode`. Los campos ausentes usan lista vacía o `null`; la fuente queda por campo en `sources` / `field_sources`.

La ficha muestra foto e identidad actual, referencia y número, tamaño y abundancia, presencia mensual, hábitats y dieta. Las aclaraciones y listas largas se expanden al tocar. «Más sobre esta ave» reúne medidas técnicas, observabilidad, clasificación, nombres históricos y fuentes. La conservación actual mantiene su distintivo. Se reutilizan Manrope, colores de especie y temas claro/oscuro, con áreas táctiles de al menos 44 px y etiquetas accesibles.

El largo válido reemplaza `size` y la abundancia válida reemplaza `abundance_status`. Hábitat, dieta y presencia precisos viven en `bird`, preservando los códigos generales que usan filtros y juegos. Si falta un campo válido se muestra el dato del catálogo indicando «otras fuentes».

## Reproducir

Desde `NaturaUY-source`:

```powershell
# Sólo al reemplazar la fuente original; requiere Python/openpyxl.
python scripts/catalog/extract-azpiroz.py RUTA_EXCEL --legend-photo RUTA_FOTO
npm run data:azpiroz
npm run data:azpiroz -- --apply
npm run test:azpiroz
npm run data:catalog-db
npm run data:catalog-verify
```

El primer comando npm es dry-run. La etapa 06 conserva referencias de Azpiroz y la etapa de traits no sobrescribe su tamaño. Después de reconstruir JSON desde otras fuentes, reaplicar el overlay antes de generar SQLite. Esta base usa schema 12 y data_version 4; en futuras publicaciones usar `NATURA_CATALOG_DATA_VERSION` consistente con el release editorial.

Desde `NaturaUY-admin`, `npm run catalog:import-azpiroz` informa códigos y lotes sin escribir. `--sql --batch=0` hasta el último lote genera transacciones para la conexión administrativa autorizada; requiere `EDITORIAL_SYSTEM_USER_ID` del editor activo autorizado. Las RPCs `submit_species_change` y `review_species_change(..., true, true)` registran antes/después y autovalidación aprobada por el usuario. No se cambian permisos ni se fabrica un nivel MFA. Se preservan otros perfiles y referencias, se omiten cambios idénticos, se bloquean códigos ausentes o clases distintas y se verifica el perfil guardado. Una falla revierte el lote entero.

La publicación schema 12 no consulta Aprender de schema 13, todavía sin desplegar; no aplicar esa migración para publicar aves. En Expo por USB, regenerar la base y recargar completamente: desarrollo importa `natura.db` y conserva `user.db`. La publicación productiva sigue el workflow manual existente y la activación atómica habitual con versión superior a la publicada.

## Validación y recuperación

Implementación comprobada el 9 de octubre de 2026: 432 perfiles en SQLite y en Supabase, con 432 revisiones aprobadas. La auditoría de antes/después confirmó cero cambios fuera de tamaño, abundancia, historia natural, fuentes y fecha de actualización. Repetir los lotes de prueba no agregó revisiones. Pasaron TypeScript, lint y las pruebas de la app, las seis pruebas del normalizador, la verificación del catálogo y el build y chequeo de scripts del panel.

En el Pixel conectado por USB se comprobaron el ñandú (150 cm, calendario, abundancia y dieta expandible), la explicación de la ⓘ y el albatros cabeza gris (80 cm de largo y 220 cm de envergadura). La comprobación se realizó con Expo Go contra el proyecto local: la aplicación instalada mantiene su bundle anterior. El catálogo editorial está enriquecido; la distribución productiva mediante el workflow de publicación queda pendiente de completar la infraestructura y secretos documentados en el panel.

Casos: ñandú 150 cm/BC; albatros 80 cm/220 cm de envergadura; medidas por sexo; PM indivisible; Ps completo; meses y asteriscos; `#NAME?` sin inventar; fórmula `=BC` recuperada. Verificar números originales, unicidad, filas duplicadas coherentes, identidad/taxonomía/conservación intactas y recorrido JSON → SQLite → mapper. Reaplicar debe dar cero cambios y no crear revisiones.

Para revertir Supabase, crear y aprobar otra revisión con los campos anteriores de `species_changes.before_values`; nunca borrar especies o revisiones. Regenerar y publicar con versión mayor. Favoritos y progreso permanecen en `user.db`.
