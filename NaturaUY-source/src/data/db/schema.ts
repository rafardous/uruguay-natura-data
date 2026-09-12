/** Shape of a `species` row exactly as SQLite returns it. */
export interface SpeciesRow {
  stable_id?: string;
  codigo: string;
  scientific_name: string;
  accepted_name: string | null;
  common_name: string;
  common_names: string;
  kingdom: string;
  phylum: string;
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
  establishment?: 'established' | 'casual' | 'uncertain' | null;
  seasonality: string | null;
  presence_certainty?: 'confirmed' | 'probable' | 'uncertain' | null;
  abundance_status: string | null;
  knowledge_level?: 'easy' | 'medium' | 'hard';
  abundance_category?: string | null;
  abundance_label?: string | null;
  conservation_system?: string | null;
  conservation_source?: string | null;
  conservation_assessed_at?: string | null;
  habitat: string;
  diet: string;
  relevant_note: string | null;
  sources: string;
  descripcion: string;
  alimentacion: string;
  tamano: string;
  traits?: string;
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

export interface SpeciesMediaRow {
  id: string;
  stable_id?: string;
  media_type: 'image' | 'audio';
  ordinal: number;
  is_primary: number;
  url: string;
  thumbnail_url: string | null;
  author: string;
  license: string;
  original_license?: string | null;
  source: string;
  source_url: string | null;
  duration_seconds: number | null;
  external_id?: string | null;
}

export interface SpeciesFactRow {
  id: string;
  stable_id: string;
  body: string;
  sort_order: number;
  source_code?: string | null;
  source_record_id?: string | null;
}
export interface SpeciesObservabilityRow {
  stable_id: string; method_version: string; period_start: string; period_end: string;
  occurrence_count: number; occupied_cells: number; years_observed: number; score: number;
  band: 'high' | 'medium' | 'low' | 'insufficient_data'; comparison_class: string;
}
export interface SpeciesGameRuleRow { stable_id: string; game_key: string; enabled: number; min_knowledge_level: 'easy' | 'medium' | 'hard' | null }

/**
 * The read-only catalogue. A verified remote database is staged in a separate
 * file and atomically activated before this database is opened.
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
  `CREATE TABLE IF NOT EXISTS quiz_records (
     mode        TEXT NOT NULL,
     scope       TEXT NOT NULL,
     best_score  INTEGER NOT NULL DEFAULT 0,
     best_streak INTEGER NOT NULL DEFAULT 0,
     played_at   INTEGER,
     PRIMARY KEY (mode, scope)
   );`,
  `INSERT OR IGNORE INTO quiz_records (mode, scope, best_score, best_streak, played_at)
   SELECT mode, 'animals_all', best_score, best_streak, played_at FROM quiz_scores;`,
  `CREATE TABLE IF NOT EXISTS favorite_sync (
     codigo      TEXT PRIMARY KEY,
     is_favorite INTEGER NOT NULL CHECK (is_favorite IN (0, 1)),
     updated_at  INTEGER NOT NULL
   );`,
  `INSERT OR IGNORE INTO favorite_sync (codigo, is_favorite, updated_at)
   SELECT codigo, 1, created_at FROM favorites;`,
  `CREATE TABLE IF NOT EXISTS quiz_sync (
     mode       TEXT NOT NULL,
     scope      TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (mode, scope)
   );`,
  `INSERT OR IGNORE INTO quiz_sync (mode, scope, updated_at)
   SELECT mode, scope, COALESCE(played_at, 1) FROM quiz_records;`,
  `CREATE TABLE IF NOT EXISTS game_sync (
     mode          TEXT NOT NULL,
     scope         TEXT NOT NULL,
     pending_games INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (mode, scope)
   );`,
  `INSERT OR IGNORE INTO game_sync (mode, scope, pending_games)
   SELECT mode, scope, 0 FROM quiz_records;`,
  `CREATE TABLE IF NOT EXISTS puzzle_records (
     scope TEXT NOT NULL,
     grid_size INTEGER NOT NULL CHECK (grid_size IN (3,4)),
     best_time_ms INTEGER NOT NULL,
     fewest_moves INTEGER NOT NULL,
     played_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (scope, grid_size)
   );`,
  `CREATE TABLE IF NOT EXISTS account_favorites (
     owner_id TEXT NOT NULL,
     codigo TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (owner_id, codigo)
   );`,
  `CREATE TABLE IF NOT EXISTS account_favorite_sync (
     owner_id TEXT NOT NULL,
     codigo TEXT NOT NULL,
     is_favorite INTEGER NOT NULL CHECK (is_favorite IN (0, 1)),
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (owner_id, codigo)
   );`,
  `CREATE TABLE IF NOT EXISTS account_quiz_records (
     owner_id TEXT NOT NULL,
     mode TEXT NOT NULL,
     scope TEXT NOT NULL,
     best_score INTEGER NOT NULL DEFAULT 0,
     best_streak INTEGER NOT NULL DEFAULT 0,
     played_at INTEGER,
     PRIMARY KEY (owner_id, mode, scope)
   );`,
  `CREATE TABLE IF NOT EXISTS account_quiz_sync (
     owner_id TEXT NOT NULL,
     mode TEXT NOT NULL,
     scope TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (owner_id, mode, scope)
   );`,
  `CREATE TABLE IF NOT EXISTS account_game_sync (
     owner_id TEXT NOT NULL,
     mode TEXT NOT NULL,
     scope TEXT NOT NULL,
     pending_games INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (owner_id, mode, scope)
   );`,
  `CREATE TABLE IF NOT EXISTS account_puzzle_records (
     owner_id TEXT NOT NULL,
     scope TEXT NOT NULL,
     grid_size INTEGER NOT NULL CHECK (grid_size IN (3,4)),
     best_time_ms INTEGER NOT NULL,
     fewest_moves INTEGER NOT NULL,
     played_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (owner_id, scope, grid_size)
   );`,
];
