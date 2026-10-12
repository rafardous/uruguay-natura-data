export type LearningQuestionType = 'single' | 'multi' | 'order' | 'classify';

export interface LearningSource {
  code: string;
  name: string;
  url: string;
  note?: string;
}

export interface LearningBlock {
  eyebrow?: string;
  title: string;
  body: string;
  callout?: string;
  illustration?: LearningIllustration;
}

/** Fotos del catálogo y pasos de lectura; las flechas sólo se usan en secuencias. */
export interface LearningIllustration {
  title: string;
  layout: 'compare' | 'sequence' | 'tree';
  items: { label: string; speciesCode?: string; caption?: string }[];
}

export interface LearningQuestion {
  id: string;
  objectiveId: string;
  version: number;
  type: LearningQuestionType;
  prompt: string;
  options: string[];
  correct: string[];
  categories?: string[];
  classification?: Record<string, string>;
  explanation: string;
}

export interface LearningModule {
  id: string;
  title: string;
  /** Compatibilidad con documentos editoriales anteriores; no se muestra en la UI. */
  minutes?: number;
  contentVersion?: number;
  hook: string;
  blocks: LearningBlock[];
  questions: LearningQuestion[];
  sourceCodes: string[];
}

export interface LearningPath {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  icon: string;
  illustration?: LearningIllustration;
  modules: LearningModule[];
}

export type LearningMasteryState = 'understood' | 'practicing' | 'review';

export interface LearningObjectiveProgress {
  objectiveId: string;
  questionVersion: number;
  correctStreak: number;
  lastResult: boolean;
  lastAnsweredAt: number;
  dueAt: number;
  updatedAt: number;
}
