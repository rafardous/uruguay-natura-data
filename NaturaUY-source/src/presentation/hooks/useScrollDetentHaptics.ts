import { useCallback, useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

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
