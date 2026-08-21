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

import { contrastRatio, AA_NORMAL } from '../../src/shared/color/contrast';
import { darkColors, lightColors } from '../../src/presentation/theme/tokens';
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

const LIGHT_SURFACE = lightColors.surface;
const DARK_SURFACE = darkColors.surface;

/** Walks `tones` in order and returns the first that clears `min` against `bg`. */
function firstReadableTone(palette: TonalPalette, tones: number[], bg: string, min = AA_NORMAL): string {
  for (const tone of tones) {
    const hex = hexFromArgb(palette.tone(tone));
    if (contrastRatio(hex, bg) >= min) return hex;
  }
  // Tone 0 is black and tone 100 is white, so one end always satisfies any
  // ratio against a mid surface; this is a safety net for impossible inputs.
  const fallback = hexFromArgb(palette.tone(tones.at(-1)! < 50 ? 0 : 100));
  return fallback;
}

const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v);
  return out;
};

export function buildPalette(seedHex: string): PaletteRecord {
  const hct = Hct.fromInt(argbFromHex(seedHex));
  const chroma = Math.min(MAX_CHROMA, Math.max(MIN_CHROMA, hct.chroma));
  const ramp = TonalPalette.fromHueAndChroma(hct.hue, chroma);
  const soft = TonalPalette.fromHueAndChroma(hct.hue, Math.min(chroma, CONTAINER_CHROMA));

  // Start vivid and darken only as far as legibility demands.
  const accentLight = firstReadableTone(ramp, range(52, 8, -4), LIGHT_SURFACE);
  const accentDark = firstReadableTone(ramp, range(60, 96, 4), DARK_SURFACE);

  const containerLight = hexFromArgb(soft.tone(90));
  const onContainerLight = firstReadableTone(ramp, range(40, 0, -4), containerLight);

  const containerDark = hexFromArgb(soft.tone(28));
  const onContainerDark = firstReadableTone(ramp, range(80, 100, 4), containerDark);

  return {
    seed: seedHex,
    accentLight,
    accentDark,
    containerLight,
    onContainerLight,
    containerDark,
    onContainerDark,
  };
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
