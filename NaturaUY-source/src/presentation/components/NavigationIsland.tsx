import { useEffect, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { CompassIcon, GameIcon, HomeIcon, type IconProps } from './TabIcons';
import { useTheme } from '../theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN } from '../theme/tokens';
import { haptics } from '../haptics';

export type MainTab = 'index' | 'explore' | 'games';

const ITEMS: { name: MainTab; label: string; icon: (props: IconProps) => React.JSX.Element }[] = [
  { name: 'index', label: 'Inicio', icon: HomeIcon },
  { name: 'explore', label: 'Descubrir', icon: CompassIcon },
  { name: 'games', label: 'Juegos', icon: GameIcon },
];

export function NavigationIsland({
  active,
  onNavigate,
  blurTarget,
}: {
  active?: MainTab;
  onNavigate: (tab: MainTab) => void;
  blurTarget?: RefObject<View | null>;
}): React.JSX.Element {
  const { radius, typography, elevation, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const light = scheme === 'light';
  const islandBackground = light ? 'rgba(201,216,196,0.94)' : 'rgba(35,65,50,0.94)';
  const islandBorder = 'rgba(41,74,58,0.24)';
  const activeBackground = '#BDD0B7';
  const activeForeground = '#293832';
  const inactiveForeground = '#294A3A';

  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: Math.max(insets.bottom, NAV_ISLAND_MARGIN) }]}>
      <View
        style={[
          styles.island,
          elevation.high,
          {
            backgroundColor: islandBackground,
            borderColor: islandBorder,
            borderRadius: radius.pill,
            height: NAV_ISLAND_HEIGHT,
            overflow: 'hidden',
          },
        ]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: islandBackground }]} />
        {blurTarget && (
          <BlurView
            pointerEvents="none"
            blurTarget={blurTarget}
            intensity={48}
            tint={light ? 'light' : 'dark'}
            blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: light ? 'rgba(190,211,184,0.42)' : 'rgba(42,83,61,0.3)' }]} />
        {ITEMS.map(({ name, label, icon: Icon }) => {
          return <NavigationItem key={name} icon={Icon} name={name} label={label} focused={active === name} onNavigate={onNavigate} radius={radius.pill} typography={typography} activeBackground={activeBackground} activeForeground={activeForeground} inactiveForeground={inactiveForeground} />;
        })}
      </View>
    </View>
  );
}

function NavigationItem({
  icon: Icon,
  name,
  label,
  focused,
  onNavigate,
  radius,
  typography,
  activeBackground,
  activeForeground,
  inactiveForeground,
}: {
  icon: (props: IconProps) => React.JSX.Element;
  name: MainTab;
  label: string;
  focused: boolean;
  onNavigate: (tab: MainTab) => void;
  radius: number;
  typography: { label: { fontSize: number; fontFamily?: string; fontWeight?: '600' } };
  activeBackground: string;
  activeForeground: string;
  inactiveForeground: string;
}): React.JSX.Element {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 175 });
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(0,0,0,0)', activeBackground]),
    paddingHorizontal: interpolate(progress.value, [0, 1], [11, 16]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.025]) }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: progress.value, maxWidth: progress.value * 80 }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={() => {
        if (focused) return;
        haptics.press();
        onNavigate(name);
      }}
      style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.78 : 1 }]}
    >
      <Animated.View style={[styles.pill, { borderRadius: radius }, pillStyle]}>
        <Icon color={focused ? activeForeground : inactiveForeground} size={22} strokeWidth={2} />
        <Animated.View style={[styles.labelWrap, labelStyle]}>
          <Text style={[typography.label, { color: activeForeground }]}>{label}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18 },
  island: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10 },
  labelWrap: { overflow: 'hidden' },
});
