import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { stageLatestCatalog } from './catalogUpdater';

type CatalogUpdateState = 'checking' | 'current' | 'staged' | 'app_update_required' | 'offline';
const CatalogUpdateContext = createContext<CatalogUpdateState>('checking');

export function CatalogUpdateProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const database = useSQLiteContext(); const [state, setState] = useState<CatalogUpdateState>('checking');
  useEffect(() => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8_000);
    void database.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'data_version'")
      .then((row) => stageLatestCatalog(Number(row?.value ?? 0), controller.signal))
      .then(setState)
      .catch(() => setState('offline'))
      .finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [database]);
  return <CatalogUpdateContext.Provider value={state}>{children}</CatalogUpdateContext.Provider>;
}

export const useCatalogUpdateState = (): CatalogUpdateState => useContext(CatalogUpdateContext);
