/**
 * Quiz rules, as pure functions.
 *
 * Deliberately free of React and React Native imports so the rules can be unit
 * tested directly. Randomness is injected, which keeps tests deterministic.
 */
import { QUIZ_MODES, type QuizOption, type QuizQuestion, type QuizRunState } from '../entities/quiz';
import { isQuizEligible, type Species } from '../entities/species';

export type Rng = () => number;

const OPTION_COUNT = 4;

const pickIndex = (length: number, rng: Rng): number => Math.floor(rng() * length);

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * A distractor is only fair if the player could rule it out from the photo.
 *
 * Modern taxonomy merges some SNAP entries — *Melanophryniscus orejasmirandai*
 * and *M. pachyrhinus* resolve to the same accepted taxon and therefore share a
 * photograph. Offering both would make the question unanswerable, so candidates
 * sharing the target's image or display name are excluded outright.
 */
function isFairDistractor(candidate: Species, target: Species): boolean {
  if (candidate.codigo === target.codigo) return false;
  if (candidate.displayName === target.displayName) return false;
  if (candidate.photo && target.photo && candidate.photo.url === target.photo.url) return false;
  return true;
}

/**
 * Draws distractors from progressively wider taxonomic rings, so wrong answers
 * are plausible relatives rather than random noise — that is what makes the
 * difficulty meaningful.
 */
export function selectDistractors(
  target: Species,
  pool: readonly Species[],
  rng: Rng,
  count = OPTION_COUNT - 1,
): Species[] {
  const fair = pool.filter((candidate) => isFairDistractor(candidate, target));

  const rings: Species[][] = [
    fair.filter((s) => s.taxonomy.familia === target.taxonomy.familia),
    fair.filter((s) => s.taxonomy.orden === target.taxonomy.orden && s.taxonomy.familia !== target.taxonomy.familia),
    fair.filter((s) => s.taxonomy.clase === target.taxonomy.clase && s.taxonomy.orden !== target.taxonomy.orden),
    fair.filter((s) => s.taxonomy.clase !== target.taxonomy.clase),
  ];

  const chosen: Species[] = [];
  const taken = new Set<string>();

  for (const ring of rings) {
    const available = ring.filter((s) => !taken.has(s.codigo));
    while (chosen.length < count && available.length > 0) {
      const [picked] = available.splice(pickIndex(available.length, rng), 1);
      if (!picked) break;
      chosen.push(picked);
      taken.add(picked.codigo);
    }
    if (chosen.length >= count) break;
  }

  return chosen;
}

export function buildQuestion(target: Species, pool: readonly Species[], rng: Rng): QuizQuestion {
  const distractors = selectDistractors(target, pool, rng);

  const options: QuizOption[] = [
    { codigo: target.codigo, label: target.displayName, correct: true },
    ...distractors.map((s) => ({ codigo: s.codigo, label: s.displayName, correct: false })),
  ];

  return { target, options: shuffle(options, rng) };
}

/** Species that can actually be asked about: they need a photo to show. */
export const eligibleTargets = (pool: readonly Species[]): Species[] => pool.filter(isQuizEligible);

export function answerQuestion(state: QuizRunState, wasCorrect: boolean): QuizRunState {
  const config = QUIZ_MODES[state.mode];

  const streak = wasCorrect ? state.streak + 1 : 0;
  const livesLeft = state.livesLeft === null ? null : wasCorrect ? state.livesLeft : state.livesLeft - 1;
  const questionIndex = state.questionIndex + 1;

  const outOfLives = livesLeft !== null && livesLeft <= 0;
  const outOfQuestions = config.questionCount !== null && questionIndex >= config.questionCount;

  return {
    ...state,
    questionIndex,
    score: wasCorrect ? state.score + 1 : state.score,
    streak,
    bestStreakThisRun: Math.max(state.bestStreakThisRun, streak),
    livesLeft,
    finished: outOfLives || outOfQuestions,
  };
}

/** Ends a timed run when the clock runs out. */
export const finishRun = (state: QuizRunState): QuizRunState => ({ ...state, finished: true });

/** Rewards a survival streak without imposing a cap on earned lives. */
export const grantExtraLife = (state: QuizRunState): QuizRunState =>
  state.livesLeft === null ? state : { ...state, livesLeft: state.livesLeft + 1 };

/** Total questions for progress UI, or null when the run is open-ended. */
export const totalQuestions = (state: QuizRunState): number | null =>
  QUIZ_MODES[state.mode].questionCount;
