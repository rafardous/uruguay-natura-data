import { useCallback, useEffect, useRef, useState } from 'react';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import type { Species } from '../../domain/entities/species';
import { speciesRepository, type SpeciesFilters } from '../../data/repositories/speciesRepository';

const PAGE_SIZE = 24;
const CACHE_LIMIT = 20;
type CachedList = { items: Species[]; total: number; hasMore: boolean };
const caches = new WeakMap<SQLiteDatabase, Map<string, CachedList>>();
const EMPTY: CachedList = { items: [], total: 0, hasMore: false };

function cacheFor(db: SQLiteDatabase): Map<string, CachedList> {
  let cache = caches.get(db);
  if (!cache) { cache = new Map(); caches.set(db, cache); }
  return cache;
}
function remember(cache: Map<string, CachedList>, key: string, value: CachedList): void {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

export interface SpeciesListState extends CachedList {
  loading: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

/** Conserva las páginas cargadas y descarta respuestas de filtros anteriores. */
export function useSpeciesList(filters: SpeciesFilters, enabled = true, refreshKey = 0): SpeciesListState {
  const db = useSQLiteContext();
  const cache = cacheFor(db);
  const key = JSON.stringify([filters, refreshKey]);
  const [data, setData] = useState<CachedList>(() => enabled ? cache.get(key) ?? EMPTY : EMPTY);
  const [loading, setLoading] = useState(() => enabled && !cache.has(key));
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);
  const fetching = useRef(false);
  const readyKey = useRef<string | null>(null);

  useEffect(() => {
    const id = ++requestId.current;
    fetching.current = false;
    readyKey.current = null;
    setLoadingMore(false);
    const cleanup = () => { requestId.current++; };
    if (!enabled) {
      setData(EMPTY); setLoading(false);
      return cleanup;
    }
    const cached = cache.get(key);
    if (cached) {
      setData(cached); setLoading(false); readyKey.current = key;
      return cleanup;
    }
    setLoading(true);
    void Promise.all([
      speciesRepository.findPaged(db, filters, PAGE_SIZE, 0),
      speciesRepository.count(db, filters),
    ]).then(([page, total]) => {
      if (id !== requestId.current) return;
      const next = { items: page.items, total, hasMore: page.hasMore };
      remember(cache, key, next);
      readyKey.current = key;
      setData(next);
    }).catch(() => {
      if (id === requestId.current) setData(EMPTY);
    }).finally(() => {
      if (id === requestId.current) setLoading(false);
    });
    return cleanup;
    // La clave incluye todos los filtros y la versión de refresco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key, enabled]);

  const loadMore = useCallback(() => {
    if (!enabled || loading || fetching.current || !data.hasMore || readyKey.current !== key) return;
    const id = requestId.current;
    fetching.current = true;
    setLoadingMore(true);
    void speciesRepository.findPaged(db, filters, PAGE_SIZE, data.items.length).then((page) => {
      if (id !== requestId.current) return;
      const next = { ...data, items: [...data.items, ...page.items], hasMore: page.hasMore };
      remember(cache, key, next);
      setData(next);
    }).catch(() => {
      // Conserva lo ya cargado y permite reintentar la siguiente página.
    }).finally(() => {
      if (id !== requestId.current) return;
      fetching.current = false;
      setLoadingMore(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key, data, loading, enabled]);

  return { ...data, loading, loadingMore, loadMore };
}
