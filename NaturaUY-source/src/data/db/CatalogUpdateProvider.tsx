import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { readPendingCatalog, stageLatestCatalog, type CatalogManifest } from './catalogUpdater';
import { classifyUpdateError, type UpdateErrorKind } from '../updates/updateErrors';
import { useNetwork } from '../../presentation/network/NetworkProvider';

export type CatalogUpdateState = 'checking' | 'downloading' | 'verifying' | 'current' | 'staged' | 'app_update_required' | 'error' | 'web';
type CatalogUpdateSnapshot = {
  state: CatalogUpdateState;
  installedVersion: number | null;
  pendingVersion: number | null;
  availableVersion: number | null;
  downloadSize: number | null;
  requiredAppVersion: string | null;
  requiredSchema: number | null;
  error: UpdateErrorKind | null;
};
type CatalogUpdateContextValue = CatalogUpdateSnapshot & { check: () => Promise<void>; busy: boolean };
const initialSnapshot: CatalogUpdateSnapshot = { state: 'checking', installedVersion: null, pendingVersion: null, availableVersion: null, downloadSize: null, requiredAppVersion: null, requiredSchema: null, error: null };
const CatalogUpdateContext = createContext<CatalogUpdateContextValue>({ ...initialSnapshot, check: async () => {}, busy: true });

export function CatalogUpdateProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const database = useSQLiteContext();
  const { isOffline } = useNetwork();
  const offline = useRef(isOffline);
  useEffect(() => { offline.current = isOffline; }, [isOffline]);
  const controller = useRef<AbortController | null>(null);
  const startedOwner = useRef<AbortController | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const [snapshot, setSnapshot] = useState<CatalogUpdateSnapshot>(initialSnapshot);
  const performCheck = useCallback(async () => {
    const owner = controller.current;
    if (!owner || owner.signal.aborted) return;
    startedOwner.current = owner;
    const publish = (patch: Partial<CatalogUpdateSnapshot>) => {
      if (controller.current === owner && !owner.signal.aborted) setSnapshot((previous) => ({ ...previous, ...patch }));
    };
    publish({ state: 'checking', error: null, availableVersion: null, requiredAppVersion: null, requiredSchema: null, downloadSize: null });
    try {
      const rows = await database.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key IN ('data_version', 'schema_version')");
      const meta = Object.fromEntries(rows.map((row) => [row.key, row.value]));
      const installedVersion = Number(meta.data_version);
      publish({ installedVersion });
      if (Platform.OS === 'web') { publish({ state: 'web' }); return; }
      const pending = await readPendingCatalog();
      publish({ pendingVersion: pending?.data_version ?? null });
      if (offline.current === true) { publish({ state: 'error', error: 'offline' }); return; }
      const describe = (manifest: CatalogManifest) => ({ availableVersion: manifest.data_version, downloadSize: manifest.database_size });
      const result = await stageLatestCatalog(installedVersion, Number(meta.schema_version), owner.signal, (progress) => publish({ state: progress.state, ...(progress.manifest ? describe(progress.manifest) : {}) }));
      const pendingVersion = result.state === 'staged' ? result.manifest.data_version : pending?.data_version ?? null;
      publish({ ...describe(result.manifest), state: result.state === 'current' && pendingVersion !== null && pendingVersion > installedVersion ? 'staged' : result.state, pendingVersion,
        requiredAppVersion: result.state === 'app_update_required' ? result.manifest.min_app_version : null,
        requiredSchema: result.state === 'app_update_required' ? result.manifest.schema_version : null });
    } catch (error) {
      publish({ state: 'error', error: classifyUpdateError(error, offline.current === true) });
    }
  }, [database]);
  const check = useCallback(() => {
    if (!running.current) running.current = Promise.resolve().then(performCheck).finally(() => { running.current = null; });
    return running.current;
  }, [performCheck]);

  useEffect(() => {
    const owner = new AbortController();
    controller.current = owner;
    // A StrictMode cleanup can cancel a previous shared call. Retry in the new lifetime.
    void check().then(() => {
      if (controller.current === owner && !owner.signal.aborted && startedOwner.current !== owner) void check();
    });
    return () => { owner.abort(); };
  }, [check]);

  const busy = snapshot.state === 'checking' || snapshot.state === 'downloading' || snapshot.state === 'verifying';
  return <CatalogUpdateContext.Provider value={{ ...snapshot, busy, check }}>{children}</CatalogUpdateContext.Provider>;
}

export const useCatalogUpdate = (): CatalogUpdateContextValue => useContext(CatalogUpdateContext);
export const useCatalogUpdateState = (): CatalogUpdateState => useCatalogUpdate().state;
