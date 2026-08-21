import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
// expo-router bundles its own copy of the bottom-tabs types; using those keeps
// the tabBar signature identical to what <Tabs> actually passes.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { MotiView } from 'moti';

import { CompassIcon, GameIcon, HomeIcon, type IconProps } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN } from '../../src/presentation/theme/tokens';

const ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  index: HomeIcon,
  explore: CompassIcon,
  games: GameIcon,
};

const LABELS: Record<string, string> = {
  index: 'Inicio',
  explore: 'Descubrir',
  games: 'Juegos',
};

/**
 * A floating island rather than a full-width strip.
 *
 * The old bar spanned edge to edge with a hairline on top, which is the shape a
 * web page uses for a footer — it made the app feel like a document. Detaching
 * it from all three edges and giving it its own shadow turns it into an object
 * sitting above the content.
 *
 * Only the focused tab carries a label: on an island there isn't width for
 * three, and the icons already read on their own.
 */
function TabBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const { colors, radius, typography, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, NAV_ISLAND_MARGIN) }]}
    >
      <View
        style={[
          styles.island,
          elevation.high,
          {
            backgroundColor: colors.canvas,
            borderColor: colors.canvasBorder,
            borderRadius: radius.pill,
            height: NAV_ISLAND_HEIGHT,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? HomeIcon;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={LABELS[route.name]}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                // Nothing moved if the tab was already active — no buzz either.
                if (!focused && !event.defaultPrevented) {
                  haptics.tick();
                  navigation.navigate(route.name);
                }
              }}
              style={styles.tab}
            >
              <MotiView
                animate={{
                  backgroundColor: focused ? colors.accent : 'transparent',
                  paddingHorizontal: focused ? 16 : 12,
                }}
                transition={{ type: 'timing', duration: 220 }}
                style={[styles.pill, { borderRadius: radius.pill }]}
              >
                <Icon color={focused ? colors.onAccent : colors.navInactiveText} size={21} />
                {focused && (
                  <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 200 }}>
                    <Text style={[typography.label, { color: colors.onAccent }]}>{LABELS[route.name]}</Text>
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

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // The island floats over the content instead of reserving layout height;
        // screens pad their own scroll content by NAV_ISLAND_HEIGHT.
        tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="games" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18 },
  island: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10 },
});
