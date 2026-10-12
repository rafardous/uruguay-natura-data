import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ResetIcon, ZoomInIcon, ZoomOutIcon } from './TabIcons';
import { clampPhotoOffset, photoZoomBounds } from '../photoZoom';

interface TransientZoomViewProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  borderRadius?: number;
  /** Adds explicit controls for users who cannot or prefer not to pinch. */
  showControls?: boolean;
  onZoomActiveChange?: (active: boolean) => void;
  persistent?: boolean;
  imageAspectRatio?: number;
}

const MAX_SCALE = 3;

/** Inline photos use transient zoom; the fullscreen viewer keeps scale and pan. */
export function TransientZoomView({ children, onPress, accessibilityLabel, borderRadius = 0, showControls = false, onZoomActiveChange, persistent = false, imageAspectRatio = 0 }: TransientZoomViewProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const targetScale = useSharedValue(1);
  const pinching = useSharedValue(false);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const ratio = useSharedValue(imageAspectRatio);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const anchorX = useSharedValue(0);
  const anchorY = useSharedValue(0);
  useEffect(() => {
    ratio.value = imageAspectRatio;
    const bounds = photoZoomBounds(width.value, height.value, imageAspectRatio, scale.value);
    x.value = clampPhotoOffset(x.value, bounds.x);
    y.value = clampPhotoOffset(y.value, bounds.y);
  }, [imageAspectRatio, ratio, width, height, scale, x, y]);
  const reset = (): void => {
    'worklet';
    scale.value = withTiming(1, { duration: 180 });
    targetScale.value = 1;
    x.value = withTiming(0, { duration: 180 });
    y.value = withTiming(0, { duration: 180 });
    if (onZoomActiveChange) runOnJS(onZoomActiveChange)(false);
  };

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      pinching.value = true;
      startScale.value = scale.value;
      anchorX.value = (event.focalX - width.value / 2 - x.value) / scale.value;
      anchorY.value = (event.focalY - height.value / 2 - y.value) / scale.value;
      if (onZoomActiveChange) runOnJS(onZoomActiveChange)(true);
    })
    .onUpdate((event) => {
      const next = Math.min(MAX_SCALE, Math.max(1, startScale.value * event.scale));
      scale.value = next;
      targetScale.value = next;
      if (persistent) {
        const bounds = photoZoomBounds(width.value, height.value, ratio.value, next);
        x.value = clampPhotoOffset(event.focalX - width.value / 2 - anchorX.value * next, bounds.x);
        y.value = clampPhotoOffset(event.focalY - height.value / 2 - anchorY.value * next, bounds.y);
      }
    })
    .onFinalize(() => {
      if (!pinching.value) return;
      pinching.value = false;
      if (!persistent) reset();
      else if (onZoomActiveChange) runOnJS(onZoomActiveChange)(scale.value > 1);
    });
  const pan = Gesture.Pan()
    .enabled(persistent)
    .maxPointers(1)
    .minDistance(3)
    .onTouchesDown((_event, manager) => {
      if (scale.value <= 1 || pinching.value) manager.fail();
    })
    .onStart(() => { startX.value = x.value; startY.value = y.value; })
    .onUpdate((event) => {
      const bounds = photoZoomBounds(width.value, height.value, ratio.value, scale.value);
      x.value = clampPhotoOffset(startX.value + event.translationX, bounds.x);
      y.value = clampPhotoOffset(startY.value + event.translationY, bounds.y);
    });
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
      const next = targetScale.value > 1 ? 1 : 2;
      scale.value = withTiming(next, { duration: 180 });
      targetScale.value = next;
      x.value = withTiming(0, { duration: 180 });
      y.value = withTiming(0, { duration: 180 });
      if (onZoomActiveChange) runOnJS(onZoomActiveChange)(next > 1);
    });
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));

  const changeScale = (delta: number): void => {
    const next = Math.min(MAX_SCALE, Math.max(1, targetScale.value + delta));
    scale.value = withTiming(next, { duration: 180 });
    targetScale.value = next;
    const bounds = photoZoomBounds(width.value, height.value, ratio.value, next);
    x.value = withTiming(clampPhotoOffset(x.value, bounds.x), { duration: 180 });
    y.value = withTiming(clampPhotoOffset(y.value, bounds.y), { duration: 180 });
    onZoomActiveChange?.(next > 1);
  };
  const resetFromControl = (): void => {
    reset();
  };

  return (
    <View style={[styles.container, { borderRadius }]}>
      <GestureDetector gesture={persistent ? Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, tap)) : Gesture.Simultaneous(pinch, tap)}>
        <View onLayout={(event) => {
          width.value = event.nativeEvent.layout.width;
          height.value = event.nativeEvent.layout.height;
          const bounds = photoZoomBounds(width.value, height.value, ratio.value, scale.value);
          x.value = clampPhotoOffset(x.value, bounds.x);
          y.value = clampPhotoOffset(y.value, bounds.y);
        }} style={[styles.clip, { borderRadius }]} accessible accessibilityRole={onPress ? 'imagebutton' : 'image'} accessibilityLabel={accessibilityLabel} onAccessibilityTap={onPress}>
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
