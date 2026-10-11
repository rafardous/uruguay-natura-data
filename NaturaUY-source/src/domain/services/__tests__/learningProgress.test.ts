import { LEARNING_PATHS } from '../../../content/learningContent';
import type { LearningObjectiveProgress } from '../../entities/learning';
import { learningModuleState } from '../learningProgress';

const module = LEARNING_PATHS[0]!.modules[0]!;
const now = 1000;
const mastered: LearningObjectiveProgress[] = module.questions.map(question => ({ objectiveId: question.objectiveId, questionVersion: question.version, correctStreak: 3, lastResult: true, lastAnsweredAt: 500, dueAt: 2000, updatedAt: 500 }));

test('preserves completed modules but requests practice for new or changed questions', () => {
  expect(learningModuleState(module, false, [], now)).toBe('Nuevo');
  expect(learningModuleState(module, true, mastered, now)).toBe('Comprendido');
  expect(learningModuleState(module, true, mastered.slice(1), now)).toBe('Para repasar');
  expect(learningModuleState(module, true, mastered.map(item => ({ ...item, questionVersion: 1 })), now)).toBe('Para repasar');
  expect(learningModuleState(module, true, mastered.map(item => ({ ...item, correctStreak: 1 })), now)).toBe('En práctica');
  expect(learningModuleState(module, true, mastered.map(item => ({ ...item, dueAt: now })), now)).toBe('Para repasar');
});
