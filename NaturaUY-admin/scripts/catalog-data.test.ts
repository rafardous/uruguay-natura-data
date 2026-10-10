import assert from 'node:assert/strict';
import { test } from 'node:test';

import { approvedImagesForSpecies, publicMediaUrl } from './catalog-data';

const species = { id: 'bird-uuid', catalog_code: 'ave-ejemplo', primary_image_id: 'new-1' };
const image = (id: string, ordinal: number, status: string) => ({
  id, species_id: species.id, type: 'image', ordinal, status,
  storage_path: `guia-aves/001/0${ordinal}.webp`,
});

test('la publicación ignora las fotos archivadas y conserva el orden nuevo', () => {
  const selected = approvedImagesForSpecies(species, [
    image('old', 1, 'archived'), image('new-2', 2, 'approved'), image('new-1', 1, 'approved'),
  ]);
  assert.deepEqual(selected.images.map((item) => item.id), ['new-1', 'new-2']);
  assert.equal(selected.primary?.id, 'new-1');
});

test('la publicación rechaza más de dos fotos aprobadas por especie', () => {
  assert.throws(() => approvedImagesForSpecies(species, [
    image('one', 1, 'approved'), image('two', 2, 'approved'), image('three', 3, 'approved'),
  ]), /Más de dos/);
});

test('las URLs del catálogo pasan por la ruta estable de medios', () => {
  const previous = process.env.PUBLIC_MEDIA_ORIGIN;
  delete process.env.PUBLIC_MEDIA_ORIGIN;
  try {
    assert.equal(publicMediaUrl('guia-aves/001/01.webp'), 'https://xbnbfekcxrkgteuijbzh.supabase.co/storage/v1/object/public/guia-aves/001/01.webp');
    assert.equal(publicMediaUrl(null), null);
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_MEDIA_ORIGIN;
    else process.env.PUBLIC_MEDIA_ORIGIN = previous;
  }
});
