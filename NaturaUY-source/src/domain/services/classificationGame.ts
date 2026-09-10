import type { Species } from '../entities/species';

export type ClassificationLevel = 'easy' | 'medium' | 'hard';
export type ClassificationRank = 'clase' | 'orden' | 'familia';

export interface ClassificationQuestion {
  species: Species;
  rank: ClassificationRank;
  rankLabel: string;
  correctAnswer: string;
  options: string[];
}

export const CLASSIFICATION_LEVELS: Record<ClassificationLevel, { rank: ClassificationRank; rankLabel: string; prompt: string }> = {
  easy: { rank: 'clase', rankLabel: 'clase', prompt: '¿A qué clase pertenece?' },
  medium: { rank: 'orden', rankLabel: 'orden', prompt: '¿A qué orden pertenece?' },
  hard: { rank: 'familia', rankLabel: 'familia', prompt: '¿A qué familia pertenece?' },
};

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

/** Builds photo questions with three plausible, distinct distractors. */
export function buildClassificationQuestions(
  pool: Species[],
  level: ClassificationLevel,
  count = 8,
  random: () => number = Math.random,
): ClassificationQuestion[] {
  const config = CLASSIFICATION_LEVELS[level];
  const values = [...new Set(pool.map((species) => species.taxonomy[config.rank]).filter(Boolean))];
  if (values.length < 4) return [];

  return shuffled(pool.filter((species) => Boolean(species.photo && species.taxonomy[config.rank])), random)
    .slice(0, count)
    .map((species) => {
      const correctAnswer = species.taxonomy[config.rank];
      const distractors = shuffled(values.filter((value) => value !== correctAnswer), random).slice(0, 3);
      return {
        species,
        rank: config.rank,
        rankLabel: config.rankLabel,
        correctAnswer,
        options: shuffled([correctAnswer, ...distractors], random),
      };
    });
}
