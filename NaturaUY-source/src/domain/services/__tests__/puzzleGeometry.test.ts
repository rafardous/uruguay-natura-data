import { puzzlePiecePath } from '../puzzleGeometry';

describe('puzzle geometry', () => {
  it('is deterministic and keeps outer edges flat', () => {
    const first = puzzlePiecePath(0, 3, 100);
    expect(first).toBe(puzzlePiecePath(0, 3, 100));
    expect(first.startsWith('M0 0')).toBe(true);
    expect(first).toContain('V100');
  });
  it('creates complementary variants for neighboring pieces', () => {
    expect(puzzlePiecePath(1, 3, 100)).not.toBe(puzzlePiecePath(2, 3, 100));
  });
});
