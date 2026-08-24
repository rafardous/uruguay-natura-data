import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import {
  speciesRepository,
  type TaxonRank,
  type TaxonomyPath,
} from '../../data/repositories/speciesRepository';

export interface TaxonOption {
  value: string;
  count: number;
}

/** Loads one constrained level of the taxonomic tree from SQLite. */
export function useTaxonomyChildren(
  rank: TaxonRank | null,
  ancestors: TaxonomyPath,
): { items: TaxonOption[]; loading: boolean } {
  const db = useSQLiteContext();
  const [items, setItems] = useState<TaxonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(ancestors);

  useEffect(() => {
    if (!rank) {
      setItems([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void speciesRepository.listTaxonomyChildren(db, rank, ancestors).then((rows) => {
      if (active) {
        setItems(rows);
        setLoading(false);
      }
    });
    return () => { active = false; };
    // `key` is the stable serialized form; the object is rebuilt by screens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, rank, key]);

  return { items, loading };
}
