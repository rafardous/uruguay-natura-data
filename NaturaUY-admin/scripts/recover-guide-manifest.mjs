/** Recupera el manifiesto de objetos subidos, sin inventar originales de cámara. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source = resolve(import.meta.dirname, '../../NaturaUY-source');
const map = JSON.parse(readFileSync(resolve(source, 'data/guide-birds/assigned-media.json'), 'utf8'));
const rows = readFileSync(resolve(import.meta.dirname, '../data/guide-birds/aves_catalogo_para_correspondencias.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
const byCode = new Map(rows.map((row) => {
  const cells = row.match(/(?:"(?:[^"]|"")*"|[^,]*)(?:,|$)/g).filter((cell) => cell.length).map((cell) => cell.replace(/,$/, '').replace(/^"|"$/g, '').replaceAll('""', '"'));
  return [cells[1], cells[0]];
}));
const selected = Object.entries(map.species).flatMap(([code, photos]) => {
  const speciesId = byCode.get(code);
  if (!speciesId) throw new Error(`Falta UUID editorial: ${code}`);
  return photos.map((photo) => ({ number: Number(photo.path.split('/')[0]), ordinal: photo.ordinal, speciesId,
    original: photo.path, originalKind: 'uploaded-derived-webp', storagePath: `guia-aves/${photo.path}`,
    thumbnailPath: `guia-aves/${photo.thumbnail}`, mainSha256: photo.sha256, thumbnailSha256: photo.thumbnailSha256 }));
});
const output = resolve(source, '.expo/assigned-manifest.json');
writeFileSync(output, JSON.stringify({ schemaVersion: 1, bucket: map.bucket, recoveredFrom: 'data/guide-birds/assigned-media.json', selected }, null, 2));
console.log(JSON.stringify({ species: Object.keys(map.species).length, photos: selected.length, output }));
