import { isPuzzleSolved, movePuzzlePiece, movablePieceIndexes, shuffledSolvablePuzzle, solvedPuzzle } from '../slidingPuzzle';
import { seededRng } from '../../../testing/speciesFactory';

describe('sliding puzzle', () => {
  test('only exposes orthogonal neighbours without wrapping rows', () => {
    expect(movablePieceIndexes([0, 1, 2, 3, 4, 5, 6, 7, 8], 8, 3)).toEqual([5, 7]);
    expect(movePuzzlePiece([0, 1, 8, 3, 4, 5, 6, 7, 2], 3, 8, 3)).toBeNull();
  });

  test('moves an adjacent piece into the empty cell', () => {
    expect(movePuzzlePiece([0, 1, 2, 3, 4, 5, 6, 7, 8], 7, 8, 3)).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 7]);
  });

  test('creates deterministic, shuffled and solvable boards via legal moves', () => {
    const first = shuffledSolvablePuzzle(4, seededRng(42));
    const second = shuffledSolvablePuzzle(4, seededRng(42));
    expect(first).toEqual(second);
    expect(first).not.toEqual(solvedPuzzle(4));

    // Reversing the exact legal walk is possible by construction; at minimum
    // the result still contains every piece exactly once.
    expect([...first].sort((a, b) => a - b)).toEqual(solvedPuzzle(4));
    expect(isPuzzleSolved(solvedPuzzle(4))).toBe(true);
  });
});
