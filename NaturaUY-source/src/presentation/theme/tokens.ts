/**
 * Base design tokens.
 *
 * Derived from the original prototype's sage/forest palette, but every
 * foreground/background pair here is asserted against WCAG AA by
 * `scripts/07-verify.ts` and `src/shared/color/__tests__`. The prototype had
 * 9 of 17 pairs below 4.5:1 — notably the drawer, which is why the drawer is
 * now a deep forest surface in both themes instead of a bright yellow-green.
 */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceContainer: string;

  text: string;
  textSecondary: string;
  textMuted: string;

  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;

  border: string;
  outline: string;

  /**
   * The plane the app's chrome is built on — hero, drawer, navigation island,
   * in-game HUD. One token for all of them: they used to be three different
   * greens that never quite agreed with each other.
   *
   * Flat and unmodulated on purpose. A gradient wash sat here before and read
   * as decoration: depth should come from stacking planes, not from shading a
   * single one.
   */
  canvas: string;
  canvasText: string;
  canvasTextMuted: string;
  /** Row highlight inside the drawer. */
  canvasActive: string;
  /**
   * A hairline along the canvas edge. On a dark ground a drop shadow is
   * invisible, so the edge is what separates the plane from the page.
   */
  canvasBorder: string;

  /**
   * The one emphatic colour. It marks a single thing per screen — the primary
   * action, the selected tab, the one figure worth reading — and nothing else,
   * which is what keeps it meaning something.
   */
  accent: string;
  onAccent: string;

  navInactiveText: string;

  skeleton: string;
  skeletonHighlight: string;

  success: string;
  danger: string;
  onDanger: string;
  /** Amber accent — currently only the quiz's Contrarreloj mode. */
  warning: string;
  onWarning: string;

  /**
   * Two domain accents, one per cross-cutting feature rather than one per
   * decoration: saving and play each get a hue so the eye learns "this colour
   * is Juegos" the same way it already reads green as the brand. A third,
   * taxonomy orange, was tried across Descubrir's chips and didn't earn its
   * place — pulled rather than kept as an unused option.
   */
  /** Every filled heart — a saved species reads the same everywhere it appears. */
  favorite: string;
  onFavorite: string;
  /** The Juegos screen and the run itself: mode records, the HUD, lives. */
  play: string;
  onPlay: string;

  scrim: string;
}

export const lightColors: ThemeColors = {
  background: '#FBF2DC',
  surface: '#FFF9EA',
  surfaceVariant: '#EEE8D5',
  surfaceContainer: '#DCE6D5',

  text: '#293832',
  textSecondary: '#465A50',
  textMuted: '#5D6C64',

  primary: '#477052',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D8E7D3',
  onPrimaryContainer: '#294A3A',

  border: '#D7D5BE',
  outline: '#6C7B72',

  canvas: '#477052',
  canvasText: '#FFF9EA',
  canvasTextMuted: '#E4F0E3',
  canvasActive: '#47765E',
  canvasBorder: 'rgba(255,249,234,0.18)',

  accent: '#BDD0B7',
  onAccent: '#293832',

  navInactiveText: '#E4F0E3',

  skeleton: '#E9E2CF',
  skeletonHighlight: '#F9F2E1',

  success: '#1E6B43',
  danger: '#A32B32',
  onDanger: '#FFFFFF',
  warning: '#9A5B00',
  onWarning: '#FFFFFF',

  favorite: '#A83D66',
  onFavorite: '#FFFFFF',
  play: '#6E4E9E',
  onPlay: '#FFFFFF',

  scrim: 'rgba(12, 26, 20, 0.55)',
};

export const darkColors: ThemeColors = {
  /*
   * A strict ladder — page, then the chrome plane, then cards on top:
   *   background < canvas < surface < surfaceVariant < surfaceContainer
   * Without the gaps the navigation island and the hero dissolved into the
   * page, because a shadow contributes nothing on a dark ground.
   */
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

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  /** Reserved for the hero, whose lower corners curve far more than any card. */
  hero: 40,
  pill: 999,
} as const;

export interface ElevationStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  /** Android reads this instead of the four shadow* props. */
  elevation: number;
}

/**
 * Depth is what separates planes here — hairline borders were doing that job
 * alone, which is why every surface sat on one flat layer.
 *
 *  low    cards resting on the background
 *  medium a surface overlapping another plane (quick actions over the hero)
 *  high   the navigation island, which floats clear of everything
 */
export interface ElevationSet {
  low: ElevationStyle;
  medium: ElevationStyle;
  high: ElevationStyle;
}

export const lightElevation: ElevationSet = {
  low: { shadowColor: '#355847', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
  medium: { shadowColor: '#355847', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.11, shadowRadius: 18, elevation: 6 },
  high: { shadowColor: '#294A3A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 },
};

// A dark ground swallows a soft shadow, so these carry more opacity to read at all.
export const darkElevation: ElevationSet = {
  low: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.34, shadowRadius: 10, elevation: 3 },
  medium: { shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.46, shadowRadius: 20, elevation: 8 },
  high: { shadowColor: '#000000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.56, shadowRadius: 26, elevation: 14 },
};

/**
 * The tab bar no longer spans the full width, so screens can't rely on it
 * consuming layout height — they pad their scroll content by this much instead.
 */
export const NAV_ISLAND_HEIGHT = 62;
export const NAV_ISLAND_MARGIN = 14;

/** Shared geometry excluding the device safe-area inset, which is added at runtime. */
export const COLLAPSIBLE_HEADER_EXPANDED = 144;
// Keep the compact chrome comfortably taller than the 48 px menu/account
// targets. This leaves a small breathing band around the search field instead
// of making it look pinned against the collapsed header edges.
export const COLLAPSIBLE_HEADER_COLLAPSED = 68;
export const COLLAPSIBLE_HEADER_SCROLL_DISTANCE = COLLAPSIBLE_HEADER_EXPANDED - COLLAPSIBLE_HEADER_COLLAPSED;

/**
 * Manrope unifica toda la interfaz con una voz contemporánea, cálida y muy
 * legible. Los pesos explícitos conservan una jerarquía clara en Android sin
 * mezclar estilos editoriales con el contenido de catálogo.
 */
const HEADLINE_FONT = 'Manrope_700Bold';
const BODY_FONT = 'Manrope_400Regular';
const LABEL_FONT = 'Manrope_600SemiBold';
const EMPHASIS_FONT = 'Manrope_700Bold';

export const typography = {
  /**
   * The screen-opening statement. Set large with the leading pulled tighter
   * than the size, so a three-line headline reads as one block of type — that
   * density is what carries a screen without needing decoration behind it.
   */
  hero: { fontSize: 38, lineHeight: 41, fontFamily: HEADLINE_FONT, letterSpacing: -1.05 },
  display: { fontSize: 30, lineHeight: 36, fontFamily: HEADLINE_FONT, letterSpacing: -0.65 },
  title: { fontSize: 21, lineHeight: 28, fontFamily: HEADLINE_FONT, letterSpacing: -0.38 },
  headerTitle: { fontSize: 20, lineHeight: 26, fontFamily: HEADLINE_FONT, letterSpacing: -0.32 },
  cardTitle: { fontSize: 17, fontFamily: HEADLINE_FONT },
  body: { fontSize: 15, fontFamily: BODY_FONT, lineHeight: 23 },
  label: { fontSize: 13, fontFamily: LABEL_FONT },
  caption: { fontSize: 12, fontFamily: LABEL_FONT },
  eyebrow: { fontSize: 11, fontFamily: EMPHASIS_FONT, letterSpacing: 1.4 },
} as const;

/** Pairs that must hold at WCAG AA — asserted by tests and the data pipeline. */
export const CONTRAST_CONTRACT: { name: string; fg: keyof ThemeColors; bg: keyof ThemeColors }[] = [
  { name: 'body on background', fg: 'text', bg: 'background' },
  { name: 'body on surface', fg: 'text', bg: 'surface' },
  { name: 'secondary on background', fg: 'textSecondary', bg: 'background' },
  { name: 'secondary on surface', fg: 'textSecondary', bg: 'surface' },
  { name: 'muted on background', fg: 'textMuted', bg: 'background' },
  { name: 'muted on surface', fg: 'textMuted', bg: 'surface' },
  { name: 'muted on surfaceVariant', fg: 'textMuted', bg: 'surfaceVariant' },
  { name: 'text on surfaceVariant', fg: 'text', bg: 'surfaceVariant' },
  { name: 'text on surfaceContainer', fg: 'text', bg: 'surfaceContainer' },
  { name: 'onPrimary on primary', fg: 'onPrimary', bg: 'primary' },
  { name: 'onPrimaryContainer on primaryContainer', fg: 'onPrimaryContainer', bg: 'primaryContainer' },
  { name: 'canvas text', fg: 'canvasText', bg: 'canvas' },
  { name: 'canvas text on active row', fg: 'canvasText', bg: 'canvasActive' },
  { name: 'canvas muted text', fg: 'canvasTextMuted', bg: 'canvas' },
  { name: 'text on accent', fg: 'onAccent', bg: 'accent' },
  { name: 'nav inactive label', fg: 'navInactiveText', bg: 'canvas' },
  { name: 'success on surface', fg: 'success', bg: 'surface' },
  { name: 'danger on surface', fg: 'danger', bg: 'surface' },
  { name: 'onDanger on danger', fg: 'onDanger', bg: 'danger' },
  { name: 'warning on surface', fg: 'warning', bg: 'surface' },
  { name: 'onWarning on warning', fg: 'onWarning', bg: 'warning' },
  { name: 'favorite on surface', fg: 'favorite', bg: 'surface' },
  { name: 'onFavorite on favorite', fg: 'onFavorite', bg: 'favorite' },
  { name: 'play on surface', fg: 'play', bg: 'surface' },
  { name: 'onPlay on play', fg: 'onPlay', bg: 'play' },
];
