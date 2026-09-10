import type { SQLiteDatabase } from 'expo-sqlite';

import type { KnowledgeLevel, QuizMode, QuizScope } from '../../domain/entities/quiz';

const storageScope = (scope: QuizScope, level: KnowledgeLevel): string => `${scope}:${level}`;
const parseStorageScope = (value: string): { scope: QuizScope; knowledgeLevel: KnowledgeLevel } => {
  const [scope, level] = value.split(':');
  return { scope: scope as QuizScope, knowledgeLevel: level === 'easy' || level === 'medium' || level === 'hard' ? level : 'hard' };
};

export interface QuizRecord {
  mode: QuizMode;
  scope: QuizScope;
  knowledgeLevel: KnowledgeLevel;
  bestScore: number;
  bestStreak: number;
  playedAt: number | null;
}

interface QuizScoreRow {
  mode: string;
  scope: string;
  best_score: number;
  best_streak: number;
  played_at: number | null;
}

export const quizRepository = {
  async getRecord(db: SQLiteDatabase, mode: QuizMode, scope: QuizScope, knowledgeLevel: KnowledgeLevel = 'hard'): Promise<QuizRecord | null> {
    const row = await db.getFirstAsync<QuizScoreRow>(
      'SELECT * FROM quiz_records WHERE mode = ? AND scope = ? LIMIT 1',
      [mode, storageScope(scope, knowledgeLevel)],
    );
    if (!row) return null;
    return {
      mode: row.mode as QuizMode,
      ...parseStorageScope(row.scope),
      bestScore: row.best_score,
      bestStreak: row.best_streak,
      playedAt: row.played_at,
    };
  },

  async listRecords(db: SQLiteDatabase, scope?: QuizScope): Promise<Record<string, QuizRecord>> {
    const rows = await db.getAllAsync<QuizScoreRow>(
      `SELECT * FROM quiz_records ${scope ? 'WHERE scope = ? OR scope LIKE ?' : ''}`,
      scope ? [scope, `${scope}:%`] : [],
    );

    return Object.fromEntries(
      rows.map((row) => [
        `${row.scope}:${row.mode}`,
        {
          mode: row.mode as QuizMode,
          ...parseStorageScope(row.scope),
          bestScore: row.best_score,
          bestStreak: row.best_streak,
          playedAt: row.played_at,
        },
      ]),
    );
  },

  /** Keeps the best of old and new, so a bad run never erases a record. */
  async submitRun(
    db: SQLiteDatabase,
    mode: QuizMode,
    scope: QuizScope,
    knowledgeLevel: KnowledgeLevel,
    score: number,
    streak: number,
  ): Promise<void> {
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO quiz_records (mode, scope, best_score, best_streak, played_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(mode, scope) DO UPDATE SET
           best_score  = MAX(best_score, excluded.best_score),
           best_streak = MAX(best_streak, excluded.best_streak),
           played_at   = excluded.played_at`,
        [mode, storageScope(scope, knowledgeLevel), score, streak, now],
      );
      await db.runAsync(
        `INSERT INTO quiz_sync (mode, scope, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(mode, scope) DO UPDATE SET updated_at = excluded.updated_at`,
        [mode, storageScope(scope, knowledgeLevel), now],
      );
      await db.runAsync(
        `INSERT INTO game_sync (mode, scope, pending_games) VALUES (?, ?, 1)
         ON CONFLICT(mode, scope) DO UPDATE SET pending_games = pending_games + 1`,
        [mode, storageScope(scope, knowledgeLevel)],
      );
    });
  },
};
