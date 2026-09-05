# Natura UY · Panel editorial

Panel privado para mantener el catálogo aprobado de Natura UY. Supabase conserva identidades, permisos, fichas actuales, solicitudes y auditoría. GitHub Actions procesa medios y genera los artefactos públicos; Supabase Storage sirve derivados y el manifiesto estable.

## Arquitectura

- `species` contiene únicamente la ficha aprobada en columnas y arrays simples.
- Toda alta, edición, baja lógica o cambio multimedia entra por `species_change_requests` y se aplica con `approve_species_change` en una transacción.
- `species_audit` guarda el diff aprobado, su autor y validador. La autovalidación exige confirmación explícita.
- Los administradores conservan MFA TOTP y son los únicos que pueden solicitar una publicación manual.
- `species_media` separa aprobación editorial de `media_jobs`; GitHub Actions produce WebP 1600/480 o MP3 y verifica Storage.
- La app conserva `user.db`, modo invitado y funcionamiento offline. Favoritos y resultados se sincronizan sólo al iniciar sesión.
- Bugs, sugerencias y solicitudes de revisión usan tablas y RPCs independientes.
- La publicación genera `natura.db`, `natura.db.gz`, `catalog-full.json`, seis JSON por clase, manifest e informe público con esquema 5.
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

Los tests SQL viven en `supabase/tests/` y se ejecutan con `npx supabase test db` cuando Docker/Supabase local está disponible.

## Directorios

- `src/`: panel, autenticación y flujos de solicitudes/revisión.
- `supabase/migrations/`: esquema, RLS, Storage y RPCs transaccionales.
- `supabase/functions/`: invitaciones y dispatch seguro a GitHub Actions.
- `supabase/tests/`: pgTAP para RLS, permisos, conflictos y rollback.
- `scripts/`: importación, medios, export JSON y publicación.
- `../.github/workflows/`: medios, publicación manual y respaldo/limpieza.

La operación de cutover está documentada en [docs/deployment.md](docs/deployment.md).
