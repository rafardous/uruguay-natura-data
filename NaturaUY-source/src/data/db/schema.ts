/** Shape of a `species` row exactly as SQLite returns it. */
export interface SpeciesRow {
  codigo: string;
  scientific_name: string;
  accepted_name: string | null;
  common_name: string;
  common_names: string;
  clase: string;
  orden: string;
  familia: string;
  genero: string;
  epiteto: string;
  estado_conservacion: string;
  conservation_label: string;
  conservation_rank: number;
  nativa: number;
  origin: 'native' | 'introduced' | null;
  descripcion: string;
  alimentacion: string;
  tamano: string;
  image_url: string | null;
  full_url: string | null;
  thumb_asset: string | null;
  audio_url: string | null;
  image_license: string | null;
  image_attribution: string | null;
  image_source: string | null;
  image_page: string | null;
  accent_light: string;
  accent_dark: string;
  container_light: string;
  on_container_light: string;
  container_dark: string;
  on_container_dark: string;
}

/**
 * The catalogue: shipped prebuilt and replaced wholesale on every launch, so a
 * new app version always serves fresh data. Read-only at runtime.
 */
export const CATALOG_DATABASE_NAME = 'natura.db';

/**
 * Everything the user creates. Kept in a separate file precisely so replacing
 * the catalogue can never destroy favourites, quiz records or preferences.
 */
export const USER_DATABASE_NAME = 'user.db';

/** Applied in order on the user database; each must be idempotent. */
export const USER_MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS favorites (
     codigo     TEXT PRIMARY KEY,
     created_at INTEGER NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS quiz_scores (
     mode        TEXT PRIMARY KEY,
     best_score  INTEGER NOT NULL DEFAULT 0,
     best_streak INTEGER NOT NULL DEFAULT 0,
     played_at   INTEGER
   );`,
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
];
