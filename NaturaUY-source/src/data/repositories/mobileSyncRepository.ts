import type { SQLiteDatabase } from 'expo-sqlite';

import { mobileSupabase } from '../../lib/supabase';
import { favoriteChangesPayload, gameResultPayload } from '../../domain/services/syncContracts';
import { settingsRepository } from './settingsRepository';

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

interface PuzzleSyncRow {
  scope: string;
  grid_size: number;
  best_time_ms: number;
  fewest_moves: number;
  played_at: number;
  updated_at: number;
}

export interface RemoteFavorite {
  catalogCode: string;
  isFavorite: boolean;
  updatedAt: number;
}

export interface RemoteQuizRecord {
  mode: string;
  scope: string;
  bestScore: number;
  bestStreak: number;
  playedAt: number;
  updatedAt: number;
}

export interface RemotePuzzleRecord {
  scope: string;
  gridSize: number;
  bestTimeMs: number;
  fewestMoves: number;
  playedAt: number;
  updatedAt: number;
}

interface RemoteProgress {
  quizRecords?: RemoteQuizRecord[];
  puzzleRecords?: RemotePuzzleRecord[];
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
      if (remoteRow && !remoteRow.isFavorite && (!localChange || remoteRow.updatedAt >= localChange.updated_at)) {
        await db.runAsync('DELETE FROM favorites WHERE codigo = ?', [row.codigo]);
      }
    }
    for (const row of remoteRows) {
      const localChange = pendingByCode.get(row.catalogCode);
      if (row.isFavorite && (!localChange || row.updatedAt >= localChange.updated_at)) {
        await db.runAsync('INSERT OR IGNORE INTO favorites (codigo, created_at) VALUES (?, ?)', [row.catalogCode, row.updatedAt || now]);
      }
    }
    await db.runAsync('DELETE FROM favorite_sync');
    for (const row of pending) {
      const remoteRow = remote.get(row.codigo);
      if (!remoteRow || row.updated_at > remoteRow.updatedAt) {
        await db.runAsync('INSERT INTO favorite_sync (codigo, is_favorite, updated_at) VALUES (?, ?, ?)', [row.codigo, row.is_favorite, row.updated_at]);
      }
    }
  });
}

export async function reconcileQuizRecords(db: SQLiteDatabase, rows: RemoteQuizRecord[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(
        `INSERT INTO quiz_records (mode, scope, best_score, best_streak, played_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(mode, scope) DO UPDATE SET
           best_score = MAX(best_score, excluded.best_score),
           best_streak = MAX(best_streak, excluded.best_streak),
           played_at = MAX(COALESCE(played_at, 0), excluded.played_at)`,
        [row.mode, row.scope, row.bestScore, row.bestStreak, row.playedAt],
      );
      await db.runAsync(
        `INSERT INTO quiz_sync (mode, scope, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(mode, scope) DO UPDATE SET updated_at = MAX(updated_at, excluded.updated_at)`,
        [row.mode, row.scope, row.updatedAt],
      );
      await db.runAsync('INSERT OR IGNORE INTO game_sync (mode, scope, pending_games) VALUES (?, ?, 0)', [row.mode, row.scope]);
    }
  });
}

export async function reconcilePuzzleRecords(db: SQLiteDatabase, rows: RemotePuzzleRecord[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(
        `INSERT INTO puzzle_records (scope, grid_size, best_time_ms, fewest_moves, played_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(scope, grid_size) DO UPDATE SET
           best_time_ms = MIN(best_time_ms, excluded.best_time_ms),
           fewest_moves = MIN(fewest_moves, excluded.fewest_moves),
           played_at = MAX(played_at, excluded.played_at),
           updated_at = MAX(updated_at, excluded.updated_at)`,
        [row.scope, row.gridSize, row.bestTimeMs, row.fewestMoves, row.playedAt, row.updatedAt],
      );
    }
  });
}

async function syncFavorites(db: SQLiteDatabase): Promise<void> {
  if (!mobileSupabase) return;
  const favorites = await db.getAllAsync<FavoriteSyncRow>('SELECT codigo, is_favorite, updated_at FROM favorite_sync');
  const { data, error } = await mobileSupabase.rpc('sync_favorites', {
    p_changes: favoriteChangesPayload(favorites),
  });
  if (error) throw error;
  await reconcileFavorites(db, (data ?? []) as RemoteFavorite[]);
}

async function syncGames(db: SQLiteDatabase): Promise<void> {
  if (!mobileSupabase) return;
  const games = await db.getAllAsync<GameSyncRow>(
    `SELECT record.mode, record.scope, record.best_score, record.best_streak,
            COALESCE(record.played_at, 1) AS updated_at, sync.pending_games
     FROM quiz_records record
     JOIN game_sync sync ON sync.mode = record.mode AND sync.scope = record.scope
     WHERE sync.pending_games > 0`,
  );
  for (const game of games) {
    const { error } = await mobileSupabase.rpc('record_game_result', gameResultPayload(game));
    if (error) throw error;
    await db.runAsync('UPDATE game_sync SET pending_games = 0 WHERE mode = ? AND scope = ?', [game.mode, game.scope]);
  }
}

async function syncPuzzles(db: SQLiteDatabase): Promise<void> {
  if (!mobileSupabase) return;
  const puzzleRecords = await db.getAllAsync<PuzzleSyncRow>(
    'SELECT scope, grid_size, best_time_ms, fewest_moves, played_at, updated_at FROM puzzle_records LIMIT 24',
  );
  const { error } = await mobileSupabase.rpc('sync_puzzle_records', {
    p_records: puzzleRecords.map((row) => ({
      scope: row.scope,
      gridSize: row.grid_size,
      bestTimeMs: row.best_time_ms,
      fewestMoves: row.fewest_moves,
      playedAt: row.played_at,
      updatedAt: row.updated_at,
    })),
  });
  if (error) throw error;
}

async function pullProgress(db: SQLiteDatabase): Promise<void> {
  if (!mobileSupabase) return;
  const { data, error } = await mobileSupabase.rpc('get_personal_mobile_progress');
  if (error) throw error;
  const progress = (data ?? {}) as RemoteProgress;
  await reconcileQuizRecords(db, progress.quizRecords ?? []);
  await reconcilePuzzleRecords(db, progress.puzzleRecords ?? []);
}

export const mobileSyncRepository = {
  async sync(db: SQLiteDatabase): Promise<void> {
    if (!mobileSupabase) return;
    const failures: string[] = [];
    for (const [name, operation] of [
      ['favoritos', () => syncFavorites(db)],
      ['récords', () => syncGames(db)],
      ['puzzle', () => syncPuzzles(db)],
      ['descarga', () => pullProgress(db)],
    ] as const) {
      try {
        await operation();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        failures.push(`${name}: ${detail}`);
      }
    }
    if (failures.length > 0) throw new Error(failures.join(' · '));
    await settingsRepository.set(db, 'sync.last_success_at', String(Date.now()));
  },
};
