import { StyleSheet, View } from 'react-native';
import { MotiView } from 'moti';

const PARTICLES = [
  { x: 0, y: -25 },
  { x: 18, y: -18 },
  { x: 26, y: 0 },
  { x: 18, y: 18 },
  { x: 0, y: 25 },
  { x: -18, y: 18 },
  { x: -26, y: 0 },
  { x: -18, y: -18 },
] as const;

/** Lightweight one-shot feedback, rendered only when a favorite is added. */
export function FavoriteSparkles({ trigger, color }: { trigger: number; color: string }): React.JSX.Element | null {
  if (trigger === 0) return null;

  return (
    <View pointerEvents="none" style={styles.layer}>
      <MotiView
        key={`${trigger}-ring`}
        from={{ opacity: 0.72, scale: 0.35 }}
        animate={{ opacity: 0, scale: 1.55 }}
        transition={{ type: 'timing', duration: 460 }}
        style={[styles.ring, { borderColor: color }]}
      />
      {PARTICLES.map((particle, index) => (
        <MotiView
          key={`${trigger}-${index}`}
          from={{ opacity: 1, scale: 0.4, translateX: 0, translateY: 0 }}
          animate={{ opacity: 0, scale: 1, translateX: particle.x, translateY: particle.y }}
          transition={{ type: 'timing', duration: 430 + (index % 3) * 45, delay: index * 12 }}
          style={[styles.spark, { backgroundColor: color }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  ring: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  spark: { position: 'absolute', width: 5, height: 9, borderRadius: 3 },
});
