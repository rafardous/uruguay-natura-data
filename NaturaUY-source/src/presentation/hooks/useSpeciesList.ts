import { useCallback, useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { Species } from '../../domain/entities/species';
import { speciesRepository, type SpeciesFilters } from '../../data/repositories/speciesRepository';

const PAGE_SIZE = 24;

/**
 * SQLite resolves a filter query in a few milliseconds, so without a floor the
 * skeleton would flash for a single frame on every filter change — reading as
 * a glitch rather than a loading state. Holding it for at least this long
 * makes the transition feel deliberate instead of flickery.
 */
const MIN_LOADING_MS = 380;

export interface SpeciesListState {
  items: Species[];
  total: number;
  /** First page is loading — show skeletons. */
  loading: boolean;
  /** A further page is loading — show the footer spinner. */
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Paged catalogue reads backing the infinite scroll.
 *
 * SQLite returns a page in about a millisecond, so the perceived wait is
 * entirely image loading — which is why the list shows skeleton *cards* rather
 * than a blocking spinner.
 */
export function useSpeciesList(filters: SpeciesFilters): SpeciesListState {
  const db = useSQLiteContext();
  const [items, setItems] = useState<Species[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Guards against a stale page landing after the filters changed.
  const requestId = useRef(0);
  const key = JSON.stringify(filters);

  useEffect(() => {
    const id = ++requestId.current;
    const startedAt = Date.now();
    setLoading(true);

    void (async () => {
      const [page, count] = await Promise.all([
        speciesRepository.findPaged(db, filters, PAGE_SIZE, 0),
        speciesRepository.count(db, filters),
      ]);

      if (id !== requestId.current) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise((r) => setTimeout(r, MIN_LOADING_MS - elapsed));
      }
      // A newer request may have started during the wait — its own effect run
      // will finish the job, so bail rather than overwrite with stale data.
      if (id !== requestId.current) return;

      setItems(page.items);
      setHasMore(page.hasMore);
      setTotal(count);
      setLoading(false);
    })();
    // `key` is the serialised form of `filters`; depending on the object itself
    // would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;

    const id = requestId.current;
    setLoadingMore(true);

    void (async () => {
      const page = await speciesRepository.findPaged(db, filters, PAGE_SIZE, items.length);

      if (id !== requestId.current) return;

      setItems((current) => [...current, ...page.items]);
      setHasMore(page.hasMore);
      setLoadingMore(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key, items.length, loading, loadingMore, hasMore]);

  return { items, total, loading, loadingMore, hasMore, loadMore };
}
