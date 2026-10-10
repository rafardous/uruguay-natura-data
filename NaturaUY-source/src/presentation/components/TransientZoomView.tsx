import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ResetIcon, ZoomInIcon, ZoomOutIcon } from './TabIcons';

interface TransientZoomViewProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  borderRadius?: number;
  /** Adds explicit controls for users who cannot or prefer not to pinch. */
  showControls?: boolean;
  onZoomActiveChange?: (active: boolean) => void;
}

const MAX_SCALE = 3;

/** Two-finger zoom that always returns to the original framing on release. */
export function TransientZoomView({ children, onPress, accessibilityLabel, borderRadius = 0, showControls = false, onZoomActiveChange }: TransientZoomViewProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const pinching = useSharedValue(false);
  const reset = (): void => {
    'worklet';
    scale.value = withTiming(1, { duration: 180 });
    if (onZoomActiveChange) runOnJS(onZoomActiveChange)(false);
  };

  const pinch = Gesture.Pinch()
    .onStart(() => { pinching.value = true; if (onZoomActiveChange) runOnJS(onZoomActiveChange)(true); })
    .onUpdate((event) => { scale.value = Math.min(MAX_SCALE, Math.max(1, event.scale)); })
    .onFinalize(() => { if (pinching.value) { pinching.value = false; reset(); } });
  const tap = Gesture.Tap()
    .enabled(Boolean(onPress))
    .maxDuration(260)
    .onEnd((_event, success) => { if (success && onPress) runOnJS(onPress)(); });
  const doubleTap = Gesture.Tap()
    .enabled(showControls)
    .numberOfTaps(2)
    .maxDelay(280)
    .onEnd((_event, success) => {
      if (!success) return;
      const next = scale.value > 1 ? 1 : 2;
      scale.value = withTiming(next, { duration: 180 });
      if (onZoomActiveChange) runOnJS(onZoomActiveChange)(next > 1);
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const changeScale = (delta: number): void => {
    const next = Math.min(MAX_SCALE, Math.max(1, scale.value + delta));
    scale.value = withTiming(next, { duration: 180 });
    onZoomActiveChange?.(next > 1);
  };
  const resetFromControl = (): void => {
    scale.value = withTiming(1, { duration: 180 });
    onZoomActiveChange?.(false);
  };

  return (
    <View style={[styles.container, { borderRadius }]}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, tap))}>
        <View style={[styles.clip, { borderRadius }]} accessible accessibilityRole={onPress ? 'imagebutton' : 'image'} accessibilityLabel={accessibilityLabel} onAccessibilityTap={onPress}>
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
  control: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.56)' },
});
