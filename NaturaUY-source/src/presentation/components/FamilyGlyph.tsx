import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

/**
 * A silhouette standing in for a species' photo, tinted with its own accent.
 *
 * One component, two jobs:
 *  - the shape inside a loading skeleton, so a card never flashes empty; and
 *  - the permanent fallback for species with no freely licensed photograph.
 *
 * Keyed on taxonomic class, which covers all 2021 records with 15 shapes.
 */

type GlyphKey =
  | 'bird'
  | 'fish'
  | 'shark'
  | 'mammal'
  | 'reptile'
  | 'amphibian'
  | 'leaf'
  | 'grass'
  | 'fern'
  | 'conifer'
  | 'snail'
  | 'shell'
  | 'spider'
  | 'insect'
  | 'crab'
  | 'generic';

/** Every class present in the SNAP dataset, plus a catch-all. */
const CLASS_TO_GLYPH: Record<string, GlyphKey> = {
  Aves: 'bird',
  Actinopterygii: 'fish',
  Chondrichthyes: 'shark',
  Mammalia: 'mammal',
  Reptilia: 'reptile',
  Amphibia: 'amphibian',
  Magnoliopsida: 'leaf',
  Liliopsida: 'grass',
  Polypodiopsida: 'fern',
  Lycopodiopsida: 'fern',
  Pinopsida: 'conifer',
  Gnetopsida: 'conifer',
  Gastropoda: 'snail',
  Bivalvia: 'shell',
  Arachnida: 'spider',
  Insecta: 'insect',
  Malacostraca: 'crab',
  Polychaeta: 'generic',
  Ascidiacea: 'generic',
  Gymnolaemata: 'generic',
};

export const glyphForClass = (clase: string): GlyphKey => CLASS_TO_GLYPH[clase] ?? 'generic';

/** Paths are drawn in a 64x64 box and scaled by the `size` prop. */
function GlyphShape({ glyph, color }: { glyph: GlyphKey; color: string }): React.JSX.Element {
  switch (glyph) {
    case 'bird':
      return (
        <G fill={color}>
          <Path d="M40 16c-7 0-13 5-14 12l-13 7c-1 1-1 2 0 3l9 3 3 10c0 2 2 2 3 1l6-9c9-1 16-8 16-17V16l6-5-9 1-2-4-3 6z" />
          <Circle cx="42" cy="20" r="1.8" fill="#fff" opacity={0.9} />
        </G>
      );
    case 'fish':
      return (
        <G fill={color}>
          <Path d="M8 32c6-9 16-14 25-14s16 5 19 14c-3 9-10 14-19 14S14 41 8 32z" />
          <Path d="M52 32l8-8v16l-8-8z" />
          <Circle cx="22" cy="29" r="2" fill="#fff" opacity={0.9} />
        </G>
      );
    case 'shark':
      return (
        <G fill={color}>
          <Path d="M6 36c8-10 20-15 30-15 4 0 8 1 11 3l3-12 5 14c3 3 5 6 5 10-9 6-20 9-30 9-9 0-17-3-24-9z" />
          <Circle cx="20" cy="32" r="2" fill="#fff" opacity={0.9} />
        </G>
      );
    case 'mammal':
      return (
        <G fill={color}>
          <Path d="M14 26c0-4 3-7 7-7h18c5 0 9 4 9 9v6c0 3-2 5-4 6l1 8h-4l-2-7H23l-2 7h-4l1-8c-3-1-4-3-4-6z" />
          <Path d="M48 24l6-6 1 8-4 3zM16 22l-5-5v8l4 2z" />
          <Circle cx="45" cy="27" r="1.8" fill="#fff" opacity={0.9} />
        </G>
      );
    case 'reptile':
      return (
        <G fill={color}>
          <Path d="M10 40c0-6 6-9 13-9h10c8 0 14 4 14 10 0 3-2 5-5 5l8 6-9-2-4 4-1-6c-4 1-9 1-13 1-8 0-13-3-13-9z" />
          <Path d="M20 44l-7 6 2-8zM36 46l6 8-8-4z" />
          <Circle cx="41" cy="38" r="1.8" fill="#fff" opacity={0.9} />
        </G>
      );
    case 'amphibian':
      return (
        <G fill={color}>
          <Ellipse cx="32" cy="38" rx="17" ry="13" />
          <Circle cx="24" cy="24" r="7" />
          <Circle cx="40" cy="24" r="7" />
          <Path d="M12 44l-6 8 8-3zM52 44l6 8-8-3z" />
          <Circle cx="24" cy="23" r="2.4" fill="#fff" opacity={0.9} />
          <Circle cx="40" cy="23" r="2.4" fill="#fff" opacity={0.9} />
        </G>
      );
    case 'leaf':
      return (
        <G fill={color}>
          <Path d="M48 12C28 12 14 24 14 40c0 5 2 9 5 12 3-16 14-27 27-31-9 6-16 15-19 26 3 2 7 3 11 3 13 0 22-13 22-30 0-3 0-6-1-8z" />
        </G>
      );
    case 'grass':
      return (
        <G fill={color}>
          <Path d="M30 54c0-14-4-26-12-34 10 3 16 12 18 22 2-12 8-21 18-25-9 9-13 22-13 37z" />
          <Path d="M28 54c-1-10-5-18-11-24 8 4 13 12 15 21z" opacity={0.75} />
        </G>
      );
    case 'fern':
      return (
        <G fill={color} stroke={color} strokeWidth={2.5} strokeLinecap="round">
          <Path d="M32 56C32 34 30 20 24 10" fill="none" />
          <Path d="M30 46l-12-4M31 38l-12-6M32 30l-10-7M33 22l-8-7M30 46l12-8M31 38l11-9M32 30l9-9M33 22l7-8" fill="none" />
        </G>
      );
    case 'conifer':
      return (
        <G fill={color}>
          <Path d="M32 6l12 18h-7l9 14h-7l9 14H16l9-14h-7l9-14h-7z" />
          <Path d="M29 52h6v8h-6z" />
        </G>
      );
    case 'snail':
      return (
        <G fill={color}>
          <Path d="M8 44c0-3 3-5 7-5h8c-2-9 4-19 14-19 9 0 16 7 16 16s-7 16-16 16H14c-3 0-6-2-6-5z" />
          <Path
            d="M37 28c-4 0-7 3-7 8s3 8 7 8 8-4 8-8-3-8-8-8zm0 4c2 0 4 2 4 4s-2 4-4 4-3-2-3-4 1-4 3-4z"
            fill="#fff"
            opacity={0.55}
          />
          <Path d="M13 39l-3-8M20 39l-2-9" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        </G>
      );
    case 'shell':
      return (
        <G fill={color}>
          <Path d="M32 10c13 0 23 12 23 26 0 8-3 15-8 18H17c-5-3-8-10-8-18 0-14 10-26 23-26z" />
          <Path
            d="M32 12v42M22 14l-6 38M42 14l6 38"
            stroke="#fff"
            strokeWidth={2}
            opacity={0.45}
            fill="none"
          />
        </G>
      );
    case 'spider':
      return (
        <G fill={color} stroke={color} strokeWidth={3} strokeLinecap="round">
          <Ellipse cx="32" cy="34" rx="10" ry="12" stroke="none" />
          <Circle cx="32" cy="20" r="6" stroke="none" />
          <Path d="M22 28L8 18M22 34H6M22 40l-14 8M24 45l-8 12M42 28l14-10M42 34h16M42 40l14 8M40 45l8 12" fill="none" />
        </G>
      );
    case 'insect':
      return (
        <G fill={color}>
          <Ellipse cx="32" cy="36" rx="6" ry="16" />
          <Circle cx="32" cy="17" r="6" />
          <Path d="M26 26c-12-6-20-2-20 6s10 12 20 6zM38 26c12-6 20-2 20 6s-10 12-20 6z" opacity={0.85} />
          <Path d="M29 12l-6-6M35 12l6-6" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        </G>
      );
    case 'crab':
      return (
        <G fill={color} stroke={color} strokeWidth={3} strokeLinecap="round">
          <Ellipse cx="32" cy="36" rx="16" ry="11" stroke="none" />
          <Path d="M18 28c-6-6-12-6-14-2M46 28c6-6 12-6 14-2" fill="none" />
          <Path d="M18 44l-10 8M26 47l-6 10M46 44l10 8M38 47l6 10" fill="none" />
          <Circle cx="26" cy="32" r="2.4" fill="#fff" stroke="none" opacity={0.9} />
          <Circle cx="38" cy="32" r="2.4" fill="#fff" stroke="none" opacity={0.9} />
        </G>
      );
    case 'generic':
    default:
      return (
        <G fill={color}>
          <Path d="M32 8c10 0 18 8 18 18 0 13-10 24-18 30-8-6-18-17-18-30 0-10 8-18 18-18z" />
          <Circle cx="32" cy="25" r="7" fill="#fff" opacity={0.5} />
        </G>
      );
  }
}

export interface FamilyGlyphProps {
  clase: string;
  color: string;
  size?: number;
  opacity?: number;
}

export const FamilyGlyph = memo(function FamilyGlyph({
  clase,
  color,
  size = 48,
  opacity = 1,
}: FamilyGlyphProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" opacity={opacity}>
      <GlyphShape glyph={glyphForClass(clase)} color={color} />
    </Svg>
  );
});
