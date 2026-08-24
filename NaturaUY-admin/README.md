# Natura UY · Panel editorial

Panel privado para mantener el catálogo canónico de Natura UY. Supabase conserva los datos editoriales, revisiones y auditoría; GitHub Actions genera los JSON y `natura.db`; Cloudflare Pages publica el panel, el manifiesto y las URLs estables de medios; R2 mantiene la copia independiente.

## Estado implementado

- Autenticación por invitación, perfiles `admin` y `collaborator`, RLS y MFA exigible.
- Catálogo con alta, edición, baja lógica, restauración, validación, historial y control optimista de revisiones.
- Procedencia por campo (`taxonomy.order`, `conservation.status`, etc.).
- Conservación separada de abundancia y presencia descompuesta en cuatro dimensiones.
- Subida reanudable de imágenes/audio, licencia y evidencia de autorización.
- Procesamiento reproducible, derivados optimizados, paleta, checksums, Supabase Storage y R2.
- Publicaciones técnicas de JSON/SQLite, informe de calidad, manifiesto y GitHub Release.
- Respaldo PostgreSQL cifrado, retención, limpieza y verificación mensual de medios.
- Actualizador móvil no bloqueante, verificación SHA-256/SQLite, activación atómica y rollback.

Los archivos actuales contienen 1006 registros de entrada, que se consolidan en **902 especies únicas** por su identificador estable. El importador informa esta diferencia y preserva los códigos existentes.

## Desarrollo local

```powershell
cd "C:\Users\rafar\Documents\2026 - proyects\uruguay-natura-data\NaturaUY-admin"
Copy-Item .env.example .env.local
npm install
npm run dev
```

Sin credenciales, el panel abre en modo demostración con información local. Con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` utiliza el backend real.

Verificaciones:

```powershell
npm run build
npm run typecheck:automation
npm run catalog:import -- --dry-run
```

La puesta en producción completa está documentada en [docs/deployment.md](docs/deployment.md).

## Directorios

- `src/`: interfaz, autenticación, cliente Supabase y operaciones editoriales.
- `supabase/migrations/`: esquema, RLS, vistas y funciones transaccionales.
- `supabase/functions/`: invitaciones y disparadores seguros hacia GitHub Actions.
- `scripts/`: importación, exportación, medios, publicación y respaldos.
- `functions/`: Cloudflare Pages Functions para `/m/*` y el manifiesto.
- `../.github/workflows/`: procesamiento, publicación y mantenimiento programado.

No deben incorporarse a Git `.env*`, `node_modules`, `dist`, originales multimedia ni respaldos. Sólo se versionan código, migraciones y artefactos públicos adjuntos a Releases.
