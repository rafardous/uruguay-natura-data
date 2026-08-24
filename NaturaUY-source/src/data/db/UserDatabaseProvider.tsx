import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { USER_DATABASE_NAME, USER_MIGRATIONS } from './schema';

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

  useEffect(() => {
    let active = true;
    let opened: SQLiteDatabase | null = null;

    void (async () => {
      const database = await openDatabaseAsync(USER_DATABASE_NAME);
      for (const migration of USER_MIGRATIONS) {
        await database.execAsync(migration);
      }

      if (!active) {
        await database.closeAsync();
        return;
      }

      opened = database;
      setDb(database);
    })();

    return () => {
      active = false;
      void opened?.closeAsync();
    };
  }, []);

  // Migrations are a few CREATE TABLE IF NOT EXISTS statements, so this gate is
  // momentary; rendering children without a database would crash the hooks below.
  if (!db) return null;

  return <UserDatabaseContext.Provider value={db}>{children}</UserDatabaseContext.Provider>;
}

export function useUserDatabase(): SQLiteDatabase {
  const db = useContext(UserDatabaseContext);
  if (!db) throw new Error('useUserDatabase must be used inside <UserDatabaseProvider>');
  return db;
}
