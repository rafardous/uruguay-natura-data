import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useMobileAuth } from '../auth/MobileAuthProvider';
import { useUserDatabase } from '../data/db/UserDatabaseProvider';
import { mobileSyncRepository } from '../data/repositories/mobileSyncRepository';

type SyncStatus = 'guest' | 'idle' | 'syncing' | 'error';

interface MobileSyncContextValue {
  status: SyncStatus;
  revision: number;
  requestSync(): Promise<void>;
}

const MobileSyncContext = createContext<MobileSyncContextValue | null>(null);

export function MobileSyncProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const db = useUserDatabase();
  const { session } = useMobileAuth();
  const [status, setStatus] = useState<SyncStatus>(session ? 'idle' : 'guest');
  const [revision, setRevision] = useState(0);
  const running = useRef<Promise<void> | null>(null);

  const requestSync = useCallback(async () => {
    if (!session) {
      setStatus('guest');
      return;
    }
    if (running.current) return running.current;
    const task = (async () => {
      setStatus('syncing');
      try {
        await mobileSyncRepository.sync(db);
        setRevision((current) => current + 1);
        setStatus('idle');
      } catch (error) {
        console.warn('No se pudo sincronizar user.db; se reintentará más adelante.', error);
        setStatus('error');
      } finally {
        running.current = null;
      }
    })();
    running.current = task;
    return task;
  }, [db, session]);

  useEffect(() => {
    if (!session) {
      setStatus('guest');
      return;
    }
    void requestSync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void requestSync();
    });
    return () => subscription.remove();
  }, [requestSync, session]);

  const value = useMemo(() => ({ status, revision, requestSync }), [requestSync, revision, status]);
  return <MobileSyncContext.Provider value={value}>{children}</MobileSyncContext.Provider>;
}

export function useMobileSync(): MobileSyncContextValue {
  const value = useContext(MobileSyncContext);
  if (!value) throw new Error('useMobileSync must be used inside <MobileSyncProvider>');
  return value;
}
