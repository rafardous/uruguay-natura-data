import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';

import { loadApprovedCatalog, writeCatalogJson } from './catalog-data';
import { adminClient, required } from './shared';

const client = adminClient();
const output = resolve(import.meta.dirname, '../dist/catalog');
const databasePath = resolve(output, 'natura.db');
const mediaUrl = (path: string | null | undefined) => path ? `${required('SUPABASE_URL').replace(/\/$/, '')}/storage/v1/object/public/media-public/${path}` : null;
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

const releaseId = required('CATALOG_RELEASE_ID');
const { data: release, error: releaseError } = await client
  .from('catalog_releases')
  .update({ status: 'building', started_at: new Date().toISOString(), error: null })
  .eq('id', releaseId)
  .eq('status', 'pending')
  .select('*')
  .single();
if (releaseError) throw releaseError;

const items = await loadApprovedCatalog();
const blockers: string[] = [];
const warnings: Array<{ code: string; speciesId: string; detail: string }> = [];
const scientificNames = new Set<string>();
const catalogCodes = new Set<string>();

for (const item of items) {
  const species = item.species;
  const scientificName = String(species.scientific_name ?? '').trim();
  const code = String(species.catalog_code ?? '').trim();
  if (!scientificName) blockers.push(`scientific_name_missing:${species.id}`);
  if (!code) blockers.push(`catalog_code_missing:${species.id}`);
  if (scientificNames.has(scientificName.toLocaleLowerCase())) blockers.push(`duplicate_scientific_name:${scientificName}`);
  if (catalogCodes.has(code)) blockers.push(`duplicate_catalog_code:${code}`);
  scientificNames.add(scientificName.toLocaleLowerCase());
  catalogCodes.add(code);
  if (!item.image) warnings.push({ code: 'image_missing', speciesId: species.id, detail: scientificName });
  if (!item.audio) warnings.push({ code: 'audio_missing', speciesId: species.id, detail: scientificName });
  if (!species.description) warnings.push({ code: 'description_missing', speciesId: species.id, detail: scientificName });
}

if (blockers.length) {
  await client.from('catalog_releases').update({ status: 'failed', error: blockers.join('\n') }).eq('id', releaseId);
  throw new Error(`Catalog blocked:\n${blockers.join('\n')}`);
}

const db = new DatabaseSync(databasePath);
db.exec(`
pragma journal_mode=delete;
pragma foreign_keys=on;
create table species (
  stable_id text not null unique, codigo text primary key, scientific_name text not null, accepted_name text, common_name text not null, common_names text not null,
  kingdom text not null, phylum text not null, clase text not null, orden text not null, familia text not null, genero text not null, epiteto text not null,
  estado_conservacion text not null, conservation_label text not null, conservation_rank integer not null, conservation_system text, conservation_source text, conservation_assessed_at text,
  nativa integer not null, descripcion text not null, alimentacion text not null, tamano text not null,
  image_url text, full_url text, thumb_asset text, audio_url text, image_license text, image_attribution text, image_source text, image_page text,
  accent_light text not null, accent_dark text not null, container_light text not null, on_container_light text not null, container_dark text not null, on_container_dark text not null,
  origin text, establishment text, seasonality text, presence_certainty text, abundance_status text, habitat text not null, diet text not null, relevant_note text, sources text not null
);
create index idx_species_clase on species(clase);
create index idx_species_phylum on species(phylum);
create index idx_species_orden on species(orden);
create index idx_species_familia on species(familia);
create index idx_species_genero on species(genero);
create index idx_species_taxonomy_path on species(phylum, clase, orden, familia, genero, common_name collate nocase);
create index idx_species_rank on species(conservation_rank);
create index idx_species_has_photo on species(image_url);
create index idx_species_sort on species(common_name);
create virtual table species_fts using fts5(common_names, scientific_name, familia, genero, content='species', content_rowid='rowid', tokenize="unicode61 remove_diacritics 2");
create table species_media (
  id text primary key, stable_id text not null references species(stable_id), media_type text not null check(media_type in ('image','audio')),
  ordinal integer not null, is_primary integer not null default 0, url text not null, thumbnail_url text,
  author text not null, license text not null, source text not null, source_url text, duration_seconds real
);
create index idx_species_media_species on species_media(stable_id, media_type, ordinal);
create table meta (key text primary key, value text not null);
`);

const defaults = ['#477052', '#BDD0B7', '#DCE8D8', '#293832', '#31533D', '#E5F1E2'];
const insert = db.prepare(`insert into species values (${Array.from({ length: 46 }, () => '?').join(',')})`);
const insertMedia = db.prepare('insert into species_media values (?,?,?,?,?,?,?,?,?,?,?,?)');
db.exec('begin');
try {
  for (const item of items) {
    const species = item.species;
    const commonNames = [species.common_name, ...(species.alternate_common_names ?? [])];
    const category = species.conservation_category || 'NE';
    const references = Object.entries(species.field_sources ?? {}).flatMap(([field, values]) => (values as string[]).map((source) => ({ source, record: field })));
    const values = [
      species.id, species.catalog_code, species.scientific_name, species.accepted_name || species.scientific_name,
      species.common_name, JSON.stringify(commonNames), species.kingdom ?? '', species.phylum ?? '', species.class ?? '',
      species.order_name ?? '', species.family ?? '', species.genus ?? '', String(species.scientific_name).split(' ')[1] ?? '',
      category, species.conservation_label || category, Number(species.conservation_rank ?? 0), species.conservation_system,
      species.conservation_source, species.conservation_assessed_at, species.origin === 'native' ? 1 : 0,
      species.description ?? '', (species.diet ?? []).join(', '), species.size ?? '', item.imageUrl,
      item.image?.storage_path ? `${required('SUPABASE_URL').replace(/\/$/, '')}/storage/v1/object/public/media-public/${item.image.storage_path}` : null,
      null, item.audioUrl, item.image?.license ?? null, item.image?.author ?? null, item.image?.source ?? null,
      item.image?.source_url ?? null, ...defaults, species.origin, species.establishment, species.seasonality,
      species.presence_certainty, species.abundance_status, JSON.stringify(species.habitat ?? []),
      JSON.stringify(species.diet ?? []), species.relevant_note, JSON.stringify(references),
    ];
    if (values.length !== 46) throw new Error(`SQLite column mismatch: expected 46, got ${values.length}`);
    insert.run(...values);
    item.images.forEach((image, index) => insertMedia.run(image.id, species.id, 'image', index + 1, image.id === item.image?.id ? 1 : 0,
      mediaUrl(image.storage_path), mediaUrl(image.thumbnail_path ?? image.storage_path), image.author, image.license, image.source, image.source_url, null));
    if (item.audio?.storage_path) insertMedia.run(item.audio.id, species.id, 'audio', 1, 0, mediaUrl(item.audio.storage_path), null,
      item.audio.author, item.audio.license, item.audio.source, item.audio.source_url, 15);
  }
  db.exec(`insert into species_fts(rowid, common_names, scientific_name, familia, genero)
    select rowid, replace(replace(replace(common_names, '["', ''), '"]', ''), '","', ' '), scientific_name, familia, genero from species;`);
  const meta = db.prepare('insert into meta values (?,?)');
  meta.run('schema_version', String(release.schema_version));
  meta.run('data_version', String(release.version));
  meta.run('built_at', new Date().toISOString());
  meta.run('species_count', String(items.length));
  db.exec('commit');
} catch (error) {
  db.exec('rollback');
  db.close();
  throw error;
}

const integrity = db.prepare('pragma integrity_check').get() as { integrity_check: string };
const count = (db.prepare('select count(*) as count from species').get() as { count: number }).count;
const ftsCount = (db.prepare('select count(*) as count from species_fts').get() as { count: number }).count;
const mediaCount = (db.prepare('select count(*) as count from species_media').get() as { count: number }).count;
if (integrity.integrity_check !== 'ok' || count !== items.length || ftsCount !== items.length) {
  throw new Error(`SQLite validation failed: integrity=${integrity.integrity_check}, species=${count}, fts=${ftsCount}, media=${mediaCount}`);
}
db.exec('pragma optimize; vacuum;');
db.close();

writeCatalogJson(output, items);
const database = readFileSync(databasePath);
const compressed = gzipSync(database, { level: 9 });
writeFileSync(`${databasePath}.gz`, compressed);
const sha256 = createHash('sha256').update(database).digest('hex');
const report = {
  version: release.version,
  schemaVersion: release.schema_version,
  generatedAt: new Date().toISOString(),
  speciesCount: items.length,
  media: { images: items.filter((item) => item.image).length, audio: items.filter((item) => item.audio).length },
  blockers,
  warningCount: warnings.length,
  warnings,
};
writeFileSync(resolve(output, 'quality-report.json'), `${JSON.stringify(report, null, 2)}\n`);
const manifest = {
  data_version: release.version,
  schema_version: release.schema_version,
  published_at: null,
  database_url: '',
  compressed_database_url: '',
  compressed_size: compressed.length,
  database_size: database.length,
  sha256,
  min_app_version: release.min_app_version,
  quality_report_url: '',
};
writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(resolve(output, 'build-metadata.json'), JSON.stringify({
  releaseId,
  version: release.version,
  speciesCount: items.length,
  databaseSize: database.length,
  sha256,
}, null, 2));
console.log(`Built catalog v${release.version}: ${items.length} species, ${(database.length / 1024 / 1024).toFixed(2)} MiB, ${warnings.length} warnings.`);
