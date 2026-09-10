import type { MainTab } from './components/NavigationIsland';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN } from './theme/tokens';

/** Routes where the bottom navigation is intentionally not part of the task. */
export function shouldShowNavigation(pathname: string): boolean {
  return pathname !== '/report' && pathname !== '/learn' && pathname !== '/game' && !pathname.startsWith('/game/') && !pathname.startsWith('/species/');
}

/** Maps regular routes to the primary surface they belong to. */
export function navigationTabForPath(pathname: string): MainTab | undefined {
  if (pathname === '/' || pathname === '/index' || pathname === '/(tabs)' || pathname === '/(tabs)/index') return 'index';
  if (
    pathname === '/explore' || pathname === '/(tabs)/explore' || pathname === '/taxonomy'
    || pathname === '/species' || pathname === '/favorites'
  ) return 'explore';
  if (pathname === '/games' || pathname === '/(tabs)/games') return 'games';
  return undefined;
}

/** Bottom space needed by regular scroll content to clear the floating island. */
export const NAVIGATION_BOTTOM_SPACE = NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN;

export function navigationBottomInset(safeAreaBottom: number, extra = 0): number {
  return Math.max(safeAreaBottom, NAV_ISLAND_MARGIN) + NAV_ISLAND_HEIGHT + extra;
}
