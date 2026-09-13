import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ResetIcon, ZoomInIcon, ZoomOutIcon } from './TabIcons';

interface TransientZoomViewProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  borderRadius?: number;
  /** Adds explicit controls for users who cannot or prefer not to pinch. */
  showControls?: boolean;
}

const MAX_SCALE = 3;

/** Two-finger zoom that always returns to the original framing on release. */
export function TransientZoomView({ children, onPress, accessibilityLabel, borderRadius = 0, showControls = false }: TransientZoomViewProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const reset = (): void => {
    'worklet';
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => { scale.value = Math.min(MAX_SCALE, Math.max(1, event.scale)); })
    .onEnd(reset)
    .onFinalize(reset);
  const tap = Gesture.Tap()
    .enabled(Boolean(onPress))
    .maxDuration(260)
    .onEnd((_event, success) => { if (success && onPress) runOnJS(onPress)(); });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const changeScale = (delta: number): void => {
    scale.value = withSpring(Math.min(MAX_SCALE, Math.max(1, scale.value + delta)), { damping: 18, stiffness: 220 });
  };
  const resetFromControl = (): void => {
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
  };

  return (
    <View style={[styles.container, { borderRadius }]}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, tap)}>
        <View style={[styles.clip, { borderRadius }]} accessibilityRole={onPress ? 'imagebutton' : 'image'} accessibilityLabel={accessibilityLabel}>
          <Animated.View style={[styles.fill, animatedStyle]}>{children}</Animated.View>
        </View>
      </GestureDetector>
      {showControls && <View style={styles.controls}>
        <Pressable onPress={() => changeScale(0.5)} accessibilityRole="button" accessibilityLabel="Acercar foto" style={styles.control}><ZoomInIcon color="#FFFFFF" size={19} /></Pressable>
        <Pressable onPress={() => changeScale(-0.5)} accessibilityRole="button" accessibilityLabel="Alejar foto" style={styles.control}><ZoomOutIcon color="#FFFFFF" size={19} /></Pressable>
        <Pressable onPress={resetFromControl} accessibilityRole="button" accessibilityLabel="Restablecer zoom" style={styles.control}><ResetIcon color="#FFFFFF" size={18} /></Pressable>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: '100%' },
  clip: { overflow: 'hidden', width: '100%', height: '100%' },
  fill: { width: '100%', height: '100%' },
  controls: { position: 'absolute', right: 18, bottom: 28, flexDirection: 'row', gap: 8 },
  control: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.56)' },
});
