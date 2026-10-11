import type { SQLiteDatabase } from 'expo-sqlite';
import { ENRICHED_RECORDS_SQL } from './enrichedGameRepository';

const ACCOUNT_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS account_favorites (owner_id TEXT NOT NULL, codigo TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, codigo));
CREATE TABLE IF NOT EXISTS account_favorite_sync (owner_id TEXT NOT NULL, codigo TEXT NOT NULL, is_favorite INTEGER NOT NULL CHECK (is_favorite IN (0, 1)), updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, codigo));
CREATE TABLE IF NOT EXISTS account_quiz_records (owner_id TEXT NOT NULL, mode TEXT NOT NULL, scope TEXT NOT NULL, best_score INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0, played_at INTEGER, PRIMARY KEY (owner_id, mode, scope));
CREATE TABLE IF NOT EXISTS account_quiz_sync (owner_id TEXT NOT NULL, mode TEXT NOT NULL, scope TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, mode, scope));
CREATE TABLE IF NOT EXISTS account_game_sync (owner_id TEXT NOT NULL, mode TEXT NOT NULL, scope TEXT NOT NULL, pending_games INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (owner_id, mode, scope));
CREATE TABLE IF NOT EXISTS account_puzzle_records (owner_id TEXT NOT NULL, scope TEXT NOT NULL, grid_size INTEGER NOT NULL CHECK (grid_size IN (3,4)), best_time_ms INTEGER NOT NULL, fewest_moves INTEGER NOT NULL, played_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, scope, grid_size));
CREATE TABLE IF NOT EXISTS account_learning_module_progress (owner_id TEXT NOT NULL, path_id TEXT NOT NULL, module_id TEXT NOT NULL, content_version INTEGER NOT NULL, completed_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, path_id, module_id));
CREATE TABLE IF NOT EXISTS account_learning_objective_progress (owner_id TEXT NOT NULL, objective_id TEXT NOT NULL, question_version INTEGER NOT NULL, correct_streak INTEGER NOT NULL DEFAULT 0, last_result INTEGER NOT NULL CHECK (last_result IN (0,1)), last_answered_at INTEGER NOT NULL, due_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_id, objective_id));`;

/**
 * `user.db` stays offline-first, but its active tables must never mix two
 * Google accounts. Each account is snapshotted before another one becomes
 * active, including pending mutations that have not reached Supabase yet.
 */
export async function activateLocalAccount(db: SQLiteDatabase, ownerId: string): Promise<boolean> {
  await db.execAsync(ACCOUNT_TABLES_SQL);
  await db.execAsync(ENRICHED_RECORDS_SQL);
  const current = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'sync.active_owner_id' LIMIT 1",
  );

  // Existing installations adopt their current offline data on the first
  // successful login. That preserves favourites created before signing in.
  if (!current) {
    await db.runAsync(
      "INSERT INTO settings (key, value) VALUES ('sync.active_owner_id', ?)",
      [ownerId],
    );
    return false;
  }
  if (current.value === ownerId) return false;

  await db.withTransactionAsync(async () => {
    const previous = current.value;
    await db.runAsync('DELETE FROM account_enriched_game_records WHERE owner_id=?', [previous]);
    await db.runAsync('INSERT INTO account_enriched_game_records SELECT ?, mode, scope, best_score, best_time_ms, fewest_moves, played_at, updated_at FROM enriched_game_records', [previous]);
    await db.runAsync('DELETE FROM enriched_game_records');
    await db.runAsync('INSERT INTO enriched_game_records SELECT mode, scope, best_score, best_time_ms, fewest_moves, played_at, updated_at FROM account_enriched_game_records WHERE owner_id=?', [ownerId]);
    for (const table of ['account_favorites', 'account_favorite_sync', 'account_quiz_records', 'account_quiz_sync', 'account_game_sync', 'account_puzzle_records', 'account_learning_module_progress', 'account_learning_objective_progress']) {
      await db.runAsync(`DELETE FROM ${table} WHERE owner_id = ?`, [previous]);
    }
    await db.runAsync('INSERT INTO account_favorites SELECT ?, codigo, created_at FROM favorites', [previous]);
    await db.runAsync('INSERT INTO account_favorite_sync SELECT ?, codigo, is_favorite, updated_at FROM favorite_sync', [previous]);
    await db.runAsync('INSERT INTO account_quiz_records SELECT ?, mode, scope, best_score, best_streak, played_at FROM quiz_records', [previous]);
    await db.runAsync('INSERT INTO account_quiz_sync SELECT ?, mode, scope, updated_at FROM quiz_sync', [previous]);
    await db.runAsync('INSERT INTO account_game_sync SELECT ?, mode, scope, pending_games FROM game_sync', [previous]);
    await db.runAsync('INSERT INTO account_puzzle_records SELECT ?, scope, grid_size, best_time_ms, fewest_moves, played_at, updated_at FROM puzzle_records', [previous]);
    await db.runAsync('INSERT INTO account_learning_module_progress SELECT ?, path_id, module_id, content_version, completed_at, updated_at FROM learning_module_progress', [previous]);
    await db.runAsync('INSERT INTO account_learning_objective_progress SELECT ?, objective_id, question_version, correct_streak, last_result, last_answered_at, due_at, updated_at FROM learning_objective_progress', [previous]);

    await db.execAsync('DELETE FROM favorites; DELETE FROM favorite_sync; DELETE FROM quiz_records; DELETE FROM quiz_sync; DELETE FROM game_sync; DELETE FROM puzzle_records; DELETE FROM learning_module_progress; DELETE FROM learning_objective_progress;');

    await db.runAsync('INSERT INTO favorites SELECT codigo, created_at FROM account_favorites WHERE owner_id = ?', [ownerId]);
    await db.runAsync('INSERT INTO favorite_sync SELECT codigo, is_favorite, updated_at FROM account_favorite_sync WHERE owner_id = ?', [ownerId]);
    await db.runAsync('INSERT INTO quiz_records SELECT mode, scope, best_score, best_streak, played_at FROM account_quiz_records WHERE owner_id = ?', [ownerId]);
    await db.runAsync('INSERT INTO quiz_sync SELECT mode, scope, updated_at FROM account_quiz_sync WHERE owner_id = ?', [ownerId]);
    await db.runAsync('INSERT INTO game_sync SELECT mode, scope, pending_games FROM account_game_sync WHERE owner_id = ?', [ownerId]);
    await db.runAsync('INSERT INTO puzzle_records SELECT scope, grid_size, best_time_ms, fewest_moves, played_at, updated_at FROM account_puzzle_records WHERE owner_id = ?', [ownerId]);
    await db.runAsync('INSERT INTO learning_module_progress SELECT path_id, module_id, content_version, completed_at, updated_at FROM account_learning_module_progress WHERE owner_id = ?', [ownerId]);
    await db.runAsync('INSERT INTO learning_objective_progress SELECT objective_id, question_version, correct_streak, last_result, last_answered_at, due_at, updated_at FROM account_learning_objective_progress WHERE owner_id = ?', [ownerId]);
    await db.runAsync("UPDATE settings SET value = ? WHERE key = 'sync.active_owner_id'", [ownerId]);
  });

  return true;
}
