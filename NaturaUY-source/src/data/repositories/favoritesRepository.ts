import type { SQLiteDatabase } from 'expo-sqlite';

export const favoritesRepository = {
  async listCodigos(db: SQLiteDatabase): Promise<string[]> {
    const rows = await db.getAllAsync<{ codigo: string }>(
      'SELECT codigo FROM favorites ORDER BY created_at DESC',
    );
    return rows.map((r) => r.codigo);
  },

  async add(db: SQLiteDatabase, codigo: string): Promise<void> {
    await db.runAsync('INSERT OR IGNORE INTO favorites (codigo, created_at) VALUES (?, ?)', [
      codigo,
      Date.now(),
    ]);
  },

  async remove(db: SQLiteDatabase, codigo: string): Promise<void> {
    await db.runAsync('DELETE FROM favorites WHERE codigo = ?', [codigo]);
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
