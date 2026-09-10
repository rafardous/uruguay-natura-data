import type { PuzzleDifficulty } from '../entities/puzzle';

export type SlidingPuzzlePieces = readonly number[];

export function solvedPuzzle(gridSize: PuzzleDifficulty): number[] {
  return Array.from({ length: gridSize * gridSize }, (_, index) => index);
}

export function isPuzzleSolved(pieces: SlidingPuzzlePieces): boolean {
  return pieces.every((piece, index) => piece === index);
}

export function movablePieceIndexes(
  pieces: SlidingPuzzlePieces,
  hiddenPiece: number,
  gridSize: PuzzleDifficulty,
): number[] {
  const hiddenIndex = pieces.indexOf(hiddenPiece);
  if (hiddenIndex < 0) return [];
  const row = Math.floor(hiddenIndex / gridSize);
  const column = hiddenIndex % gridSize;
  const indexes: number[] = [];
  if (row > 0) indexes.push(hiddenIndex - gridSize);
  if (row < gridSize - 1) indexes.push(hiddenIndex + gridSize);
  if (column > 0) indexes.push(hiddenIndex - 1);
  if (column < gridSize - 1) indexes.push(hiddenIndex + 1);
  return indexes;
}

export function movePuzzlePiece(
  pieces: SlidingPuzzlePieces,
  piece: number,
  hiddenPiece: number,
  gridSize: PuzzleDifficulty,
): number[] | null {
  const pieceIndex = pieces.indexOf(piece);
  const hiddenIndex = pieces.indexOf(hiddenPiece);
  if (!movablePieceIndexes(pieces, hiddenPiece, gridSize).includes(pieceIndex)) return null;
  const next = [...pieces];
  next[hiddenIndex] = piece;
  next[pieceIndex] = hiddenPiece;
  return next;
}

/**
 * Starts solved and performs only legal moves. That guarantees a solvable
 * board, unlike shuffling all pieces independently (half of those boards
 * cannot be completed).
 */
export function shuffledSolvablePuzzle(
  gridSize: PuzzleDifficulty,
  rng: () => number,
  steps = gridSize * gridSize * 18,
): number[] {
  const hiddenPiece = gridSize * gridSize - 1;
  let pieces = solvedPuzzle(gridSize);
  let previousHiddenIndex = -1;

  for (let step = 0; step < steps; step += 1) {
    const candidates = movablePieceIndexes(pieces, hiddenPiece, gridSize)
      .filter((index) => index !== previousHiddenIndex);
    const choices = candidates.length > 0 ? candidates : movablePieceIndexes(pieces, hiddenPiece, gridSize);
    const pickedIndex = choices[Math.floor(rng() * choices.length)] ?? choices[0];
    if (pickedIndex === undefined) break;
    const oldHiddenIndex = pieces.indexOf(hiddenPiece);
    const moved = movePuzzlePiece(pieces, pieces[pickedIndex]!, hiddenPiece, gridSize);
    if (moved) {
      pieces = moved;
      previousHiddenIndex = oldHiddenIndex;
    }
  }

  if (isPuzzleSolved(pieces)) {
    const firstMove = movablePieceIndexes(pieces, hiddenPiece, gridSize)[0];
    if (firstMove !== undefined) pieces = movePuzzlePiece(pieces, pieces[firstMove]!, hiddenPiece, gridSize) ?? pieces;
  }
  return pieces;
}
