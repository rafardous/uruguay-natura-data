import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { defaultDatabaseDirectory, importDatabaseFromAssetAsync, openDatabaseAsync } from 'expo-sqlite';

import { CATALOG_DATABASE_NAME } from './schema';
import { OWNED_DATABASE_OPTIONS } from './sqliteOpenOptions';
import { decideCatalogUpdate, shouldActivateBundledCatalog } from './catalogUpdatePolicy';
import { assertCatalogDownload, assertCatalogIntegrity, assertCatalogTables, recoverySource } from './catalogUpdateValidation';
import { assertCatalogManifest, type CatalogManifestContract } from './catalogManifestValidation';
import { installedAppVersion } from '../updates/installedApp';
import { fetchUpdateManifest } from '../updates/fetchUpdateManifest';
import { UpdateError } from '../updates/updateErrors';

const STAGED_DATABASE_NAME = 'natura.next.db';
const PREVIOUS_DATABASE_NAME = 'natura.previous.db';
const BUNDLED_DATABASE_NAME = 'natura.bundled.db';
const DOWNLOAD_DATABASE_NAME = 'natura.download.db';
const PENDING_METADATA_NAME = 'natura.pending.json';
const PREVIOUS_METADATA_NAME = 'natura.pending.previous.json';
const NEXT_METADATA_NAME = 'natura.pending.next.json';
export const CATALOG_DOWNLOAD_TIMEOUT_MS = 120_000;
export const SUPPORTED_CATALOG_SCHEMA = 15;

export type CatalogManifest = CatalogManifestContract;
export { assertCatalogManifest } from './catalogManifestValidation';

// Serialize native file work across provider lifetimes (including a startup recovery remount).
let fileOperation: Promise<unknown> = Promise.resolve();
function serializeFileOperation<T>(work: () => Promise<T>): Promise<T> {
  const next = fileOperation.catch(() => {}).then(work);
  fileOperation = next;
  return next;
}

/**
 * expo-sqlite exposes the native database directory as a filesystem path,
 * while expo-file-system's new File API expects a URI. Android otherwise
 * throws `URI is not absolute` before it can inspect the bundled catalogue.
 */
function databaseDirectoryUri(): string {
  const directory = String(defaultDatabaseDirectory);
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(directory)) return directory.replace(/\/+$/, '');
  return `file://${directory.startsWith('/') ? '' : '/'}${directory.replace(/\/+$/, '')}`;
}

const databaseFile = (name: string): File => new File(`${databaseDirectoryUri()}/${name}`);

async function readMeta(databaseName: string): Promise<{ dataVersion: number; schemaVersion: number }> {
  // Never share these validation handles with SQLiteProvider. In particular,
  // closing a cached alias while React owns the catalogue can invalidate the
  // native connection underneath the provider.
  const database = await openDatabaseAsync(databaseName, OWNED_DATABASE_OPTIONS);
  try {
    const integrity = await database.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    assertCatalogIntegrity(integrity?.integrity_check);
    const rows = await database.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key IN ('data_version', 'schema_version')");
    const meta = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    if (!Number.isSafeInteger(Number(meta.data_version)) || Number(meta.data_version) < 0
      || !Number.isSafeInteger(Number(meta.schema_version)) || Number(meta.schema_version) < 1) throw new Error('catalog_meta_invalid');
    const tables = await database.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
    assertCatalogTables(Number(meta.schema_version ?? 0), tables.map((table) => table.name));
    return { dataVersion: Number(meta.data_version ?? 0), schemaVersion: Number(meta.schema_version ?? 0) };
  } finally { await database.closeAsync(); }
}

async function atomicReplace(candidateName: string): Promise<void> {
  const current = databaseFile(CATALOG_DATABASE_NAME); const candidate = databaseFile(candidateName); const previous = databaseFile(PREVIOUS_DATABASE_NAME);
  if (!candidate.exists) return;
  await readMeta(candidateName);
  if (previous.exists) previous.delete();
  if (current.exists) await current.move(previous);
  try {
    await candidate.move(databaseFile(CATALOG_DATABASE_NAME));
    await readMeta(CATALOG_DATABASE_NAME);
  } catch (error) {
    const failedCurrent = databaseFile(CATALOG_DATABASE_NAME); const backup = databaseFile(PREVIOUS_DATABASE_NAME);
    if (failedCurrent.exists) failedCurrent.delete();
    if (backup.exists) await backup.move(databaseFile(CATALOG_DATABASE_NAME));
    throw error;
  }
}

async function recoverInstalledCatalog(assetId: number): Promise<void> {
  const current = databaseFile(CATALOG_DATABASE_NAME); const previous = databaseFile(PREVIOUS_DATABASE_NAME);
  let previousIsValid = false;
  if (previous.exists) {
    try {
      await readMeta(PREVIOUS_DATABASE_NAME);
      previousIsValid = true;
      if (recoverySource(previousIsValid) !== 'previous') throw new Error('invalid_recovery_plan');
      if (current.exists) current.delete();
      await previous.move(databaseFile(CATALOG_DATABASE_NAME));
      await readMeta(CATALOG_DATABASE_NAME);
      return;
    } catch { if (previous.exists) previous.delete(); }
  }
  if (recoverySource(previousIsValid) !== 'bundled') throw new Error('catalog_recovery_failed');
  if (current.exists) current.delete();
  await importDatabaseFromAssetAsync(CATALOG_DATABASE_NAME, { assetId, forceOverwrite: true });
  await readMeta(CATALOG_DATABASE_NAME);
}

/** Runs before SQLiteProvider opens the catalogue, so no connection is moved underneath React. */
export async function prepareCatalogDatabase(assetId: number): Promise<void> {
  return serializeFileOperation(() => prepareCatalogDatabaseInternal(assetId));
}

async function prepareCatalogDatabaseInternal(assetId: number): Promise<void> {
  // Old clients left natura.next.db without a verification receipt. Never activate it blindly.
  removeFile(STAGED_DATABASE_NAME);
  removeFile(DOWNLOAD_DATABASE_NAME);
  removeFile(NEXT_METADATA_NAME);
  // Recover first: a process may have stopped between moving current to previous and activating.
  try { await readMeta(CATALOG_DATABASE_NAME); } catch { await recoverInstalledCatalog(assetId); }
  await importDatabaseFromAssetAsync(BUNDLED_DATABASE_NAME, { assetId, forceOverwrite: true });
  // Keep native close operations serialized. Concurrent statement teardown is
  // the startup crash observed on Android 17 / Pixel 9 Pro XL.
  const installed = await readMeta(CATALOG_DATABASE_NAME);
  const bundled = await readMeta(BUNDLED_DATABASE_NAME);
  if (shouldActivateBundledCatalog(installed, bundled)) await atomicReplace(BUNDLED_DATABASE_NAME);
  else { const bundledFile = databaseFile(BUNDLED_DATABASE_NAME); if (bundledFile.exists) bundledFile.delete(); }
  const pending = await readPendingCatalogInternal();
  if (pending) {
    const active = await readMeta(CATALOG_DATABASE_NAME);
    if (catalogDecision(pending, active.dataVersion, active.schemaVersion) === 'stage') {
      // Revalidate immediately before moving a database, while React owns no catalogue handle.
      await verifyCatalog(pendingDatabaseName(pending), pending);
      try {
        await atomicReplace(pendingDatabaseName(pending));
        clearPendingCatalog();
      } catch { /* Keep the receipt for a later retry; atomicReplace restores the current DB. */ }
    } else clearPendingCatalog();
  }
  cleanupPendingFiles(pending ? pendingDatabaseName(pending) : undefined);
}

async function sha256(file: File): Promise<string> {
  const result = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await file.bytes());
  return [...new Uint8Array(result)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function removeFile(name: string): void {
  const file = databaseFile(name);
  if (file.exists) file.delete();
}

function pendingDatabaseName(manifest: CatalogManifest): string {
  return `natura.pending-${manifest.data_version}-${manifest.sha256.toLowerCase()}.db`;
}

function catalogDecision(manifest: CatalogManifest, dataVersion: number, schemaVersion: number) {
  return decideCatalogUpdate({ dataVersion: manifest.data_version, schemaVersion: manifest.schema_version, minAppVersion: manifest.min_app_version }, dataVersion, schemaVersion, SUPPORTED_CATALOG_SCHEMA, installedAppVersion());
}

async function verifyCatalog(name: string, manifest: CatalogManifest): Promise<void> {
  const file = databaseFile(name);
  if (!file.exists) throw new Error('catalog_file_missing');
  // Fail unsupported schemas before attempting SQLite reads.
  if (manifest.schema_version > SUPPORTED_CATALOG_SCHEMA || catalogDecision(manifest, -1, 0) !== 'stage') throw new Error('catalog_compatibility_invalid');
  const checksum = await sha256(file);
  const meta = await readMeta(name);
  assertCatalogDownload({ actualSize: file.size, expectedSize: manifest.database_size, actualSha256: checksum, expectedSha256: manifest.sha256, actualDataVersion: meta.dataVersion, expectedDataVersion: manifest.data_version, actualSchemaVersion: meta.schemaVersion, expectedSchemaVersion: manifest.schema_version });
}

export async function readPendingCatalog(): Promise<CatalogManifest | null> {
  return serializeFileOperation(readPendingCatalogInternal);
}

async function readPendingCatalogInternal(): Promise<CatalogManifest | null> {
  for (const name of [PENDING_METADATA_NAME, PREVIOUS_METADATA_NAME]) {
    const receipt = databaseFile(name);
    if (!receipt.exists) continue;
    try {
      const value: unknown = JSON.parse(await receipt.text());
      assertCatalogManifest(value);
      await verifyCatalog(pendingDatabaseName(value), value);
      return value;
    } catch { /* A corrupt or incomplete receipt must never activate a candidate. */ }
  }
  return null;
}

function clearPendingCatalog(): void {
  removeFile(PENDING_METADATA_NAME);
  removeFile(PREVIOUS_METADATA_NAME);
}

function cleanupPendingFiles(keep?: string): void {
  // Only our catalogue candidates, never user.db, installed DBs or unrelated files.
  try {
    for (const entry of new Directory(databaseDirectoryUri()).list()) {
      if (entry instanceof File && /^natura\.pending-\d+-[a-f0-9]{64}\.db$/.test(entry.name) && entry.name !== keep) entry.delete();
    }
  } catch { /* Cleanup cannot invalidate a successful update. */ }
}

export type CatalogUpdateProgress = { state: 'checking' | 'downloading' | 'verifying'; manifest?: CatalogManifest };
export type CatalogStageResult = { state: 'current' | 'staged' | 'app_update_required'; manifest: CatalogManifest };

export async function stageLatestCatalog(currentDataVersion: number, currentSchemaVersion: number, signal?: AbortSignal, onProgress?: (progress: CatalogUpdateProgress) => void): Promise<CatalogStageResult> {
  return serializeFileOperation(() => {
    if (signal?.aborted) throw new UpdateError('interrupted', 'catalog_download_cancelled');
    return stageLatestCatalogInternal(currentDataVersion, currentSchemaVersion, signal, onProgress);
  });
}

async function stageLatestCatalogInternal(currentDataVersion: number, currentSchemaVersion: number, signal?: AbortSignal, onProgress?: (progress: CatalogUpdateProgress) => void): Promise<CatalogStageResult> {
  const configured = process.env.EXPO_PUBLIC_CATALOG_MANIFEST_URL
    ?? (Constants.expoConfig?.extra?.catalogManifestUrl as string | undefined);
  if (!configured) throw new UpdateError('invalid', 'manifest_url_missing');
  onProgress?.({ state: 'checking' });
  const manifestValue = await fetchUpdateManifest(configured, signal);
  assertCatalogManifest(manifestValue);
  const manifest = manifestValue;
  const decision = catalogDecision(manifest, currentDataVersion, currentSchemaVersion);
  if (decision !== 'stage') return { state: decision, manifest };
  const pending = await readPendingCatalogInternal();
  if (pending && pending.data_version >= manifest.data_version && pending.schema_version >= manifest.schema_version) {
    if (pending.data_version > manifest.data_version || pending.sha256.toLowerCase() === manifest.sha256.toLowerCase()) return { state: 'staged', manifest: pending };
  }
  const available = Paths.availableDiskSpace;
  if (available < manifest.database_size + 5 * 1024 * 1024) throw new UpdateError('space', 'catalog_space_insufficient');
  removeFile(DOWNLOAD_DATABASE_NAME);
  const temporary = databaseFile(DOWNLOAD_DATABASE_NAME);
  const downloadController = new AbortController();
  const abort = () => downloadController.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, CATALOG_DOWNLOAD_TIMEOUT_MS);
  let promoted = false;
  try {
    onProgress?.({ state: 'downloading', manifest });
    await File.downloadFileAsync(manifest.database_url, temporary, { idempotent: true, signal: downloadController.signal });
    clearTimeout(timeout);
    if (downloadController.signal.aborted) throw new UpdateError('interrupted', 'catalog_download_cancelled');
    onProgress?.({ state: 'verifying', manifest });
    await verifyCatalog(DOWNLOAD_DATABASE_NAME, manifest);
    if (signal?.aborted) throw new UpdateError('interrupted', 'catalog_download_cancelled');
    await temporary.move(databaseFile(pendingDatabaseName(manifest)), { overwrite: true });
    const receipt = databaseFile(NEXT_METADATA_NAME);
    receipt.write(JSON.stringify(manifest));
    // Preserve the verified receipt even when readPendingCatalog recovered it from the backup.
    if (pending) databaseFile(PREVIOUS_METADATA_NAME).write(JSON.stringify(pending));
    await receipt.move(databaseFile(PENDING_METADATA_NAME), { overwrite: true });
    promoted = true;
    try { removeFile(PREVIOUS_METADATA_NAME); } catch { /* Old receipt is a safe fallback. */ }
    cleanupPendingFiles(pendingDatabaseName(manifest));
    return { state: 'staged', manifest };
  } catch (error) {
    if (downloadController.signal.aborted) throw new UpdateError('interrupted', 'catalog_download_cancelled');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
    try { removeFile(DOWNLOAD_DATABASE_NAME); removeFile(NEXT_METADATA_NAME); } catch { /* Removed on next cold start. */ }
    // Unreferenced verified candidates are removed on the next cold start if promotion failed.
    if (!promoted && !pending) cleanupPendingFiles();
  }
}
