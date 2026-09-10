import type { KnowledgeLevel } from './species';

export type PuzzleDifficulty = 3 | 4;
export type PuzzleScope = 'animals_all' | 'birds' | 'mammals' | 'reptiles' | 'amphibians' | 'fish';
export type PuzzleRunState = 'ready' | 'running' | 'paused' | 'completed';
export interface PuzzleRecord { scope: PuzzleScope; knowledgeLevel: KnowledgeLevel; gridSize: PuzzleDifficulty; bestTimeMs: number; fewestMoves: number; playedAt: number; updatedAt: number; }
export const PUZZLE_SCOPES: Record<PuzzleScope, { label: string; classes: string[] }> = {
  animals_all: { label: 'Todos', classes: [] }, birds: { label: 'Aves', classes: ['Aves'] }, mammals: { label: 'Mamíferos', classes: ['Mammalia'] }, reptiles: { label: 'Reptiles', classes: ['Reptilia'] }, amphibians: { label: 'Anfibios', classes: ['Amphibia'] }, fish: { label: 'Peces', classes: ['Actinopterygii'] },
};
