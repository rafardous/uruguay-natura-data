import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import { StatusBar } from 'expo-status-bar';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';

import { CatalogUpdateProvider, useCatalogUpdateState } from '../src/data/db/CatalogUpdateProvider';
import { prepareCatalogDatabase, SUPPORTED_CATALOG_SCHEMA } from '../src/data/db/catalogUpdater';
import { CATALOG_DATABASE_NAME } from '../src/data/db/schema';
import { UserDatabaseProvider } from '../src/data/db/UserDatabaseProvider';
import { MobileAuthProvider } from '../src/auth/MobileAuthProvider';
import { FavoritesProvider } from '../src/presentation/hooks/FavoritesProvider';
import { MobileSyncProvider } from '../src/sync/MobileSyncProvider';
import { ThemeProvider, useTheme } from '../src/presentation/theme/ThemeProvider';
import { lightColors } from '../src/presentation/theme/tokens';
import { StartupExperience, useStartup } from '../src/presentation/components/StartupExperience';

/**
 * The catalogue ships prebuilt, so `assetSource` copies one file on first launch
 * and every later start opens it directly — no import step, no empty state.
 */
function Navigator(): React.JSX.Element {
  const { colors } = useTheme();
  const { mounted, ready } = useStartup();
  const pathname = usePathname();
  useEffect(() => {
    mounted();
    if (pathname !== '/' && pathname !== '/index') ready();
  }, [mounted, pathname, ready]);

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
        <Stack.Screen name="auth/callback" options={{ animation: 'fade', gestureEnabled: false }} />
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
        <Stack.Screen name="game/identify-modes" options={{ animation: 'fade_from_bottom', animationDuration: 260 }} />
        <Stack.Screen name="game/categories" options={{ animation: 'fade_from_bottom', animationDuration: 260 }} />
        <Stack.Screen name="game/records" options={{ animation: 'fade_from_bottom', animationDuration: 260 }} />
        <Stack.Screen name="credits" />
      </Stack>
    </>
  );
}

async function verifyOpenedCatalog(database: SQLiteDatabase): Promise<void> {
  const [integrity, schema, species] = await Promise.all([
    database.getFirstAsync<{ quick_check?: string; integrity_check?: string }>('PRAGMA quick_check'),
    database.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'"),
    database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM species'),
  ]);
  if ((integrity?.quick_check ?? integrity?.integrity_check) !== 'ok') throw new Error('catalog_integrity_failed');
  if (Number(schema?.value) !== SUPPORTED_CATALOG_SCHEMA) throw new Error('catalog_schema_unsupported');
  if (!species?.count) throw new Error('catalog_empty');
}

function LocalDataFailure({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const { mounted, ready } = useStartup();
  useEffect(() => { mounted(); ready(); }, [mounted, ready]);
  return (
    <View style={styles.failure}>
      <Text style={styles.failureTitle}>No pudimos abrir el catálogo</Text>
      <Text style={styles.failureBody}>Tus datos personales siguen guardados. Probá nuevamente para restaurar la copia incluida con Natura UY.</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" style={styles.failureButton}>
        <Text style={styles.failureButtonText}>Reintentar</Text>
      </Pressable>
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
const BUNDLED_CATALOG_ASSET_ID = require('../assets/db/natura.db');

export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({ Fraunces_600SemiBold });
  const [catalogReady, setCatalogReady] = useState(false);
  const [forceBundledCatalog, setForceBundledCatalog] = useState(false);
  const [databaseError, setDatabaseError] = useState<Error | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const automaticRecoveryStarted = useRef(false);
  // File-based staging is native-only. On web, SQLite imports the bundled
  // catalogue below directly into its browser-backed database. The schema is
  // part of the web filename so a new bundled schema gets a fresh database
  // without overwriting a file that an HMR worker may still have open.
  const catalogDatabaseName = Platform.OS === 'web'
    ? `natura.web.schema-${SUPPORTED_CATALOG_SCHEMA}.db`
    : CATALOG_DATABASE_NAME;
  const catalogAssetSource = {
    assetId: BUNDLED_CATALOG_ASSET_ID,
    // A development client can retain an empty database from a failed
    // previous bundle. Always re-import the known-good bundled catalogue in
    // development; user.db remains separate and is never touched.
    forceOverwrite: Platform.OS !== 'web' && (__DEV__ || forceBundledCatalog),
  };

  useEffect(() => {
    let active = true;
    setCatalogReady(false);
    if (Platform.OS === 'web' || __DEV__) {
      setCatalogReady(true);
      return () => { active = false; };
    }
    void prepareCatalogDatabase(BUNDLED_CATALOG_ASSET_ID)
      .catch((error: unknown) => {
        // Some OEM filesystem implementations can reject the staging move.
        // SQLiteProvider's native asset importer is the safest fallback: it
        // replaces only natura.db, never the separate user.db.
        console.warn('Catalogue preparation failed; restoring the bundled copy.', error);
        if (active) setForceBundledCatalog(true);
      })
      .finally(() => { if (active) setCatalogReady(true); });
    return () => { active = false; };
  }, [bootstrapAttempt]);

  const retryDatabase = useCallback(() => {
    setDatabaseError(null);
    setForceBundledCatalog(true);
    setBootstrapAttempt((attempt) => attempt + 1);
  }, []);
  const handleDatabaseError = useCallback((error: Error) => {
    // SQLiteProvider reports non-Suspense failures while rendering its error
    // branch. Defer the parent state update to the next task.
    console.warn('Catalog database could not be opened.', error);
    if (Platform.OS !== 'web' && !forceBundledCatalog && !automaticRecoveryStarted.current) {
      automaticRecoveryStarted.current = true;
      setTimeout(() => {
        setForceBundledCatalog(true);
        setBootstrapAttempt((attempt) => attempt + 1);
      }, 0);
      return;
    }
    setTimeout(() => setDatabaseError(error), 0);
  }, [forceBundledCatalog]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StartupExperience>
        {databaseError ? <LocalDataFailure onRetry={retryDatabase} /> :
        ((fontsLoaded || fontError) && catalogReady && (
          <SQLiteProvider
            key={`${catalogDatabaseName}-${bootstrapAttempt}-${forceBundledCatalog ? 'bundled' : 'installed'}`}
            databaseName={catalogDatabaseName}
            assetSource={catalogAssetSource}
            onInit={verifyOpenedCatalog}
            onError={handleDatabaseError}
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
        ))}
        </StartupExperience>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  failure: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: lightColors.background },
  failureTitle: { color: lightColors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  failureBody: { color: lightColors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 420 },
  failureButton: { marginTop: 22, minHeight: 48, minWidth: 150, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: lightColors.primary },
  failureButtonText: { color: lightColors.onPrimary, fontSize: 15, fontWeight: '700' },
});
