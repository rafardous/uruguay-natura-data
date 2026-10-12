import React, { act, useEffect } from 'react';
import { Platform } from 'react-native';
import { CatalogUpdateProvider, useCatalogUpdate } from '../../db/CatalogUpdateProvider';
import { AppUpdateProvider, useAppUpdate } from '../AppUpdateProvider';
import { readPendingCatalog, stageLatestCatalog } from '../../db/catalogUpdater';
import { fetchUpdateManifest } from '../fetchUpdateManifest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: React.ReactElement) => { update: (element: React.ReactElement) => void; unmount: () => void } };
const mockDb = { getAllAsync: async () => [{ key: 'data_version', value: '9' }, { key: 'schema_version', value: '14' }] };
let mockOffline: boolean | null = false;
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('../../db/catalogUpdater', () => ({ readPendingCatalog: jest.fn(), stageLatestCatalog: jest.fn() }));
jest.mock('../fetchUpdateManifest', () => ({ fetchUpdateManifest: jest.fn() }));
jest.mock('../installedApp', () => ({ installedAppVersion: () => '1.4.0', installedAndroidBuild: () => 7 }));
jest.mock('../../../presentation/network/NetworkProvider', () => ({ useNetwork: () => ({ isOffline: mockOffline }) }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { appReleaseManifestUrl: 'https://example.com/app.json' } } } }));
const release = { version: '1.4.0', build: 8, download_url: 'https://expo.dev/artifacts/eas/ApprovedBuild123.apk', apk_size: 166_000_000, catalog_schema: 15, published_at: '2026-10-12T00:00:00Z' };
const manifest = { data_version: 10, schema_version: 14, min_app_version: '1.3.1', published_at: '2026-10-12T00:00:00Z', database_url: 'https://example.com/natura.db', database_size: 100, sha256: 'aa'.repeat(32), quality_report_url: 'https://example.com/report.json' };
let catalog: ReturnType<typeof useCatalogUpdate>;
let app: ReturnType<typeof useAppUpdate>;
let root: ReturnType<typeof renderer.create> | undefined;
function Probe() {
  const catalogValue = useCatalogUpdate(); const appValue = useAppUpdate();
  useEffect(() => { catalog = catalogValue; app = appValue; }, [appValue, catalogValue]);
  return null;
}
const tree = () => <AppUpdateProvider><CatalogUpdateProvider><Probe /></CatalogUpdateProvider></AppUpdateProvider>;
async function mount() { await act(async () => { root = renderer.create(tree()); }); }
beforeEach(() => {
  jest.clearAllMocks(); mockOffline = false;
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  jest.mocked(readPendingCatalog).mockResolvedValue(null);
  jest.mocked(stageLatestCatalog).mockResolvedValue({ state: 'current', manifest });
  jest.mocked(fetchUpdateManifest).mockResolvedValue({ android: release });
});
afterEach(async () => { await act(async () => { root?.unmount(); root = undefined; }); });

test('manual requests share the automatic download and publish its result', async () => {
  let finish!: (value: { state: 'staged'; manifest: typeof manifest }) => void;
  jest.mocked(stageLatestCatalog).mockImplementation((_data, _schema, _signal, progress) => {
    progress?.({ state: 'downloading', manifest });
    return new Promise((resolve) => { finish = resolve; });
  });
  await mount();
  expect(catalog.busy).toBe(true);
  expect(catalog.installedVersion).toBe(9);
  let manual!: Promise<void>; let another!: Promise<void>;
  await act(async () => { manual = catalog.check(); another = catalog.check(); });
  expect(manual).toBe(another);
  expect(stageLatestCatalog).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ state: 'staged', manifest }); await manual; });
  expect(catalog.pendingVersion).toBe(10);
  expect(catalog.busy).toBe(false);
});

test('app availability survives a catalogue server error and a pending download remains visible', async () => {
  jest.mocked(readPendingCatalog).mockResolvedValue(manifest);
  jest.mocked(stageLatestCatalog).mockRejectedValue(new Error('Network request failed'));
  await mount();
  expect(app.state).toBe('available');
  expect(catalog.state).toBe('error');
  expect(catalog.error).toBe('server');
  expect(catalog.pendingVersion).toBe(10);
  jest.mocked(stageLatestCatalog).mockResolvedValueOnce({ state: 'staged', manifest });
  await act(async () => { await catalog.check(); });
  expect(catalog.state).toBe('staged');
  expect(catalog.error).toBeNull();
  expect(stageLatestCatalog).toHaveBeenCalledTimes(2);
});

test('catalogue success survives an app manifest failure and does not repeat on an ordinary render', async () => {
  jest.mocked(fetchUpdateManifest).mockRejectedValue(new Error('Network request failed'));
  jest.mocked(stageLatestCatalog).mockResolvedValue({ state: 'staged', manifest });
  await mount();
  expect(app.state).toBe('error');
  expect(catalog.state).toBe('staged');
  await act(async () => { root!.update(tree()); });
  expect(stageLatestCatalog).toHaveBeenCalledTimes(1);
});

test('offline startup shows local pending metadata and allows an explicit retry after reconnecting', async () => {
  mockOffline = true;
  jest.mocked(readPendingCatalog).mockResolvedValue(manifest);
  await mount();
  expect(catalog.error).toBe('offline');
  expect(catalog.pendingVersion).toBe(10);
  expect(stageLatestCatalog).not.toHaveBeenCalled();
  mockOffline = false;
  await act(async () => { root!.update(tree()); });
  await act(async () => { await catalog.check(); });
  expect(catalog.state).toBe('staged');
});

test('unmount aborts the shared catalogue operation without activating any live database', async () => {
  let signal: AbortSignal | undefined;
  jest.mocked(stageLatestCatalog).mockImplementation((_data, _schema, cancel) => {
    signal = cancel;
    return new Promise((_, reject) => cancel?.addEventListener('abort', () => reject(new Error('aborted'))));
  });
  await mount();
  await act(async () => { root!.unmount(); root = undefined; });
  expect(signal?.aborted).toBe(true);
});

test('StrictMode does not create a second startup request after sharing a flight', async () => {
  await act(async () => { root = renderer.create(<React.StrictMode>{tree()}</React.StrictMode>); });
  expect(stageLatestCatalog).toHaveBeenCalledTimes(1);
  expect(fetchUpdateManifest).toHaveBeenCalledTimes(1);
  expect(catalog.state).toBe('current');
});
