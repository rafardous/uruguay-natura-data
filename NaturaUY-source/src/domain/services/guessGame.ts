import type { Species } from '../entities/species';
import { dietLabel, habitatLabel } from '../catalogLabels';

export const CLUE_KINDS = ['habitat', 'diet', 'behavior', 'appearance', 'decisive'] as const;
export type ClueKind = typeof CLUE_KINDS[number];
export interface GameClue { kind: ClueKind; body: string; sortOrder: number; sourceCode?: string | null }
export interface GuessRound { answer: Species; clues: GameClue[]; options: Species[] }
export interface GuessState { guesses: string[]; status: 'playing' | 'won' | 'lost'; score: number }
export const CLUE_LABELS: Record<ClueKind, string> = { habitat: 'Hábitat', diet: 'Alimentación', behavior: 'Comportamiento', appearance: 'Apariencia', decisive: 'Pista decisiva' };
export const normalizeGuess = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

// Reject texts that reveal any full answer, including the accepted name and aliases.
export function clueRevealsAnswer(body: string, species: Species): boolean {
  const text = ` ${normalizeGuess(body).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return [species.displayName, species.scientificName, species.acceptedName, ...species.commonNames]
    .filter((name): name is string => !!name && normalizeGuess(name).length > 2)
    .some(name => text.includes(` ${normalizeGuess(name).replace(/[^\p{L}\p{N}]+/gu, ' ')} `));
}

/** Editorial overrides are authoritative; fallback uses only already published fields. */
export function buildGuessClues(species: Species, editorial: GameClue[] = []): GameClue[] {
  const behaviorLabels: Record<string, string> = { terrestrial: 'Se desplaza en tierra.', aquatic: 'Se desplaza en el agua.', aerial: 'Se desplaza volando.', arboreal: 'Vive entre los árboles.', diurnal: 'Tiene actividad durante el día.', nocturnal: 'Tiene actividad de noche.', crepuscular: 'Tiene actividad al amanecer o al atardecer.', both: 'Puede tener actividad de día y de noche.' };
  const behavior = [...species.ecology.lifeModes, ...species.ecology.activity].map(value => behaviorLabels[value]).filter(Boolean).join(' ');
  const diagnostic = species.naturalHistory?.arthropod?.identification?.diagnosticCharacters?.join('. ');
  const fallbacks: Partial<Record<ClueKind, string>> = {
    habitat: species.ecology.habitats.length ? `Habita en ${species.ecology.habitats.map(habitatLabel).join(', ').toLocaleLowerCase('es')}.` : undefined,
    diet: species.ecology.diet.length ? `Su alimentación incluye ${species.ecology.diet.map(dietLabel).join(', ').toLocaleLowerCase('es')}.` : undefined,
    behavior: behavior || undefined,
    appearance: diagnostic || undefined,
    decisive: species.facts.find(fact => !clueRevealsAnswer(fact.body, species))?.body || undefined,
  };
  const clues = CLUE_KINDS.map((kind, index) => {
    const override = editorial.find(clue => clue.kind === kind);
    return override ?? { kind, body: fallbacks[kind] ?? '', sortOrder: index + 1 };
  }).filter(clue => clue.body.trim() && !clueRevealsAnswer(clue.body, species)).sort((a, b) => a.sortOrder - b.sortOrder);
  // Never fill a missing biological attribute with an invented one.
  return clues.length === 5 && new Set(clues.map(clue => clue.sortOrder)).size === 5 ? clues : [];
}

export function guessSuggestions(pool: Species[], query: string, used: string[]): Species[] {
  const terms = normalizeGuess(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return pool.filter(species => !used.includes(species.codigo) && terms.every(term =>
    normalizeGuess([species.displayName, species.scientificName, species.acceptedName, ...species.commonNames].join(' ')).includes(term)
  )).slice(0, 8);
}

export function submitGuess(state: GuessState, round: GuessRound, codigo: string, candidates: Species[], mode: 'search' | 'choices'): GuessState {
  if (state.status !== 'playing' || state.guesses.includes(codigo) || !(mode === 'choices' ? round.options : candidates).some(item => item.codigo === codigo)) return state;
  const guesses = [...state.guesses, codigo];
  if (codigo === round.answer.codigo) return { guesses, status: 'won', score: (6 - guesses.length) * (mode === 'choices' ? 50 : 100) };
  return { guesses, status: guesses.length === 5 ? 'lost' : 'playing', score: 0 };
}

export function shuffled<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
}

export function guessOptions(answer: Species, pool: Species[]): Species[] {
  const others = pool.filter(item => item.codigo !== answer.codigo);
  const nearby = shuffled(others.filter(item => item.taxonomy.clase === answer.taxonomy.clase));
  const selected = [...nearby, ...shuffled(others.filter(item => item.taxonomy.clase !== answer.taxonomy.clase))].slice(0, 5);
  return shuffled([answer, ...selected]);
}
