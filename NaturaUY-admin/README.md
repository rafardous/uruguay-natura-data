# Natura UY · Panel editorial

Panel privado para mantener el catálogo aprobado de Natura UY. Supabase conserva identidades, permisos, fichas actuales, solicitudes y auditoría. GitHub Actions procesa medios y genera los artefactos públicos; Supabase Storage sirve derivados y el manifiesto estable.

## Arquitectura

- `profiles` representa cualquier cuenta; `editor_access` agrega una invitación o permiso editorial, sin tablas de usuarios duplicadas.
- `species` contiene únicamente la ficha aprobada; `species_changes` conserva propuesta, validación e historial en una sola entidad. La autovalidación exige confirmación explícita.
- Los administradores conservan MFA TOTP y son los únicos que pueden solicitar una publicación manual.
- `species_media` limita cada especie a dos imágenes y un audio. El navegador sube imágenes WebP 1600 px y WAV mono de hasta 15 s; GitHub Actions verifica y produce WebP 480 px o MP3 96 kbps/48 kHz.
- La app conserva `user.db`, modo invitado y funcionamiento offline. Favoritos y resultados se sincronizan sólo al iniciar sesión.
- Bugs, sugerencias y solicitudes de revisión entran en la bandeja única `feedback`.
- La publicación genera `natura.db`, `natura.db.gz`, `catalog-full.json`, seis JSON por clase, manifest e informe público con esquema 6, incluida la galería sin binarios.
- El actualizador mobile valida versión, compatibilidad, tamaño, SHA-256 e integridad SQLite antes de activar la DB al siguiente inicio.
- El respaldo PostgreSQL se cifra y se conserva como artefacto privado temporal. No se usa R2 ni un proxy de medios.

La importación actual consolida 1006 entradas en 902 especies y preserva UUID/códigos estables. Los medios con licencia ambigua quedan archivados para revisión.

## Desarrollo y verificación

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev

npm run build
npm run typecheck:automation
npm run catalog:import -- --dry-run
npm run catalog:export-json
```

El panel requiere `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para funcionar. No existe un fallback de datos demo: si faltan esas variables, muestra un error de configuración. En Cloudflare Pages deben configurarse únicamente para el entorno Production; nunca colocar una `service_role` key en el frontend.

Los tests SQL viven en `supabase/tests/` y se ejecutan con `npx supabase test db` cuando Docker/Supabase local está disponible.

## Directorios

- `src/`: panel, autenticación y flujos de solicitudes/revisión.
- `supabase/migrations/`: esquema, RLS, Storage y RPCs transaccionales.
- `supabase/functions/`: invitaciones y dispatch seguro a GitHub Actions.
- `supabase/tests/`: pgTAP para RLS, permisos, conflictos, autovalidación y límites de medios.
- `scripts/`: importación, medios, export JSON y publicación.
- `../.github/workflows/`: medios, publicación manual y respaldo/limpieza.

La operación de cutover está documentada en [docs/deployment.md](docs/deployment.md).
