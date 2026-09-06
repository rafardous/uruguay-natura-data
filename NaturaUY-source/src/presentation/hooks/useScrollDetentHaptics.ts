import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ViewToken } from 'react-native';

import { haptics } from '../haptics';

/** A soft picker-like tick whenever a list advances exactly one card. */
export function useScrollDetentHaptics(
  rowHeight: number,
  resetKey: string = '',
): (event: NativeSyntheticEvent<NativeScrollEvent>) => void {
  const lastDetent = useRef(0);

  useEffect(() => { lastDetent.current = 0; }, [resetKey]);

  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const row = Math.round(event.nativeEvent.contentOffset.y / rowHeight);
    const moved = row - lastDetent.current;
    lastDetent.current = row;
    if (Math.abs(moved) === 1) haptics.tick();
  }, [rowHeight]);
}

/** Haptic feedback based on actual viewability, useful for variable-height taxon cards. */
export function useViewableItemHaptics(resetKey = ''): { onViewableItemsChanged: (info: { viewableItems: ViewToken[] }) => void; viewabilityConfig: { itemVisiblePercentThreshold: number } } {
  const lastVisible = useRef<string | null>(null);
  useEffect(() => { lastVisible.current = null; }, [resetKey]);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const key = viewableItems[0]?.key ?? null;
    if (key && lastVisible.current && key !== lastVisible.current) haptics.tick();
    if (key) lastVisible.current = String(key);
  }, []);
  return { onViewableItemsChanged, viewabilityConfig: { itemVisiblePercentThreshold: 60 } };
}
