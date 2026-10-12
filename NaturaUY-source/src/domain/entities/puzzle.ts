import type { KnowledgeLevel } from './species';
import { GAME_SCOPES, type GameScope } from './gameScopes';

export type PuzzleDifficulty = 3 | 4;
/** Encastrar has one piece layout, independent of the sliding preference. */
export const JIGSAW_GRID_SIZE: PuzzleDifficulty = 4;
export type PuzzleScope = GameScope;
export type PuzzleRunState = 'ready' | 'running' | 'paused' | 'completed';
export interface PuzzleRecord { scope: PuzzleScope; knowledgeLevel: KnowledgeLevel; gridSize: PuzzleDifficulty; bestTimeMs: number; fewestMoves: number; playedAt: number; updatedAt: number; }
export const PUZZLE_SCOPES: Record<PuzzleScope, { label: string; classes: string[]; taxa: string[] }> = Object.fromEntries(Object.entries(GAME_SCOPES).map(([id, scope]) => [id, { label: scope.label, classes: scope.classes, taxa: scope.taxa }])) as Record<PuzzleScope, { label: string; classes: string[]; taxa: string[] }>;
