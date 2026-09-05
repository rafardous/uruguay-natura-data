import type { SQLiteDatabase } from 'expo-sqlite';

import { mobileSupabase } from '../../lib/supabase';
import { settingsRepository } from './settingsRepository';

interface FavoriteSyncRow {
  codigo: string;
  is_favorite: number;
}

interface GameSyncRow {
  mode: string;
  scope: string;
  best_score: number;
  pending_games: number;
}

async function reconcileFavorites(db: SQLiteDatabase, remoteCodes: string[]): Promise<void> {
  const now = Date.now();
  const remote = new Set(remoteCodes);
  await db.withTransactionAsync(async () => {
    const local = await db.getAllAsync<{ codigo: string }>('SELECT codigo FROM favorites');
    for (const row of local) if (!remote.has(row.codigo)) await db.runAsync('DELETE FROM favorites WHERE codigo = ?', [row.codigo]);
    for (const codigo of remote) await db.runAsync('INSERT OR IGNORE INTO favorites (codigo, created_at) VALUES (?, ?)', [codigo, now]);
    await db.runAsync('DELETE FROM favorite_sync');
    for (const codigo of remote) await db.runAsync('INSERT INTO favorite_sync (codigo, is_favorite, updated_at) VALUES (?, 1, ?)', [codigo, now]);
  });
}

export const mobileSyncRepository = {
  async sync(db: SQLiteDatabase): Promise<void> {
    if (!mobileSupabase) return;
    const games = await db.getAllAsync<GameSyncRow>(
      `SELECT record.mode, record.scope, record.best_score, sync.pending_games
       FROM quiz_records record JOIN game_sync sync ON sync.mode = record.mode AND sync.scope = record.scope
       WHERE sync.pending_games > 0`,
    );
    for (const game of games) {
      const { error } = await mobileSupabase.rpc('record_game_result', {
        p_game_mode: `${game.mode}:${game.scope}`,
        p_score: game.best_score,
        p_games_delta: game.pending_games,
      });
      if (error) throw error;
      await db.runAsync('UPDATE game_sync SET pending_games = 0 WHERE mode = ? AND scope = ?', [game.mode, game.scope]);
    }

    const favorites = await db.getAllAsync<FavoriteSyncRow>('SELECT codigo, is_favorite FROM favorite_sync');
    const { data, error } = await mobileSupabase.rpc('sync_favorites', {
      p_changes: favorites.map((favorite) => ({ catalogCode: favorite.codigo, isFavorite: favorite.is_favorite === 1 })),
    });
    if (error) throw error;
    await reconcileFavorites(db, (data ?? []) as string[]);
    await settingsRepository.set(db, 'sync.last_success_at', String(Date.now()));
  },
};
