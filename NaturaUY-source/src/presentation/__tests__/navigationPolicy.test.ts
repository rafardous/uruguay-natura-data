import { navigationBottomInset, navigationTabForPath, shouldShowNavigation } from '../navigationPolicy';

describe('navigation policy', () => {
  test('keeps the island on regular routes', () => {
    expect(shouldShowNavigation('/taxonomy')).toBe(true);
    expect(shouldShowNavigation('/favorites')).toBe(true);
    expect(navigationTabForPath('/taxonomy')).toBe('explore');
    expect(navigationTabForPath('/settings')).toBeUndefined();
  });

  test('hides it on immersive and reporting routes', () => {
    expect(shouldShowNavigation('/game/identify')).toBe(false);
    expect(shouldShowNavigation('/report')).toBe(false);
    expect(shouldShowNavigation('/species/O_bezoarti')).toBe(false);
  });

  test('reserves the island and safe-area space for scroll content', () => {
    expect(navigationBottomInset(0)).toBe(76);
    expect(navigationBottomInset(34, 8)).toBe(104);
  });
});
