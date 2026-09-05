import { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';

import { CatalogUpdateProvider, useCatalogUpdateState } from '../src/data/db/CatalogUpdateProvider';
import { prepareCatalogDatabase } from '../src/data/db/catalogUpdater';
import { CATALOG_DATABASE_NAME } from '../src/data/db/schema';
import { UserDatabaseProvider } from '../src/data/db/UserDatabaseProvider';
import { MobileAuthProvider } from '../src/auth/MobileAuthProvider';
import { FavoritesProvider } from '../src/presentation/hooks/FavoritesProvider';
import { MobileSyncProvider } from '../src/sync/MobileSyncProvider';
import { ThemeProvider, useTheme } from '../src/presentation/theme/ThemeProvider';
import { lightColors } from '../src/presentation/theme/tokens';

/**
 * The catalogue ships prebuilt, so `assetSource` copies one file on first launch
 * and every later start opens it directly — no import step, no empty state.
 */
function Navigator(): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
          animationDuration: 240,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="report" />
        <Stack.Screen name="collaborate" />
        <Stack.Screen name="biomes" />
        <Stack.Screen name="interest-sites" />
        <Stack.Screen name="about" />
        <Stack.Screen name="taxonomy" />
        <Stack.Screen
          name="species/[codigo]"
          options={{
            // Android's native formSheet keeps intercepting a downward finger
            // movement even after its navigation gesture is disabled. A
            // transparent modal preserves the card presentation, but assigns
            // every vertical gesture exclusively to the inner ScrollView.
            presentation: 'transparentModal',
            animation: 'fade',
            animationDuration: 180,
            gestureEnabled: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="game/identify" options={{ animation: 'fade_from_bottom', animationDuration: 260 }} />
        <Stack.Screen name="game/categories" options={{ animation: 'fade_from_bottom', animationDuration: 260 }} />
        <Stack.Screen name="game/records" options={{ animation: 'fade_from_bottom', animationDuration: 260 }} />
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

function CatalogUpdateNotice(): null {
  const updateState = useCatalogUpdateState();
  useEffect(() => {
    if (updateState === 'app_update_required') Alert.alert('Actualización necesaria', 'Hay un catálogo nuevo que requiere una versión más reciente de Natura UY. Mientras tanto podés seguir usando tus datos actuales.');
  }, [updateState]);
  return null;
}

// Held open until fonts are ready, so headline text never flashes in the
// system font first and then jumps to Fraunces mid-render.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({ Fraunces_600SemiBold });
  const [catalogReady, setCatalogReady] = useState(false);
  // File-based staging is native-only. On web, SQLite imports the bundled
  // catalogue below directly into its browser-backed database.
  const catalogAssetSource = Platform.OS === 'web'
    ? { assetId: require('../assets/db/natura.db'), forceOverwrite: true }
    : undefined;

  useEffect(() => {
    if (Platform.OS === 'web') {
      setCatalogReady(true);
      return;
    }
    void prepareCatalogDatabase(require('../assets/db/natura.db'))
      .catch((error: unknown) => console.warn('Catalogue preparation failed; opening the last local copy.', error))
      .finally(() => setCatalogReady(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if ((!fontsLoaded && !fontError) || !catalogReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Suspense fallback={<Loading />}>
          <SQLiteProvider
            databaseName={CATALOG_DATABASE_NAME}
            assetSource={catalogAssetSource}
            useSuspense
          >
            <CatalogUpdateProvider>
              <CatalogUpdateNotice />
              <UserDatabaseProvider>
                <ThemeProvider>
                  <MobileAuthProvider>
                    <MobileSyncProvider>
                      <FavoritesProvider>
                        <Navigator />
                      </FavoritesProvider>
                    </MobileSyncProvider>
                  </MobileAuthProvider>
                </ThemeProvider>
              </UserDatabaseProvider>
            </CatalogUpdateProvider>
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
