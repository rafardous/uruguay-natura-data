import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arthropodTargets, publishableCandidate } from './05b-arthropod-media';
import type { CatalogImage } from './lib';

test('incluye los tres grupos, usa nombres aceptados y rechaza duplicados', () => {
  const sample = {
    Arachnida: [{ scientificName: 'Ejemplo viejo', acceptedName: 'Ejemplo aceptado', taxonomy: { class: 'Arachnida' } }],
    Insecta: [{ scientificName: 'Insecto ejemplo', taxonomy: { class: 'Insecta' } }],
    Malacostraca: [{ scientificName: 'Crustáceo ejemplo', taxonomy: { class: 'Malacostraca' } }],
  };
  const targets = arthropodTargets(sample);
  assert.deepEqual([...targets.keys()], ['Ejemplo aceptado', 'Insecto ejemplo', 'Crustáceo ejemplo']);
  assert.deepEqual(targets.get('Ejemplo aceptado')?.names, ['Ejemplo viejo']);
  assert.throws(() => arthropodTargets({ ...sample, Insecta: [{ scientificName: 'Insecto ejemplo', acceptedName: 'Ejemplo aceptado', taxonomy: { class: 'Insecta' } }] }), /duplicado/);
});

test('sólo propone medios con tamaño y licencia exacta publicables', () => {
  const image = {
    url: 'https://example.org/example.webp', fullUrl: 'https://example.org/example.webp',
    license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'Autor', source: 'inaturalist', sourcePage: null, width: 1600, height: 1200,
  } satisfies CatalogImage;
  assert.equal(publishableCandidate(image), true);
  assert.equal(publishableCandidate({ ...image, width: 800, height: 700 }), false);
  assert.equal(publishableCandidate({ ...image, licenseUrl: 'https://creativecommons.org/licenses/by/3.0/' }), false);
});
