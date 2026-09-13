import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { adminClient, chunks, required, stableUuid } from './shared';

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
    class: string | null;
    order: string | null;
    family: string | null;
    genus: string | null;
  };
  origin: string | null;
  seasonality: string | null;
  abundanceStatus: string | null;
  description: string | null;
  habitat: string[];
  diet: string[] | null;
  size: string | null;
  relevantNote: string | null;
  traits?: Record<string, unknown>;
  taxonIdentifiers?: Record<string, unknown>;
  naturalHistory?: Record<string, unknown>;
  distributionSummary?: Record<string, unknown>;
  media: {
    image: {
      url: string;
      fullUrl: string;
      license: string;
      originalLicense?: string | null;
      attribution: string;
      source: string;
      sourcePage: string | null;
      licenseUrl?: string; externalId?: string; sourceTaxonId?: string; sourceChecksum?: string | null; width?: number; height?: number;
      selectionScore?: number; selectionDetails?: Record<string, unknown>; retrievedAt?: string;
    } | null;
    audio: string | null;
  };
  sources: Array<{ source: string; record: string | null; fieldPath?: string }>;
}

interface LegacyRow {
  codigo: string;
  scientific_name: string;
  accepted_name: string | null;
  estado_conservacion: string;
  conservation_label: string;
  conservation_rank: number;
  image_url: string | null;
  full_url: string | null;
  image_license: string | null;
  image_attribution: string | null;
  image_source: string | null;
  image_page: string | null;
}

interface ImportedSpecies {
  id: string;
  catalog_code: string;
  scientific_name: string;
  accepted_name: string;
  common_name: string;
  alternate_common_names: string[];
  kingdom: string;
  phylum: string;
  subphylum: string;
  class: string;
  order_name: string;
  family: string;
  genus: string;
  origin: string;
  establishment: string;
  seasonality: string;
  presence_certainty: string;
  abundance_status: string;
  conservation_system: string;
  conservation_category: string;
  conservation_label: string;
  conservation_source: string;
  conservation_rank: number;
  conservation_assessed_at: null;
  description: string;
  habitat: string[];
  diet: string[];
  size: string;
  traits: Record<string, unknown>;
  taxon_identifiers: Record<string, unknown>;
  natural_history: Record<string, unknown>;
  distribution_summary: Record<string, unknown>;
  relevant_note: string;
  field_sources: Record<string, string[]>;
  status: 'active';
  image: ImportedImage | null;
}

interface ImportedImage {
  url: string;
  fullUrl: string;
  license: string;
  originalLicense?: string | null;
  attribution: string;
  source: string;
  sourcePage: string | null;
  licenseUrl?: string;
  externalId?: string;
  sourceTaxonId?: string;
  sourceChecksum?: string | null;
  width?: number;
  height?: number;
  selectionScore?: number;
  selectionDetails?: Record<string, unknown>;
  retrievedAt?: string;
}

interface FeaturedFact {
  id: string;
  scientificName: string;
  body: string;
  sourceCode: string;
  sourceRecordId: string;
  sortOrder: number;
}

const sourceRoot = resolve(import.meta.dirname, '../../NaturaUY-source');
const catalogDir = process.env.CATALOG_DIR ?? resolve(sourceRoot, 'data/catalog');
const dbPath = process.env.LEGACY_DB ?? resolve(sourceRoot, 'assets/db/natura.db');
const dryRun = process.argv.includes('--dry-run');
const approvedImageLicense=(license:string):'CC0'|'CC-BY-4.0'|'legacy'=>license==='CC0'||license==='CC-BY-4.0'?license:'legacy';
const featuredFacts = (JSON.parse(readFileSync(resolve(sourceRoot, 'data/facts/featured.json'), 'utf8')) as { facts: FeaturedFact[] }).facts;

const items = readdirSync(catalogDir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .flatMap((file) => JSON.parse(readFileSync(resolve(catalogDir, file), 'utf8')) as CatalogItem[]);

const grouped = new Map<string, CatalogItem[]>();
for (const item of items) grouped.set(item.id, [...(grouped.get(item.id) ?? []), item]);

const legacy = new Map<string, LegacyRow>();
if (existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = db.prepare(`
    select codigo, scientific_name, accepted_name, estado_conservacion,
      conservation_label, conservation_rank, image_url, full_url,
      image_license, image_attribution, image_source, image_page
    from species
  `).all() as unknown as LegacyRow[];
  for (const row of rows) legacy.set(row.scientific_name.toLocaleLowerCase('es'), row);
  db.close();
}

const first = <T>(rows: CatalogItem[], pick: (row: CatalogItem) => T | null | undefined): T | null => {
  for (const row of rows) {
    const value = pick(row);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
};
const uniqueStrings = (values: Array<string | null | undefined>) => [...new Map(values
  .map((value) => value?.normalize('NFC').replace(/\s+/g, ' ').trim()).filter((value): value is string => Boolean(value))
  .map((value) => [value.normalize('NFKC').replace(/\p{Cf}/gu, '').toLocaleLowerCase('es'), value])).values()];
const slug = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const taxonId = (parent: string | null, rank: string, name: string): string => `taxon-${slug(`${parent ?? 'root'}-${rank}-${name}`)}`;
const subphylumFor = (row: CatalogItem): string => row.taxonomy.phylum !== 'Arthropoda' ? '' : row.taxonomy.class === 'Arachnida' ? 'Chelicerata' : row.taxonomy.class === 'Insecta' ? 'Hexapoda' : row.taxonomy.class === 'Malacostraca' ? 'Crustacea' : '';

const speciesRows: ImportedSpecies[] = [...grouped].map(([slug, rows]) => {
  const scientificName = first(rows, (row) => row.scientificName) ?? slug;
  const old = legacy.get(scientificName.toLocaleLowerCase('es'));
  const commonNames = uniqueStrings(rows.flatMap((row) => row.commonNames ?? (row.commonName ? [row.commonName] : [])));
  const sourceReferences = uniqueStrings(rows.flatMap((row) => row.sources.map((source) => source.record ? `${source.source}: ${source.record}` : source.source)));
  const fieldSources: Record<string, string[]> = {};
  for (const source of rows.flatMap((row) => row.sources)) {
    const field = source.fieldPath ?? 'general';
    const reference = source.record ? `${source.source}: ${source.record}` : source.source;
    fieldSources[field] = uniqueStrings([...(fieldSources[field] ?? []), reference]);
  }
  const image = first(rows, (row) => row.media?.image) ?? (old?.image_url ? {
    url: old.image_url,
    fullUrl: old.full_url ?? old.image_url,
    license: old.image_license ?? 'Licencia no normalizada',
    attribution: old.image_attribution ?? 'Fuente externa',
    source: old.image_source ?? 'Catálogo anterior',
    sourcePage: old.image_page,
  } : null);

  return {
    id: stableUuid(`species:${slug}`),
    catalog_code: old?.codigo ?? first(rows, (row) => row.catalogCode) ?? slug,
    scientific_name: scientificName,
    accepted_name: first(rows, (row) => row.acceptedName ?? null) ?? old?.accepted_name ?? scientificName,
    common_name: commonNames[0] ?? scientificName,
    alternate_common_names: commonNames.slice(1),
    kingdom: first(rows, (row) => row.taxonomy.kingdom) ?? 'Animalia',
    phylum: first(rows, (row) => row.taxonomy.phylum) ?? '',
    subphylum: subphylumFor(rows[0]!),
    class: first(rows, (row) => row.taxonomy.class) ?? '',
    order_name: first(rows, (row) => row.taxonomy.order) ?? '',
    family: first(rows, (row) => row.taxonomy.family) ?? '',
    genus: first(rows, (row) => row.taxonomy.genus) ?? scientificName.split(' ')[0] ?? '',
    origin: first(rows, (row) => row.origin) ?? 'unknown',
    establishment: 'uncertain',
    seasonality: first(rows, (row) => row.seasonality) ?? 'unknown',
    presence_certainty: 'uncertain',
    abundance_status: first(rows, (row) => row.abundanceStatus) ?? '',
    conservation_system: old?.estado_conservacion ? 'Prioridad nacional/SNAP (legado)' : 'UICN',
    conservation_category: 'NE',
    conservation_label: old?.conservation_label ?? '',
    conservation_source: old?.estado_conservacion ?? '',
    conservation_rank: old?.conservation_rank ?? 0,
    conservation_assessed_at: null,
    description: first(rows, (row) => row.description) ?? '',
    habitat: uniqueStrings(rows.flatMap((row) => row.habitat ?? [])),
    diet: uniqueStrings(rows.flatMap((row) => row.diet ?? [])),
    size: first(rows, (row) => row.size) ?? '',
    traits: first(rows, (row) => row.traits) ?? { measurements: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [], depthMinM: null, depthMaxM: null, sources: [] },
    taxon_identifiers: first(rows, (row) => row.taxonIdentifiers) ?? {},
    natural_history: first(rows, (row) => row.naturalHistory) ?? {},
    distribution_summary: first(rows, (row) => row.distributionSummary) ?? {},
    relevant_note: first(rows, (row) => row.relevantNote) ?? '',
    field_sources: { general: sourceReferences, ...fieldSources },
    status: 'active' as const,
    image,
  };
}).sort((a, b) => a.catalog_code.localeCompare(b.catalog_code, 'es'));

const speciesByScientificName = new Map(speciesRows.map((row) => [row.scientific_name.toLocaleLowerCase('es'), row]));
const missingFactSpecies = featuredFacts.filter((fact) => !speciesByScientificName.has(fact.scientificName.toLocaleLowerCase('es')));
if (missingFactSpecies.length) throw new Error(`Featured fact species not found: ${missingFactSpecies.map((fact) => fact.scientificName).join(', ')}`);
const legacyCodes = new Set([...legacy.values()].map((row) => row.codigo));
console.log(JSON.stringify({
  catalogRecords: items.length,
  uniqueSpecies: speciesRows.length,
  featuredFacts: featuredFacts.length,
  legacyMatches: speciesRows.filter((row) => legacyCodes.has(row.catalog_code)).length,
  legacyNameMatches: speciesRows.filter((row) => legacy.has(row.scientific_name.toLocaleLowerCase('es'))).length,
}));
if (dryRun) process.exit(0);

const client = adminClient();
const actor = required('EDITORIAL_BOOTSTRAP_USER_ID');
const { data: membership, error: membershipError } = await client
  .from('editor_access')
  .select('user_id,active')
  .eq('user_id', actor)
  .single();
if (membershipError || !membership?.active) throw new Error('EDITORIAL_BOOTSTRAP_USER_ID must reference an active editorial member');

const publicFields = (row: ImportedSpecies) => {
  const { image: _image, ...fields } = row;
  return fields;
};
const changeFields = (row: ImportedSpecies) => {
  const { id: _id, ...fields } = publicFields(row);
  return fields;
};

let imported = 0;
for (const batch of chunks(speciesRows, 100)) {
  const species = batch.map(publicFields);
  const { error: speciesError } = await client.from('species').upsert(species, { onConflict: 'id' });
  if (speciesError) throw speciesError;

  const requests = batch.map((row) => ({
    id: stableUuid(`initial-change:${row.id}`),
    species_id: row.id,
    change_type: 'create',
    proposed_values: changeFields(row),
    base_updated_at: null,
    proposed_by: actor,
    status: 'approved',
    reviewed_by: actor,
    comment: 'Importación inicial',
    reviewed_at: new Date(0).toISOString(),
    before_values: {},
    after_values: changeFields(row),
  }));
  const { error: requestError } = await client.from('species_changes').upsert(requests, { onConflict: 'id' });
  if (requestError) throw requestError;

  const media = batch.filter((row) => row.image).map((row) => ({
    id: stableUuid(`legacy-image:${row.id}`),
    species_id: row.id,
    change_id: null,
    ordinal: 1,
    type: 'image',
    storage_path: null,
    thumbnail_path: null,
    author: row.image!.attribution || 'Fuente externa',
    license: approvedImageLicense(row.image!.license),
    source: `${row.image!.source || 'Catálogo anterior'}${row.image!.sourcePage ? ` · ${row.image!.sourcePage}` : ''}`,
    source_url: row.image!.fullUrl ?? row.image!.url,
    original_filename: null,
    uploaded_by: actor,
    status: 'archived',
    original_license: row.image!.originalLicense ?? null,
    license_url: row.image!.licenseUrl ?? null,
    external_id: row.image!.externalId ?? null,
    source_taxon_id: row.image!.sourceTaxonId ?? null,
    source_width: row.image!.width ?? null,
    source_height: row.image!.height ?? null,
    selection_score: row.image!.selectionScore ?? null,
    selection_details: row.image!.selectionDetails || row.image!.sourceChecksum ? { ...(row.image!.selectionDetails ?? {}), ...(row.image!.sourceChecksum ? { sourceChecksum: row.image!.sourceChecksum } : {}) } : null,
    retrieved_at: row.image!.retrievedAt ?? null,
  }));
  if (media.length) {
    const { error: mediaError } = await client.from('species_media').upsert(media, { onConflict: 'id' });
    if (mediaError) throw mediaError;
  }

  imported += batch.length;
  console.log(`Imported ${imported}/${speciesRows.length}`);
}

const taxonRows: Array<Record<string, unknown>> = [];
const speciesTaxonRows: Array<Record<string, unknown>> = [];
for (const row of speciesRows) {
  const values: Array<{ rank: string; name: string }> = [];
  if (row.phylum) values.push({ rank: 'phylum', name: row.phylum });
  if (row.subphylum) values.push({ rank: 'subphylum', name: row.subphylum });
  if (row.class) values.push({ rank: 'class', name: row.class });
  if (row.order_name) values.push({ rank: 'order', name: row.order_name });
  if (row.family) values.push({ rank: 'family', name: row.family });
  if (row.genus) values.push({ rank: 'genus', name: row.genus });
  let parent: string | null = null;
  values.forEach((value, index) => {
    const id = taxonId(parent, value.rank, value.name);
    taxonRows.push({ taxon_id: id, parent_id: parent, rank: value.rank, canonical_name: value.name, simple_name: null, description: '', identifiers: {}, source_ids: [], sort_order: index });
    speciesTaxonRows.push({ species_id: row.id, taxon_id: id, is_primary: true });
    parent = id;
  });
}
if (!dryRun) {
  for (const batch of chunks([...new Map(taxonRows.map((row) => [row.taxon_id, row])).values()], 200)) {
    const { error } = await client.from('taxa').upsert(batch, { onConflict: 'taxon_id' });
    if (error) throw error;
  }
  for (const batch of chunks(speciesTaxonRows, 500)) {
    const { error } = await client.from('species_taxa').upsert(batch, { onConflict: 'species_id,taxon_id' });
    if (error) throw error;
  }
}

const { data: factSources, error: factSourcesError } = await client
  .from('catalog_sources')
  .select('id,code')
  .in('code', [...new Set(featuredFacts.map((fact) => fact.sourceCode))]);
if (factSourcesError) throw factSourcesError;
const sourceIdByCode = new Map((factSources ?? []).map((source) => [source.code, source.id]));
const missingFactSources = [...new Set(featuredFacts.map((fact) => fact.sourceCode))].filter((code) => !sourceIdByCode.has(code));
if (missingFactSources.length) throw new Error(`Featured fact sources not registered: ${missingFactSources.join(', ')}`);

const factRows = featuredFacts.map((fact) => ({
  id: stableUuid(`featured-fact:${fact.id}`),
  species_id: speciesByScientificName.get(fact.scientificName.toLocaleLowerCase('es'))!.id,
  body: fact.body,
  source_id: sourceIdByCode.get(fact.sourceCode)!,
  source_record_id: fact.sourceRecordId,
  sort_order: fact.sortOrder,
  active: true,
  created_by: actor,
  reviewed_by: actor,
}));
const { error: factsError } = await client.from('species_facts').upsert(factRows, { onConflict: 'id' });
if (factsError) throw factsError;
const factChanges = factRows.map((fact) => ({
  id: stableUuid(`initial-featured-fact-change:${fact.id}`),
  content_type: 'fact',
  entity_id: fact.id,
  species_id: fact.species_id,
  operation: 'upsert',
  proposed_values: { body: fact.body, source_id: fact.source_id, source_record_id: fact.source_record_id, sort_order: fact.sort_order },
  proposed_by: actor,
  status: 'approved',
  reviewed_by: actor,
  reviewed_at: new Date(0).toISOString(),
  before_values: {},
  after_values: { body: fact.body, source_id: fact.source_id, source_record_id: fact.source_record_id, sort_order: fact.sort_order },
  comment: 'Contenido semilla versionado',
  self_validation_confirmed: true,
}));
const { error: factChangesError } = await client.from('content_changes').upsert(factChanges, { onConflict: 'id' });
if (factChangesError) throw factChangesError;

console.log(`Initial catalog import completed with ${factRows.length} featured facts; legacy media remains archived pending license review.`);
