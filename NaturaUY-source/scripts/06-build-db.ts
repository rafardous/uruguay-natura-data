/**
 * Stage 06 — assemble the prebuilt SQLite catalogue that ships in the bundle.
 *
 * Shipping a ready-made database means first launch has no import step: the app
 * copies one file and immediately queries 2021 species with full-text search.
 */
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

import Database from 'better-sqlite3';

import { readJson } from './lib/cache';
import { ensureDirs, PATHS } from './lib/paths';
import type { MediaRecord, NormalizedSpecies, PaletteRecord, TaxonomyMatch } from './lib/types';

/** Bumped whenever the schema changes so the app knows to re-copy the asset. */
const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE species (
  codigo              TEXT PRIMARY KEY,
  scientific_name     TEXT NOT NULL,
  accepted_name       TEXT,
  common_name         TEXT NOT NULL,
  common_names        TEXT NOT NULL,
  clase               TEXT NOT NULL,
  orden               TEXT NOT NULL,
  familia             TEXT NOT NULL,
  genero              TEXT NOT NULL,
  epiteto             TEXT NOT NULL,
  estado_conservacion TEXT NOT NULL,
  conservation_label  TEXT NOT NULL,
  conservation_rank   INTEGER NOT NULL,
  nativa              INTEGER NOT NULL,
  descripcion         TEXT NOT NULL,
  alimentacion        TEXT NOT NULL,
  tamano              TEXT NOT NULL,
  image_url           TEXT,
  full_url            TEXT,
  thumb_asset         TEXT,
  audio_url           TEXT,
  image_license       TEXT,
  image_attribution   TEXT,
  image_source        TEXT,
  image_page          TEXT,
  accent_light        TEXT NOT NULL,
  accent_dark         TEXT NOT NULL,
  container_light     TEXT NOT NULL,
  on_container_light  TEXT NOT NULL,
  container_dark      TEXT NOT NULL,
  on_container_dark   TEXT NOT NULL
);

CREATE INDEX idx_species_clase    ON species(clase);
CREATE INDEX idx_species_orden    ON species(orden);
CREATE INDEX idx_species_familia  ON species(familia);
CREATE INDEX idx_species_rank     ON species(conservation_rank);
CREATE INDEX idx_species_has_photo ON species(image_url);
CREATE INDEX idx_species_sort     ON species(common_name);

-- remove_diacritics 2 lets "nandu" match "Ñandú", which matters a lot in Spanish.
CREATE VIRTUAL TABLE species_fts USING fts5(
  common_names,
  scientific_name,
  familia,
  genero,
  content='species',
  content_rowid='rowid',
  tokenize="unicode61 remove_diacritics 2"
);

-- Build metadata. This database is the catalogue only: it is replaced wholesale
-- on every app launch, so nothing the user creates may ever live here.
-- Favourites, quiz records and settings belong to user.db.
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function main(): void {
  ensureDirs();

  const species = readJson<NormalizedSpecies[]>(resolve(PATHS.out, 'species.json'));
  const taxonomy = readJson<Record<string, TaxonomyMatch>>(resolve(PATHS.out, 'taxonomy.json'));
  const media = readJson<Record<string, MediaRecord | null>>(resolve(PATHS.out, 'media.json'));
  const thumbs = readJson<Record<string, string>>(resolve(PATHS.out, 'thumbs.json'));
  const palettes = readJson<Record<string, PaletteRecord>>(resolve(PATHS.out, 'palettes.json'));

  rmSync(PATHS.db, { force: true });
  const db = new Database(PATHS.db);
  db.pragma('journal_mode = DELETE'); // A single portable file, no -wal sidecar.
  db.exec(SCHEMA);

  const insert = db.prepare(`
    INSERT INTO species VALUES (
      @codigo, @scientific_name, @accepted_name, @common_name, @common_names,
      @clase, @orden, @familia, @genero, @epiteto,
      @estado_conservacion, @conservation_label, @conservation_rank, @nativa,
      @descripcion, @alimentacion, @tamano,
      @image_url, @full_url, @thumb_asset, @audio_url,
      @image_license, @image_attribution, @image_source, @image_page,
      @accent_light, @accent_dark, @container_light, @on_container_light,
      @container_dark, @on_container_dark
    )
  `);

  const insertAll = db.transaction((rows: NormalizedSpecies[]) => {
    for (const s of rows) {
      const photo = media[s.codigo] ?? null;
      const palette = palettes[s.codigo];
      if (!palette) throw new Error(`missing palette for ${s.codigo} — run stage 05`);

      insert.run({
        codigo: s.codigo,
        scientific_name: s.scientificName,
        accepted_name: taxonomy[s.codigo]?.acceptedName ?? null,
        common_name: s.commonName,
        common_names: JSON.stringify(s.commonNames),
        clase: s.clase,
        orden: s.orden,
        familia: s.familia,
        genero: s.genero,
        epiteto: s.epiteto,
        estado_conservacion: s.estadoConservacion,
        conservation_label: s.conservationLabel,
        conservation_rank: s.conservationRank,
        nativa: s.nativa ? 1 : 0,
        descripcion: s.descripcion,
        alimentacion: s.alimentacion,
        tamano: s.tamano,
        image_url: photo?.imageUrl ?? null,
        full_url: photo?.fullUrl ?? null,
        thumb_asset: thumbs[s.codigo] ? `${thumbs[s.codigo]}.webp` : null,
        audio_url: s.audioUrl,
        image_license: photo?.license ?? null,
        image_attribution: photo?.attribution ?? null,
        image_source: photo?.source ?? null,
        image_page: photo?.sourcePage ?? null,
        accent_light: palette.accentLight,
        accent_dark: palette.accentDark,
        container_light: palette.containerLight,
        on_container_light: palette.onContainerLight,
        container_dark: palette.containerDark,
        on_container_dark: palette.onContainerDark,
      });
    }
  });

  insertAll(species);

  // Populate FTS from the base table, indexing every vernacular name.
  db.exec(`
    INSERT INTO species_fts (rowid, common_names, scientific_name, familia, genero)
    SELECT rowid,
           replace(replace(replace(common_names, '["', ''), '"]', ''), '","', ' '),
           scientific_name, familia, genero
    FROM species;
  `);

  const setMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
  setMeta.run('schema_version', String(SCHEMA_VERSION));
  setMeta.run('built_at', new Date().toISOString());
  setMeta.run('species_count', String(species.length));

  db.exec('VACUUM;');

  const withPhoto = db.prepare('SELECT COUNT(*) AS n FROM species WHERE image_url IS NOT NULL').get() as { n: number };
  const ftsProbe = db.prepare("SELECT COUNT(*) AS n FROM species_fts WHERE species_fts MATCH 'nandu'").get() as { n: number };
  db.close();

  console.log(`06-build-db: ${species.length} species written to assets/db/natura.db`);
  console.log(`  ${withPhoto.n} with a photo`);
  console.log(`  FTS diacritic probe ("nandu"): ${ftsProbe.n} match(es)`);
}

main();
