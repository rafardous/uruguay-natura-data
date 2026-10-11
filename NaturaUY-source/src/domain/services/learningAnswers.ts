import type { LearningQuestion } from '../entities/learning';

export function canCheckLearningAnswer(question: LearningQuestion, selected: string[], classified: Record<string, string>): boolean {
  if (question.type === 'classify') return question.options.length > 0 && question.options.every(item => typeof classified[item] === 'string' && question.categories?.includes(classified[item]!));
  if (question.type === 'single') return selected.length === 1;
  if (question.type === 'order') return selected.length === question.options.length;
  return selected.length > 0;
}

export function checkLearningAnswer(question: LearningQuestion, selected: string[], classified: Record<string, string>): boolean {
  if (!canCheckLearningAnswer(question, selected, classified)) return false;
  if (question.type === 'classify') return question.options.every(item => classified[item] === question.classification?.[item]);
  if (!question.correct.length || selected.some(item => !question.options.includes(item)) || new Set(selected).size !== selected.length) return false;
  return selected.length === question.correct.length && question.correct.every((item, index) => question.type === 'order' ? selected[index] === item : selected.includes(item));
}
