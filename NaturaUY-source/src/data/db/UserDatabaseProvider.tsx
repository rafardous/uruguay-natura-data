import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { USER_DATABASE_NAME, USER_MIGRATIONS } from './schema';
import { OWNED_DATABASE_OPTIONS } from './sqliteOpenOptions';
import { useStartup } from '../../presentation/components/StartupExperience';
import { lightColors } from '../../presentation/theme/tokens';

const UserDatabaseContext = createContext<SQLiteDatabase | null>(null);

/**
 * Opens (and migrates) the database holding everything the user creates.
 *
 * Deliberately separate from the catalogue: `natura.db` can be atomically
 * replaced by a verified editorial release, which would destroy favourites and
 * quiz records if they shared the file.
 */
export function UserDatabaseProvider({ children }: { children: ReactNode }): React.JSX.Element | null {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { mounted, ready } = useStartup();

  useEffect(() => {
    let active = true;
    let opened: SQLiteDatabase | null = null;
    setError(false);

    void (async () => {
      try {
        const database = await openDatabaseAsync(USER_DATABASE_NAME, OWNED_DATABASE_OPTIONS);
        for (const migration of USER_MIGRATIONS) await database.execAsync(migration);

        if (!active) {
          await database.closeAsync();
          return;
        }

        opened = database;
        setDb(database);
      } catch (cause) {
        console.warn('User database could not be opened.', cause);
        if (active) setError(true);
      }
    })();

    return () => {
      active = false;
      void opened?.closeAsync();
    };
  }, [attempt]);

  useEffect(() => {
    if (!error) return;
    mounted();
    ready();
  }, [error, mounted, ready]);

  if (error) return (
    <View style={styles.failure}>
      <Text style={styles.title}>No pudimos abrir tus datos locales</Text>
      <Text style={styles.body}>No borramos tus favoritos ni tus récords. Cerrá otras instancias de Natura UY y volvé a intentar.</Text>
      <Pressable onPress={() => { setDb(null); setAttempt((value) => value + 1); }} accessibilityRole="button" style={styles.button}>
        <Text style={styles.buttonText}>Reintentar</Text>
      </Pressable>
    </View>
  );

  // Migrations are a few CREATE TABLE IF NOT EXISTS statements, so this gate is
  // momentary; rendering children without a database would crash the hooks below.
  if (!db) return null;

  return <UserDatabaseContext.Provider value={db}>{children}</UserDatabaseContext.Provider>;
}

const styles = StyleSheet.create({
  failure: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: lightColors.background },
  title: { color: lightColors.text, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  body: { color: lightColors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 420 },
  button: { marginTop: 22, minHeight: 48, minWidth: 150, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: lightColors.primary },
  buttonText: { color: lightColors.onPrimary, fontSize: 15, fontWeight: '700' },
});

export function useUserDatabase(): SQLiteDatabase {
  const db = useContext(UserDatabaseContext);
  if (!db) throw new Error('useUserDatabase must be used inside <UserDatabaseProvider>');
  return db;
}
