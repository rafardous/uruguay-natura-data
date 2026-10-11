import { LEARNING_PATHS } from '../../../content/learningContent';
import { canCheckLearningAnswer, checkLearningAnswer } from '../learningAnswers';

const questions = LEARNING_PATHS.flatMap(path => path.modules.flatMap(module => module.questions));

describe('learning answer checking', () => {
  it('accepts a valid answer for every shipped question', () => {
    for (const question of questions) {
      expect(canCheckLearningAnswer(question, question.correct, question.classification ?? {})).toBe(true);
      expect(checkLearningAnswer(question, question.correct, question.classification ?? {})).toBe(true);
    }
  });

  it('lets children answer the first taxonomy question with one choice', () => {
    const question = questions.find(item => item.id === 'tax-purpose')!;
    expect(question.type).toBe('single');
    expect(question.version).toBe(2);
    for (const option of question.options) {
      expect(canCheckLearningAnswer(question, [option], {})).toBe(true);
      expect(checkLearningAnswer(question, [option], {})).toBe(question.correct.includes(option));
    }
  });

  it('requires every correct choice for multi-select, but permits checking a partial attempt', () => {
    const question = questions.find(item => item.type === 'multi')!;
    expect(canCheckLearningAnswer(question, [question.correct[0]!], {})).toBe(true);
    expect(checkLearningAnswer(question, [question.correct[0]!], {})).toBe(false);
    expect(checkLearningAnswer(question, [...question.correct].reverse(), {})).toBe(true);
    expect(checkLearningAnswer(question, question.options, {})).toBe(false);
  });

  it('checks order and rejects incomplete sequences', () => {
    const question = questions.find(item => item.type === 'order')!;
    expect(canCheckLearningAnswer(question, question.correct.slice(1), {})).toBe(false);
    expect(checkLearningAnswer(question, [...question.correct].reverse(), {})).toBe(false);
  });

  it('requires a valid classification for each item', () => {
    const question = questions.find(item => item.type === 'classify')!;
    expect(canCheckLearningAnswer(question, [], {})).toBe(false);
    expect(checkLearningAnswer(question, [], Object.fromEntries(question.options.map(item => [item, 'Unknown'])))).toBe(false);
    const wrong = { ...question.classification, [question.options[0]!]: question.categories!.find(item => item !== question.classification![question.options[0]!])! };
    expect(canCheckLearningAnswer(question, [], wrong)).toBe(true);
    expect(checkLearningAnswer(question, [], wrong)).toBe(false);
  });

  it('rejects duplicate choices and values outside the question', () => {
    const question = questions.find(item => item.type === 'multi')!;
    expect(checkLearningAnswer(question, [...question.correct, question.correct[0]!], {})).toBe(false);
    expect(checkLearningAnswer(question, ['invented'], {})).toBe(false);
  });
});
