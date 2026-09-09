import type { SQLiteDatabase } from 'expo-sqlite';

/** Small key/value store for user preferences, kept in the same database. */
export const settingsRepository = {
  async get(db: SQLiteDatabase, key: string): Promise<string | null> {
    // Expo Go can reuse an experience-scoped user.db created by an older
    // bundle; keep reads self-healing instead of surfacing a native prepare
    // error while migrations catch up.
    await db.execAsync('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
      key,
    ]);
    return row?.value ?? null;
  },

  async set(db: SQLiteDatabase, key: string, value: string): Promise<void> {
    await db.execAsync('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  },
};
