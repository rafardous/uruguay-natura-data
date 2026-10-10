import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';

import { loadApprovedCatalog, loadApprovedLearningPaths, loadApprovedTaxonContent, loadApprovedTrivia, publicMediaUrl, serializeCatalogRecord, writeCatalogJson } from './catalog-data';
import { adminClient, required } from './shared';

const client = adminClient();
const output = resolve(import.meta.dirname, '../dist/catalog');
const databasePath = resolve(output, 'natura.db');
const mediaUrl = publicMediaUrl;
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
if (release.schema_version !== 14) throw new Error(`Schema de release incompatible: ${release.schema_version}; se requiere 14`);

const [items, trivia, taxonContent, learningPaths] = await Promise.all([loadApprovedCatalog(), loadApprovedTrivia(), loadApprovedTaxonContent(), Number(release.schema_version) >= 13 ? loadApprovedLearningPaths() : Promise.resolve([])]);
const blockers: string[] = [];
const warnings: Array<{ code: string; speciesId: string; detail: string }> = [];
const scientificNames = new Set<string>();
const catalogCodes = new Set<string>();
const seed = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../NaturaUY-source/data/raw/curated-plants/seed-100.json'), 'utf8')) as {
  arboles: Array<{ nombre_cientifico: string }>;
  otras_plantas_nativas: Array<{ nombre_cientifico: string }>;
};
const selectedPlants = new Set([...seed.arboles, ...seed.otras_plantas_nativas].map((row) => row.nombre_cientifico));
const plantItems = items.filter((item) => item.species.kingdom === 'Plantae');
const photoGaps: Array<{ scientificName: string; reasons: string[] }> = [];
if (selectedPlants.size !== 100 || plantItems.length !== 100 || plantItems.some((item) => !selectedPlants.has(String(item.species.scientific_name)))) {
  blockers.push(`plant_selection_mismatch: active=${plantItems.length}, selected=${selectedPlants.size}`);
}

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
  if (species.kingdom === 'Plantae') {
    const reasons: string[] = [];
    if (species.origin === 'native' && (!Array.isArray(species.field_sources?.origin) || !species.field_sources.origin.length)) reasons.push('native_origin_unverified');
    if (species.origin !== 'native') warnings.push({ code: 'plant_origin_unknown', speciesId: species.id, detail: scientificName });
    const image = item.image;
    if (!image) warnings.push({ code: 'image_missing', speciesId: species.id, detail: scientificName });
    else {
      if (!['CC0','CC-BY-4.0','permission'].includes(String(image.license))) reasons.push('image_license_invalid');
      if (!image.author || !image.source || !image.source_url) reasons.push('image_attribution_incomplete');
      if (image.license === 'permission' && !image.evidence_path) reasons.push('permission_evidence_missing');
      if (image.license !== 'permission' && !image.license_url) reasons.push('license_url_missing');
      if (!image.storage_path || !image.thumbnail_path) reasons.push('processed_files_missing');
    }
    if (reasons.length) photoGaps.push({ scientificName, reasons });
  } else if (!item.image) warnings.push({ code: 'image_missing', speciesId: species.id, detail: scientificName });
  if (!item.audio) warnings.push({ code: 'audio_missing', speciesId: species.id, detail: scientificName });
  if (!species.description) warnings.push({ code: 'description_missing', speciesId: species.id, detail: scientificName });
}

const objects = [...new Set(items.flatMap((item) => item.images.flatMap((image) =>
  [image.storage_path, image.thumbnail_path].filter((path): path is string => typeof path === 'string'
    && path.length > 0 && (item.species.kingdom === 'Plantae' || path.startsWith('guia-aves/'))))))];
for (let offset = 0; offset < objects.length; offset += 10) {
  const batch = objects.slice(offset, offset + 10);
  const checked = await Promise.all(batch.map(async (path) => {
    const guide = path.startsWith('guia-aves/');
    return { path, error: (await client.storage.from(guide ? 'guia-aves' : 'media-public')
      .info(guide ? path.slice('guia-aves/'.length) : path)).error };
  }));
  for (const result of checked) if (result.error) blockers.push(`media_storage_object_missing:${result.path}`);
}
writeFileSync(resolve(output, 'plant-photo-gaps.json'), JSON.stringify({ selected: selectedPlants.size, active: plantItems.length, photographed: plantItems.filter((item) => item.image).length, missingPhotos: plantItems.filter((item) => !item.image).map((item) => item.species.scientific_name), gaps: photoGaps }, null, 2));
for (const gap of photoGaps) blockers.push(`plant_not_ready:${gap.scientificName}:${gap.reasons.join(',')}`);

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
  conservation text not null, nativa integer not null, descripcion text not null, measurements text not null, ecology text not null,
  taxon_identifiers text not null, natural_history text not null,
  image_url text, full_url text, thumb_asset text, audio_url text, image_license text, image_attribution text, image_source text, image_page text,
  accent_light text not null, accent_dark text not null, container_light text not null, on_container_light text not null, container_dark text not null, on_container_dark text not null,
  origin text, seasonality text, abundance_status text check(abundance_status is null or abundance_status in ('abundant','common','fairly_common','uncommon','rare','scarce','occasional')), relevant_note text, sources text not null,
  knowledge_level text not null check(knowledge_level in ('easy','medium','hard')), abundance_category text, abundance_label text
);
create index idx_species_clase on species(clase);
create index idx_species_phylum on species(phylum);
create index idx_species_orden on species(orden);
create index idx_species_familia on species(familia);
create index idx_species_genero on species(genero);
create index idx_species_taxonomy_path on species(phylum, clase, orden, familia, genero, common_name collate nocase);
create index idx_species_priority on species(json_extract(conservation,'$.nationalDesignations'));
create index idx_species_has_photo on species(image_url);
create index idx_species_sort on species(common_name);
create virtual table species_fts using fts5(common_names, scientific_name, familia, genero, content='species', content_rowid='rowid', tokenize="unicode61 remove_diacritics 2");
create table species_media (
  id text primary key, stable_id text not null references species(stable_id), media_type text not null check(media_type in ('image','audio')),
  ordinal integer not null, is_primary integer not null default 0, url text not null, thumbnail_url text,
  author text not null, license text not null, source text not null, source_url text, duration_seconds real, external_id text, original_license text
);
create index idx_species_media_species on species_media(stable_id, media_type, ordinal);
create unique index idx_species_media_audio_external on species_media(external_id) where media_type='audio' and external_id is not null;
create table species_observability (
  stable_id text primary key references species(stable_id), method_version text not null,
  period_start text not null, period_end text not null, occurrence_count integer not null,
  occupied_cells integer not null, years_observed integer not null, score real not null,
  band text not null, comparison_class text not null
);
create table species_conservation (
  stable_id text not null references species(stable_id), system text not null,
  category text, designations text not null, source_code text not null,
  source_record_id text, version text, assessed_at text, primary key(stable_id,system)
);
create table species_facts (
  id text primary key, stable_id text not null references species(stable_id), body text not null, sort_order integer not null,
  source_code text, source_record_id text
);
create index idx_species_facts_species on species_facts(stable_id, sort_order);
create table species_game_rules (
  stable_id text not null references species(stable_id), game_key text not null, enabled integer not null,
  min_knowledge_level text, primary key(stable_id, game_key)
);
create table taxon_content (
  id text primary key, taxon_rank text not null, kingdom text not null, phylum text not null,
  class_name text not null, taxon_name text not null, language text not null, description text not null, simple_name text, source_code text not null,
  unique(taxon_rank,class_name,taxon_name,language)
);
create index idx_taxon_content_lookup on taxon_content(class_name,taxon_rank,taxon_name);
create table catalog_sources (
  code text primary key, name text not null, url text, publisher text, license text, citation text, use_policy text not null
);
create table trivia_questions (
  id text primary key, stable_id text references species(stable_id), prompt text not null,
  explanation text, source_id text not null, image_url text, image_attribution text, image_license text
);
create table trivia_options (
  id text primary key, question_id text not null references trivia_questions(id), body text not null,
  is_correct integer not null, sort_order integer not null
);
create index idx_trivia_species on trivia_questions(stable_id);
create table learning_paths (
  id text primary key, version integer not null, language text not null, title text not null,
  short_title text not null, description text not null, accent_color text not null,
  content text not null check(json_valid(content)), source_codes text not null check(json_valid(source_codes))
);
create table meta (key text primary key, value text not null);
`);

const defaults = ['#477052', '#BDD0B7', '#DCE8D8', '#293832', '#31533D', '#E5F1E2'];
const insert = db.prepare(`insert into species values (${Array.from({ length: 42 }, () => '?').join(',')})`);
const insertConservation = db.prepare('insert into species_conservation values (?,?,?,?,?,?,?,?)');
const insertMedia = db.prepare('insert into species_media values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
const insertObservability = db.prepare('insert into species_observability values (?,?,?,?,?,?,?,?,?,?)');
const insertFact = db.prepare('insert into species_facts values (?,?,?,?,?,?)');
const insertGameRule = db.prepare('insert into species_game_rules values (?,?,?,?)');
const insertTaxon = db.prepare('insert into taxon_content values (?,?,?,?,?,?,?,?,?,?)');
const insertCatalogSource = db.prepare('insert into catalog_sources values (?,?,?,?,?,?,?)');
const insertTrivia = db.prepare('insert into trivia_questions values (?,?,?,?,?,?,?,?)');
const insertTriviaOption = db.prepare('insert into trivia_options values (?,?,?,?,?)');
const insertLearningPath = db.prepare('insert into learning_paths values (?,?,?,?,?,?,?,?,?)');
db.exec('begin');
try {
  const catalogSources = items[0]?.catalogSources ?? [];
  const sourcesById = new Map(catalogSources.map((source) => [String(source.id), source]));
  catalogSources.filter((source) => source.active !== false).forEach((source) => insertCatalogSource.run(
    source.code, source.name, source.url ?? null, source.publisher ?? null, source.license ?? null,
    source.citation ?? null, source.use_policy,
  ));
  for (const item of items) {
    const species = item.species;
    const commonNames = [species.common_name, ...(species.alternate_common_names ?? [])];
    const serialized = serializeCatalogRecord(item);
    const references = serialized.sources;
    const values = [
      species.id, species.catalog_code, species.scientific_name, species.accepted_name || species.scientific_name,
      species.common_name, JSON.stringify(commonNames), species.kingdom ?? '', species.phylum ?? '', species.class ?? '',
      species.order_name ?? '', species.family ?? '', species.genus ?? '', String(species.scientific_name).split(' ')[1] ?? '',
      JSON.stringify(serialized.conservation), species.origin === 'native' ? 1 : 0,
      species.description ?? '', JSON.stringify(species.measurements ?? []), JSON.stringify(species.ecology ?? {}),
      JSON.stringify(species.taxon_identifiers ?? {}), JSON.stringify(species.natural_history ?? {}), item.imageUrl,
      mediaUrl(item.image?.storage_path),
      null, item.audioUrl, item.image?.license ?? null, item.image?.author ?? null, item.image?.source ?? null,
      item.image?.source_url ?? null, ...defaults, species.origin, species.seasonality,
      species.abundance_status, species.relevant_note, JSON.stringify(references),
      item.gameProfile?.knowledge_level ?? 'hard', species.abundance_status ?? null, species.abundance_status ?? null,
    ];
    if (values.length !== 42) throw new Error(`SQLite column mismatch: expected 42, got ${values.length}`);
    insert.run(...values);
    for (const assessment of item.conservationAssessments) {
      const sourceCode = sourcesById.get(String(assessment.source_id))?.code;
      if (!sourceCode) throw new Error(`Conservation source missing: ${assessment.source_id}`);
      insertConservation.run(species.id, assessment.system, assessment.category ?? null, JSON.stringify(assessment.designations ?? []), sourceCode, assessment.source_record_id ?? null, assessment.version_label ?? null, assessment.assessed_at ?? null);
    }
    item.images.forEach((image, index) => insertMedia.run(image.id, species.id, 'image', index + 1, image.id === item.image?.id ? 1 : 0,
      mediaUrl(image.storage_path), mediaUrl(image.thumbnail_path ?? image.storage_path), image.author, image.license, image.source, image.source_url, null, image.external_id ?? null, image.original_license ?? null));
    if (item.audio?.storage_path) insertMedia.run(item.audio.id, species.id, 'audio', 1, 0, mediaUrl(item.audio.storage_path), null,
      item.audio.author, item.audio.license, item.audio.source, item.audio.source_url, Number(item.audio.clip_duration_seconds ?? item.audio.duration_seconds ?? 15), item.audio.external_id ?? null, item.audio.original_license ?? null);
    if (item.observability) insertObservability.run(
      species.id, item.observability.method_version, item.observability.period_start, item.observability.period_end,
      item.observability.occurrence_count, item.observability.occupied_cells, item.observability.years_observed,
      item.observability.score, item.observability.band, item.observability.comparison_class,
    );
    item.facts.forEach((fact) => insertFact.run(
      fact.id, species.id, fact.body, fact.sort_order,
      sourcesById.get(String(fact.source_id))?.code ?? null, fact.source_record_id ?? null,
    ));
    item.gameRules.forEach((rule) => insertGameRule.run(species.id, rule.game_key, rule.enabled ? 1 : 0, rule.min_knowledge_level));
  }
  trivia.forEach((question) => {
    insertTrivia.run(question.id, question.species_id, question.prompt, question.explanation, question.source_id,
      mediaUrl(question.image?.thumbnail_path ?? question.image?.storage_path),question.image?.author??null,question.image?.license??null);
    question.options.forEach((option) => insertTriviaOption.run(option.id, question.id, option.body, option.is_correct ? 1 : 0, option.sort_order));
  });
  taxonContent.forEach((item)=>insertTaxon.run(
    item.id,item.taxon_rank,item.kingdom,item.phylum,item.class_name,item.taxon_name,item.language,
    item.description,item.simple_name ?? null,sourcesById.get(String(item.source_id))?.code ?? String(item.source_id),
  ));
  learningPaths.forEach((item) => insertLearningPath.run(
    item.id, item.version, item.language, item.title, item.short_title, item.description,
    item.accent_color, JSON.stringify(item.content), JSON.stringify(item.source_codes ?? []),
  ));
  db.exec(`insert into species_fts(rowid, common_names, scientific_name, familia, genero)
    select rowid, replace(replace(replace(common_names, '["', ''), '"]', ''), '","', ' '), scientific_name, familia, genero from species;`);
  const meta = db.prepare('insert into meta values (?,?)');
  meta.run('schema_version', String(release.schema_version));
  meta.run('data_version', String(release.version));
  meta.run('built_at', new Date().toISOString());
  meta.run('species_count', String(items.length));
  meta.run('learning_path_count', String(learningPaths.length));
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
