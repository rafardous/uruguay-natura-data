import { Tabs } from 'expo-router';

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // The three primary surfaces stay mounted and switch immediately. A
        // cross-fade made the shared gradient briefly reveal the page behind
        // it, which read as a flash on both Android and web.
        animation: 'none',
        // NavigationIsland is rendered once by the root shell so it remains
        // present on regular stack screens too.
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="games" />
    </Tabs>
  );
}
