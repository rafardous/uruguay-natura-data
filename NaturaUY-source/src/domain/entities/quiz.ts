import type { Species } from './species';

export type QuizMode = 'classic' | 'timed' | 'survival';
export type QuizScope = 'animals_all' | 'birds' | 'mammals' | 'reptiles' | 'amphibians' | 'fish';

export interface QuizScopeConfig {
  id: QuizScope;
  label: string;
  classes: string[];
}

export const QUIZ_SCOPES: Record<QuizScope, QuizScopeConfig> = {
  animals_all: { id: 'animals_all', label: 'Todos', classes: [] },
  birds: { id: 'birds', label: 'Aves', classes: ['Aves'] },
  mammals: { id: 'mammals', label: 'Mamíferos', classes: ['Mammalia'] },
  reptiles: { id: 'reptiles', label: 'Reptiles', classes: ['Reptilia'] },
  amphibians: { id: 'amphibians', label: 'Anfibios', classes: ['Amphibia'] },
  fish: { id: 'fish', label: 'Peces', classes: ['Actinopterygii', 'Chondrichthyes'] },
};

export const QUIZ_SCOPE_ORDER: QuizScope[] = ['animals_all', 'birds', 'mammals', 'reptiles', 'amphibians', 'fish'];

export interface QuizModeConfig {
  id: QuizMode;
  title: string;
  description: string;
  /** Fixed number of questions, or null when the run ends some other way. */
  questionCount: number | null;
  /** Seconds for the whole run, or null when untimed. */
  durationSeconds: number | null;
  /** Wrong answers allowed before the run ends, or null for unlimited. */
  lives: number | null;
}

export const QUIZ_MODES: Record<QuizMode, QuizModeConfig> = {
  classic: {
    id: 'classic',
    title: 'Clásico',
    description: '10 especies, sin apuro.',
    questionCount: 10,
    durationSeconds: null,
    lives: null,
  },
  timed: {
    id: 'timed',
    title: 'Contrarreloj',
    description: '60 segundos, las que puedas.',
    questionCount: null,
    durationSeconds: 60,
    lives: null,
  },
  survival: {
    id: 'survival',
    title: 'Eliminación',
    description: 'Tres vidas. Hasta donde llegues.',
    questionCount: null,
    durationSeconds: null,
    lives: 3,
  },
};

export interface QuizOption {
  codigo: string;
  label: string;
  /** Set on the taxon the photo actually belongs to. */
  correct: boolean;
}

export interface QuizQuestion {
  target: Species;
  options: QuizOption[];
}

export interface QuizRunState {
  mode: QuizMode;
  questionIndex: number;
  score: number;
  streak: number;
  bestStreakThisRun: number;
  livesLeft: number | null;
  finished: boolean;
}

export const createRun = (mode: QuizMode): QuizRunState => ({
  mode,
  questionIndex: 0,
  score: 0,
  streak: 0,
  bestStreakThisRun: 0,
  livesLeft: QUIZ_MODES[mode].lives,
  finished: false,
});
