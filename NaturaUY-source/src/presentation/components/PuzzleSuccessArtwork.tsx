import { useEffect, useState } from 'react';
import { MotiView } from 'moti';
import { Image } from 'expo-image';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

const CONFETTI_COLORS = ['#EAC65A', '#F2EFE0', '#8EBF85', '#E18B68', '#8FB9C2', '#B5A0CD'];
const CONFETTI = Array.from({ length: 24 }, (_, index) => ({
  left: `${7 + ((index * 31) % 86)}%` as `${number}%`,
  top: `${5 + ((index * 17) % 26)}%` as `${number}%`,
  drift: ((index % 5) - 2) * 16,
  drop: 46 + (index % 4) * 18,
  rotate: `${(index % 2 ? 1 : -1) * (90 + (index % 4) * 45)}deg`,
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length]!,
  width: index % 3 === 0 ? 10 : 7,
  height: index % 3 === 0 ? 6 : 8,
}));

/** Foto de llegada sin piezas, líneas ni cortes; el confeti cae y deja la imagen limpia. */
export function PuzzleSuccessArtwork({ source, size }: { source: ImageSourcePropType; size: number }): React.JSX.Element {
  const [celebrating, setCelebrating] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setCelebrating(false), 1500);
    return () => clearTimeout(timer);
  }, []);
  return <View style={[styles.frame, { width: size, height: size }]}>
    <Image source={source} contentFit="cover" transition={180} style={StyleSheet.absoluteFill} />
    {celebrating && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {CONFETTI.map((piece, index) => <MotiView key={index}
        from={{ opacity: 0, translateX: 0, translateY: -12, rotate: '0deg', scale: 0.65 }}
        animate={{ opacity: 0.9, translateX: piece.drift, translateY: piece.drop, rotate: piece.rotate, scale: 1 }}
        transition={{ type: 'timing', duration: 1050, delay: 70 + index * 24 }}
        style={[styles.confetti, { left: piece.left, top: piece.top, width: piece.width, height: piece.height, backgroundColor: piece.color }]}
      />)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: 22, backgroundColor: '#F2ECDD' },
  confetti: { position: 'absolute', borderRadius: 2 },
});
