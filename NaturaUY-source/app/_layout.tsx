import { Suspense, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';

import { CATALOG_DATABASE_NAME } from '../src/data/db/schema';
import { UserDatabaseProvider } from '../src/data/db/UserDatabaseProvider';
import { FavoritesProvider } from '../src/presentation/hooks/FavoritesProvider';
import { ThemeProvider, useTheme } from '../src/presentation/theme/ThemeProvider';
import { lightColors } from '../src/presentation/theme/tokens';

/**
 * The catalogue ships prebuilt, so `assetSource` copies one file on first launch
 * and every later start opens it directly — no import step, no empty state.
 */
function Navigator(): React.JSX.Element {
  const { colors, scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="species/[codigo]"
          options={{
            // Native bottom sheet (UISheetPresentationController on iOS, Material
            // BottomSheetBehaviour on Android) instead of a hand-rolled slide-up.
            // A `transparentModal` + manual translateY was tried first, but on
            // Android `transparentModal` plays its own native dialog animation
            // that `animation: 'none'` doesn't suppress, so it ran at the same
            // time as the custom one — two overlapping motions, reads as broken.
            // formSheet gives one native-driven motion with swipe-to-dismiss for free.
            presentation: 'formSheet',
            sheetAllowedDetents: [0.94],
            sheetCornerRadius: 28,
            sheetGrabberVisible: false,
            sheetExpandsWhenScrolledToEdge: false,
          }}
        />
        <Stack.Screen name="game/identify" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="credits" />
      </Stack>
    </>
  );
}

function Loading(): React.JSX.Element {
  return (
    <View style={[styles.loading, { backgroundColor: lightColors.background }]}>
      <ActivityIndicator color={lightColors.primary} />
    </View>
  );
}

// Held open until fonts are ready, so headline text never flashes in the
// system font first and then jumps to Fraunces mid-render.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({ Fraunces_600SemiBold });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Suspense fallback={<Loading />}>
          <SQLiteProvider
            databaseName={CATALOG_DATABASE_NAME}
            // Always re-copy: the catalogue holds no user data, so overwriting is
            // free and guarantees a new app version ships new content.
            assetSource={{ assetId: require('../assets/db/natura.db'), forceOverwrite: true }}
            useSuspense
          >
            <UserDatabaseProvider>
              <ThemeProvider>
                <FavoritesProvider>
                  <Navigator />
                </FavoritesProvider>
              </ThemeProvider>
            </UserDatabaseProvider>
          </SQLiteProvider>
        </Suspense>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
