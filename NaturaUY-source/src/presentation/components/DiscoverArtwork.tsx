import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Line, Path } from 'react-native-svg';

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
    <Svg width="94" height="74" viewBox="0 0 94 74" accessibilityLabel="Libro abierto con ramas de clasificación">
      <Path d="M10 17c14-5 25-3 37 5v39c-12-8-23-10-37-5Z" fill="#FFF9EA" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <Path d="M84 17c-14-5-25-3-37 5v39c12-8 23-10 37-5Z" fill="#FFF9EA" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <Path d="M47 22v-9M47 13H31M47 13h16M31 13v-5M31 13v5M63 13v-5M63 13v5" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx="47" cy="12" r="3.5" fill={GOLD} stroke={INK} strokeWidth="1.5" />
      <Circle cx="31" cy="5" r="3" fill={MINT} stroke={INK} strokeWidth="1.4" />
      <Circle cx="31" cy="21" r="3" fill={SAGE} stroke={INK} strokeWidth="1.4" />
      <Circle cx="63" cy="5" r="3" fill={MINT} stroke={INK} strokeWidth="1.4" />
      <Circle cx="63" cy="21" r="3" fill={SAGE} stroke={INK} strokeWidth="1.4" />
      <Path d="M20 32h18M20 40h21M56 32h18M56 40h15" stroke="#9ABDA3" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  lensArt: { width: 104, height: 92, alignItems: 'center', justifyContent: 'center' },
  photoFrame: { width: 61, height: 61, marginTop: -8, marginLeft: -8, overflow: 'hidden', borderRadius: 31, backgroundColor: '#C9DED0', borderWidth: 2, borderColor: '#FFF9EA' },
  photoFallback: { backgroundColor: '#C9DED0' },
});
