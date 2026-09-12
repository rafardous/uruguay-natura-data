# Audios de aves

La primera integración usa exclusivamente grabaciones de Pedro Rinaldi en [Xeno-canto](https://xeno-canto.org/contributor/VKQHDAFQDZ). La clave de la API v3 sólo se lee desde `XENO_CANTO_API_KEY`; nunca se guarda en el repositorio, en la app ni en el catálogo publicado.

## Inventario sin publicar

Desde `NaturaUY-admin`:

```powershell
$env:XENO_CANTO_API_KEY = 'clave-local-no-commitear'
npm run audio:xenocanto-inventory
```

El comando cruza el nombre científico aceptado de las aves del catálogo con la respuesta de la API y escribe candidatos en `data/reports/xenocanto-inventory.json`. Prioriza Uruguay, calidad A/B y una heurística conservadora de sonido limpio. Todos los candidatos quedan con `approved: false` y requieren revisión humana.

Antes de aprobar un candidato hay que completar `approvedBy`, `authorizationEvidenceRef`, `clipStartSeconds` y `clipDurationSeconds` en una copia de trabajo del inventario. La evidencia puede ser un registro privado de la autorización; no debe subirse al repositorio.

## Recorte y formato

Para cada candidato aprobado, el pipeline usa FFmpeg y genera un MP3 mono de 48 kHz, 96 kbps y hasta 15 segundos:

```powershell
npm run audio:xenocanto-prepare -- --manifest .\data\reports\xenocanto-inventory-approved.json
```

Los archivos generados se cargan mediante el flujo editorial de medios existente. El panel registra el ID XC, página original, autor, licencia original y evidencia de autorización adicional; la app muestra esa atribución separada de la fotografía.

La aprobación editorial sigue siendo manual. La API sólo crea candidatos y no escribe en Supabase.
