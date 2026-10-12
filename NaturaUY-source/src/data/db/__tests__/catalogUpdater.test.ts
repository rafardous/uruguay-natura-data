import { File, Paths } from 'expo-file-system';
import { fetchUpdateManifest } from '../../updates/fetchUpdateManifest';
import { prepareCatalogDatabase, readPendingCatalog, stageLatestCatalog, CATALOG_DOWNLOAD_TIMEOUT_MS } from '../catalogUpdater';

type FakeFile = { text?: string; size?: number; hash?: number; data?: number; schema?: number; integrity?: string; missingTable?: string };
const mockFiles = new Map<string, FakeFile>();
const mockRemoved: string[] = [];
let mockFailMoveTo: string | undefined;
const mockTables = ['species', 'meta', 'taxa', 'species_taxa', 'taxon_names', 'taxon_closure', 'species_media', 'learning_paths', 'habitats', 'habitat_relations', 'habitat_aliases', 'species_habitats', 'habitat_metrics', 'habitat_media'];

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { catalogManifestUrl: 'https://example.com/manifest.json' } } } }));
jest.mock('../../updates/installedApp', () => ({ installedAppVersion: () => '1.4.0' }));
jest.mock('../../updates/fetchUpdateManifest', () => ({ fetchUpdateManifest: jest.fn() }));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA256' }, digest: async (_: unknown, data: Uint8Array) => data }));
jest.mock('expo-file-system', () => {
  class FakeFile {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    get name() { return this.uri.split('/').pop()!; }
    get exists() { return mockFiles.has(this.name); }
    get size() { return mockFiles.get(this.name)?.size ?? 100; }
    delete() { mockRemoved.push(this.name); mockFiles.delete(this.name); }
    write(text: string) { mockFiles.set(this.name, { text }); }
    async text() { return mockFiles.get(this.name)?.text ?? ''; }
    async bytes() { return new Uint8Array(32).fill(mockFiles.get(this.name)?.hash ?? 170); }
    async move(destination: FakeFile) {
      if (mockFailMoveTo === destination.name) { mockFailMoveTo = undefined; throw new Error('move failed'); }
      const entry = mockFiles.get(this.name);
      if (!entry) throw new Error('missing file');
      mockFiles.set(destination.name, entry);
      mockFiles.delete(this.name);
      this.uri = destination.uri;
    }
    async copy(destination: FakeFile) { mockFiles.set(destination.name, { ...mockFiles.get(this.name) }); }
    static downloadFileAsync = jest.fn();
  }
  return { File: FakeFile, Paths: { availableDiskSpace: 1_000_000_000 }, Directory: class { list() { return [...mockFiles.keys()].map((name) => new FakeFile(`file:///db/${name}`)); } } };
});
jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/db',
  openDatabaseAsync: async (name: string) => ({
    getFirstAsync: async () => {
      if (!mockFiles.get(name)?.data) throw new Error('catalog_file_missing');
      return { integrity_check: mockFiles.get(name)?.integrity ?? 'ok' };
    },
    getAllAsync: async (sql: string) => sql.includes('sqlite_master') ? mockTables.filter((table) => table !== mockFiles.get(name)?.missingTable).map((table) => ({ name: table }))
      : [{ key: 'data_version', value: String(mockFiles.get(name)?.data) }, { key: 'schema_version', value: String(mockFiles.get(name)?.schema) }],
    closeAsync: async () => {},
  }),
  importDatabaseFromAssetAsync: async (name: string) => { mockFiles.set(name, { data: 9, schema: 14, hash: 170, size: 100 }); },
}));

const manifest = (data = 10, hash = 'aa') => ({ data_version: data, schema_version: 14, min_app_version: '1.3.1', published_at: '2026-10-12T00:00:00Z', database_url: 'https://example.com/natura.db', database_size: 100, sha256: hash.repeat(32), quality_report_url: 'https://example.com/report.json' });
const pendingName = (data = 10, hash = 'aa') => `natura.pending-${data}-${hash.repeat(32)}.db`;
const download = File.downloadFileAsync as jest.Mock;

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  mockFiles.clear(); mockRemoved.length = 0; mockFailMoveTo = undefined;
  mockFiles.set('natura.db', { data: 9, schema: 14, size: 100 });
  mockFiles.set('user.db', { text: 'favorites and progress' });
  Object.defineProperty(Paths, 'availableDiskSpace', { value: 1_000_000_000, configurable: true });
  jest.mocked(fetchUpdateManifest).mockResolvedValue(manifest());
  download.mockImplementation(async (_: string, file: File) => { mockFiles.set(file.name, { data: 10, schema: 14, size: 100, hash: 170 }); return file; });
});

test('stages a verified download without changing live catalogue or personal data; reuses the receipt', async () => {
  const states: string[] = [];
  expect((await stageLatestCatalog(9, 14, undefined, (progress) => states.push(progress.state))).state).toBe('staged');
  expect(states).toEqual(['checking', 'downloading', 'verifying']);
  expect(mockFiles.get('natura.db')?.data).toBe(9);
  expect(mockFiles.get('user.db')?.text).toBe('favorites and progress');
  expect((await stageLatestCatalog(9, 14)).state).toBe('staged');
  expect(download).toHaveBeenCalledTimes(1);
  expect(mockFiles.has('natura.download.db')).toBe(false);
});

test('keeps a previous pending release when a replacement fails its hash verification', async () => {
  await stageLatestCatalog(9, 14);
  jest.mocked(fetchUpdateManifest).mockResolvedValue(manifest(11, 'bb'));
  await expect(stageLatestCatalog(9, 14)).rejects.toThrow('catalog_sha256_mismatch');
  expect((await readPendingCatalog())?.data_version).toBe(10);
  expect(mockFiles.has(pendingName())).toBe(true);
  expect(mockFiles.has('natura.download.db')).toBe(false);
});

test('promotes a replacement only after verification and updates its receipt', async () => {
  await stageLatestCatalog(9, 14);
  jest.mocked(fetchUpdateManifest).mockResolvedValue(manifest(11, 'bb'));
  download.mockImplementation(async (_: string, file: File) => { mockFiles.set(file.name, { data: 11, schema: 14, size: 100, hash: 187 }); return file; });
  await stageLatestCatalog(9, 14);
  expect((await readPendingCatalog())?.data_version).toBe(11);
  expect(mockFiles.has(pendingName())).toBe(false);
  expect(mockFiles.get('natura.db')?.data).toBe(9);
});

test('applies the receipt only during a cold start and retains the previous database', async () => {
  await stageLatestCatalog(9, 14);
  await prepareCatalogDatabase(1);
  expect(mockFiles.get('natura.db')?.data).toBe(10);
  expect(mockFiles.get('natura.previous.db')?.data).toBe(9);
  expect(await readPendingCatalog()).toBeNull();
  expect(mockRemoved).not.toContain('user.db');
});

test('rejects corruption discovered after staging and cleans partial and legacy files', async () => {
  await stageLatestCatalog(9, 14);
  mockFiles.get(pendingName())!.hash = 187;
  mockFiles.set('natura.download.db', { data: 99 });
  mockFiles.set('natura.next.db', { data: 99, schema: 14 });
  await prepareCatalogDatabase(1);
  expect(mockFiles.get('natura.db')?.data).toBe(9);
  expect(mockFiles.has('natura.download.db')).toBe(false);
  expect(mockFiles.has('natura.next.db')).toBe(false);
});

test('recovers the previous database after a process stopped between the two activation moves', async () => {
  mockFiles.delete('natura.db');
  mockFiles.set('natura.previous.db', { data: 12, schema: 14 });
  await prepareCatalogDatabase(1);
  expect(mockFiles.get('natura.db')?.data).toBe(12);
});

test('refuses an unsupported schema or required app without downloading', async () => {
  jest.mocked(fetchUpdateManifest).mockResolvedValue({ ...manifest(), schema_version: 16 });
  expect((await stageLatestCatalog(9, 14)).state).toBe('app_update_required');
  jest.mocked(fetchUpdateManifest).mockResolvedValue({ ...manifest(), min_app_version: '1.5.0' });
  expect((await stageLatestCatalog(9, 14)).state).toBe('app_update_required');
  expect(download).not.toHaveBeenCalled();
});

test('does not start a download when free storage is insufficient', async () => {
  Object.defineProperty(Paths, 'availableDiskSpace', { value: 50, configurable: true });
  await expect(stageLatestCatalog(9, 14)).rejects.toMatchObject({ kind: 'space' });
  expect(download).not.toHaveBeenCalled();
});

test('cancels the native download at its own deadline and removes partial files', async () => {
  jest.useFakeTimers();
  download.mockImplementation((_url: string, file: File, options: { signal: AbortSignal }) => {
    mockFiles.set(file.name, { size: 5 });
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  });
  const result = stageLatestCatalog(9, 14);
  const rejection = expect(result).rejects.toMatchObject({ kind: 'interrupted' });
  await jest.advanceTimersByTimeAsync(CATALOG_DOWNLOAD_TIMEOUT_MS);
  await rejection;
  expect(mockFiles.has('natura.download.db')).toBe(false);
  expect(mockFiles.get('natura.db')?.data).toBe(9);
});

test('a failed metadata promotion keeps the previous verified pending release', async () => {
  await stageLatestCatalog(9, 14);
  jest.mocked(fetchUpdateManifest).mockResolvedValue(manifest(11, 'bb'));
  download.mockImplementation(async (_: string, file: File) => { mockFiles.set(file.name, { data: 11, schema: 14, size: 100, hash: 187 }); return file; });
  mockFailMoveTo = 'natura.pending.json';
  await expect(stageLatestCatalog(9, 14)).rejects.toThrow('move failed');
  expect((await readPendingCatalog())?.data_version).toBe(10);
});

test('a failed promotion also preserves a pending release recovered from the backup receipt', async () => {
  await stageLatestCatalog(9, 14);
  mockFiles.set('natura.pending.previous.json', { ...mockFiles.get('natura.pending.json') });
  mockFiles.set('natura.pending.json', { text: 'truncated' });
  jest.mocked(fetchUpdateManifest).mockResolvedValue(manifest(11, 'bb'));
  download.mockImplementation(async (_: string, file: File) => { mockFiles.set(file.name, { data: 11, schema: 14, size: 100, hash: 187 }); return file; });
  mockFailMoveTo = 'natura.pending.json';
  await expect(stageLatestCatalog(9, 14)).rejects.toThrow('move failed');
  expect((await readPendingCatalog())?.data_version).toBe(10);
});

test.each([
  [{ size: 99 }, 'catalog_size_mismatch'],
  [{ data: 11 }, 'catalog_version_mismatch'],
  [{ integrity: 'malformed' }, 'catalog_integrity_failed'],
  [{ missingTable: 'taxa' }, 'catalog_tables_missing'],
])('rejects invalid candidate metadata, size, integrity or tables without changing the live database: %j', async (invalid, error) => {
  download.mockImplementation(async (_: string, file: File) => { mockFiles.set(file.name, { data: 10, schema: 14, size: 100, hash: 170, ...invalid }); return file; });
  await expect(stageLatestCatalog(9, 14)).rejects.toThrow(error);
  expect(mockFiles.get('natura.db')?.data).toBe(9);
  expect(mockFiles.has('natura.download.db')).toBe(false);
});

test('restores the live catalogue when candidate activation fails and retries the pending copy next start', async () => {
  await stageLatestCatalog(9, 14);
  mockFailMoveTo = 'natura.db';
  await prepareCatalogDatabase(1);
  expect(mockFiles.get('natura.db')?.data).toBe(9);
  expect((await readPendingCatalog())?.data_version).toBe(10);
  await prepareCatalogDatabase(1);
  expect(mockFiles.get('natura.db')?.data).toBe(10);
});

test('a restart waits for cancellation of native file work from the preceding provider lifetime', async () => {
  const controller = new AbortController();
  let began!: () => void;
  const started = new Promise<void>((resolve) => { began = resolve; });
  download.mockImplementation((_url: string, file: File, options: { signal: AbortSignal }) => {
    mockFiles.set(file.name, { size: 5 });
    began();
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  });
  const downloadResult = stageLatestCatalog(9, 14, controller.signal);
  const rejected = expect(downloadResult).rejects.toMatchObject({ kind: 'interrupted' });
  await started;
  const prepare = prepareCatalogDatabase(1);
  controller.abort();
  await rejected; await prepare;
  expect(mockFiles.get('natura.db')?.data).toBe(9);
  expect(mockFiles.has('natura.download.db')).toBe(false);
  expect(mockFiles.get('user.db')?.text).toBe('favorites and progress');
});
