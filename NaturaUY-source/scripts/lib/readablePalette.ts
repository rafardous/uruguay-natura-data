import { contrastRatio, AA_NORMAL } from '../../src/shared/color/contrast';
import { lightColors, type ThemeColors } from '../../src/presentation/theme/tokens';
import type { PaletteRecord } from './types';

const darkColors: ThemeColors = {
  background: '#0F1913',
  surface: '#26332C',
  surfaceVariant: '#2F3D35',
  surfaceContainer: '#38473E',

  text: '#E9F0E7',
  textSecondary: '#BCC9BE',
  textMuted: '#A2B1A5',

  primary: '#9CCBAC',
  onPrimary: '#0B1F16',
  primaryContainer: '#2B4A3A',
  onPrimaryContainer: '#CFE9D6',

  border: '#2F3D35',
  outline: '#8B9A90',

  canvas: '#1A2B21',
  canvasText: '#EDF3E8',
  canvasTextMuted: '#A2B1A5',
  canvasActive: '#26392E',
  canvasBorder: 'rgba(237,243,232,0.14)',

  accent: '#9CCBAC',
  onAccent: '#0E2318',

  navInactiveText: '#A2B1A5',

  skeleton: '#212D25',
  skeletonHighlight: '#2B3830',

  success: '#7FCB9C',
  danger: '#F2A0A0',
  onDanger: '#3A0A0C',
  warning: '#E8B04D',
  onWarning: '#241400',

  favorite: '#E8A0BE',
  onFavorite: '#3A1524',
  play: '#C3A8E0',
  onPlay: '#2A1B42',

  scrim: 'rgba(0, 0, 0, 0.6)',
};

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
