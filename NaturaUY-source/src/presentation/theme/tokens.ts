

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

  canvas: string;
  canvasText: string;
  canvasTextMuted: string;

  canvasActive: string;

  canvasBorder: string;

  accent: string;
  onAccent: string;

  navInactiveText: string;

  skeleton: string;
  skeletonHighlight: string;

  success: string;
  danger: string;
  onDanger: string;

  warning: string;
  onWarning: string;

  favorite: string;
  onFavorite: string;

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

  hero: 40,
  pill: 999,
} as const;

export interface ElevationStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;

  elevation: number;
}

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

export const NAV_ISLAND_HEIGHT = 80;
export const NAV_ISLAND_MARGIN = 14;

export const COLLAPSIBLE_HEADER_EXPANDED = 144;
// Keep the compact chrome comfortably taller than the 48 px menu/account
// targets. This leaves a small breathing band around the search field instead
// of making it look pinned against the collapsed header edges.
export const COLLAPSIBLE_HEADER_COLLAPSED = 68;
export const COLLAPSIBLE_HEADER_SCROLL_DISTANCE = COLLAPSIBLE_HEADER_EXPANDED - COLLAPSIBLE_HEADER_COLLAPSED;

const HEADLINE_FONT = 'Manrope_700Bold';
const BODY_FONT = 'Manrope_400Regular';
const LABEL_FONT = 'Manrope_600SemiBold';
const EMPHASIS_FONT = 'Manrope_700Bold';

export const typography = {

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
