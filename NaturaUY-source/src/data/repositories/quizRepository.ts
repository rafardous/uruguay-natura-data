import type { SQLiteDatabase } from 'expo-sqlite';

import type { QuizMode, QuizScope } from '../../domain/entities/quiz';

export interface QuizRecord {
  mode: QuizMode;
  scope: QuizScope;
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
  async listRecords(db: SQLiteDatabase, scope?: QuizScope): Promise<Record<string, QuizRecord>> {
    const rows = await db.getAllAsync<QuizScoreRow>(
      `SELECT * FROM quiz_records ${scope ? 'WHERE scope = ?' : ''}`,
      scope ? [scope] : [],
    );

    return Object.fromEntries(
      rows.map((row) => [
        `${row.scope}:${row.mode}`,
        {
          mode: row.mode as QuizMode,
          scope: row.scope as QuizScope,
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
        [mode, scope, score, streak, now],
      );
      await db.runAsync(
        `INSERT INTO quiz_sync (mode, scope, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(mode, scope) DO UPDATE SET updated_at = excluded.updated_at`,
        [mode, scope, now],
      );
    });
  },
};
