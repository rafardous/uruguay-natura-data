import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { inferGuideMapping } from './prepare-assigned-guide-photos.mjs';
import { chooseGuidePhotos, uploadedFamily } from './reconcile-guide-photos.mjs';

const birds = [
  { species_id: 'bird-a', nombre_cientifico: 'Rhea americana', nombre_comun: 'Ñandú' },
  { species_id: 'bird-b', nombre_cientifico: 'Passer domesticus', nombre_comun: 'Gorrión' },
];

test('infiere sólo coincidencias únicas y compatibles entre etiquetas', () => {
  assert.equal(inferGuideMapping(1, ['1 ÑANDÚ - Greater Rhea (Rhea americana).JPG', '1 (1) ÑANDÚ.JPG'], birds), 'bird-a');
  assert.equal(inferGuideMapping(1, ['1 ÑANDÚ.JPG', '1 (1) GORRIÓN.JPG'], birds), null);
  assert.equal(inferGuideMapping(1, ['1 ÑANDÚ.JPG', '1 (1) Polla de agua juvenil.JPG'], birds), null);
  assert.equal(inferGuideMapping(1, ['1.JPG', '1 (1).JPG'], birds), null);
  assert.equal(inferGuideMapping(1, ['1 ÑANDÚ.JPG', '1 (1) Foto cedida.JPG'], birds), null);
});

test('prioriza fotos familiares y conserva como máximo dos imágenes', () => {
  assert.deepEqual(chooseGuidePhotos([{ id: 'f1' }], [{ id: 'e1' }, { id: 'e2' }]).map((row) => [row.id, row.ordinal, row.is_primary]),
    [['f1', 1, true], ['e1', 2, false]]);
});

test('verifica imagen y miniatura remotas antes de vincularlas', async () => {
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const files = new Map([['001/01.webp', 'imagen'], ['001/01-480.webp', 'miniatura']]);
  const client = { storage: { from(bucket) {
    assert.equal(bucket, 'guia-aves');
    return { async download(path) { return files.has(path)
      ? { data: new Blob([files.get(path)]), error: null }
      : { data: null, error: { statusCode: 404, message: 'not found' } }; } };
  } } };
  const item = { number: 1, ordinal: 1, storagePath: 'guia-aves/001/01.webp', thumbnailPath: 'guia-aves/001/01-480.webp', mainSha256: hash('imagen'), thumbnailSha256: hash('miniatura') };
  assert.equal(await uploadedFamily(client, item), true);
  files.delete('001/01-480.webp');
  assert.equal(await uploadedFamily(client, item), false);
  files.set('001/01.webp', 'otra imagen');
  await assert.rejects(() => uploadedFamily(client, item), /SHA-256 incorrecto/);
});
