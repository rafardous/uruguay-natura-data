import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import { mobileSupabase } from '../../lib/supabase';
import { settingsRepository } from './settingsRepository';

interface FavoriteSyncRow {
  codigo: string;
  is_favorite: number;
  updated_at: number;
}

interface QuizSyncRow {
  mode: string;
  scope: string;
  best_score: number;
  best_streak: number;
  played_at: number | null;
  updated_at: number;
}

interface SyncResponse {
  favorites: { catalogCode: string; isFavorite: boolean; updatedAt: number }[];
  quizRecords: { mode: string; scope: string; bestScore: number; bestStreak: number; playedAt: number | null; updatedAt: number }[];
}

async function deviceId(db: SQLiteDatabase): Promise<string> {
  const existing = await settingsRepository.get(db, 'sync.device_id');
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await settingsRepository.set(db, 'sync.device_id', created);
  return created;
}

async function applyRemote(db: SQLiteDatabase, remote: SyncResponse): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const favorite of remote.favorites) {
      const local = await db.getFirstAsync<{ updated_at: number }>(
        'SELECT updated_at FROM favorite_sync WHERE codigo = ?',
        [favorite.catalogCode],
      );
      if (local && local.updated_at > favorite.updatedAt) continue;
      if (favorite.isFavorite) {
        await db.runAsync('INSERT OR IGNORE INTO favorites (codigo, created_at) VALUES (?, ?)', [favorite.catalogCode, favorite.updatedAt]);
      } else {
        await db.runAsync('DELETE FROM favorites WHERE codigo = ?', [favorite.catalogCode]);
      }
      await db.runAsync(
        `INSERT INTO favorite_sync (codigo, is_favorite, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(codigo) DO UPDATE SET is_favorite = excluded.is_favorite, updated_at = excluded.updated_at`,
        [favorite.catalogCode, favorite.isFavorite ? 1 : 0, favorite.updatedAt],
      );
    }

    for (const record of remote.quizRecords) {
      await db.runAsync(
        `INSERT INTO quiz_records (mode, scope, best_score, best_streak, played_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(mode, scope) DO UPDATE SET
           best_score = MAX(best_score, excluded.best_score),
           best_streak = MAX(best_streak, excluded.best_streak),
           played_at = MAX(played_at, excluded.played_at)`,
        [record.mode, record.scope, record.bestScore, record.bestStreak, record.playedAt],
      );
      await db.runAsync(
        `INSERT INTO quiz_sync (mode, scope, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(mode, scope) DO UPDATE SET updated_at = MAX(updated_at, excluded.updated_at)`,
        [record.mode, record.scope, record.updatedAt],
      );
    }
  });
}

export const mobileSyncRepository = {
  async sync(db: SQLiteDatabase): Promise<void> {
    if (!mobileSupabase) return;
    const [id, favorites, quizRecords] = await Promise.all([
      deviceId(db),
      db.getAllAsync<FavoriteSyncRow>('SELECT codigo, is_favorite, updated_at FROM favorite_sync'),
      db.getAllAsync<QuizSyncRow>(
        `SELECT record.mode, record.scope, record.best_score, record.best_streak,
                record.played_at, sync.updated_at
         FROM quiz_records record
         JOIN quiz_sync sync ON sync.mode = record.mode AND sync.scope = record.scope`,
      ),
    ]);
    const { data, error } = await mobileSupabase.rpc('sync_mobile_state', {
      p_device_id: id,
      p_favorites: favorites.map((favorite) => ({
        catalogCode: favorite.codigo,
        isFavorite: favorite.is_favorite === 1,
        updatedAt: favorite.updated_at,
      })),
      p_quiz_records: quizRecords.map((record) => ({
        mode: record.mode,
        scope: record.scope,
        bestScore: record.best_score,
        bestStreak: record.best_streak,
        playedAt: record.played_at,
        updatedAt: record.updated_at,
      })),
    });
    if (error) throw error;
    await applyRemote(db, data as SyncResponse);
    await settingsRepository.set(db, 'sync.last_success_at', String(Date.now()));
  },
};
