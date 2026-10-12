import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

import { fetchUpdateManifest } from './fetchUpdateManifest';
import { assertAppReleaseManifest, isNewerAndroidRelease, type AndroidAppRelease } from './appReleasePolicy';
import { installedAndroidBuild, installedAppVersion } from './installedApp';
import { classifyUpdateError, type UpdateErrorKind } from './updateErrors';
import { useNetwork } from '../../presentation/network/NetworkProvider';

type AppUpdateSnapshot = { state: 'checking' | 'current' | 'available' | 'error' | 'unsupported'; release: AndroidAppRelease | null; error: UpdateErrorKind | null };
type AppUpdateContextValue = AppUpdateSnapshot & { check: () => Promise<void>; openDownload: () => Promise<void>; opening: boolean };
const initial: AppUpdateSnapshot = { state: 'checking', release: null, error: null };
const AppUpdateContext = createContext<AppUpdateContextValue>({ ...initial, check: async () => {}, openDownload: async () => {}, opening: false });

export function AppUpdateProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { isOffline } = useNetwork();
  const offline = useRef(isOffline);
  useEffect(() => { offline.current = isOffline; }, [isOffline]);
  const controller = useRef<AbortController | null>(null);
  const startedOwner = useRef<AbortController | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const [snapshot, setSnapshot] = useState(initial);
  const [opening, setOpening] = useState(false);
  const openInFlight = useRef<Promise<void> | null>(null);
  const performCheck = useCallback(async () => {
    const owner = controller.current;
    if (!owner || owner.signal.aborted) return;
    startedOwner.current = owner;
    const publish = (patch: Partial<AppUpdateSnapshot>) => {
      if (controller.current === owner && !owner.signal.aborted) setSnapshot((previous) => ({ ...previous, ...patch }));
    };
    if (Platform.OS !== 'android' || Constants.appOwnership === 'expo' || installedAndroidBuild() === null) { publish({ state: 'unsupported' }); return; }
    publish({ state: 'checking', error: null });
    if (offline.current === true) { publish({ state: 'error', error: 'offline' }); return; }
    try {
      const url = process.env.EXPO_PUBLIC_APP_RELEASE_MANIFEST_URL ?? Constants.expoConfig?.extra?.appReleaseManifestUrl as string | undefined;
      if (!url) throw new Error('manifest_app_url_missing');
      const value = await fetchUpdateManifest(url, owner.signal);
      assertAppReleaseManifest(value);
      const release = value.android && isNewerAndroidRelease(value.android, installedAndroidBuild(), installedAppVersion()) ? value.android : null;
      publish({ state: release ? 'available' : 'current', release });
    } catch (error) { publish({ state: 'error', error: classifyUpdateError(error, Boolean(offline.current)) }); }
  }, []);
  const check = useCallback(() => {
    if (!running.current) running.current = Promise.resolve().then(performCheck).finally(() => { running.current = null; });
    return running.current;
  }, [performCheck]);

  useEffect(() => {
    const owner = new AbortController();
    controller.current = owner;
    void check().then(() => {
      if (controller.current === owner && !owner.signal.aborted && startedOwner.current !== owner) void check();
    });
    return () => owner.abort();
  }, [check]);

  const openDownload = useCallback((): Promise<void> => {
    if (openInFlight.current) return openInFlight.current;
    const release = snapshot.release;
    if (!release) return Promise.resolve();
    setOpening(true);
    const operation = Linking.openURL(release.download_url).then(() => undefined).finally(() => {
      openInFlight.current = null;
      if (controller.current && !controller.current.signal.aborted) setOpening(false);
    });
    openInFlight.current = operation;
    return operation;
  }, [snapshot.release, setOpening]);

  return <AppUpdateContext.Provider value={{ ...snapshot, check, openDownload, opening }}>{children}</AppUpdateContext.Provider>;
}

export const useAppUpdate = (): AppUpdateContextValue => useContext(AppUpdateContext);
