import assert from 'node:assert/strict';
import { test } from 'node:test';

import { approvedImagesForSpecies, publicMediaUrl, selectPublishedSpecies } from './catalog-data';

const species = { id: 'bird-uuid', catalog_code: 'ave-ejemplo', primary_image_id: 'new-1' };
const image = (id: string, ordinal: number, status: string) => ({
  id, species_id: species.id, type: 'image', ordinal, status,
  storage_path: `guia-aves/001/0${ordinal}.webp`,
});

test('la selección publica 100 plantas sin alterar ni archivar las restantes', () => {
  const names = new Set(Array.from({ length: 100 }, (_, i) => `plant-${i}`));
  const rows = Array.from({ length: 3157 }, (_, i) => ({ id: i, scientific_name: `plant-${i}`, kingdom: 'Plantae', status: 'active' }));
  const bird = { id: 'bird', kingdom: 'Animalia', status: 'active' };
  const selected = selectPublishedSpecies([...rows, bird], names);
  assert.equal(selected.length, 101);
  assert.ok(selected.includes(bird));
  assert.equal(rows.filter((row) => row.status === 'active').length, 3157);
  assert.throws(() => selectPublishedSpecies(rows.slice(1), names), /incompleta/);
});

test('la publicación ignora las fotos archivadas y conserva el orden nuevo', () => {
  const selected = approvedImagesForSpecies(species, [
    image('old', 1, 'archived'), image('new-2', 2, 'approved'), image('new-1', 1, 'approved'),
  ]);
  assert.deepEqual(selected.images.map((item) => item.id), ['new-1', 'new-2']);
  assert.equal(selected.primary?.id, 'new-1');
});

test('la publicación admite tres fotos y rechaza una cuarta', () => {
  assert.equal(approvedImagesForSpecies(species, [image('one',1,'approved'),image('two',2,'approved'),image('three',3,'approved')]).images.length,3);
  assert.throws(() => approvedImagesForSpecies(species, [
    image('one', 1, 'approved'), image('two', 2, 'approved'), image('three', 3, 'approved'), image('four', 4, 'approved'),
  ]), /Más de tres/);
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
