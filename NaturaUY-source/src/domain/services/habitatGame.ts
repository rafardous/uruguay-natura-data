import type { Species } from '../entities/species';

export const MACRO_HABITATS = [
  'Campo natural',
  'Monte y matorral',
  'Humedales y aguas continentales',
  'Costa y mar',
  'Sierras y roquedales',
  'Ambientes humanos',
] as const;
export type MacroHabitat = (typeof MACRO_HABITATS)[number];

const HABITAT_GROUPS: Record<MacroHabitat, string[]> = {
  'Campo natural': ['pastizal_campo_natural'],
  'Monte y matorral': ['monte_nativo', 'matorral'],
  'Humedales y aguas continentales': ['humedal', 'laguna_estero', 'rio_arroyo'],
  'Costa y mar': ['costa_playa_dunas', 'mar_costero', 'mar_abierto'],
  'Sierras y roquedales': ['roquedal_sierras'],
  'Ambientes humanos': ['agroecosistema', 'urbano_suburbano'],
};

const EXPLANATIONS: Record<MacroHabitat, string> = {
  'Campo natural': 'Se asocia a pastizales y campos naturales, donde encuentra alimento, refugio o lugares para reproducirse.',
  'Monte y matorral': 'Usa árboles, arbustos y matorrales para alimentarse, refugiarse o desplazarse.',
  'Humedales y aguas continentales': 'Está vinculada a ríos, arroyos, lagunas, esteros o humedales de agua dulce.',
  'Costa y mar': 'Puede encontrarse en playas, dunas, costas o aguas marinas.',
  'Sierras y roquedales': 'Aprovecha ambientes con afloramientos rocosos, sierras y paredones.',
  'Ambientes humanos': 'También puede vivir en cultivos, chacras, jardines o áreas urbanas.',
};

export interface HabitatQuestion {
  id: string;
  species: Species;
  correctAnswers: MacroHabitat[];
  options: MacroHabitat[];
  explanation: string;
  isRetry?: boolean;
}

export function macroHabitatsFor(species: Pick<Species, 'habitat'>): MacroHabitat[] {
  return MACRO_HABITATS.filter((group) => species.habitat.some((raw) => HABITAT_GROUPS[group].includes(raw)));
}

export function habitatExplanation(groups: MacroHabitat[]): string {
  if (groups.length === 0) return 'Todavía no tenemos un ambiente principal cargado para esta especie.';
  return groups.length === 1
    ? EXPLANATIONS[groups[0]!]
    : `Puede usar varios ambientes. En el catálogo figura en ${groups.slice(0, -1).join(', ')} y ${groups.at(-1)}.`;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function balancedCandidates(pool: Species[], count: number, random: () => number): Species[] {
  // The interface always shows three choices. Excluding species with four or
  // more macro-habitats is what lets every known habitat remain a valid answer.
  const usable = pool.filter((species) => species.photo && macroHabitatsFor(species).length > 0 && macroHabitatsFor(species).length <= 3);
  const birds = shuffle(usable.filter((species) => species.taxonomy.clase.toLocaleLowerCase('es') === 'aves'), random);
  const other = shuffle(usable.filter((species) => species.taxonomy.clase.toLocaleLowerCase('es') !== 'aves'), random);
  if (other.length === 0 || birds.length === 0) return shuffle(usable, random);
  const target = Math.min(count, usable.length);
  const birdLimit = Math.floor(target * 0.6);
  const otherNeeded = target - birdLimit;
  const otherPicked = other.slice(0, otherNeeded);
  const birdsPicked = birds.slice(0, Math.min(birds.length, Math.max(birdLimit, target - otherPicked.length)));
  return shuffle([...birdsPicked, ...otherPicked], random);
}

export function buildHabitatQuestions(pool: Species[], count = 10, random: () => number = Math.random): HabitatQuestion[] {
  const candidates = balancedCandidates(pool, count, random);
  const selected: Species[] = [];
  for (const species of candidates) {
    if (selected.some((item) => item.codigo === species.codigo)) continue;
    selected.push(species);
    if (selected.length >= count) break;
  }
  return selected.map((species) => {
    const correctAnswers = macroHabitatsFor(species);
    const distractors = shuffle(MACRO_HABITATS.filter((option) => !correctAnswers.includes(option)), random);
    const options = shuffle([...correctAnswers, ...distractors.slice(0, Math.max(0, 3 - correctAnswers.length))], random).slice(0, 3);
    return { id: species.codigo, species, correctAnswers, options, explanation: habitatExplanation(correctAnswers) };
  });
}

/** Adds one retry two to four places after the original question. */
export function scheduleHabitatRetry(questions: HabitatQuestion[], question: HabitatQuestion, answeredAt: number, random: () => number = Math.random): HabitatQuestion[] {
  if (question.isRetry || questions.some((item) => item.isRetry && item.id === question.id)) return questions;
  const offset = 2 + Math.floor(random() * 3);
  const insertAt = Math.min(questions.length, answeredAt + offset);
  const retry = { ...question, isRetry: true };
  return [...questions.slice(0, insertAt), retry, ...questions.slice(insertAt)];
}
