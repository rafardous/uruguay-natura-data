# Extractos de rasgos

Los archivos originales no se versionan. Cada adaptador deja una lista JSON bajo el código de fuente: `avonet.json`, `tetrapodtraits3.json`, `amphibio.json`, `fishmorph.json`, `freshwater_fish_shortfalls.json`, `mobs.json`, `combine.json` o `fishbase.json`.

Cada registro lleva `scientificName`, `taxonomicClass`, `recordId` y los rasgos disponibles. `measurements` usa `{ kind, value, unit, basis, estimated }`; longitudes en mm, masas en g y profundidad en m.

`npm run data:traits` valida vocabularios y coincidencias exactas. FishBase nunca queda habilitado para publicación; MOBS y COMBINE permanecen en revisión hasta verificar la licencia del archivo exacto. `freshwater_fish_shortfalls.json` también es sólo editorial: el paquete agregado es CC BY 4.0, pero su flujo de talla deriva largos observados de FishBase y además contiene imputaciones.
