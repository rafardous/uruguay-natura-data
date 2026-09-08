import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const PIECES = Array.from({ length: 28 }, (_, index) => ({
  left: `${8 + ((index * 37) % 84)}%` as `${number}%`,
  top: 54 + ((index * 17) % 50),
  drift: ((index % 5) - 2) * 24,
  fall: 110 + (index % 4) * 36,
  rotate: `${(index % 2 ? 1 : -1) * (120 + (index % 4) * 35)}deg`,
  width: index % 3 === 0 ? 13 : 8,
  height: index % 3 === 0 ? 5 : 9,
}));

export function RecordCelebration({ visible, palette, reducedMotion }: { visible: boolean; palette: string[]; reducedMotion: boolean }): React.JSX.Element | null {
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.layer} accessibilityLiveRegion="polite">
      <View style={styles.garland}>
        <Svg width={280} height={58} viewBox="0 0 280 58">
          <Path d="M12 13 Q140 82 268 13" fill="none" stroke={palette[0] ?? '#E7C65D'} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={48} cy={39} r={5} fill={palette[1 % palette.length] ?? '#E7C65D'} />
          <Circle cx={140} cy={58} r={5} fill={palette[2 % palette.length] ?? '#E7C65D'} />
          <Circle cx={232} cy={39} r={5} fill={palette[3 % palette.length] ?? '#E7C65D'} />
        </Svg>
      </View>
      {!reducedMotion && PIECES.map((piece, index) => (
        <ConfettiPiece key={index} {...piece} color={palette[index % palette.length] ?? '#E7C65D'} />
      ))}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>¡Nuevo récord personal!</Text>
      </View>
    </View>
  );
}

function ConfettiPiece({ left, top, drift, fall, rotate, width, height, color }: (typeof PIECES)[number] & { color: string }): React.JSX.Element {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(Math.round(top - 54) * 4, withTiming(1, { duration: 920 }));
  }, [progress, top]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: drift * progress.value },
      { translateY: fall * progress.value },
      { rotate: progress.value === 0 ? '0deg' : rotate },
    ],
  }));
  return <Animated.View style={[styles.piece, { left, top, width, height, backgroundColor: color }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 30, alignItems: 'center' },
  garland: { position: 'absolute', top: 3, alignItems: 'center' },
  badge: { marginTop: 68, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: '#E7C65D', shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  badgeText: { color: '#3D3210', fontSize: 14, fontWeight: '800' },
  piece: { position: 'absolute', borderRadius: 3 },
});
