import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { COLLAPSIBLE_HEADER_COLLAPSED, COLLAPSIBLE_HEADER_EXPANDED, COLLAPSIBLE_HEADER_SCROLL_DISTANCE } from '../theme/tokens';

export interface CollapsibleGradientHeaderProps {
  scrollY: SharedValue<number>;
  gradient: readonly [string, string, string];
  controls: ReactNode;
  expandedContent: ReactNode;
}

/** A static chrome plane whose content compresses in response to the screen scroll. */
export function CollapsibleGradientHeader({ scrollY, gradient, controls, expandedContent }: CollapsibleGradientHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { radius, spacing } = useTheme();
  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [COLLAPSIBLE_HEADER_EXPANDED + insets.top, COLLAPSIBLE_HEADER_COLLAPSED + insets.top], Extrapolation.CLAMP),
    borderBottomLeftRadius: interpolate(scrollY.value, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [radius.hero, radius.lg], Extrapolation.CLAMP),
    borderBottomRightRadius: interpolate(scrollY.value, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [radius.hero, radius.lg], Extrapolation.CLAMP),
  }));
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE * 0.72], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [0, -18], Extrapolation.CLAMP) }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="box-none">
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.gradient]}>
        <View style={[styles.inner, { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg }]}>
          <View style={styles.controls}>{controls}</View>
          <View style={[styles.contentPlane, { marginTop: spacing.sm, paddingBottom: spacing.sm }]} pointerEvents="none">
            <Animated.View style={[styles.layer, expandedStyle]}>{expandedContent}</Animated.View>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, overflow: 'hidden' },
  gradient: { overflow: 'hidden' },
  inner: { flex: 1 },
  controls: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contentPlane: { flex: 1, minHeight: 0, position: 'relative' },
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
});
