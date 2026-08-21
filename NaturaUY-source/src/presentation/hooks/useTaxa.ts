import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { speciesRepository, type TaxonRank } from '../../data/repositories/speciesRepository';

/** Cached per rank — there are only three, and the values never change at runtime. */
const cache = new Map<TaxonRank, { value: string; count: number }[]>();

/** Distinct taxa for the filter row, ordered by how many species they contain. */
export function useTaxa(rank: TaxonRank, limit = 40): { value: string; count: number }[] {
  const db = useSQLiteContext();
  const [taxa, setTaxa] = useState<{ value: string; count: number }[]>(() => cache.get(rank) ?? []);

  useEffect(() => {
    const cached = cache.get(rank);
    if (cached) {
      setTaxa(cached);
      return;
    }

    let active = true;
    void speciesRepository.listTaxa(db, rank).then((rows) => {
      cache.set(rank, rows);
      if (active) setTaxa(rows);
    });

    return () => {
      active = false;
    };
  }, [db, rank]);

  return taxa.slice(0, limit);
}
