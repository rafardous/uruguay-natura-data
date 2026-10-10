/**
 * Turns a seed colour into a set of contrast-safe tones.
 *
 * The prototype stored the raw dominant colour and used it as text — which is
 * exactly why its accents measured 3.77:1 and 3.79:1, below AA. Here the seed
 * only decides *hue and chroma*; the tone is then chosen by walking the tonal
 * ramp until the pair actually passes 4.5:1 against the real surface colour.
 * That makes legibility a property of the algorithm, not a thing to hope for.
 */
import { Hct, TonalPalette, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

import { buildPaletteFromRamps } from './readablePalette';
import type { PaletteRecord } from './types';

/** Below this, washed-out photos would yield near-grey accents with no identity. */
const MIN_CHROMA = 26;
/** Above this, accents start to look neon against the muted green shell. */
const MAX_CHROMA = 76;

/**
 * Containers are large filled areas — chip backgrounds, and the ground behind a
 * placeholder glyph. At the accent's own chroma a cyan or yellow hue turns
 * fluorescent at tone 90, which is precisely the "too bright" quality this
 * redesign set out to remove. They therefore come off a desaturated ramp.
 */
const CONTAINER_CHROMA = 18;

export function buildPalette(seedHex: string): PaletteRecord {
  const hct = Hct.fromInt(argbFromHex(seedHex));
  const chroma = Math.min(MAX_CHROMA, Math.max(MIN_CHROMA, hct.chroma));
  const ramp = TonalPalette.fromHueAndChroma(hct.hue, chroma);
  const soft = TonalPalette.fromHueAndChroma(hct.hue, Math.min(chroma, CONTAINER_CHROMA));
  return buildPaletteFromRamps(seedHex, { hexAt: (tone) => hexFromArgb(ramp.tone(tone)) }, { hexAt: (tone) => hexFromArgb(soft.tone(tone)) });
}

/** Stable 32-bit string hash, so a family always lands on the same hue. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Seed for species with no photo. Keyed on family so an entire family shares a
 * hue and the grid still reads as organised rather than random.
 */
export function seedFromFamily(familia: string): string {
  const hue = hashString(familia || 'desconocida') % 360;
  return hexFromArgb(Hct.from(hue, 42, 50).toInt());
}
