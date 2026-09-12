import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';

import {
  speciesRepository,
  type TaxonOption,
  type TaxonRank,
  type TaxonomyPath,
} from '../../data/repositories/speciesRepository';

const childrenCache = new Map<string, TaxonOption[]>();
const prefetchedOrderPaths = new Set<string>();

/** Loads one constrained level of the taxonomic tree from SQLite. */
export function useTaxonomyChildren(
  rank: TaxonRank | null,
  ancestors: TaxonomyPath,
): { items: TaxonOption[]; loading: boolean } {
  const db = useSQLiteContext();
  const key = JSON.stringify(ancestors);
  const cacheKey = `${rank ?? 'none'}:${key}`;
  const [items, setItems] = useState<TaxonOption[]>(() => childrenCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(() => !childrenCache.has(cacheKey));

  useEffect(() => {
    if (!rank) {
      setItems([]);
      setLoading(false);
      return;
    }
    const cached = childrenCache.get(cacheKey);
    if (cached) {
      setItems(cached);
      setLoading(false);
      return;
    }
    let active = true;
    // A new level has no rows to preserve; cached levels returned to later are
    // initialized synchronously above and skip this loader entirely.
    setItems([]);
    setLoading(true);
    void speciesRepository.listTaxonomyChildren(db, rank, ancestors).then(async (rows) => {
      if (rank === 'orden' && !prefetchedOrderPaths.has(cacheKey)) {
        const urls = [...new Set(rows.flatMap((row) => row.representativeImageUrl ? [row.representativeImageUrl] : []))];
        if (urls.length > 0) await Image.prefetch(urls, 'memory-disk').catch(() => false);
        prefetchedOrderPaths.add(cacheKey);
      }
      if (active) {
        childrenCache.set(cacheKey, rows);
        setItems(rows);
        setLoading(false);
      }
    });
    return () => { active = false; };
    // `key` is the stable serialized form; the object is rebuilt by screens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, db, rank]);

  return { items, loading };
}
