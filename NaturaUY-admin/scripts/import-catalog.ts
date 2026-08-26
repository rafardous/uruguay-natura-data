import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { adminClient, chunks, required, stableUuid } from './shared';

interface CatalogItem {
  id: string; scientificName: string; commonName: string | null;
  taxonomy: { kingdom: string | null; phylum: string | null; class: string | null; order: string | null; family: string | null; genus: string | null };
  origin: 'native' | 'introduced' | null; seasonality: string | null; abundanceStatus: string | null;
  description: string | null; habitat: string[]; diet: string[] | null; size: string | null; relevantNote: string | null;
  media: { image: { url: string; fullUrl: string; license: string; attribution: string; source: string; sourcePage: string | null } | null; audio: string | null };
  sources: Array<{ source: string; record: string | null }>; reviewStatus: string;
}

interface LegacyRow { codigo: string; scientific_name: string; accepted_name: string | null; estado_conservacion: string; conservation_label: string; conservation_rank: number; image_url: string | null; full_url: string | null; image_license: string | null; image_attribution: string | null; image_source: string | null; image_page: string | null; }

const root = resolve(import.meta.dirname, '../../NaturaUY-source');
const catalogDir = process.env.CATALOG_DIR ?? resolve(root, 'data/catalog');
const dbPath = process.env.LEGACY_DB ?? resolve(root, 'assets/db/natura.db');
const dryRun = process.argv.includes('--dry-run');

const items = readdirSync(catalogDir).filter((file) => file.endsWith('.json')).sort().flatMap((file) => JSON.parse(readFileSync(resolve(catalogDir, file), 'utf8')) as CatalogItem[]);
const grouped = new Map<string, CatalogItem[]>(); for (const item of items) grouped.set(item.id, [...(grouped.get(item.id) ?? []), item]);
const legacy = new Map<string, LegacyRow>();
if (existsSync(dbPath)) { const db = new DatabaseSync(dbPath, { readOnly: true }); for (const row of db.prepare('select codigo, scientific_name, accepted_name, estado_conservacion, conservation_label, conservation_rank, image_url, full_url, image_license, image_attribution, image_source, image_page from species').all() as unknown as LegacyRow[]) legacy.set(row.scientific_name.toLocaleLowerCase('es'), row); db.close(); }

const first = <T>(rows: CatalogItem[], pick: (row: CatalogItem) => T | null | undefined): T | null => { for (const row of rows) { const value = pick(row); if (value !== null && value !== undefined && value !== '') return value; } return null; };
const unique = <T>(values: T[]) => [...new Set(values)];
const speciesRows = [...grouped].map(([slug, rows]) => {
  const scientificName = first(rows, (row) => row.scientificName) ?? slug; const old = legacy.get(scientificName.toLocaleLowerCase('es'));
  const sources = unique(rows.flatMap((row) => row.sources).map((value) => JSON.stringify(value))).map((value) => JSON.parse(value));
  const commonNames = unique(rows.map((row) => row.commonName?.trim()).filter((value): value is string => Boolean(value)));
  const payload = {
    scientificName, acceptedName: old?.accepted_name ?? scientificName, commonNames,
    taxonomy: { kingdom: first(rows, (row) => row.taxonomy.kingdom) ?? 'Animalia', phylum: first(rows, (row) => row.taxonomy.phylum) ?? '', class: first(rows, (row) => row.taxonomy.class) ?? '', order: first(rows, (row) => row.taxonomy.order) ?? '', family: first(rows, (row) => row.taxonomy.family) ?? '', genus: first(rows, (row) => row.taxonomy.genus) ?? scientificName.split(' ')[0] ?? '' },
    origin: first(rows, (row) => row.origin) ?? 'unknown', establishment: 'uncertain', seasonality: first(rows, (row) => row.seasonality) ?? 'unknown', presenceCertainty: 'uncertain',
    abundanceStatus: first(rows, (row) => row.abundanceStatus) ?? '', conservation: { system: old?.estado_conservacion ? 'Prioridad nacional/SNAP (legado)' : 'UICN', category: 'NE', source: old?.conservation_label ?? '', assessedAt: '', legacyStatus: old?.estado_conservacion ?? null, legacyLabel: old?.conservation_label ?? null, legacyRank: old?.conservation_rank ?? 0 },
    description: first(rows, (row) => row.description) ?? '', habitat: unique(rows.flatMap((row) => row.habitat ?? [])), diet: unique(rows.flatMap((row) => row.diet ?? [])), size: first(rows, (row) => row.size) ?? '', relevantNote: first(rows, (row) => row.relevantNote) ?? '', sources,
    fieldSources: sources.map((source: { source: string; record: string | null }) => ({ fieldPath: 'species', name: source.source, citation: source.record ?? '', url: source.record?.startsWith('http') ? source.record : '', note: 'Importación del catálogo existente' })),
  };
  const image = first(rows, (row) => row.media?.image); return { id: stableUuid(`species:${slug}`), catalog_code: old?.codigo ?? slug, payload, review: rows.some((row) => row.reviewStatus === 'needs_review') ? 'needs_review' : 'unreviewed', image: image ?? (old?.image_url ? { url: old.image_url, fullUrl: old.full_url ?? old.image_url, license: old.image_license ?? 'CC-BY', attribution: old.image_attribution ?? 'Fuente externa', source: old.image_source ?? 'legacy', sourcePage: old.image_page } : null) };
});

console.log(`Catalog records: ${items.length}; unique species: ${speciesRows.length}; legacy codes: ${speciesRows.filter((row) => !row.catalog_code.includes('-')).length}`);
if (dryRun) process.exit(0);

const client = adminClient(); const actor = required('EDITORIAL_BOOTSTRAP_USER_ID');
const { data: membership, error: membershipError } = await client.from('editor_memberships').select('user_id,is_active').eq('user_id', actor).single(); if (membershipError || !membership?.is_active) throw new Error('EDITORIAL_BOOTSTRAP_USER_ID must reference an active editorial member');
for (const batch of chunks(speciesRows, 100)) {
  const { error } = await client.from('species').upsert(batch.map((row) => ({ id: row.id, catalog_code: row.catalog_code, lifecycle: 'active', current_revision: 1, created_by: actor })), { onConflict: 'id' }); if (error) throw error;
  const revisionRows = batch.map((row) => ({ species_id: row.id, revision: 1, payload: row.payload, validation_state: row.review, edited_by: actor, reason: 'Importación del catálogo existente' }));
  const { error: revisionError } = await client.from('species_revisions').upsert(revisionRows, { onConflict: 'species_id,revision' }); if (revisionError) throw revisionError;
  const { error: auditError } = await client.from('audit_events').insert(batch.map((row) => ({ actor_id: actor, event_type: 'species.imported', entity_type: 'species', entity_id: row.id, payload: { catalogCode: row.catalog_code, revision: 1 } }))); if (auditError) throw auditError;
  const revisionIds = batch.map((row) => row.id); const { data: persistedRevisions, error: persistedRevisionError } = await client.from('species_revisions').select('id,species_id').in('species_id', revisionIds).eq('revision', 1); if (persistedRevisionError) throw persistedRevisionError;
  const sourceEntries = batch.flatMap((row) => row.payload.fieldSources.map((source) => ({ speciesId: row.id, ...source }))); const sourceInputs = unique(sourceEntries.map((entry) => JSON.stringify({ name: entry.name, citation: entry.citation || null, url: entry.url || null, created_by: actor }))).map((entry) => JSON.parse(entry));
  if (sourceInputs.length) { const { data: persistedSources, error: sourceError } = await client.from('sources').upsert(sourceInputs, { onConflict: 'name,url' }).select('id,name,url'); if (sourceError) throw sourceError; const sourceByKey = new Map((persistedSources ?? []).map((source) => [`${source.name}\u0000${source.url ?? ''}`, source.id])); const revisionBySpecies = new Map((persistedRevisions ?? []).map((revision) => [revision.species_id, revision.id])); const joins = sourceEntries.map((entry) => ({ revision_id: revisionBySpecies.get(entry.speciesId), field_path: entry.fieldPath, source_id: sourceByKey.get(`${entry.name}\u0000${entry.url || ''}`), note: entry.note || null })).filter((entry) => entry.revision_id && entry.source_id); if (joins.length) { const { error: joinError } = await client.from('species_field_sources').upsert(joins, { onConflict: 'revision_id,field_path,source_id' }); if (joinError) throw joinError; } }
  const mediaRows = batch.filter((row) => row.image).map((row) => ({ id: stableUuid(`legacy-image:${row.id}`), species_id: row.id, kind: 'image', state: 'ready', incoming_key: `legacy/${row.id}`, external_url: row.image!.fullUrl || row.image!.url, author: row.image!.attribution || 'Fuente externa', license: row.image!.license === 'CC0' ? 'CC0' : row.image!.license === 'CC BY 4.0' ? 'CC-BY-4.0' : 'legacy', original_license: row.image!.license || 'Sin licencia normalizada', source_url: row.image!.sourcePage, terms_version: 'legacy-import', uploaded_by: actor }));
  if (mediaRows.length) { const { error: mediaError } = await client.from('media_assets').upsert(mediaRows, { onConflict: 'id' }); if (mediaError) throw mediaError; }
  console.log(`Imported ${Math.min(speciesRows.indexOf(batch[0]!) + batch.length, speciesRows.length)}/${speciesRows.length}`);
}
await client.from('catalog_state').update({ dirty: true, dirty_changes: speciesRows.length, last_changed_at: new Date().toISOString() }).eq('singleton', true);
console.log('Initial editorial import complete.');
