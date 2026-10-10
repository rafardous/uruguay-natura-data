/** Verifica el contrato editorial JSON → SQLite sin comparar versiones de medios. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { run } from './15-azpiroz.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const catalog = read('data/catalog/aves.json');
const correspondence = read('data/reference/azpiroz-2003/crosswalk-editorial.json');
const normalized = read('data/reference/azpiroz-2003/normalized.json');
assert.equal(catalog.length, 475);
assert.equal(new Set(catalog.map((row) => row.catalogCode)).size, 475);
assert.equal(correspondence.length, 435);
const db = new DatabaseSync(resolve(root, 'assets/db/natura.db'), { readOnly: true });
assert.equal(db.prepare("select count(*) n from species where clase='Aves'").get().n, 475);
assert.equal(db.prepare("select count(*) n from species where kingdom='Plantae'").get().n, 100);
assert.equal(db.prepare('select count(*) n from species').get().n, 1048);
let enriched = 0;
for (const row of normalized.filter((row) => row.speciesId)) {
  const target = correspondence.find((item) => item.number === row.number);
  const item = catalog.find((item) => item.catalogCode === target.catalogCode);
  const bird = db.prepare('select stable_id,natural_history,sources from species where codigo=?').get(target.catalogCode);
  assert.equal(item.id, target.editorialSpeciesId);
  assert.equal(bird.stable_id, target.editorialSpeciesId);
  assert.deepEqual(item.naturalHistory.bird, row.profile);
  assert.deepEqual(JSON.parse(bird.natural_history).bird, row.profile);
  assert.ok(JSON.parse(bird.sources).some((ref) => (ref.sourceCode ?? ref.source) === 'azpiroz_2003' && ref.citation && ref.fieldPath === 'naturalHistory.bird.guide'));
  enriched++;
}
assert.equal(enriched, 432);
assert.equal(db.prepare('pragma integrity_check').get().integrity_check, 'ok');
db.close();
assert.equal(run(false).changedRecords, 0, 'El overlay factual no es idempotente');
console.log('Azpiroz OK: 435 originales, 432 perfiles y UUID/códigos/fuentes idénticos en JSON y SQLite; 1048 especies, 100 plantas; overlay sin cambios.');
