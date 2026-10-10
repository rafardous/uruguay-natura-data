import { contrastRatio, AA_NORMAL } from '../../src/shared/color/contrast';
import { darkColors, lightColors } from '../../src/presentation/theme/tokens';
import type { PaletteRecord } from './types';

export interface ToneRamp { hexAt: (tone: number) => string }
const LIGHT_SURFACE = lightColors.surface;
const DARK_SURFACE = darkColors.surface;

function firstReadableTone(palette: ToneRamp, tones: number[], bg: string, min = AA_NORMAL): string {
  for (const tone of tones) {
    const hex = palette.hexAt(tone);
    if (contrastRatio(hex, bg) >= min) return hex;
  }
  // Tone 0 is black and tone 100 is white, so one end always satisfies any
  // ratio against a mid surface; this is a safety net for impossible inputs.
  const fallback = palette.hexAt(tones.at(-1)! < 50 ? 0 : 100);
  return fallback;
}

const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) out.push(v);
  return out;
};

export function buildPaletteFromRamps(seedHex: string, ramp: ToneRamp, soft: ToneRamp): PaletteRecord {

  // Start vivid and darken only as far as legibility demands.
  const accentLight = firstReadableTone(ramp, range(52, 8, -4), LIGHT_SURFACE);
  const accentDark = firstReadableTone(ramp, range(60, 96, 4), DARK_SURFACE);

  const containerLight = soft.hexAt(90);
  const onContainerLight = firstReadableTone(ramp, range(40, 0, -4), containerLight);

  const containerDark = soft.hexAt(28);
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

