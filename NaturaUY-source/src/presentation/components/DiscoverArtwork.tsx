import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import type { Species } from '../../domain/entities/species';

const INK = '#315448';
const MINT = '#B9D7C0';
const SAGE = '#E4F0E3';
const GOLD = '#E8C878';

/** Compact code-native taxonomy diagram; deliberately text-free for small cards. */
export function TaxonomyMiniMap(): React.JSX.Element {
  return (
    <Svg width="92" height="72" viewBox="0 0 92 72" accessibilityLabel="Mapa jerárquico de taxonomía">
      <Path d="M46 11v12M46 23H23v10M46 23h23v10M23 43H12M23 43h22M69 43H58M69 43h22" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <Circle cx="46" cy="10" r="7" fill={INK} />
      <Circle cx="23" cy="34" r="7" fill={MINT} stroke={INK} strokeWidth="1.5" />
      <Circle cx="69" cy="34" r="7" fill={GOLD} stroke={INK} strokeWidth="1.5" />
      <Circle cx="12" cy="51" r="6" fill={SAGE} stroke={INK} strokeWidth="1.5" />
      <Circle cx="45" cy="51" r="6" fill={SAGE} stroke={INK} strokeWidth="1.5" />
      <Circle cx="58" cy="51" r="6" fill="#D8E7C7" stroke={INK} strokeWidth="1.5" />
      <Circle cx="91" cy="51" r="6" fill="#D8E7C7" stroke={INK} strokeWidth="1.5" />
      <Path d="M9 63c3-3 7-3 10 0M42 63c3-3 7-3 10 0M55 63c3-3 7-3 10 0M88 63c3-3 7-3 10 0" stroke={INK} strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** A real catalogue photo framed by a vector magnifier. */
export function SpeciesLensArt({ species }: { species: Species | null }): React.JSX.Element {
  return (
    <View style={styles.lensArt} accessibilityLabel={species ? `Foto de ${species.displayName} dentro de una lupa` : 'Lupa sobre una especie'}>
      <View style={styles.photoFrame}>
        {species?.photo?.url ? <Image source={{ uri: species.photo.url }} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, styles.photoFallback]} />}
      </View>
      <Svg width="104" height="92" viewBox="0 0 104 92" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx="42" cy="37" r="29" fill="none" stroke="#FFF9EA" strokeWidth="7" />
        <Circle cx="42" cy="37" r="29" fill="none" stroke={INK} strokeWidth="2.4" />
        <Line x1="64" y1="59" x2="91" y2="84" stroke={INK} strokeWidth="8" strokeLinecap="round" />
        <Line x1="64" y1="59" x2="91" y2="84" stroke="#FFF9EA" strokeWidth="4" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

/** Small field-guide scene built entirely from SVG primitives. */
export function LearnFieldGuideArt(): React.JSX.Element {
  return (
    <Svg width="94" height="74" viewBox="0 0 94 74" accessibilityLabel="Guía de campo con hoja, pluma y huella">
      <Rect x="10" y="11" width="57" height="52" rx="6" fill="#FFF9EA" stroke={INK} strokeWidth="2" transform="rotate(-5 10 11)" />
      <Path d="M22 24h30M20 32h22M19 40h27" stroke="#9ABDA3" strokeWidth="3" strokeLinecap="round" />
      <Path d="M65 7c-7 13-6 25 1 34 6 7 10 13 10 23M65 7c5 4 9 9 11 16M64 19c-4 1-8 0-12-3M66 30c-4 2-8 2-12 0" fill="none" stroke={INK} strokeWidth="2.3" strokeLinecap="round" />
      <Path d="M72 59c3-7 9-7 12 0 2 4 0 8-4 8h-4c-4 0-6-4-4-8Z" fill={GOLD} stroke={INK} strokeWidth="1.8" />
      <Path d="M76 56v7M72 60h9" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  lensArt: { width: 104, height: 92, alignItems: 'center', justifyContent: 'center' },
  photoFrame: { width: 61, height: 61, marginTop: -8, marginLeft: -8, overflow: 'hidden', borderRadius: 31, backgroundColor: '#C9DED0', borderWidth: 2, borderColor: '#FFF9EA' },
  photoFallback: { backgroundColor: '#C9DED0' },
});
