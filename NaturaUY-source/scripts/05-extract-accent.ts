/**
 * Stage 05 — derive each species' accent palette from its own photo.
 *
 * The seed comes from the bundled thumbnail (already local, so this stage is
 * offline and fast). Species without a photo fall back to a hue derived from
 * their family, so the catalogue still looks deliberate rather than grey.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { Vibrant } from 'node-vibrant/node';
import sharp from 'sharp';

import { JsonCache, readJson, writeJson } from './lib/cache';
import { buildPalette, seedFromFamily } from './lib/palette';
import { ensureDirs, PATHS } from './lib/paths';
import type { NormalizedSpecies, PaletteRecord } from './lib/types';

const CONCURRENCY = 6;

/** Thrown when a thumbnail exists but no colour could be read from it. */
class ExtractionFailure extends Error {}

/**
 * Prefers a swatch with real colour over the merely most-populous one: for a
 * photo of a grey fish on grey gravel, Vibrant beats DominantMuted every time.
 *
 * Vibrant cannot decode WebP ("Unsupported MIME type"), so sharp decodes to PNG
 * first. Without this every seed silently fell back to the family hue.
 */
async function seedFromThumb(file: string): Promise<string> {
  const png = await sharp(file).png().toBuffer();
  const palette = await Vibrant.from(png).getPalette();

  const ordered = [
    palette.Vibrant,
    palette.LightVibrant,
    palette.DarkVibrant,
    palette.Muted,
    palette.DarkMuted,
    palette.LightMuted,
  ];

  for (const swatch of ordered) {
    if (swatch) return swatch.hex;
  }

  throw new ExtractionFailure(`no swatch in ${file}`);
}

async function main(): Promise<void> {
  ensureDirs();

  const species = readJson<NormalizedSpecies[]>(resolve(PATHS.out, 'species.json'));
  // código -> on-disk asset name, which is not simply the código (see assetNames).
  const thumbs = readJson<Record<string, string>>(resolve(PATHS.out, 'thumbs.json'));
  const cache = new JsonCache<PaletteRecord>('palettes');

  const pending = species.filter((s) => !cache.has(s.codigo));
  console.log(`05-extract-accent: ${pending.length} palettes to build`);

  let fromPhoto = 0;
  let noThumb = 0;
  const failures: string[] = [];
  let done = 0;
  const queue = [...pending];

  const worker = async (): Promise<void> => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;

      const assetName = thumbs[item.codigo];
      const thumb = assetName ? resolve(PATHS.thumbs, `${assetName}.webp`) : null;
      let seed: string | null = null;

      if (thumb && existsSync(thumb)) {
        try {
          seed = await seedFromThumb(thumb);
          fromPhoto++;
        } catch (error) {
          // A thumbnail that exists but yields no colour is a real defect, not
          // an expected miss, so it gets reported rather than swallowed.
          failures.push(`${item.codigo}: ${(error as Error).message}`);
        }
      } else {
        noThumb++;
      }

      cache.set(item.codigo, buildPalette(seed ?? seedFromFamily(item.familia)));

      if (++done % 250 === 0) console.log(`  ${done}/${pending.length}`);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  cache.flush();

  writeJson(resolve(PATHS.out, 'palettes.json'), Object.fromEntries(cache.entries()));

  console.log(`  ${fromPhoto} seeded from photo, ${noThumb} from family hue (no thumbnail)`);

  if (failures.length > 0) {
    console.error(`  ${failures.length} thumbnail(s) failed to yield a colour:`);
    for (const failure of failures.slice(0, 10)) console.error(`    ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
