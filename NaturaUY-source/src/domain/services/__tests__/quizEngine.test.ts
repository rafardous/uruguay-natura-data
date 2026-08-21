import { createRun, QUIZ_MODES } from '../../entities/quiz';
import { makeSpecies, seededRng } from '../../../testing/speciesFactory';
import { answerQuestion, buildQuestion, eligibleTargets, selectDistractors } from '../quizEngine';

describe('eligibleTargets', () => {
  it('only offers species that actually have a photo to show', () => {
    const withPhoto = makeSpecies();
    const withoutPhoto = makeSpecies({ photo: null });

    expect(eligibleTargets([withPhoto, withoutPhoto])).toEqual([withPhoto]);
  });
});

describe('selectDistractors', () => {
  const rng = seededRng(42);

  it('prefers same-family species so the question is not trivially easy', () => {
    const target = makeSpecies({ taxonomy: { clase: 'Aves', orden: 'Passeriformes', familia: 'Tyrannidae', genero: 'A', epiteto: 'x' } });
    const sameFamily = Array.from({ length: 5 }, () =>
      makeSpecies({ taxonomy: { clase: 'Aves', orden: 'Passeriformes', familia: 'Tyrannidae', genero: 'B', epiteto: 'y' } }),
    );
    const farAway = Array.from({ length: 5 }, () =>
      makeSpecies({ taxonomy: { clase: 'Mammalia', orden: 'Rodentia', familia: 'Caviidae', genero: 'C', epiteto: 'z' } }),
    );

    const picked = selectDistractors(target, [...sameFamily, ...farAway], rng);

    expect(picked).toHaveLength(3);
    expect(picked.every((s) => s.taxonomy.familia === 'Tyrannidae')).toBe(true);
  });

  it('widens to the order, then the class, when the family is too small', () => {
    const target = makeSpecies({ taxonomy: { clase: 'Aves', orden: 'Passeriformes', familia: 'Tyrannidae', genero: 'A', epiteto: 'x' } });
    const sameOrder = makeSpecies({ taxonomy: { clase: 'Aves', orden: 'Passeriformes', familia: 'Furnariidae', genero: 'B', epiteto: 'y' } });
    const sameClass = makeSpecies({ taxonomy: { clase: 'Aves', orden: 'Anseriformes', familia: 'Anatidae', genero: 'C', epiteto: 'z' } });
    const other = makeSpecies({ taxonomy: { clase: 'Reptilia', orden: 'Squamata', familia: 'Colubridae', genero: 'D', epiteto: 'w' } });

    const picked = selectDistractors(target, [sameOrder, sameClass, other], rng);

    expect(picked).toHaveLength(3);
    expect(picked).toEqual(expect.arrayContaining([sameOrder, sameClass, other]));
  });

  it('never offers a species that shares the target photo', () => {
    // Modern taxonomy merges some SNAP entries, so two códigos can resolve to
    // one taxon and therefore one photograph. Offering both is unanswerable.
    const shared = 'https://example.test/shared.jpg';
    const target = makeSpecies({ codigo: 'A', photo: { ...makeSpecies().photo!, url: shared } });
    const twin = makeSpecies({ codigo: 'B', photo: { ...makeSpecies().photo!, url: shared } });
    const honest = Array.from({ length: 4 }, () => makeSpecies());

    const picked = selectDistractors(target, [twin, ...honest], rng);

    expect(picked.map((s) => s.codigo)).not.toContain('B');
  });

  it('never offers a duplicate display name', () => {
    const target = makeSpecies({ displayName: 'Tero' });
    const namesake = makeSpecies({ displayName: 'Tero' });
    const others = Array.from({ length: 4 }, () => makeSpecies());

    const picked = selectDistractors(target, [namesake, ...others], rng);

    expect(picked.filter((s) => s.displayName === 'Tero')).toHaveLength(0);
  });

  it('returns fewer distractors rather than repeating when the pool is tiny', () => {
    const target = makeSpecies();
    const only = makeSpecies();

    expect(selectDistractors(target, [only], rng)).toHaveLength(1);
  });
});

describe('buildQuestion', () => {
  it('produces exactly one correct option among four', () => {
    const rng = seededRng(7);
    const target = makeSpecies();
    const pool = Array.from({ length: 12 }, () => makeSpecies());

    const question = buildQuestion(target, pool, rng);

    expect(question.options).toHaveLength(4);
    expect(question.options.filter((o) => o.correct)).toHaveLength(1);
    expect(question.options.find((o) => o.correct)?.codigo).toBe(target.codigo);
  });

  it('does not always place the answer in the same slot', () => {
    const pool = Array.from({ length: 20 }, () => makeSpecies());
    const positions = new Set<number>();

    for (let seed = 1; seed <= 25; seed++) {
      const question = buildQuestion(makeSpecies(), pool, seededRng(seed));
      positions.add(question.options.findIndex((o) => o.correct));
    }

    expect(positions.size).toBeGreaterThan(1);
  });
});

describe('answerQuestion', () => {
  it('scores correct answers and grows the streak', () => {
    let state = createRun('classic');
    state = answerQuestion(state, true);
    state = answerQuestion(state, true);

    expect(state.score).toBe(2);
    expect(state.streak).toBe(2);
    expect(state.bestStreakThisRun).toBe(2);
  });

  it('resets the streak on a miss but remembers the best one', () => {
    let state = createRun('classic');
    state = answerQuestion(state, true);
    state = answerQuestion(state, true);
    state = answerQuestion(state, false);

    expect(state.streak).toBe(0);
    expect(state.bestStreakThisRun).toBe(2);
    expect(state.score).toBe(2);
  });

  it('ends the classic run after the configured number of questions', () => {
    let state = createRun('classic');
    const count = QUIZ_MODES.classic.questionCount!;

    for (let i = 0; i < count - 1; i++) state = answerQuestion(state, true);
    expect(state.finished).toBe(false);

    state = answerQuestion(state, true);
    expect(state.finished).toBe(true);
  });

  it('ends the survival run when lives run out, not before', () => {
    let state = createRun('survival');
    expect(state.livesLeft).toBe(3);

    state = answerQuestion(state, false);
    state = answerQuestion(state, false);
    expect(state.finished).toBe(false);
    expect(state.livesLeft).toBe(1);

    state = answerQuestion(state, false);
    expect(state.livesLeft).toBe(0);
    expect(state.finished).toBe(true);
  });

  it('leaves survival runs open while answers stay correct', () => {
    let state = createRun('survival');
    for (let i = 0; i < 30; i++) state = answerQuestion(state, true);

    expect(state.finished).toBe(false);
    expect(state.score).toBe(30);
  });
});
