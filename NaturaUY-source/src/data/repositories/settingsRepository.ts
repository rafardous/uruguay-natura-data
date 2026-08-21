import type { SQLiteDatabase } from 'expo-sqlite';

/** Small key/value store for user preferences, kept in the same database. */
export const settingsRepository = {
  async get(db: SQLiteDatabase, key: string): Promise<string | null> {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
      key,
    ]);
    return row?.value ?? null;
  },

  async set(db: SQLiteDatabase, key: string, value: string): Promise<void> {
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  },
};
