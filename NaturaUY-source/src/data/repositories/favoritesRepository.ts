import type { SQLiteDatabase } from 'expo-sqlite';

export const favoritesRepository = {
  async listCodigos(db: SQLiteDatabase): Promise<string[]> {
    const rows = await db.getAllAsync<{ codigo: string }>(
      'SELECT codigo FROM favorites ORDER BY created_at DESC',
    );
    return rows.map((r) => r.codigo);
  },

  async add(db: SQLiteDatabase, codigo: string): Promise<void> {
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT OR IGNORE INTO favorites (codigo, created_at) VALUES (?, ?)', [codigo, now]);
      await db.runAsync(
        `INSERT INTO favorite_sync (codigo, is_favorite, updated_at) VALUES (?, 1, ?)
         ON CONFLICT(codigo) DO UPDATE SET is_favorite = 1, updated_at = excluded.updated_at`,
        [codigo, now],
      );
    });
  },

  async remove(db: SQLiteDatabase, codigo: string): Promise<void> {
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM favorites WHERE codigo = ?', [codigo]);
      await db.runAsync(
        `INSERT INTO favorite_sync (codigo, is_favorite, updated_at) VALUES (?, 0, ?)
         ON CONFLICT(codigo) DO UPDATE SET is_favorite = 0, updated_at = excluded.updated_at`,
        [codigo, now],
      );
    });
  },

  /** Returns the resulting state so callers can update optimistically. */
  async toggle(db: SQLiteDatabase, codigo: string): Promise<boolean> {
    const existing = await db.getFirstAsync<{ codigo: string }>(
      'SELECT codigo FROM favorites WHERE codigo = ?',
      [codigo],
    );

    if (existing) {
      await favoritesRepository.remove(db, codigo);
      return false;
    }

    await favoritesRepository.add(db, codigo);
    return true;
  },
};
