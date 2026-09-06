import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { COLLAPSIBLE_HEADER_COLLAPSED, COLLAPSIBLE_HEADER_EXPANDED, COLLAPSIBLE_HEADER_SCROLL_DISTANCE } from '../theme/tokens';

export interface CollapsibleGradientHeaderProps {
  scrollY: SharedValue<number>;
  gradient: readonly [string, string, string];
  compactTitle: string;
  controls: ReactNode;
  expandedContent: ReactNode;
}

/** A static chrome plane whose content compresses in response to the screen scroll. */
export function CollapsibleGradientHeader({ scrollY, gradient, compactTitle, controls, expandedContent }: CollapsibleGradientHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography } = useTheme();
  const containerStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [COLLAPSIBLE_HEADER_EXPANDED, COLLAPSIBLE_HEADER_COLLAPSED], Extrapolation.CLAMP),
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
  }));
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE * 0.72], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [0, -18], Extrapolation.CLAMP) }],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSIBLE_HEADER_SCROLL_DISTANCE * 0.55, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSIBLE_HEADER_SCROLL_DISTANCE], [10, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="box-none">
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.gradient, { borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero }]}>
        <View style={[styles.inner, { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg }]}>
          <View style={styles.controls}>{controls}</View>
          <Animated.View style={[styles.expanded, { marginTop: spacing.xl }, expandedStyle]}>{expandedContent}</Animated.View>
          <Animated.View style={[styles.compact, { marginTop: spacing.md }, compactStyle]}>
            <Text style={[typography.title, { color: colors.canvasText }]} numberOfLines={1}>{compactTitle}</Text>
          </Animated.View>
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
  expanded: { flex: 1 },
  compact: { minHeight: 38, justifyContent: 'center' },
});
