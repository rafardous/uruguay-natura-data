import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';

import { CompassIcon, GameIcon, HomeIcon, type IconProps } from './TabIcons';
import { useTheme } from '../theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN } from '../theme/tokens';

export type MainTab = 'index' | 'explore' | 'games';

const ITEMS: { name: MainTab; label: string; icon: (props: IconProps) => React.JSX.Element }[] = [
  { name: 'index', label: 'Inicio', icon: HomeIcon },
  { name: 'explore', label: 'Descubrir', icon: CompassIcon },
  { name: 'games', label: 'Juegos', icon: GameIcon },
];

export function NavigationIsland({
  active,
  onNavigate,
}: {
  active: MainTab;
  onNavigate: (tab: MainTab) => void;
}): React.JSX.Element {
  const { colors, radius, typography, elevation, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const light = scheme === 'light';
  // Material 3 assigns navigation components a tonal SurfaceContainer rather
  // than the brightest surface. It keeps the island distinct from ivory pages
  // without turning the whole control into another brand-colour statement.
  const islandBackground = light ? colors.surfaceContainer : colors.canvas;
  const islandBorder = light ? colors.border : colors.canvasBorder;
  const activeBackground = colors.accent;
  const activeForeground = colors.onAccent;
  const inactiveForeground = light ? colors.textSecondary : colors.navInactiveText;

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
          },
        ]}
      >
        {ITEMS.map(({ name, label, icon: Icon }) => {
          const focused = active === name;
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => onNavigate(name)}
              style={styles.tab}
            >
              <MotiView
                animate={{
                  backgroundColor: focused ? activeBackground : 'transparent',
                  paddingHorizontal: focused ? 16 : 12,
                }}
                transition={{ type: 'timing', duration: 220 }}
                style={[styles.pill, { borderRadius: radius.pill }]}
              >
                <Icon color={focused ? activeForeground : inactiveForeground} size={21} />
                {focused && (
                  <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 200 }}>
                    <Text style={[typography.label, { color: activeForeground }]}>{label}</Text>
                  </MotiView>
                )}
              </MotiView>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18 },
  island: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10 },
});
