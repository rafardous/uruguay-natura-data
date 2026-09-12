import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface TransientZoomViewProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  borderRadius?: number;
}

const MAX_SCALE = 3;

/** Two-finger zoom that always returns to the original framing on release. */
export function TransientZoomView({ children, onPress, accessibilityLabel, borderRadius = 0 }: TransientZoomViewProps): React.JSX.Element {
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

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, tap)}>
      <View style={[styles.clip, { borderRadius }]} accessibilityRole={onPress ? 'imagebutton' : 'image'} accessibilityLabel={accessibilityLabel}>
        <Animated.View style={[styles.fill, animatedStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', width: '100%', height: '100%' },
  fill: { width: '100%', height: '100%' },
});
