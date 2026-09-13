import { LEARNING_PATHS, LEARNING_SOURCES } from '../learningContent';

describe('learning curriculum', () => {
  it('ships five complete routes and every source resolves', () => {
    expect(LEARNING_PATHS).toHaveLength(5);
    expect(LEARNING_PATHS.flatMap((path) => path.modules)).toHaveLength(21);
    const sourceCodes = new Set(LEARNING_SOURCES.map((source) => source.code));
    for (const module of LEARNING_PATHS.flatMap((path) => path.modules)) {
      expect(module.blocks.length).toBeGreaterThanOrEqual(3);
      expect(module.questions.length).toBeGreaterThan(0);
      expect(module.sourceCodes.every((code) => sourceCodes.has(code))).toBe(true);
    }
  });

  it('covers all four formative question types with unique objectives', () => {
    const questions = LEARNING_PATHS.flatMap((path) => path.modules.flatMap((module) => module.questions));
    expect(new Set(questions.map((question) => question.type))).toEqual(new Set(['single', 'multi', 'order', 'classify']));
    expect(new Set(questions.map((question) => question.objectiveId)).size).toBe(questions.length);
    for (const question of questions) {
      if (question.type === 'classify') expect(Object.keys(question.classification ?? {})).toHaveLength(question.options.length);
      else expect(question.correct.every((answer) => question.options.includes(answer))).toBe(true);
    }
  });
});
