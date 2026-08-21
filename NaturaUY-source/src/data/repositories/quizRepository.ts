import type { SQLiteDatabase } from 'expo-sqlite';

import type { QuizMode } from '../../domain/entities/quiz';

export interface QuizRecord {
  mode: QuizMode;
  bestScore: number;
  bestStreak: number;
  playedAt: number | null;
}

interface QuizScoreRow {
  mode: string;
  best_score: number;
  best_streak: number;
  played_at: number | null;
}

export const quizRepository = {
  async listRecords(db: SQLiteDatabase): Promise<Record<string, QuizRecord>> {
    const rows = await db.getAllAsync<QuizScoreRow>('SELECT * FROM quiz_scores');

    return Object.fromEntries(
      rows.map((row) => [
        row.mode,
        {
          mode: row.mode as QuizMode,
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
    score: number,
    streak: number,
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO quiz_scores (mode, best_score, best_streak, played_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(mode) DO UPDATE SET
         best_score  = MAX(best_score, excluded.best_score),
         best_streak = MAX(best_streak, excluded.best_streak),
         played_at   = excluded.played_at`,
      [mode, score, streak, Date.now()],
    );
  },
};
