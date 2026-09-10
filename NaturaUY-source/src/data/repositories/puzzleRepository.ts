import type { SQLiteDatabase } from 'expo-sqlite';
import type { PuzzleDifficulty, PuzzleRecord, PuzzleScope } from '../../domain/entities/puzzle';
import type { KnowledgeLevel } from '../../domain/entities/species';

const storedScope = (scope: PuzzleScope, level: KnowledgeLevel): string => `${scope}:${level}`;
const fromRow = (row: Omit<PuzzleRecord, 'scope' | 'knowledgeLevel'> & { scope: string }): PuzzleRecord => {
  const [scope, rawLevel] = row.scope.split(':');
  const knowledgeLevel: KnowledgeLevel = rawLevel === 'easy' || rawLevel === 'medium' ? rawLevel : 'hard';
  return { ...row, scope: scope as PuzzleScope, knowledgeLevel };
};

export const puzzleRepository = {
  async list(db: SQLiteDatabase): Promise<PuzzleRecord[]> {
    await db.execAsync('CREATE TABLE IF NOT EXISTS puzzle_records (scope TEXT NOT NULL, grid_size INTEGER NOT NULL CHECK (grid_size IN (3,4)), best_time_ms INTEGER NOT NULL, fewest_moves INTEGER NOT NULL, played_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (scope, grid_size))');
    const rows = await db.getAllAsync<Omit<PuzzleRecord, 'scope' | 'knowledgeLevel'> & { scope: string }>('SELECT scope, grid_size as gridSize, best_time_ms as bestTimeMs, fewest_moves as fewestMoves, played_at as playedAt, updated_at as updatedAt FROM puzzle_records ORDER BY scope, grid_size');
    return rows.map(fromRow);
  },
  async get(db: SQLiteDatabase, scope: PuzzleScope, gridSize: PuzzleDifficulty, knowledgeLevel: KnowledgeLevel = 'hard'): Promise<PuzzleRecord | null> {
    await db.execAsync('CREATE TABLE IF NOT EXISTS puzzle_records (scope TEXT NOT NULL, grid_size INTEGER NOT NULL CHECK (grid_size IN (3,4)), best_time_ms INTEGER NOT NULL, fewest_moves INTEGER NOT NULL, played_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (scope, grid_size))');
    const row = await db.getFirstAsync<Omit<PuzzleRecord, 'scope' | 'knowledgeLevel'> & { scope: string }>('SELECT scope, grid_size as gridSize, best_time_ms as bestTimeMs, fewest_moves as fewestMoves, played_at as playedAt, updated_at as updatedAt FROM puzzle_records WHERE scope = ? AND grid_size = ?', [storedScope(scope, knowledgeLevel), gridSize]);
    return row ? fromRow(row) : null;
  },
  async submit(db: SQLiteDatabase, record: PuzzleRecord): Promise<void> {
    await db.execAsync('CREATE TABLE IF NOT EXISTS puzzle_records (scope TEXT NOT NULL, grid_size INTEGER NOT NULL CHECK (grid_size IN (3,4)), best_time_ms INTEGER NOT NULL, fewest_moves INTEGER NOT NULL, played_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (scope, grid_size))');
    const scope = storedScope(record.scope, record.knowledgeLevel);
    await db.runAsync(`INSERT OR IGNORE INTO puzzle_records (scope, grid_size, best_time_ms, fewest_moves, played_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [scope, record.gridSize, record.bestTimeMs, record.fewestMoves, record.playedAt, record.updatedAt]);
    await db.runAsync(`UPDATE puzzle_records SET best_time_ms = CASE WHEN ? < best_time_ms THEN ? ELSE best_time_ms END, fewest_moves = CASE WHEN ? < fewest_moves THEN ? ELSE fewest_moves END, played_at = ?, updated_at = ? WHERE scope = ? AND grid_size = ?`, [record.bestTimeMs, record.bestTimeMs, record.fewestMoves, record.fewestMoves, record.playedAt, record.updatedAt, scope, record.gridSize]);
  },
};
