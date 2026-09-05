/**
 * Stage 07 — turn data/catalog/*.json into the SQLite asset consumed by Expo.
 *
 * The catalogue can contain the same species in more than one source/group.
 * This stage merges those occurrences, reuses historical SNAP codes whenever
 * possible, and validates a candidate database before replacing natura.db.
 */
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { PATHS, readJson } from './lib';

const DB_PATH = resolve(PATHS.catalog, '../../assets/db/natura.db');
const NEXT_PATH = `${DB_PATH}.next`;
const PREVIOUS_PATH = `${DB_PATH}.previous`;
const SCHEMA_VERSION = 5;

type Origin = 'native' | 'introduced' | null;

interface CatalogItem {
  id: string;
  scientificName: string;
  commonName: string | null;
  taxonomy: {
    kingdom: string | null;
    phylum: string | null;
    class: string | null;
    order: string | null;
    family: string | null;
    genus: string | null;
  };
  origin: Origin;
  seasonality: string | null;
  abundanceStatus: string | null;
  description: string | null;
  habitat: string[];
  diet: string[] | null;
  size: string | null;
  relevantNote: string | null;
  media: {
    image: {
      url: string;
      fullUrl: string;
      license: string;
      attribution: string;
      source: string;
      sourcePage: string | null;
    } | null;
    audio: string | null;
  };
  sources: Array<{ source: string; record: string | null }>;
  reviewStatus: string;
}

interface OldRow {
  codigo: string;
  scientific_name: string;
  accepted_name: string | null;
  common_name: string;
  common_names: string;
  estado_conservacion: string;
  conservation_label: string;
  conservation_rank: number;
  descripcion: string;
  alimentacion: string;
  tamano: string;
  thumb_asset: string | null;
  audio_url: string | null;
  accent_light: string;
  accent_dark: string;
  container_light: string;
  on_container_light: string;
  container_dark: string;
  on_container_dark: string;
}

const DEFAULT_PALETTE = {
  accent_light: '#1F4034',
  accent_dark: '#9CCBAC',
  container_light: '#CFE3D2',
  on_container_light: '#12281F',
  container_dark: '#2B4A3A',
  on_container_dark: '#CFE9D6',
};

const DIET_LABELS: Record<string, string> = {
  algae: 'algas',
  amphibians_reptiles: 'anfibios y reptiles',
  birds_mammals: 'aves y mamíferos',
  carrion: 'carroña',
  fish: 'peces',
  fruit: 'frutos',
  invertebrates: 'invertebrados',
  nectar: 'néctar',
  other_plant_material: 'otras materias vegetales',
  seeds: 'semillas',
};

const SCHEMA = `
CREATE TABLE species (
  stable_id TEXT NOT NULL UNIQUE, codigo TEXT PRIMARY KEY, scientific_name TEXT NOT NULL, accepted_name TEXT,
  common_name TEXT NOT NULL, common_names TEXT NOT NULL,
  kingdom TEXT NOT NULL, phylum TEXT NOT NULL,
  clase TEXT NOT NULL, orden TEXT NOT NULL, familia TEXT NOT NULL,
  genero TEXT NOT NULL, epiteto TEXT NOT NULL,
  estado_conservacion TEXT NOT NULL, conservation_label TEXT NOT NULL,
  conservation_rank INTEGER NOT NULL, conservation_system TEXT, conservation_source TEXT, conservation_assessed_at TEXT,
  nativa INTEGER NOT NULL,
  descripcion TEXT NOT NULL, alimentacion TEXT NOT NULL, tamano TEXT NOT NULL,
  image_url TEXT, full_url TEXT, thumb_asset TEXT, audio_url TEXT,
  image_license TEXT, image_attribution TEXT, image_source TEXT, image_page TEXT,
  accent_light TEXT NOT NULL, accent_dark TEXT NOT NULL,
  container_light TEXT NOT NULL, on_container_light TEXT NOT NULL,
  container_dark TEXT NOT NULL, on_container_dark TEXT NOT NULL,
  origin TEXT, establishment TEXT, seasonality TEXT, presence_certainty TEXT, abundance_status TEXT,
  habitat TEXT NOT NULL, diet TEXT NOT NULL, relevant_note TEXT,
  sources TEXT NOT NULL
);
CREATE INDEX idx_species_clase ON species(clase);
CREATE INDEX idx_species_phylum ON species(phylum);
CREATE INDEX idx_species_orden ON species(orden);
CREATE INDEX idx_species_familia ON species(familia);
CREATE INDEX idx_species_genero ON species(genero);
CREATE INDEX idx_species_taxonomy_path ON species(phylum, clase, orden, familia, genero, common_name COLLATE NOCASE);
CREATE INDEX idx_species_rank ON species(conservation_rank);
CREATE INDEX idx_species_has_photo ON species(image_url);
CREATE INDEX idx_species_sort ON species(common_name);
CREATE VIRTUAL TABLE species_fts USING fts5(
  common_names, scientific_name, familia, genero,
  content='species', content_rowid='rowid',
  tokenize="unicode61 remove_diacritics 2"
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function parseNames(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function loadCatalog(): CatalogItem[] {
  return readdirSync(PATHS.catalog)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => readJson<CatalogItem[]>(resolve(PATHS.catalog, file)));
}

function loadHistorical(): { byCode: Map<string, OldRow>; byName: Map<string, OldRow> } {
  const byCode = new Map<string, OldRow>();
  const byName = new Map<string, OldRow>();
  if (!existsSync(DB_PATH)) return { byCode, byName };
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  for (const row of db.prepare('SELECT * FROM species').all() as unknown as OldRow[]) {
    byCode.set(row.codigo, row);
    for (const name of [row.scientific_name, row.accepted_name]) {
      if (name) byName.set(name.trim().toLocaleLowerCase('es'), row);
    }
  }
  db.close();
  return { byCode, byName };
}

function chooseOld(rows: CatalogItem[], old: ReturnType<typeof loadHistorical>): OldRow | null {
  const snapCodes = rows.flatMap((row) => row.sources)
    .filter((source) => source.source === 'snap' && source.record)
    .map((source) => source.record!);
  for (const code of snapCodes) {
    const match = old.byCode.get(code);
    if (match) return match;
  }
  for (const row of rows) {
    const match = old.byName.get(row.scientificName.trim().toLocaleLowerCase('es'));
    if (match) return match;
  }
  return null;
}

function first<T>(rows: CatalogItem[], pick: (row: CatalogItem) => T | null | undefined): T | null {
  for (const row of rows) {
    const value = pick(row);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function main(): void {
  const input = loadCatalog();
  if (input.length === 0) throw new Error('data/catalog has no records');
  const historical = loadHistorical();
  const grouped = new Map<string, CatalogItem[]>();
  for (const item of input) grouped.set(item.id, [...(grouped.get(item.id) ?? []), item]);

  rmSync(NEXT_PATH, { force: true });
  const db = new DatabaseSync(NEXT_PATH);
  db.exec('PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON;');
  db.exec(SCHEMA);
  const insert = db.prepare(`INSERT INTO species (
    stable_id, codigo, scientific_name, accepted_name, common_name, common_names, kingdom, phylum,
    clase, orden, familia, genero, epiteto,
    estado_conservacion, conservation_label, conservation_rank, conservation_system, conservation_source, conservation_assessed_at, nativa,
    descripcion, alimentacion, tamano,
    image_url, full_url, thumb_asset, audio_url,
    image_license, image_attribution, image_source, image_page,
    accent_light, accent_dark, container_light, on_container_light, container_dark, on_container_dark,
    origin, establishment, seasonality, presence_certainty, abundance_status, habitat, diet, relevant_note, sources
  ) VALUES (${Array.from({ length: 46 }, () => '?').join(', ')})`);

  const usedCodes = new Set<string>();
  let existingCodes = 0;
  db.exec('BEGIN');
  try {
    for (const [id, rows] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
      const old = chooseOld(rows, historical);
      let codigo = old?.codigo ?? id;
      if (usedCodes.has(codigo)) codigo = id;
      if (usedCodes.has(codigo)) throw new Error(`duplicate app code after merge: ${codigo}`);
      usedCodes.add(codigo);
      if (old) existingCodes++;

      const scientificName = first(rows, (row) => row.scientificName) ?? id;
      const catalogCommonNames = unique(
        rows.map((row) => row.commonName).filter((name): name is string => Boolean(name?.trim())),
      );
      const commonNames = catalogCommonNames.length > 0
        ? catalogCommonNames
        : old ? unique([old.common_name, ...parseNames(old.common_names)].filter(Boolean)) : [];
      const displayName = commonNames[0] ?? scientificName;
      const origins = unique(rows.map((row) => row.origin).filter((value): value is Exclude<Origin, null> => value !== null));
      const origin: Origin = origins.length === 1 ? origins[0]! : null;
      const genus = first(rows, (row) => row.taxonomy.genus) ?? scientificName.split(' ')[0] ?? '';
      const epithet = scientificName.split(' ')[1] ?? '';
      const image = first(rows, (row) => row.media?.image);
      const diet = unique(rows.flatMap((row) => row.diet ?? []));
      const habitat = unique(rows.flatMap((row) => row.habitat ?? []));
      const sources = unique(rows.flatMap((row) => row.sources).map((source) => JSON.stringify(source))).map((source) => JSON.parse(source));
      const abundance = first(rows, (row) => row.abundanceStatus);
      // Abundance and conservation are different biological concepts. Until
      // the catalogue has an explicit conservation object, preserve a prior
      // evaluated status or mark the species as unassessed.
      const conservationRaw = old?.estado_conservacion ?? 'No evaluada';
      const conservationLabel = old?.conservation_label ?? 'No evaluada';
      const conservationRank = old?.conservation_rank ?? 0;
      const palette = old ?? DEFAULT_PALETTE;
      const description = first(rows, (row) => row.description) ?? old?.descripcion ?? '';
      const size = first(rows, (row) => row.size) ?? old?.tamano ?? '';
      const dietText = diet.length > 0
        ? diet.map((value) => DIET_LABELS[value] ?? value.replaceAll('_', ' ')).join(', ')
        : old?.alimentacion ?? '';
      insert.run(
        id, codigo, scientificName, scientificName, displayName, JSON.stringify(commonNames),
        first(rows, (row) => row.taxonomy.kingdom) ?? 'Animalia',
        first(rows, (row) => row.taxonomy.phylum) ?? '',
        first(rows, (row) => row.taxonomy.class) ?? '', first(rows, (row) => row.taxonomy.order) ?? '',
        first(rows, (row) => row.taxonomy.family) ?? '', genus, epithet,
        conservationRaw, conservationLabel, conservationRank, 'Prioridad nacional/SNAP (legado)', null, null, origin === 'native' ? 1 : 0,
        description, dietText, size,
        image?.url ?? null, image?.fullUrl ?? null, old?.thumb_asset ?? null,
        first(rows, (row) => row.media?.audio) ?? old?.audio_url ?? null,
        image?.license ?? null, image?.attribution ?? null, image?.source ?? null, image?.sourcePage ?? null,
        palette.accent_light, palette.accent_dark, palette.container_light, palette.on_container_light,
        palette.container_dark, palette.on_container_dark,
        origin, 'uncertain', first(rows, (row) => row.seasonality), 'uncertain', abundance,
        JSON.stringify(habitat), JSON.stringify(diet), first(rows, (row) => row.relevantNote),
        JSON.stringify(sources),
      );
    }
    db.exec(`
      INSERT INTO species_fts (rowid, common_names, scientific_name, familia, genero)
      SELECT rowid, replace(replace(replace(common_names, '["', ''), '"]', ''), '","', ' '),
             scientific_name, familia, genero FROM species;
    `);
    const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    meta.run('schema_version', String(SCHEMA_VERSION));
    meta.run('built_at', new Date().toISOString());
    meta.run('source', 'data/catalog/*.json');
    meta.run('catalog_record_count', String(input.length));
    meta.run('species_count', String(grouped.size));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    rmSync(NEXT_PATH, { force: true });
    throw error;
  }

  const integrity = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
  const count = (db.prepare('SELECT COUNT(*) AS n FROM species').get() as { n: number }).n;
  const withPhoto = (db.prepare('SELECT COUNT(*) AS n FROM species WHERE image_url IS NOT NULL').get() as { n: number }).n;
  const ftsCount = (db.prepare('SELECT COUNT(*) AS n FROM species_fts').get() as { n: number }).n;
  if (integrity.integrity_check !== 'ok' || count !== grouped.size || ftsCount !== count) {
    db.close();
    rmSync(NEXT_PATH, { force: true });
    throw new Error(`candidate validation failed: integrity=${integrity.integrity_check}, species=${count}, fts=${ftsCount}`);
  }
  db.exec('VACUUM');
  db.close();

  rmSync(PREVIOUS_PATH, { force: true });
  if (existsSync(DB_PATH)) renameSync(DB_PATH, PREVIOUS_PATH);
  try {
    renameSync(NEXT_PATH, DB_PATH);
    rmSync(PREVIOUS_PATH, { force: true });
  } catch (error) {
    if (existsSync(PREVIOUS_PATH)) renameSync(PREVIOUS_PATH, DB_PATH);
    throw error;
  }

  console.log(`07-build-app-db: ${input.length} catalog records merged into ${count} species`);
  console.log(`  ${withPhoto} with image; ${existingCodes} existing app codes preserved`);
  console.log(`  validated and written to assets/db/natura.db`);
}

main();
