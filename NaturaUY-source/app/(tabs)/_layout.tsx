import { Tabs } from 'expo-router';
// expo-router bundles its own copy of the bottom-tabs types; using those keeps
// the tabBar signature identical to what <Tabs> actually passes.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { NavigationIsland, type MainTab } from '../../src/presentation/components/NavigationIsland';
import { haptics } from '../../src/presentation/haptics';

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
  const active = (state.routes[state.index]?.name ?? 'index') as MainTab;

  return <NavigationIsland active={active} onNavigate={(name) => {
    const target = state.routes.find((route) => route.name === name);
    if (!target || name === active) return;
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (!event.defaultPrevented) {
      haptics.tick();
      navigation.navigate(name);
    }
  }} />;
}

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
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
