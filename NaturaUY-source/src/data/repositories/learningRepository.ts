import type { SQLiteDatabase } from 'expo-sqlite';
import type { LearningMasteryState, LearningObjectiveProgress } from '../../domain/entities/learning';

const DAY = 24 * 60 * 60 * 1000;

export interface LearningModuleProgress {
  pathId: string;
  moduleId: string;
  contentVersion: number;
  completedAt: number;
  updatedAt: number;
}

interface ObjectiveRow {
  objective_id: string;
  question_version: number;
  correct_streak: number;
  last_result: number;
  last_answered_at: number;
  due_at: number;
  updated_at: number;
}

const sameLocalDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

export function nextLearningReview(previous: ObjectiveRow | null, correct: boolean, now: number, version: number) {
  if (!correct) return { streak: 0, dueAt: now + DAY };
  const previousStreak = previous?.question_version === version ? previous.correct_streak : 0;
  const streak = previous && previous.last_result === 1 && sameLocalDay(previous.last_answered_at, now)
    ? previousStreak
    : Math.min(3, previousStreak + 1);
  const delay = streak >= 3 ? 45 * DAY : streak === 2 ? 14 * DAY : 3 * DAY;
  return { streak, dueAt: now + delay };
}

const mapObjective = (row: ObjectiveRow): LearningObjectiveProgress => ({
  objectiveId: row.objective_id, questionVersion: row.question_version, correctStreak: row.correct_streak,
  lastResult: row.last_result === 1, lastAnsweredAt: row.last_answered_at, dueAt: row.due_at, updatedAt: row.updated_at,
});

export const learningRepository = {
  async listModules(db: SQLiteDatabase): Promise<LearningModuleProgress[]> {
    const rows = await db.getAllAsync<{ path_id: string; module_id: string; content_version: number; completed_at: number; updated_at: number }>('SELECT * FROM learning_module_progress');
    return rows.map((row) => ({ pathId: row.path_id, moduleId: row.module_id, contentVersion: row.content_version, completedAt: row.completed_at, updatedAt: row.updated_at }));
  },
  async listObjectives(db: SQLiteDatabase): Promise<LearningObjectiveProgress[]> {
    return (await db.getAllAsync<ObjectiveRow>('SELECT * FROM learning_objective_progress')).map(mapObjective);
  },
  async dueObjectives(db: SQLiteDatabase, limit = 8): Promise<LearningObjectiveProgress[]> {
    return (await db.getAllAsync<ObjectiveRow>('SELECT * FROM learning_objective_progress WHERE due_at <= ? ORDER BY due_at ASC LIMIT ?', [Date.now(), limit])).map(mapObjective);
  },
  async completeModule(db: SQLiteDatabase, pathId: string, moduleId: string, version = 1): Promise<void> {
    const now = Date.now();
    await db.runAsync(`INSERT INTO learning_module_progress(path_id,module_id,content_version,completed_at,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(path_id,module_id) DO UPDATE SET content_version=excluded.content_version, completed_at=MIN(completed_at,excluded.completed_at), updated_at=excluded.updated_at`,
    [pathId, moduleId, version, now, now]);
  },
  async recordAnswer(db: SQLiteDatabase, objectiveId: string, version: number, correct: boolean): Promise<LearningObjectiveProgress> {
    const now = Date.now();
    const previous = await db.getFirstAsync<ObjectiveRow>('SELECT * FROM learning_objective_progress WHERE objective_id=?', [objectiveId]);
    const next = nextLearningReview(previous, correct, now, version);
    await db.runAsync(`INSERT INTO learning_objective_progress(objective_id,question_version,correct_streak,last_result,last_answered_at,due_at,updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(objective_id) DO UPDATE SET question_version=excluded.question_version,correct_streak=excluded.correct_streak,last_result=excluded.last_result,last_answered_at=excluded.last_answered_at,due_at=excluded.due_at,updated_at=excluded.updated_at`,
    [objectiveId, version, next.streak, correct ? 1 : 0, now, next.dueAt, now]);
    return { objectiveId, questionVersion: version, correctStreak: next.streak, lastResult: correct, lastAnsweredAt: now, dueAt: next.dueAt, updatedAt: now };
  },
  state(progress: LearningObjectiveProgress | undefined): LearningMasteryState {
    if (!progress || !progress.lastResult || progress.dueAt <= Date.now()) return 'review';
    return progress.correctStreak >= 3 ? 'understood' : 'practicing';
  },
};
