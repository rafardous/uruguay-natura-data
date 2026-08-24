import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { defaultDatabaseDirectory, importDatabaseFromAssetAsync, openDatabaseAsync } from 'expo-sqlite';

import { CATALOG_DATABASE_NAME } from './schema';
import { decideCatalogUpdate } from './catalogUpdatePolicy';

const STAGED_DATABASE_NAME = 'natura.next.db';
const PREVIOUS_DATABASE_NAME = 'natura.previous.db';
const BUNDLED_DATABASE_NAME = 'natura.bundled.db';
export const SUPPORTED_CATALOG_SCHEMA = 4;

export interface CatalogManifest {
  data_version: number;
  schema_version: number;
  published_at: string;
  database_url: string;
  database_size: number;
  sha256: string;
  min_app_version: string;
  quality_report_url: string;
}

const databaseFile = (name: string): File => new File(defaultDatabaseDirectory, name);

async function readMeta(databaseName: string): Promise<{ dataVersion: number; schemaVersion: number }> {
  const database = await openDatabaseAsync(databaseName);
  try {
    const integrity = await database.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') throw new Error(`catalog_integrity_failed:${integrity?.integrity_check}`);
    const rows = await database.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM meta WHERE key IN ('data_version', 'schema_version')");
    const meta = Object.fromEntries(rows.map((row) => [row.key, row.value]));
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
  if (previous.exists) {
    try {
      await readMeta(PREVIOUS_DATABASE_NAME);
      if (current.exists) current.delete();
      await previous.move(databaseFile(CATALOG_DATABASE_NAME));
      await readMeta(CATALOG_DATABASE_NAME);
      return;
    } catch { if (previous.exists) previous.delete(); }
  }
  if (current.exists) current.delete();
  await importDatabaseFromAssetAsync(CATALOG_DATABASE_NAME, { assetId, forceOverwrite: true });
  await readMeta(CATALOG_DATABASE_NAME);
}

/** Runs before SQLiteProvider opens the catalogue, so no connection is moved underneath React. */
export async function prepareCatalogDatabase(assetId: number): Promise<void> {
  try { await atomicReplace(STAGED_DATABASE_NAME); }
  catch { const staged = databaseFile(STAGED_DATABASE_NAME); if (staged.exists) staged.delete(); }
  await importDatabaseFromAssetAsync(CATALOG_DATABASE_NAME, { assetId, forceOverwrite: false });
  await importDatabaseFromAssetAsync(BUNDLED_DATABASE_NAME, { assetId, forceOverwrite: true });
  try { await readMeta(CATALOG_DATABASE_NAME); } catch { await recoverInstalledCatalog(assetId); }
  const [installed, bundled] = await Promise.all([readMeta(CATALOG_DATABASE_NAME), readMeta(BUNDLED_DATABASE_NAME)]);
  if (bundled.dataVersion > installed.dataVersion) await atomicReplace(BUNDLED_DATABASE_NAME);
  else { const bundledFile = databaseFile(BUNDLED_DATABASE_NAME); if (bundledFile.exists) bundledFile.delete(); }
}

async function sha256(file: File): Promise<string> {
  const result = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await file.bytes());
  return [...new Uint8Array(result)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function stageLatestCatalog(currentDataVersion: number, signal?: AbortSignal): Promise<'current' | 'staged' | 'app_update_required'> {
  const configured = process.env.EXPO_PUBLIC_CATALOG_MANIFEST_URL
    ?? (Constants.expoConfig?.extra?.catalogManifestUrl as string | undefined);
  if (!configured) return 'current';
  const response = await fetch(configured, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`manifest_http_${response.status}`);
  const manifest = await response.json() as CatalogManifest;
  const decision = decideCatalogUpdate({ dataVersion: manifest.data_version, schemaVersion: manifest.schema_version, minAppVersion: manifest.min_app_version }, currentDataVersion, SUPPORTED_CATALOG_SCHEMA, Constants.expoConfig?.version ?? '0.0.0');
  if (decision !== 'stage') return decision;
  const staged = databaseFile(STAGED_DATABASE_NAME);
  if (staged.exists) staged.delete();
  await File.downloadFileAsync(manifest.database_url, staged, { idempotent: true });
  try {
    if (staged.size !== manifest.database_size) throw new Error(`catalog_size_mismatch:${staged.size}`);
    if (await sha256(staged) !== manifest.sha256.toLowerCase()) throw new Error('catalog_sha256_mismatch');
    const meta = await readMeta(STAGED_DATABASE_NAME);
    if (meta.dataVersion !== manifest.data_version || meta.schemaVersion !== manifest.schema_version) throw new Error('catalog_version_mismatch');
    return 'staged';
  } catch (error) { if (staged.exists) staged.delete(); throw error; }
}
