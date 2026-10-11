import type { LearningModule, LearningObjectiveProgress } from '../entities/learning';

export function learningModuleState(module: LearningModule, complete: boolean, objectives: LearningObjectiveProgress[], now: number): string {
  if (!complete) return 'Nuevo';
  const progress = module.questions.map(question => objectives.find(item => item.objectiveId === question.objectiveId && item.questionVersion === question.version));
  if (progress.some(item => !item || !item.lastResult || item.dueAt <= now)) return 'Para repasar';
  return progress.every(item => item!.correctStreak >= 3) ? 'Comprendido' : 'En práctica';
}
