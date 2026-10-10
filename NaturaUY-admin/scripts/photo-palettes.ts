import { createHash } from 'node:crypto';
import { Hct, TonalPalette, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { Vibrant } from 'node-vibrant/node';
import sharp from 'sharp';
import { buildPaletteFromRamps } from '../../NaturaUY-source/scripts/lib/readablePalette';
import type { PaletteRecord } from '../../NaturaUY-source/scripts/lib/types';
import type { CatalogRecord } from './catalog-data';
import { adminClient } from './shared';

export interface PhotoPalette {
  mediaId: string | null;
  thumbnailPath: string | null;
  sha256: string | null;
  basis: 'photo' | 'family';
  colors: PaletteRecord;
}

export function paletteForSeed(seed: string): PaletteRecord {
  const color = Hct.fromInt(argbFromHex(seed));
  const chroma = Math.min(76, Math.max(26, color.chroma));
  const ramp = TonalPalette.fromHueAndChroma(color.hue, chroma);
  const soft = TonalPalette.fromHueAndChroma(color.hue, 18);
  return buildPaletteFromRamps(seed, { hexAt: (tone) => hexFromArgb(ramp.tone(tone)) }, { hexAt: (tone) => hexFromArgb(soft.tone(tone)) });
}

export async function paletteForImage(bytes: Uint8Array): Promise<PaletteRecord> {
  const png = await sharp(bytes).resize(160, 160, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const swatches = await Vibrant.from(png).getPalette();
  const swatch = [swatches.Vibrant, swatches.LightVibrant, swatches.DarkVibrant, swatches.Muted, swatches.DarkMuted, swatches.LightMuted].find(Boolean);
  if (!swatch) throw new Error('No se pudo extraer el color de la foto principal');
  return paletteForSeed(swatch.hex);
}

function familySeed(name: string): string {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) { hash ^= name.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hexFromArgb(Hct.from((hash >>> 0) % 360, 42, 50).toInt());
}

/** Derived presentation data. Never changes editorial content or media approval. */
export async function derivePhotoPalettes(items: CatalogRecord[]): Promise<void> {
  const client = adminClient();
  const pending = [...items];
  let completed = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let item = pending.shift(); item; item = pending.shift()) {
      const path = item.image?.thumbnail_path ?? item.image?.storage_path ?? null;
      if (!path) {
        item.photoPalette = { mediaId: null, thumbnailPath: null, sha256: null, basis: 'family', colors: paletteForSeed(familySeed(String(item.species.family || 'desconocida'))) };
      } else {
        const guide = String(path).startsWith('guia-aves/');
        const { data, error } = await client.storage.from(guide ? 'guia-aves' : 'media-public').download(guide ? String(path).slice('guia-aves/'.length) : String(path));
        if (error || !data) throw new Error(`No se pudo leer la miniatura aprobada ${item.species.catalog_code}: ${error?.message}`);
        const bytes = new Uint8Array(await data.arrayBuffer());
        item.photoPalette = { mediaId: String(item.image!.id), thumbnailPath: String(path), sha256: createHash('sha256').update(bytes).digest('hex'), basis: 'photo', colors: await paletteForImage(bytes) };
      }
      if (++completed % 200 === 0) console.log(`Paletas: ${completed}/${items.length}`);
    }
  }));
}
