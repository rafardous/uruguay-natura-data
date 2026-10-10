/** Public, reproducible lookup for the mobile catalogue; no image bytes or private evidence. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = process.argv[2] ?? resolve(homedir(), 'Pictures/NaturaUY/assigned-manifest.json');
const mappingPath = resolve(root, 'data/guide-birds/aves_catalogo_para_correspondencias.csv');
const outputPath = resolve(root, '../NaturaUY-source/data/guide-birds/assigned-media.json');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || !manifest.selected?.length) throw new Error('Manifiesto de fotos inesperado');
const csv = await readFile(mappingPath, 'utf8');
const codes = new Map([...csv.matchAll(/^"([0-9a-f-]{36})","([^"]+)",/gm)].map((row) => [row[1], row[2]]));
const selected = new Map();
for (const row of manifest.selected) {
  const catalogCode = codes.get(row.speciesId);
  if (!catalogCode || !/^guia-aves\/\d{3}\/0[12]\.webp$/.test(row.storagePath)
    || !/^guia-aves\/\d{3}\/0[12]-480\.webp$/.test(row.thumbnailPath)) throw new Error(`Correspondencia inválida: ${row.number}`);
  const photos = selected.get(catalogCode) ?? [];
  photos.push({ ordinal: row.ordinal, path: row.storagePath.slice('guia-aves/'.length), thumbnail: row.thumbnailPath.slice('guia-aves/'.length), sha256: row.mainSha256, thumbnailSha256: row.thumbnailSha256 });
  selected.set(catalogCode, photos);
}
if ([...selected.values()].some((photos) => photos.length < 1 || photos.length > 2 || new Set(photos.map((photo) => photo.ordinal)).size !== photos.length))
  throw new Error('Cantidad de aves asignadas inválida');
const species = Object.fromEntries([...selected].sort(([a], [b]) => a.localeCompare(b)).map(([code, photos]) => [code, photos.sort((a, b) => a.ordinal - b.ordinal)]));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, bucket: 'guia-aves', species }, null, 2)}\n`);
console.log(`Mapa de Storage: ${selected.size} aves, ${manifest.selected.length} fotos`);
