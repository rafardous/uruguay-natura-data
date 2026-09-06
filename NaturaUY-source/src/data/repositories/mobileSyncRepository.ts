import type { SQLiteDatabase } from 'expo-sqlite';

import { mobileSupabase } from '../../lib/supabase';
import { settingsRepository } from './settingsRepository';
import { favoriteChangesPayload, gameResultPayload } from '../../domain/services/syncContracts';

interface FavoriteSyncRow {
  codigo: string;
  is_favorite: number;
  updated_at: number;
}

interface GameSyncRow {
  mode: string;
  scope: string;
  best_score: number;
  best_streak: number;
  updated_at: number;
  pending_games: number;
}

export interface RemoteFavorite {
  catalogCode: string;
  isFavorite: boolean;
  updatedAt: number;
}

export async function reconcileFavorites(db: SQLiteDatabase, remoteRows: RemoteFavorite[]): Promise<void> {
  const now = Date.now();
  const remote = new Map(remoteRows.map((row) => [row.catalogCode, row]));
  await db.withTransactionAsync(async () => {
    const local = await db.getAllAsync<{ codigo: string }>('SELECT codigo FROM favorites');
    const pending = await db.getAllAsync<FavoriteSyncRow>('SELECT codigo, is_favorite, updated_at FROM favorite_sync');
    const pendingByCode = new Map(pending.map((row) => [row.codigo, row]));
    for (const row of local) {
      const remoteRow = remote.get(row.codigo);
      const localChange = pendingByCode.get(row.codigo);
      if (remoteRow && !remoteRow.isFavorite && (!localChange || remoteRow.updatedAt >= localChange.updated_at)) await db.runAsync('DELETE FROM favorites WHERE codigo = ?', [row.codigo]);
    }
    for (const row of remoteRows) {
      const localChange = pendingByCode.get(row.catalogCode);
      if (row.isFavorite && (!localChange || row.updatedAt >= localChange.updated_at)) await db.runAsync('INSERT OR IGNORE INTO favorites (codigo, created_at) VALUES (?, ?)', [row.catalogCode, row.updatedAt || now]);
    }
    await db.runAsync('DELETE FROM favorite_sync');
    for (const row of pending) {
      const remoteRow = remote.get(row.codigo);
      if (!remoteRow || row.updated_at > remoteRow.updatedAt) await db.runAsync('INSERT INTO favorite_sync (codigo, is_favorite, updated_at) VALUES (?, ?, ?)', [row.codigo, row.is_favorite, row.updated_at]);
    }
  });
}

export const mobileSyncRepository = {
  async sync(db: SQLiteDatabase): Promise<void> {
    if (!mobileSupabase) return;
    const games = await db.getAllAsync<GameSyncRow>(
      `SELECT record.mode, record.scope, record.best_score, record.best_streak, COALESCE(record.played_at, 1) AS updated_at, sync.pending_games
       FROM quiz_records record JOIN game_sync sync ON sync.mode = record.mode AND sync.scope = record.scope
       WHERE sync.pending_games > 0`,
    );
    for (const game of games) {
      const { error } = await mobileSupabase.rpc('record_game_result', gameResultPayload(game));
      if (error) throw error;
      await db.runAsync('UPDATE game_sync SET pending_games = 0 WHERE mode = ? AND scope = ?', [game.mode, game.scope]);
    }

    const favorites = await db.getAllAsync<FavoriteSyncRow>('SELECT codigo, is_favorite, updated_at FROM favorite_sync');
    const { data, error } = await mobileSupabase.rpc('sync_favorites', {
      p_changes: favoriteChangesPayload(favorites),
    });
    if (error) throw error;
    await reconcileFavorites(db, (data ?? []) as RemoteFavorite[]);
    await settingsRepository.set(db, 'sync.last_success_at', String(Date.now()));
  },
};
