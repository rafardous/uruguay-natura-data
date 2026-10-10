/** Verifica el bucket público y prioriza fotos familiares sólo cuando ambos derivados son íntegros. */
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';

import { PATHS, readJson, writeJson, type CatalogImage } from './lib';

interface AssignedPhoto { ordinal: number; path: string; thumbnail: string; sha256: string; thumbnailSha256: string }
interface AssignedMap { schemaVersion: number; bucket: string; species: Record<string, AssignedPhoto[]> }
const project = 'xbnbfekcxrkgteuijbzh';
const origin = `https://${project}.supabase.co/storage/v1/object/public/guia-aves`;
const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');

async function download(path: string, expectedHash: string): Promise<Buffer | null> {
  if (!/^\d{3}\/0[12](?:-480)?\.webp$/.test(path) || !/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error(`Ruta o hash inválido: ${path}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${origin}/${path}`, { signal: AbortSignal.timeout(30_000) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Storage HTTP ${response.status}: ${path}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (sha256(body) !== expectedHash) throw new Error(`SHA-256 incorrecto: ${path}`);
      return body;
    } catch (error) {
      if (String(error).includes('SHA-256') || attempt === 2) throw error;
      await new Promise((done) => setTimeout(done, 500 * 2 ** attempt));
    }
  }
  throw new Error(`No se pudo consultar ${path}`);
}

export async function verifiedGuidePhoto(photo: AssignedPhoto): Promise<CatalogImage | null> {
  const [main, thumb] = await Promise.all([download(photo.path, photo.sha256), download(photo.thumbnail, photo.thumbnailSha256)]);
  if (!main || !thumb) return null;
  const metadata = await sharp(main).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`WebP inválido: ${photo.path}`);
  const fullUrl = `${origin}/${photo.path}`;
  return {
    url: `${origin}/${photo.thumbnail}`, fullUrl, license: 'permission', attribution: 'Pedro Rinaldi',
    source: 'family', sourcePage: fullUrl, width: metadata.width, height: metadata.height,
    externalId: `guide:${photo.path}`, approvalStatus: 'approved',
    selectionDetails: { storageVerified: true, storagePath: photo.path }, retrievedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const map = readJson<AssignedMap>(resolve(PATHS.catalog, '../guide-birds/assigned-media.json'));
  if (map.schemaVersion !== 1 || map.bucket !== 'guia-aves') throw new Error('Mapa de aves incompatible');
  const codes = Object.keys(map.species);
  const birds = readJson<Array<{ catalogCode: string }>>(resolve(PATHS.catalog, 'aves.json'));
  const birdCodes = new Set(birds.map((item) => item.catalogCode));
  if (codes.some((code) => !birdCodes.has(code))) throw new Error('Mapa familiar contiene aves ausentes del catálogo local');
  const verified: Record<string, CatalogImage[]> = {};
  const missing: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < codes.length) {
      const code = codes[next++]!;
      const photos = map.species[code]!;
      if (!photos.length || photos.length > 2 || photos.some((photo, index) => photo.ordinal !== index + 1)) throw new Error(`Cupos inválidos: ${code}`);
      const results = await Promise.all(photos.map(verifiedGuidePhoto));
      const found = results.filter((image): image is CatalogImage => image !== null);
      if (found.length) verified[code] = found;
      if (found.length !== photos.length) missing.push(code);
    }
  }));
  writeJson(resolve(PATHS.cache, 'media/guide-bird-media.json'), { schemaVersion: 1, bucket: 'guia-aves', verifiedAt: new Date().toISOString(), species: verified, missing });
  console.log(`Guía de aves: ${Object.keys(verified).length}/${codes.length} especies con fotos verificadas; ${missing.length} con objetos faltantes`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
