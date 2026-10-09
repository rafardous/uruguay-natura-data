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

import { GROUP_METADATA, PATHS, readJson, slug, type Group } from './lib';
import type { SpeciesEcology, SpeciesMeasurement } from './schema14';

const DB_PATH = process.env.NATURA_CATALOG_DB_PATH ?? resolve(PATHS.catalog, '../../assets/db/natura.db');
const NEXT_PATH = `${DB_PATH}.next`;
const PREVIOUS_PATH = `${DB_PATH}.previous`;
const SCHEMA_VERSION = 14;
const DATA_VERSION = 4;

type Origin = 'native' | 'introduced' | null;

interface AudioCandidate {
  url: string;
  license?: string;
  attribution?: string;
  source?: string;
  sourcePage?: string | null;
  externalId?: string | null;
  originalLicense?: string | null;
  durationSeconds?: number | null;
}

interface CatalogItem {
  id: string;
  catalogCode?: string;
  scientificName: string;
  acceptedName?: string | null;
  commonName: string | null;
  commonNames?: string[];
  taxonomy: {
    kingdom: string | null;
    phylum: string | null;
    subphylum?: string | null;
    class: string | null;
    order: string | null;
    family: string | null;
    genus: string | null;
  };
  origin: Origin;
  seasonality: string | null;
  abundanceStatus: 'abundant' | 'common' | 'uncommon' | 'scarce' | 'occasional' | null;
  description: string | null;
  measurements: SpeciesMeasurement[];
  ecology: SpeciesEcology;
  relevantNote: string | null;
  taxonIdentifiers?: unknown;
  naturalHistory?: unknown;
  media: {
    image: {
      url: string;
      fullUrl: string;
      license: string;
      approvalStatus?: 'approved';
      originalLicense?: string | null;
      attribution: string;
      source: string;
      sourcePage: string | null;
      externalId?: string | null;
    } | null;
    images?: Array<NonNullable<CatalogItem['media']['image']>>;
    audio: string | AudioCandidate | null;
  };
  sources: Array<{ source: string; record: string | null; fieldPath?: string }>;
  reviewStatus: string;
}

interface CatalogSource {
  code: string;
  name?: string;
  version?: string;
  url?: string;
  publisher?: string;
  license?: string;
  citation?: string;
  usePolicy: string;
}

interface FeaturedFact {
  id: string;
  scientificName: string;
  body: string;
  sourceCode: string;
  sourceRecordId: string;
  sortOrder: number;
}

interface SimpleTaxonContent {
  language: string;
  sourceCode: string;
  items: Array<{
    rank: 'phylum' | 'subphylum' | 'class' | 'order';
    className: string;
    name: string;
    simpleName: string;
    description: string;
  }>;
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

const SCHEMA = `
CREATE TABLE species (
  stable_id TEXT NOT NULL UNIQUE, codigo TEXT PRIMARY KEY, scientific_name TEXT NOT NULL, accepted_name TEXT,
  common_name TEXT NOT NULL, common_names TEXT NOT NULL,
  kingdom TEXT NOT NULL, phylum TEXT NOT NULL, subfilo TEXT NOT NULL,
  clase TEXT NOT NULL, orden TEXT NOT NULL, familia TEXT NOT NULL,
  genero TEXT NOT NULL, epiteto TEXT NOT NULL,
  conservation TEXT NOT NULL DEFAULT '{"nationalRedList":null,"iucnGlobal":null,"nationalDesignations":[]}',
  nativa INTEGER NOT NULL,
  descripcion TEXT NOT NULL, measurements TEXT NOT NULL, ecology TEXT NOT NULL,
  taxon_identifiers TEXT NOT NULL, natural_history TEXT NOT NULL,
  image_url TEXT, full_url TEXT, thumb_asset TEXT, audio_url TEXT,
  image_license TEXT, image_attribution TEXT, image_source TEXT, image_page TEXT,
  accent_light TEXT NOT NULL, accent_dark TEXT NOT NULL,
  container_light TEXT NOT NULL, on_container_light TEXT NOT NULL,
  container_dark TEXT NOT NULL, on_container_dark TEXT NOT NULL,
  origin TEXT, seasonality TEXT, abundance_status TEXT CHECK(abundance_status IS NULL OR abundance_status IN ('abundant','common','uncommon','scarce','occasional')),
  relevant_note TEXT,
  sources TEXT NOT NULL,
  knowledge_level TEXT NOT NULL DEFAULT 'hard' CHECK(knowledge_level IN ('easy','medium','hard')),
  abundance_category TEXT, abundance_label TEXT
);
CREATE INDEX idx_species_clase ON species(clase);
CREATE INDEX idx_species_phylum ON species(phylum);
CREATE INDEX idx_species_subfilo ON species(subfilo);
CREATE INDEX idx_species_orden ON species(orden);
CREATE INDEX idx_species_familia ON species(familia);
CREATE INDEX idx_species_genero ON species(genero);
CREATE INDEX idx_species_taxonomy_path ON species(phylum, clase, orden, familia, genero, common_name COLLATE NOCASE);
CREATE INDEX idx_species_priority ON species(json_extract(conservation,'$.nationalDesignations'));
CREATE INDEX idx_species_has_photo ON species(image_url);
CREATE INDEX idx_species_sort ON species(common_name);
CREATE TABLE taxa (
  taxon_id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES taxa(taxon_id),
  rank TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  simple_name TEXT,
  description TEXT NOT NULL DEFAULT '',
  identifiers TEXT NOT NULL DEFAULT '{}',
  sources TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(parent_id, rank, canonical_name)
);
CREATE INDEX idx_taxa_parent_sort ON taxa(parent_id, sort_order, canonical_name);
CREATE INDEX idx_taxa_rank_name ON taxa(rank, canonical_name);
CREATE TABLE species_taxa (
  stable_id TEXT NOT NULL REFERENCES species(stable_id),
  taxon_id TEXT NOT NULL REFERENCES taxa(taxon_id),
  is_primary INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(stable_id, taxon_id)
);
CREATE INDEX idx_species_taxa_taxon ON species_taxa(taxon_id, stable_id);
CREATE VIRTUAL TABLE species_fts USING fts5(
  common_names, scientific_name, familia, genero,
  content='species', content_rowid='rowid',
  tokenize="unicode61 remove_diacritics 2"
);
CREATE TABLE species_media (
  id TEXT PRIMARY KEY, stable_id TEXT NOT NULL REFERENCES species(stable_id),
  media_type TEXT NOT NULL CHECK(media_type IN ('image', 'audio')),
  ordinal INTEGER NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0,
  url TEXT NOT NULL, thumbnail_url TEXT, author TEXT NOT NULL,
  license TEXT NOT NULL, source TEXT NOT NULL, source_url TEXT,
  duration_seconds REAL, external_id TEXT, original_license TEXT
);
CREATE INDEX idx_species_media_species ON species_media(stable_id, media_type, ordinal);
CREATE UNIQUE INDEX idx_species_media_audio_external ON species_media(external_id) WHERE media_type='audio' AND external_id IS NOT NULL;
CREATE TABLE species_observability (
  stable_id TEXT PRIMARY KEY REFERENCES species(stable_id), method_version TEXT NOT NULL,
  period_start TEXT NOT NULL, period_end TEXT NOT NULL, occurrence_count INTEGER NOT NULL,
  occupied_cells INTEGER NOT NULL, years_observed INTEGER NOT NULL, score REAL NOT NULL,
  band TEXT NOT NULL, comparison_class TEXT NOT NULL
);
CREATE TABLE species_conservation (
  stable_id TEXT NOT NULL REFERENCES species(stable_id),
  system TEXT NOT NULL CHECK(system IN ('uy_red_list','iucn_global','uy_designations')),
  category TEXT, designations TEXT NOT NULL DEFAULT '[]', source_code TEXT NOT NULL,
  source_record_id TEXT, version TEXT, assessed_at TEXT,
  PRIMARY KEY(stable_id, system)
);
CREATE INDEX idx_species_conservation_species ON species_conservation(stable_id, system);
CREATE TABLE species_facts (
  id TEXT PRIMARY KEY, stable_id TEXT NOT NULL REFERENCES species(stable_id), body TEXT NOT NULL, sort_order INTEGER NOT NULL,
  source_code TEXT, source_record_id TEXT
);
CREATE INDEX idx_species_facts_species ON species_facts(stable_id, sort_order);
CREATE TABLE species_game_rules (
  stable_id TEXT NOT NULL REFERENCES species(stable_id), game_key TEXT NOT NULL, enabled INTEGER NOT NULL,
  min_knowledge_level TEXT, PRIMARY KEY(stable_id, game_key)
);
CREATE TABLE taxon_content (
  id TEXT PRIMARY KEY, taxon_rank TEXT NOT NULL CHECK(taxon_rank IN ('kingdom','phylum','subphylum','class','order','family','genus')),
  kingdom TEXT NOT NULL, phylum TEXT NOT NULL, class_name TEXT NOT NULL, taxon_name TEXT NOT NULL,
  language TEXT NOT NULL, description TEXT NOT NULL, simple_name TEXT, source_code TEXT NOT NULL,
  UNIQUE(taxon_rank,class_name,taxon_name,language)
);
CREATE INDEX idx_taxon_content_lookup ON taxon_content(class_name,taxon_rank,taxon_name);
CREATE TABLE catalog_sources (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT, publisher TEXT, license TEXT,
  citation TEXT, use_policy TEXT NOT NULL
);
CREATE TABLE trivia_questions (
  id TEXT PRIMARY KEY, stable_id TEXT REFERENCES species(stable_id), prompt TEXT NOT NULL, explanation TEXT, source_id TEXT NOT NULL,
  image_url TEXT, image_attribution TEXT, image_license TEXT
);
CREATE TABLE trivia_options (
  id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES trivia_questions(id), body TEXT NOT NULL, is_correct INTEGER NOT NULL, sort_order INTEGER NOT NULL
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueCommonNames(values: string[]): string[] {
  const names = new Map<string, string>();
  for (const raw of values) {
    const value = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
    const key = value.normalize('NFKC').replace(/\p{Cf}/gu, '').toLocaleLowerCase('es');
    if (value && !names.has(key)) names.set(key, value);
  }
  return [...names.values()];
}

function parseNames(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function stableTaxonId(parentId: string | null, rank: string, name: string): string {
  return `taxon-${slug(`${parentId ?? 'root'}-${rank}-${name}`)}`;
}

const TAXON_PRESENTATION: Record<string, { simpleName: string; description: string; sortOrder: number }> = {
  Animalia: { simpleName: 'Animales', description: 'Seres vivos que obtienen energía alimentándose de otros organismos y, en alguna etapa, suelen poder desplazarse.', sortOrder: 0 },
  Plantae: { simpleName: 'Plantas', description: 'Seres vivos que realizan fotosíntesis y sostienen gran parte de las redes de vida terrestres y acuáticas.', sortOrder: 1 },
  Chordata: { simpleName: 'Vertebrados', description: 'Animales con notocorda en alguna etapa del desarrollo; incluye peces, anfibios, reptiles, aves y mamíferos.', sortOrder: 0 },
  Arthropoda: { simpleName: 'Artrópodos', description: 'Animales con exoesqueleto y apéndices articulados, como insectos, arácnidos y crustáceos.', sortOrder: 1 },
  Tracheophyta: { simpleName: 'Plantas vasculares', description: 'Plantas con tejidos especializados que transportan agua y nutrientes. Incluye licófitas, helechos, gimnospermas y plantas con flor.', sortOrder: 0 },
  Lycopodiopsida: { simpleName: 'Licófitas', description: 'Un linaje antiguo de plantas vasculares que se reproduce por esporas.', sortOrder: 0 },
  Polypodiopsida: { simpleName: 'Helechos y afines', description: 'Plantas vasculares sin semillas que se reproducen mediante esporas.', sortOrder: 1 },
  Gymnospermae: { simpleName: 'Gimnospermas', description: 'Plantas con semillas no encerradas en un fruto, como pinos, araucarias y efedras.', sortOrder: 2 },
  Angiospermae: { simpleName: 'Plantas con flor', description: 'Plantas que producen flores y semillas protegidas dentro de frutos.', sortOrder: 3 },
};

function taxonPath(item: CatalogItem): Array<{ id: string; rank: string; name: string; parent: string | null }> {
  const values: Array<{ rank: string; name: string; preserveRootId?: boolean }> = [];
  if (item.taxonomy.kingdom) values.push({ rank: 'kingdom', name: item.taxonomy.kingdom });
  if (item.taxonomy.phylum) values.push({ rank: 'phylum', name: item.taxonomy.phylum, preserveRootId: true });
  if (item.taxonomy.phylum === 'Arthropoda') {
    const bridge = item.taxonomy.class === 'Arachnida' ? 'Chelicerata' : item.taxonomy.class === 'Insecta' ? 'Hexapoda' : item.taxonomy.class === 'Malacostraca' ? 'Crustacea' : null;
    if (bridge) values.push({ rank: 'subphylum', name: bridge });
  }
  if (item.taxonomy.class) values.push({ rank: 'class', name: item.taxonomy.class });
  if (item.taxonomy.order) values.push({ rank: 'order', name: item.taxonomy.order });
  if (item.taxonomy.family) values.push({ rank: 'family', name: item.taxonomy.family });
  if (item.taxonomy.genus) values.push({ rank: 'genus', name: item.taxonomy.genus });
  let parent: string | null = null;
  return values.map((value) => {
    // Schema 11 exposed root phylum IDs. Keep those IDs stable while moving
    // the nodes below Animalia or Plantae.
    const id = stableTaxonId(value.preserveRootId ? null : parent, value.rank, value.name);
    const result = { id, rank: value.rank, name: value.name, parent };
    parent = id;
    return result;
  });
}

function subphylumFor(item: CatalogItem): string {
  if (item.taxonomy.subphylum) return item.taxonomy.subphylum;
  if (item.taxonomy.phylum !== 'Arthropoda') return '';
  return item.taxonomy.class === 'Arachnida' ? 'Chelicerata' : item.taxonomy.class === 'Insecta' ? 'Hexapoda' : item.taxonomy.class === 'Malacostraca' ? 'Crustacea' : '';
}

function sourceReference(source: { source: string; record: string | null; fieldPath?: string }, registry: Map<string, CatalogSource>) {
  const metadata = registry.get(source.source);
  return {
    source: source.source,
    record: source.record,
    fieldPath: source.fieldPath ?? 'general',
    sourceCode: source.source,
    name: metadata?.name ?? metadata?.code,
    version: metadata?.version,
    url: metadata?.url,
    citation: metadata?.citation,
    license: metadata?.license,
  };
}

function loadCatalog(): CatalogItem[] {
  return readdirSync(PATHS.catalog)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .flatMap((file) => readJson<CatalogItem[]>(resolve(PATHS.catalog, file)));
}

function normalizeScientificName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
}

function loadApprovedAudio(): Map<string, AudioCandidate> {
  const file = resolve(PATHS.cache, 'audio/xenocanto-approved.json');
  if (!existsSync(file)) return new Map();
  const manifest = readJson<{ candidates?: Array<{
    id: string;
    scientificName: string;
    recordist?: string | null;
    pageUrl?: string | null;
    originalLicense?: string | null;
    clipDurationSeconds?: number | null;
    approved?: boolean;
  }> }>(file);
  return new Map((manifest.candidates ?? [])
    .filter((candidate) => candidate.approved !== false && candidate.id && candidate.scientificName)
    .map((candidate) => [normalizeScientificName(candidate.scientificName), {
      url: `bundled://xc-${candidate.id}.mp3`,
      license: 'Autorización adicional del titular',
      attribution: candidate.recordist ?? 'Pedro Rinaldi',
      source: 'Xeno-canto',
      sourcePage: candidate.pageUrl ?? `https://xeno-canto.org/${candidate.id}`,
      externalId: `XC${candidate.id}`,
      originalLicense: candidate.originalLicense ?? null,
      durationSeconds: candidate.clipDurationSeconds ?? 15,
    }] as const));
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
  // Once schema 14 has been generated, the current SQLite intentionally no
  // longer carries the six legacy conservation columns. Rehydrate only the
  // historical designation string from the committed SNAP export so repeated
  // builds remain deterministic and preserve the audited 398/264/170 counts.
  const snapPath = resolve(PATHS.raw, 'otras_fuentes/outputSNAP.json');
  if (existsSync(snapPath)) {
    const snapRows = readJson<Array<{ codigo: string; estado_conservacion?: string }>>(snapPath);
    for (const snap of snapRows) {
      const row = byCode.get(snap.codigo);
      if (!row || !snap.estado_conservacion) continue;
      row.estado_conservacion = snap.estado_conservacion;
      row.conservation_label = snap.estado_conservacion;
      row.conservation_rank = /AMENAZADA/i.test(snap.estado_conservacion) ? 3 : /PRIORITARIA/i.test(snap.estado_conservacion) && !/NO PRIORITARIA/i.test(snap.estado_conservacion) ? 2 : 0;
    }
  }
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

function deterministicBuildTimestamp(): string {
  try {
    const manifest = readJson<{ retrievedAt?: string }>(resolve(PATHS.raw, 'sources.json'));
    if (manifest.retrievedAt && !Number.isNaN(Date.parse(manifest.retrievedAt))) return manifest.retrievedAt;
  } catch { /* older checkouts may not have a source manifest yet */ }
  return '1970-01-01T00:00:00.000Z';
}

function main(): void {
  const previewUnreviewed = process.argv.includes('--preview-unreviewed');
  const previewVersionArgument = process.argv.find((argument) => argument.startsWith('--preview-data-version='));
  const previewDataVersion = previewVersionArgument ? Number(previewVersionArgument.split('=')[1]) : null;
  if (previewUnreviewed && (!Number.isSafeInteger(previewDataVersion) || (previewDataVersion ?? -1) < DATA_VERSION)) {
    throw new Error('La vista previa exige --preview-data-version=N con la última versión remota publicada para no regresar al catálogo anterior');
  }
  const input = loadCatalog();
  if (input.length === 0) throw new Error('data/catalog has no records');
  const seed = readJson<{ arboles: Array<{ nombre_cientifico: string }>; otras_plantas_nativas: Array<{ nombre_cientifico: string }> }>(PATHS.curatedPlants);
  const selected = new Set([...seed.arboles, ...seed.otras_plantas_nativas].map((row) => row.nombre_cientifico));
  const plants = input.filter((item) => item.taxonomy.kingdom === 'Plantae');
  if (selected.size !== 100 || plants.length !== 100 || plants.some((item) => !selected.has(item.scientificName))) {
    throw new Error('Catálogo móvil bloqueado: la flora debe coincidir con las 100 especies seleccionadas');
  }
  const invalidPlantImages = plants.filter((item) => item.media.image && (
    !['CC0', 'CC-BY-4.0', 'permission'].includes(item.media.image.license)
    || !item.media.image.attribution || !item.media.image.sourcePage || !item.media.image.fullUrl));
  if (invalidPlantImages.length) throw new Error(`Fotos botánicas sin derechos o fuente: ${invalidPlantImages.length}`);
  const sourceRegistry = readJson<{ sources: CatalogSource[] }>(resolve(PATHS.catalog, '../catalog-source-registry.json')).sources;
  const sourcesByCode = new Map(sourceRegistry.map((source) => [source.code, source]));
  const featuredFacts = readJson<{ facts: FeaturedFact[] }>(resolve(PATHS.catalog, '../facts/featured.json')).facts;
  const approvedAudioByScientificName = loadApprovedAudio();
  const featuredByScientificName = new Map(featuredFacts.map((fact) => [fact.scientificName, fact]));
  const historical = loadHistorical();
  const grouped = new Map<string, CatalogItem[]>();
  for (const item of input) grouped.set(item.id, [...(grouped.get(item.id) ?? []), item]);

  rmSync(NEXT_PATH, { force: true });
  const db = new DatabaseSync(NEXT_PATH);
  db.exec('PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON;');
  db.exec(SCHEMA);
  const insertCatalogSource = db.prepare('INSERT INTO catalog_sources VALUES (?,?,?,?,?,?,?)');
  const mediaInsert = db.prepare('INSERT INTO species_media VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const conservationInsert = db.prepare('INSERT INTO species_conservation VALUES (?,?,?,?,?,?,?,?)');
  for (const source of sourceRegistry) insertCatalogSource.run(
    source.code, source.name ?? source.code, source.url ?? null, source.publisher ?? null,
    source.license ?? null, source.citation ?? null, source.usePolicy,
  );
    const insert = db.prepare(`INSERT INTO species (
    stable_id, codigo, scientific_name, accepted_name, common_name, common_names, kingdom, phylum, subfilo,
    clase, orden, familia, genero, epiteto,
    conservation, nativa,
    descripcion, measurements, ecology, taxon_identifiers, natural_history,
    image_url, full_url, thumb_asset, audio_url,
    image_license, image_attribution, image_source, image_page,
    accent_light, accent_dark, container_light, on_container_light, container_dark, on_container_dark,
    origin, seasonality, abundance_status, relevant_note, sources,
    knowledge_level, abundance_category, abundance_label
    ) VALUES (${Array.from({ length: 43 }, () => '?').join(', ')})`);
  const insertTaxonNode = db.prepare(`INSERT INTO taxa(taxon_id,parent_id,rank,canonical_name,simple_name,description,identifiers,sources,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(taxon_id) DO UPDATE SET parent_id=excluded.parent_id,rank=excluded.rank,canonical_name=excluded.canonical_name`);
  const insertSpeciesTaxon = db.prepare('INSERT OR IGNORE INTO species_taxa(stable_id,taxon_id,is_primary) VALUES (?,?,1)');

  const usedCodes = new Set<string>();
  let existingCodes = 0;
  db.exec('BEGIN');
  try {
    for (const [id, rows] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
      const old = chooseOld(rows, historical);
      // `catalogCode` is persisted by stage 06. Prefer the historical SQLite
      // code when the species already existed, then the identity map for new
      // species; never derive a new code from a mutable accepted name here.
      let codigo = old?.codigo ?? first(rows, (row) => row.catalogCode) ?? id;
      if (usedCodes.has(codigo)) codigo = id;
      if (usedCodes.has(codigo)) throw new Error(`duplicate app code after merge: ${codigo}`);
      usedCodes.add(codigo);
      if (old) existingCodes++;

      const scientificName = first(rows, (row) => row.scientificName) ?? id;
      const catalogCommonNames = uniqueCommonNames(rows.flatMap((row) => row.commonNames ?? (row.commonName ? [row.commonName] : [])));
      const commonNames = catalogCommonNames.length > 0
        ? catalogCommonNames
        : old ? uniqueCommonNames([old.common_name, ...parseNames(old.common_names)].filter(Boolean)) : [];
      // A scientific name is the explicit offline fallback when no vernacular
      // name exists; keep it in the searchable aliases as well.
      const searchNames = commonNames.length > 0 ? commonNames : [scientificName];
      const displayName = searchNames[0]!;
      const origins = unique(rows.map((row) => row.origin).filter((value): value is Exclude<Origin, null> => value !== null));
      const origin: Origin = origins.length === 1 ? origins[0]! : null;
      const genus = first(rows, (row) => row.taxonomy.genus) ?? scientificName.split(' ')[0] ?? '';
      const subphylum = subphylumFor(rows[0]!);
      const epithet = scientificName.split(' ')[1] ?? '';
      const image = first(rows, (row) => row.media?.image);
      const images = first(rows, (row) => row.media?.images)?.filter(Boolean) ?? (image ? [image] : []);
      if (images.length > 2) throw new Error(`Más de dos fotos para ${scientificName}`);
      const fact = featuredByScientificName.get(scientificName);
      const sourceRows = fact
        ? [...rows.flatMap((row) => row.sources), { source: fact.sourceCode, record: fact.sourceRecordId, fieldPath: 'relevant_note' }]
        : rows.flatMap((row) => row.sources);
      const sources = unique(sourceRows.map((source) => JSON.stringify(sourceReference(source, sourcesByCode))))
        .map((source) => JSON.parse(source));
      const abundance = first(rows, (row) => row.abundanceStatus);
      if (abundance && !sources.some((source) => ['abundanceStatus', 'abundance_status'].includes(source.fieldPath))) {
        throw new Error(`Abundance source missing for ${codigo}`);
      }
      // Abundance and conservation are different biological concepts. Until
      // the catalogue has an explicit conservation object, preserve a prior
      // evaluated status or mark the species as unassessed.
      const legacyConservation = `${old?.estado_conservacion ?? ''} ${old?.conservation_label ?? ''}`.toLocaleUpperCase('es');
      const designations = [
        legacyConservation.includes('PRIORITARIA') && !legacyConservation.includes('NO PRIORITARIA') ? 'priority' : null,
        legacyConservation.includes('AMENAZADA') ? 'threatened' : null,
        legacyConservation.includes('SNAP') ? 'snap' : null,
      ].filter((value): value is string => value !== null);
      const conservation = { nationalRedList: null, iucnGlobal: null, nationalDesignations: designations };
      const palette = old ?? DEFAULT_PALETTE;
      const description = first(rows, (row) => row.description) ?? old?.descripcion ?? '';
      const measurements = first(rows, (row) => row.measurements) ?? [];
      const ecology = first(rows, (row) => row.ecology) ?? { habitats: [], diet: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [], depthMinM: null, depthMaxM: null, microhabitats: [], trophicRoles: [], hosts: [], plantAssociations: [], vegetationFormations: [] };
      const audioCandidate = approvedAudioByScientificName.get(normalizeScientificName(scientificName))
        ?? first(rows, (row) => row.media?.audio);
      const audioUrl = typeof audioCandidate === 'string' ? audioCandidate : audioCandidate?.url ?? old?.audio_url ?? null;
      insert.run(
        id, codigo, scientificName, first(rows, (row) => row.acceptedName ?? null), displayName, JSON.stringify(searchNames),
        first(rows, (row) => row.taxonomy.kingdom) ?? 'Animalia',
        first(rows, (row) => row.taxonomy.phylum) ?? '', subphylum,
        first(rows, (row) => row.taxonomy.class) ?? '', first(rows, (row) => row.taxonomy.order) ?? '',
        first(rows, (row) => row.taxonomy.family) ?? '', genus, epithet,
        JSON.stringify(conservation), origin === 'native' ? 1 : 0,
        description, JSON.stringify(measurements), JSON.stringify(ecology),
        JSON.stringify(first(rows, (row) => row.taxonIdentifiers) ?? {}),
        JSON.stringify(first(rows, (row) => row.naturalHistory) ?? {}),
        image?.url ?? null, image?.fullUrl ?? null, old?.thumb_asset ?? null,
        audioUrl,
        image?.license ?? null, image?.attribution ?? null, image?.source ?? null, image?.sourcePage ?? null,
        palette.accent_light, palette.accent_dark, palette.container_light, palette.on_container_light,
        palette.container_dark, palette.on_container_dark,
        origin, first(rows, (row) => row.seasonality), abundance,
        first(rows, (row) => row.relevantNote),
        JSON.stringify(sources), 'hard', null, abundance,
      );
      if (designations.length) conservationInsert.run(id, 'uy_designations', null, JSON.stringify(designations), 'legacy_catalog', codigo, 'pre-schema-14', null);
      for (const [index, photo] of images.entries()) {
        mediaInsert.run(`${id}-image-${index + 1}`, id, 'image', index + 1, index === 0 ? 1 : 0,
          photo.fullUrl, photo.url, photo.attribution, photo.license, photo.source, photo.sourcePage,
          null, photo.externalId ?? null, photo.originalLicense ?? null);
      }
      if (audioCandidate) {
        const audioData = typeof audioCandidate === 'string' ? { url: audioCandidate } : audioCandidate;
        mediaInsert.run(`${id}-audio`, id, 'audio', 1, 0, audioData.url, null, audioData.attribution ?? 'Pedro Rinaldi', audioData.license ?? 'permission', audioData.source ?? 'Xeno-canto', audioData.sourcePage ?? null, audioData.durationSeconds ?? 15, audioData.externalId ?? null, audioData.originalLicense ?? null);
      }
      const representative = rows[0]!;
      for (const [index, node] of taxonPath(representative).entries()) {
        const presentation = TAXON_PRESENTATION[node.name];
        const taxonomySources = rows.flatMap((row) => row.sources).filter((source) => source.fieldPath?.startsWith('taxonomy.'));
        insertTaxonNode.run(node.id, node.parent, node.rank, node.name, presentation?.simpleName ?? null, presentation?.description ?? '', '{}', JSON.stringify(taxonomySources), presentation?.sortOrder ?? index);
        insertSpeciesTaxon.run(id, node.id);
      }
    }
    const taxonomyDirectory = resolve(PATHS.catalog, '../taxonomy');
    const orderContentFiles = readdirSync(taxonomyDirectory).filter((file) => file.endsWith('.json')).sort();
    const insertTaxon = db.prepare(`INSERT INTO taxon_content VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(taxon_rank,class_name,taxon_name,language) DO UPDATE SET
        description=excluded.description,simple_name=COALESCE(excluded.simple_name,taxon_content.simple_name),source_code=excluded.source_code`);
    for (const file of orderContentFiles) {
      const content = readJson<{ taxonomicClass:string; rank:string; language:string; source:{code:string}; kingdom?:string; phylum?:string; items:Array<{name:string;simpleName?:string;description:string}> }>(resolve(taxonomyDirectory, file));
      if (content.rank !== 'order') continue;
      for (const item of content.items) {
        insertTaxon.run(
          `${content.taxonomicClass.toLocaleLowerCase()}-order-${item.name.toLocaleLowerCase()}`,
          'order',content.kingdom ?? 'Animalia',content.phylum ?? GROUP_METADATA[content.taxonomicClass as Group]?.phylum ?? 'Chordata',content.taxonomicClass,item.name,content.language,item.description,item.simpleName ?? null,content.source.code,
        );
      }
    }
    const simpleContent = readJson<SimpleTaxonContent>(resolve(taxonomyDirectory, 'simple-names.json'));
    for (const item of simpleContent.items) {
      insertTaxon.run(
        `simple-${item.rank}-${item.className || 'all'}-${item.name}`.toLocaleLowerCase('es'),
        item.rank, 'Animalia', GROUP_METADATA[item.className as Group]?.phylum ?? (item.name === 'Arthropoda' ? 'Arthropoda' : 'Chordata'), item.className, item.name, simpleContent.language,
        item.description, item.simpleName, simpleContent.sourceCode,
      );
    }
    // Taxon cards now read the tree directly. Carry the reviewed schema-11
    // prose into those nodes so switching to dynamic navigation does not lose
    // the substantial Chordata/Arthropoda/class/order descriptions.
    db.exec(`
      UPDATE taxa SET
        simple_name=COALESCE((SELECT content.simple_name FROM taxon_content content WHERE content.taxon_rank=taxa.rank AND content.taxon_name=taxa.canonical_name AND content.language='es-UY' ORDER BY content.class_name<>'' DESC LIMIT 1),simple_name),
        description=COALESCE(NULLIF((SELECT content.description FROM taxon_content content WHERE content.taxon_rank=taxa.rank AND content.taxon_name=taxa.canonical_name AND content.language='es-UY' ORDER BY content.class_name<>'' DESC LIMIT 1),''),description)
      WHERE EXISTS (SELECT 1 FROM taxon_content content WHERE content.taxon_rank=taxa.rank AND content.taxon_name=taxa.canonical_name AND content.language='es-UY');
    `);
    const insertFact = db.prepare('INSERT INTO species_facts VALUES (?,?,?,?,?,?)');
    for (const fact of featuredFacts) {
      const species = db.prepare('SELECT stable_id FROM species WHERE scientific_name=?').get(fact.scientificName) as { stable_id: string } | undefined;
      if (!species) throw new Error(`featured fact species not found: ${fact.scientificName}`);
      if (!sourcesByCode.has(fact.sourceCode)) throw new Error(`featured fact source not registered: ${fact.sourceCode}`);
      insertFact.run(fact.id, species.stable_id, fact.body, fact.sortOrder, fact.sourceCode, fact.sourceRecordId);
    }
    const trivia = readJson<{sourceCode:string;questions:Array<{id:string;prompt:string;explanation:string;options:string[];correctIndex:number}>}>(resolve(PATHS.catalog, '../trivia/demo.json'));
    const insertTrivia = db.prepare('INSERT INTO trivia_questions VALUES (?,?,?,?,?,?,?,?)');
    const insertOption = db.prepare('INSERT INTO trivia_options VALUES (?,?,?,?,?)');
    for (const question of trivia.questions) {
      insertTrivia.run(question.id,null,question.prompt,question.explanation,trivia.sourceCode,null,null,null);
      question.options.forEach((body,index)=>insertOption.run(`${question.id}-${index}`,question.id,body,index===question.correctIndex?1:0,index));
    }
    db.exec(`
      INSERT INTO species_fts (rowid, common_names, scientific_name, familia, genero)
      SELECT rowid, replace(replace(replace(common_names, '["', ''), '"]', ''), '","', ' '),
             scientific_name,
             familia || ' ' || replace(replace(replace(COALESCE(json_extract(natural_history,'$.plant.nomenclature.familyAliases'),'[]'),'["',''),'"]',''),'","',' '),
             genero FROM species;
    `);
    const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    meta.run('schema_version', String(SCHEMA_VERSION));
    meta.run('data_version', String(previewUnreviewed ? previewDataVersion : DATA_VERSION));
    meta.run('editorial_status', previewUnreviewed ? 'preview_unreviewed' : 'automatic');
    // The offline build must be reproducible. The source refresh timestamp is
    // fixed for a snapshot and changes only when data:catalog-refresh runs.
    meta.run('built_at', deterministicBuildTimestamp());
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
  const birdLengths = (db.prepare("SELECT COUNT(*) AS n FROM species WHERE clase='Aves' AND EXISTS (SELECT 1 FROM json_each(measurements) WHERE json_extract(value,'$.kind')='body_length')").get() as { n: number }).n;
  const invalidMeasurements = (db.prepare("SELECT COUNT(*) AS n FROM species, json_each(species.measurements) WHERE json_extract(value,'$.sourceCode') IS NULL OR json_extract(value,'$.unit') IS NULL OR json_extract(value,'$.provenance') IS NULL").get() as { n: number }).n;
  if (integrity.integrity_check !== 'ok' || count !== grouped.size || ftsCount !== count || birdLengths !== 475 || invalidMeasurements !== 0) {
    db.close();
    rmSync(NEXT_PATH, { force: true });
    throw new Error(`candidate validation failed: integrity=${integrity.integrity_check}, species=${count}, fts=${ftsCount}, bird_lengths=${birdLengths}, invalid_measurements=${invalidMeasurements}`);
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
  console.log(`  validated and written to ${DB_PATH}`);
}

main();
