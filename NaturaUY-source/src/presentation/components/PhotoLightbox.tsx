import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';

import { CloseIcon } from './TabIcons';

export interface PhotoLightboxProps {
  visible: boolean;
  uri: string | undefined;
  label: string;
  onClose: () => void;
}

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Full-resolution photo viewer, opened by tapping the photo inside the detail
 * sheet — the "second tap" that shows the image at its real size instead of
 * the cropped `cover` thumbnail used inline. Pinch and double-tap to zoom.
 */
export function PhotoLightbox({ visible, uri, label, onClose }: PhotoLightboxProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = (): void => {
    'worklet';
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  // A fresh photo (or a fresh open) should never inherit the previous zoom.
  useEffect(() => {
    if (visible) resetZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, uri]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) resetZoom();
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (savedScale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        resetZoom();
        return;
      }
      scale.value = withTiming(DOUBLE_TAP_SCALE);
      savedScale.value = DOUBLE_TAP_SCALE;
    });

  // Double-tap gets first refusal; otherwise pinch and pan run together.
  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!visible || !uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar foto" />

        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.imageWrap, imageStyle]}>
            <Image source={{ uri }} contentFit="contain" style={styles.image} accessibilityLabel={label} />
          </Animated.View>
        </GestureDetector>

        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <CloseIcon color="#FFFFFF" size={22} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  imageWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  close: { position: 'absolute', right: 16, padding: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)' },
});
