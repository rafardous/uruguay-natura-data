import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { adminClient, chunks, required, stableUuid } from './shared';

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
  origin: string | null;
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
  relevant_note: string;
  source_references: string[];
  status: 'active';
  image: ImportedImage | null;
}

interface ImportedImage {
  url: string;
  fullUrl: string;
  license: string;
  attribution: string;
  source: string;
  sourcePage: string | null;
}

const sourceRoot = resolve(import.meta.dirname, '../../NaturaUY-source');
const catalogDir = process.env.CATALOG_DIR ?? resolve(sourceRoot, 'data/catalog');
const dbPath = process.env.LEGACY_DB ?? resolve(sourceRoot, 'assets/db/natura.db');
const dryRun = process.argv.includes('--dry-run');

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
const uniqueStrings = (values: Array<string | null | undefined>) => [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];

const speciesRows: ImportedSpecies[] = [...grouped].map(([slug, rows]) => {
  const scientificName = first(rows, (row) => row.scientificName) ?? slug;
  const old = legacy.get(scientificName.toLocaleLowerCase('es'));
  const commonNames = uniqueStrings(rows.map((row) => row.commonName));
  const sourceReferences = uniqueStrings(rows.flatMap((row) => row.sources.map((source) => source.record ? `${source.source}: ${source.record}` : source.source)));
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
    catalog_code: old?.codigo ?? slug,
    scientific_name: scientificName,
    accepted_name: old?.accepted_name ?? scientificName,
    common_name: commonNames[0] ?? scientificName,
    alternate_common_names: commonNames.slice(1),
    kingdom: first(rows, (row) => row.taxonomy.kingdom) ?? 'Animalia',
    phylum: first(rows, (row) => row.taxonomy.phylum) ?? '',
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
    relevant_note: first(rows, (row) => row.relevantNote) ?? '',
    source_references: sourceReferences,
    status: 'active' as const,
    image,
  };
}).sort((a, b) => a.catalog_code.localeCompare(b.catalog_code, 'es'));

console.log(JSON.stringify({ catalogRecords: items.length, uniqueSpecies: speciesRows.length, legacyMatches: speciesRows.filter((row) => legacy.has(row.scientific_name.toLocaleLowerCase('es'))).length }));
if (dryRun) process.exit(0);

const client = adminClient();
const actor = required('EDITORIAL_BOOTSTRAP_USER_ID');
const { data: membership, error: membershipError } = await client
  .from('editor_memberships')
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
    proposed_changes: changeFields(row),
    base_updated_at: null,
    proposed_by: actor,
    status: 'approved',
    validated_by: actor,
    comment: 'Importación inicial',
    validated_at: new Date(0).toISOString(),
  }));
  const { error: requestError } = await client.from('species_change_requests').upsert(requests, { onConflict: 'id' });
  if (requestError) throw requestError;

  const audits = batch.map((row) => ({
    species_id: row.id,
    change_request_id: stableUuid(`initial-change:${row.id}`),
    before_values: {},
    after_values: changeFields(row),
    proposed_by: actor,
    validated_by: actor,
    created_at: new Date(0).toISOString(),
  }));
  const { error: auditError } = await client.from('species_audit').upsert(audits, { onConflict: 'change_request_id' });
  if (auditError) throw auditError;

  const media = batch.filter((row) => row.image).map((row) => ({
    id: stableUuid(`legacy-image:${row.id}`),
    species_id: row.id,
    change_request_id: null,
    ordinal: 1,
    type: 'image',
    storage_path: null,
    thumbnail_path: null,
    author: row.image!.attribution || 'Fuente externa',
    license: row.image!.license || 'Licencia no normalizada',
    source: `${row.image!.source || 'Catálogo anterior'}${row.image!.sourcePage ? ` · ${row.image!.sourcePage}` : ''}`,
    source_url: row.image!.fullUrl ?? row.image!.url,
    original_filename: null,
    uploaded_by: actor,
    status: 'archived',
  }));
  if (media.length) {
    const { error: mediaError } = await client.from('species_media').upsert(media, { onConflict: 'id' });
    if (mediaError) throw mediaError;
  }

  imported += batch.length;
  console.log(`Imported ${imported}/${speciesRows.length}`);
}

const { error: stateError } = await client.from('catalog_state').update({
  dirty: true,
  dirty_changes: speciesRows.length,
  last_changed_at: new Date().toISOString(),
}).eq('singleton', true);
if (stateError) throw stateError;

console.log('Initial catalog import completed; legacy media remains archived pending license review.');
