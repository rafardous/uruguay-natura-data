import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzePhotos, parseMapping, selectPhotos } from './guide-photo-selection.mjs';
import { ensureOwnerAttestation, mediaId, ownerAttestationPath, planGuidePhotoUploads, selectReviewedPhotos, storagePath, summarizeGuidePlan } from './import-guide-photos.mjs';

const files = (names) => names.map((relativePath) => ({ path: relativePath, relativePath }));

test('registra la declaración del titular en bucket privado y la reutiliza sin duplicarla', async () => {
  const uploadedBy = '123e4567-e89b-42d3-a456-426614174000';
  const path = ownerAttestationPath('Pedro Rinaldi', uploadedBy);
  assert.match(path, /^declaraciones\/guia-aves-[0-9a-f]{32}\.txt$/);
  let saved = null;
  let uploads = 0;
  const client = { storage: { from(bucket) {
    assert.equal(bucket, 'media-evidence');
    return {
      async download(requestedPath) {
        assert.equal(requestedPath, path);
        return saved
          ? { data: new Blob([saved]), error: null }
          : { data: null, error: { statusCode: '404', message: 'Object not found' } };
      },
      async upload(requestedPath, body, options) {
        assert.equal(requestedPath, path);
        assert.equal(options.contentType, 'text/plain');
        assert.equal(options.upsert, false);
        saved = body;
        uploads += 1;
        return { error: null };
      },
    };
  } } };
  await ensureOwnerAttestation(client, path, 'Pedro Rinaldi', uploadedBy);
  await ensureOwnerAttestation(client, path, 'Pedro Rinaldi', uploadedBy);
  assert.equal(uploads, 1);
  assert.match(saved.toString(), /Declaración:.*Pedro Rinaldi/);
  await assert.rejects(() => ensureOwnerAttestation(client, path, 'Otro autor', uploadedBy), /no coincide/);
});

test('prioriza base, luego variantes menores, limita a dos e ignora 436', () => {
  assert.deepEqual(selectPhotos(files(['2 (3).jpg', '1 (2).jpg', '436.jpg', '2 (1).jpg', '1.jpg', '1 (1).jpg', 'bird-3.jpg'])).map(({ number, variant }) => [number, variant]), [[1, 0], [1, 1], [2, 1], [2, 3]]);
});

test('aborta ante imágenes ambiguas en carpetas o extensiones distintas', () => {
  assert.throws(() => selectPhotos(files(['a/1.jpg', 'b/1.png'])), /ambigua/);
});

test('el análisis conserva la ambigüedad sin seleccionar ese número', () => {
  const result = analyzePhotos(files(['75.jpeg', '75.JPG', '75 (1).jpg', '76.jpg']));
  assert.deepEqual(result.ambiguities, [{ number: 75, variant: 0, files: ['75.jpeg', '75.JPG'] }]);
  assert.deepEqual(result.selected.map(({ number, ordinal }) => [number, ordinal]), [[76, 1]]);
});

test('la elección revisada resuelve sólo la foto ambigua indicada', () => {
  const result = analyzePhotos(files(['75.jpeg', '75.JPG', '75 (1).jpg', '76.jpg']), { '75:0': '75.jpeg' });
  assert.deepEqual(result.ambiguities, []);
  assert.deepEqual(result.selected.map(({ number, ordinal, relativePath }) => [number, ordinal, relativePath]), [[75, 1, '75.jpeg'], [75, 2, '75 (1).jpg'], [76, 1, '76.jpg']]);
  assert.throws(() => analyzePhotos(files(['75.jpeg', '75.JPG']), { '75:0': '75.png' }), /no coincide/);
});

test('acepta únicamente vínculos UUID revisados de forma individual', () => {
  assert.equal(parseMapping('numero_guia,species_id,revisado\n1,123e4567-e89b-42d3-a456-426614174000,si\n2,,no\n').get(2), null);
  assert.throws(() => parseMapping('numero_guia,species_id,revisado\n1,,si'), /UUID válido/);
  assert.throws(() => parseMapping('numero_guia,species_id,revisado\n1,123e4567-e89b-42d3-a456-426614174000,no'), /no está revisado/);
});

test('genera IDs y rutas estables por número y ordinal', () => {
  assert.equal(mediaId(1, 1), mediaId(1, 1));
  assert.match(mediaId(1, 1), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(storagePath(1, 1), 'guia-aves/001/01.webp');
  assert.equal(storagePath(435, 2, true), 'guia-aves/435/02-480.webp');
});

const selected = (number) => [
  { number, ordinal: 1, original: `${number}.JPG` },
  { number, ordinal: 2, original: `${number} (1).JPG` },
];
const speciesId = '123e4567-e89b-42d3-a456-426614174000';
const mapping = (number) => new Map([[number, speciesId]]);
const prior = (number, ordinal, original, status = 'approved') => ({
  id: mediaId(number, ordinal), species_id: speciesId, type: 'image', ordinal, original_filename: original, status,
});

test('sin medios previos prepara las dos fotos en orden', () => {
  const plan = planGuidePhotoUploads(selected(97), mapping(97), []);
  assert.deepEqual(plan.planned.map(({ item }) => [item.original, item.ordinal, item.storagePath]), [
    ['97.JPG', 1, 'guia-aves/097/01.webp'],
    ['97 (1).JPG', 2, 'guia-aves/097/02.webp'],
  ]);
  assert.equal(plan.skipped.length, 0);
});

test('un medio reservado será archivado y no reduce el cupo nuevo', () => {
  const existing = [{ id: 'other', species_id: speciesId, type: 'image', ordinal: 1, status: 'reserved' }];
  const plan = planGuidePhotoUploads(selected(97).reverse(), mapping(97), existing);
  assert.deepEqual(plan.planned.map(({ item }) => [item.original, item.ordinal, item.storagePath]), [
    ['97.JPG', 1, 'guia-aves/097/01.webp'],
    ['97 (1).JPG', 2, 'guia-aves/097/02.webp'],
  ]);
  assert.equal(plan.skipped.length, 0);
});

test('dos medios activos anteriores se sustituyen sin superar dos nuevos', () => {
  const existing = [1, 2].map((ordinal) => ({ id: `other-${ordinal}`, species_id: speciesId, type: 'image', ordinal, status: 'approved' }));
  const plan = planGuidePhotoUploads(selected(413), mapping(413), existing);
  assert.equal(plan.planned.length, 2);
  assert.equal(plan.skipped.length, 0);
});

test('repetir la carga conserva las fotos ya importadas y su ruta', () => {
  const first = planGuidePhotoUploads(selected(97), mapping(97), [
    { id: 'reserved', species_id: speciesId, type: 'image', ordinal: 1, status: 'reserved' },
  ]);
  const existing = [
    { id: 'reserved', species_id: speciesId, type: 'image', ordinal: 1, status: 'reserved' },
    prior(97, 1, '97.JPG'),
  ];
  const repeated = planGuidePhotoUploads(selected(97), mapping(97), existing);
  assert.deepEqual(repeated.planned, [
    { ...first.planned[0], alreadyRegistered: true },
    first.planned[1],
  ]);
  assert.equal(repeated.skipped.length, 0);
});

test('un medio propio archivado exige revisión manual antes de reactivarlo', () => {
  assert.throws(() => planGuidePhotoUploads(selected(97), mapping(97), [prior(97, 1, '97.JPG', 'archived')]), /otra selección o estado/);
});

test('un medio previamente importado incompatible bloquea la repetición', () => {
  assert.throws(() => planGuidePhotoUploads(selected(97), mapping(97), [prior(97, 1, 'otra.JPG')]), /otra selección o estado/);
});

test('omite los números sin UUID revisado antes de planificar la carga', () => {
  const result = selectReviewedPhotos([...selected(97), ...selected(108)], mapping(97));
  assert.deepEqual(result.selected.map(({ number }) => number), [97, 97]);
  assert.deepEqual(result.reviewedNumbers, [97]);
  assert.deepEqual(result.missingNumbers, [108]);
});

test('el plan local cuenta sólo fotos con vínculo revisado sin inventar una segunda', () => {
  const rows = [
    ...selected(97),
    { number: 98, ordinal: 1, original: '98.JPG' },
    { number: 99, ordinal: 1, original: '99.JPG' },
  ].map((item) => ({ ...item, storagePath: storagePath(item.number, item.ordinal),
    thumbnailPath: storagePath(item.number, item.ordinal, true), mainBytes: 1024, thumbnailBytes: 512 }));
  const plan = summarizeGuidePlan({ selected: rows }, new Map([
    [97, speciesId], [98, '123e4567-e89b-42d3-a456-426614174001'], [99, null],
  ]));
  assert.equal(plan.reviewedNumbers, 2);
  assert.equal(plan.selectedPhotos, 3);
  assert.deepEqual(plan.numbersWithOnePhoto, [98]);
  assert.deepEqual(plan.numbersWithoutReviewedLink, [99]);
});
