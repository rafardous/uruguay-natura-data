import { nextLearningReview } from '../learningRepository';

const DAY = 24 * 60 * 60 * 1000;
const row = (streak: number, answeredAt: number, version = 1) => ({ objective_id: 'o', question_version: version, correct_streak: streak, last_result: 1, last_answered_at: answeredAt, due_at: answeredAt, updated_at: answeredAt });

describe('learning review schedule', () => {
  it('sends an error to tomorrow', () => expect(nextLearningReview(row(2, 1), false, 1000, 1)).toEqual({ streak: 0, dueAt: 1000 + DAY }));
  it('uses 3, 14 and 45 day intervals', () => {
    expect(nextLearningReview(null, true, 1000, 1)).toEqual({ streak: 1, dueAt: 1000 + 3 * DAY });
    expect(nextLearningReview(row(1, 1000), true, 1000 + DAY, 1)).toEqual({ streak: 2, dueAt: 1000 + DAY + 14 * DAY });
    expect(nextLearningReview(row(2, 1000), true, 1000 + DAY, 1)).toEqual({ streak: 3, dueAt: 1000 + DAY + 45 * DAY });
  });
  it('does not increase mastery twice on the same local day', () => {
    const now = new Date(2026, 8, 13, 15).getTime();
    expect(nextLearningReview(row(1, new Date(2026, 8, 13, 9).getTime()), true, now, 1).streak).toBe(1);
  });
  it('resets mastery when the question version changes', () => expect(nextLearningReview(row(3, 1000, 1), true, 1000 + DAY, 2).streak).toBe(1));
});
