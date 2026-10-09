/** Verifica que el SQLite de un release contenga las fotos de la guía revisada. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { parseMapping } from './guide-photo-selection.mjs';

const root = resolve(import.meta.dirname, '..');
const defaultMapping = resolve(root, 'data/guide-birds/correspondencias_aves_1-435.csv');
const defaultExpectations = resolve(root, 'data/guide-birds/publication-expectations.json');
const option = (key, fallback) => {
  const index = process.argv.indexOf(key);
  return index < 0 ? fallback : process.argv[index + 1];
};
const guidePath = (number, value) => new RegExp(`^(?:/m/guia-aves|/storage/v1/object/public/guia-aves)/${String(number).padStart(3, '0')}/(?:0[12]\\.webp|external/0[12]-[0-9a-f]{12}\\.webp)$`).test(value);

function pathname(value) {
  assert.equal(typeof value, 'string', 'Falta URL de medio');
  const url = new URL(value);
  assert.equal(url.protocol, 'https:', 'La URL de medio debe ser HTTPS');
  return url.pathname;
}

export function verifyGuideCatalog(db, mapping, expectations) {
  const reviewed = [...mapping].filter(([, uuid]) => uuid);
  assert.equal(reviewed.length, expectations.reviewedNumbers, 'Cambió el número de vínculos revisados');
  assert.equal(new Set(reviewed.map(([, uuid]) => uuid)).size, reviewed.length, 'UUID de ave repetido');
  let photos = 0; let singlePhotoNumbers = 0;
  const findSpecies = db.prepare('select stable_id, clase, image_url, full_url from species where stable_id = ?');
  const findMedia = db.prepare("select ordinal, is_primary, url, thumbnail_url from species_media where stable_id = ? and media_type = 'image' order by ordinal");
  for (const [number, uuid] of reviewed) {
    const species = findSpecies.get(uuid);
    assert.ok(species, `Falta la especie revisada del número ${number}`);
    assert.equal(species.clase, 'Aves', `El número ${number} no apunta a un ave`);
    const rows = findMedia.all(uuid);
    assert.ok(rows.length >= 1 && rows.length <= 2, `Cupo o fotos faltantes en guía ${number}`);
    if (rows.length === 1) singlePhotoNumbers += 1;
    for (const [index, row] of rows.entries()) {
      const ordinal = index + 1;
      assert.equal(row.ordinal, ordinal, `Ordinal incorrecto en guía ${number}`);
      assert.equal(row.is_primary, ordinal === 1 ? 1 : 0, `Foto principal incorrecta en guía ${number}`);
      const fullPath = pathname(row.url);
      assert.ok(guidePath(number, fullPath), `URL principal incorrecta en guía ${number}`);
      assert.equal(pathname(row.thumbnail_url), fullPath.replace(/\.webp$/, '-480.webp'), `Miniatura incorrecta en guía ${number}`);
    }
    assert.equal(pathname(species.image_url), pathname(rows[0].thumbnail_url), `Foto de ficha incorrecta en guía ${number}`);
    assert.equal(pathname(species.full_url), pathname(rows[0].url), `Foto completa incorrecta en guía ${number}`);
    photos += rows.length;
  }
  return { reviewedNumbers: reviewed.length, photos, singlePhotoNumbers };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const dbPath = resolve(option('--db', resolve(root, 'dist/catalog/natura.db')));
  const mapping = parseMapping(readFileSync(resolve(option('--mapping', defaultMapping)), 'utf8'));
  const expectations = JSON.parse(readFileSync(resolve(option('--expectations', defaultExpectations)), 'utf8'));
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { console.log(JSON.stringify(verifyGuideCatalog(db, mapping, expectations))); }
  finally { db.close(); }
}
