import type { SQLiteDatabase } from 'expo-sqlite';
import type { PuzzleDifficulty, PuzzleRecord, PuzzleScope } from '../../domain/entities/puzzle';

export const puzzleRepository = {
  async list(db: SQLiteDatabase): Promise<PuzzleRecord[]> {
    await db.execAsync('CREATE TABLE IF NOT EXISTS puzzle_records (scope TEXT NOT NULL, grid_size INTEGER NOT NULL CHECK (grid_size IN (3,4)), best_time_ms INTEGER NOT NULL, fewest_moves INTEGER NOT NULL, played_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (scope, grid_size))');
    return db.getAllAsync<PuzzleRecord>('SELECT scope, grid_size as gridSize, best_time_ms as bestTimeMs, fewest_moves as fewestMoves, played_at as playedAt, updated_at as updatedAt FROM puzzle_records ORDER BY scope, grid_size');
  },
  async get(db: SQLiteDatabase, scope: PuzzleScope, gridSize: PuzzleDifficulty): Promise<PuzzleRecord | null> {
    await db.execAsync('CREATE TABLE IF NOT EXISTS puzzle_records (scope TEXT NOT NULL, grid_size INTEGER NOT NULL CHECK (grid_size IN (3,4)), best_time_ms INTEGER NOT NULL, fewest_moves INTEGER NOT NULL, played_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (scope, grid_size))');
    return db.getFirstAsync<PuzzleRecord>('SELECT scope, grid_size as gridSize, best_time_ms as bestTimeMs, fewest_moves as fewestMoves, played_at as playedAt, updated_at as updatedAt FROM puzzle_records WHERE scope = ? AND grid_size = ?', [scope, gridSize]);
  },
  async submit(db: SQLiteDatabase, record: PuzzleRecord): Promise<void> {
    await db.execAsync('CREATE TABLE IF NOT EXISTS puzzle_records (scope TEXT NOT NULL, grid_size INTEGER NOT NULL CHECK (grid_size IN (3,4)), best_time_ms INTEGER NOT NULL, fewest_moves INTEGER NOT NULL, played_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (scope, grid_size))');
    await db.runAsync(`INSERT OR IGNORE INTO puzzle_records (scope, grid_size, best_time_ms, fewest_moves, played_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [record.scope, record.gridSize, record.bestTimeMs, record.fewestMoves, record.playedAt, record.updatedAt]);
    await db.runAsync(`UPDATE puzzle_records SET best_time_ms = CASE WHEN ? < best_time_ms THEN ? ELSE best_time_ms END, fewest_moves = CASE WHEN ? < fewest_moves THEN ? ELSE fewest_moves END, played_at = ?, updated_at = ? WHERE scope = ? AND grid_size = ?`, [record.bestTimeMs, record.bestTimeMs, record.fewestMoves, record.fewestMoves, record.playedAt, record.updatedAt, record.scope, record.gridSize]);
  },
};
