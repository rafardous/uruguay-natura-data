import { useCallback, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
}

const SHIMMER_WIDTH_RATIO = 0.55;
const SWEEP_DURATION = 1100;

/**
 * A shimmer-sweep placeholder block — a soft gradient band travels across a
 * flat base colour, left edge to right. Replaces a flat opacity pulse, which
 * read as an unfinished/flat loading state rather than a deliberate one.
 */
export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps): React.JSX.Element {
  const { colors, radius: r } = useTheme();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const sweep = useSharedValue(0);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const measured = event.nativeEvent.layout.width;
      if (measured <= 0 || measured === measuredWidth) return;

      setMeasuredWidth(measured);
      sweep.value = withRepeat(
        withTiming(measured * (1 + SHIMMER_WIDTH_RATIO), {
          duration: SWEEP_DURATION,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
      );
    },
    [measuredWidth, sweep],
  );

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value - measuredWidth * SHIMMER_WIDTH_RATIO }],
  }));

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.base,
        { width, height, borderRadius: radius ?? r.sm, backgroundColor: colors.skeleton },
        style,
      ]}
    >
      {measuredWidth > 0 && (
        <Animated.View style={[styles.shimmer, { width: measuredWidth * SHIMMER_WIDTH_RATIO }, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', colors.skeletonHighlight, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  shimmer: { position: 'absolute', top: 0, bottom: 0 },
});
