/** Verifica el catálogo publicado sin regenerarlo ni modificarlo. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(import.meta.dirname, '../..');
const files = ['aves', 'mammalia', 'reptilia', 'amphibia', 'actinopterygii', 'chondrichthyes', 'arachnida', 'insecta', 'malacostraca', 'plantae'];
const catalog = files.flatMap((file) => JSON.parse(readFileSync(resolve(root, 'data/catalog', file + '.json'), 'utf8')));
const seed = JSON.parse(readFileSync(resolve(root, 'data/raw/curated-plants/seed-100.json'), 'utf8'));
const plantNames = new Set([...seed.arboles, ...seed.otras_plantas_nativas].map((row) => row.nombre_cientifico));
const db = new DatabaseSync(process.env.NATURA_CATALOG_DB_PATH ?? resolve(root, 'assets/db/natura.db'), { readOnly: true });
try {
  const scalar = (sql: string): number => Number(Object.values(db.prepare(sql).get()!)[0]);
  const meta = Object.fromEntries(db.prepare('select key,value from meta').all().map((row) => [row.key, row.value]));
  assert.equal(meta.schema_version, '14');
  assert.ok(Number.isSafeInteger(Number(meta.data_version)) && Number(meta.data_version) > 0);
  assert.equal(db.prepare('pragma integrity_check').get()!.integrity_check, 'ok');
  assert.deepEqual(db.prepare('pragma foreign_key_check').all(), []);
  assert.equal(catalog.length, 1048);
  assert.equal(new Set(catalog.map((row) => row.id)).size, 1048);
  assert.equal(new Set(catalog.map((row) => row.catalogCode)).size, 1048);
  assert.equal(plantNames.size, 100);
  assert.equal(scalar("select count(*) from species where kingdom='Animalia'"), 948);
  assert.equal(scalar("select count(*) from species where kingdom='Plantae'"), 100);
  assert.deepEqual(new Set(db.prepare("select scientific_name from species where kingdom='Plantae'").all().map((row) => row.scientific_name)), plantNames);
  const rows = db.prepare('select stable_id,codigo,scientific_name from species').all();
  const byId = new Map(catalog.map((row) => [row.id, row]));
  assert.equal(rows.length, catalog.length);
  for (const row of rows) {
    const expected = byId.get(row.stable_id);
    assert.ok(expected, 'UUID ausente del JSON: ' + row.stable_id);
    assert.equal(row.codigo, expected.catalogCode);
    assert.equal(row.scientific_name, expected.scientificName);
  }
  for (const table of ['taxa', 'species_taxa', 'taxon_names', 'taxon_closure', 'species_media', 'species_fts', 'catalog_sources', 'learning_paths']) {
    assert.equal(scalar("select count(*) from sqlite_master where type='table' and name='" + table + "'"), 1, table);
  }
  assert.equal(scalar('select count(*) from species_fts'), 1048);
  assert.equal(scalar("select count(*) from species_fts where species_fts match 'carpincho'") > 0, true);
  assert.equal(scalar("select count(*) from species where image_url is not null and image_license not in ('CC0','CC-BY-4.0','permission')"), 0);
  assert.equal(scalar("select count(*) from species_media where media_type='audio' and (duration_seconds is null or duration_seconds<=0 or duration_seconds>15 or external_id is null)"), 0);
  assert.equal(scalar("select count(*) from species_media where media_type='audio'"), 177);
  assert.equal(scalar("select count(*) from species where measurements is null or not json_valid(measurements) or ecology is null or not json_valid(ecology) or conservation is null or not json_valid(conservation)"), 0);
  console.log('Catálogo v' + meta.data_version + '/schema 14: 1048 UUID/códigos, 948 animales, seed-100 exacto, integridad, taxonomía, búsqueda, licencias y 177 audios verificados.');
} finally {
  db.close();
}
