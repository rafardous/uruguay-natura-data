export interface CatalogManifestContract {
  data_version: number;
  schema_version: number;
  published_at: string;
  database_url: string;
  database_size: number;
  sha256: string;
  min_app_version: string;
  quality_report_url: string;
}

export function assertCatalogManifest(value: unknown): asserts value is CatalogManifestContract {
  if (!value || typeof value !== 'object') throw new Error('manifest_invalid');
  const manifest = value as Partial<CatalogManifestContract>;
  const urls = [manifest.database_url, manifest.quality_report_url];
  if (!urls.every((url) => typeof url === 'string' && (() => { try { return new URL(url).protocol === 'https:'; } catch { return false; } })())) throw new Error('manifest_url_invalid');
  if (typeof manifest.published_at !== 'string' || Number.isNaN(Date.parse(manifest.published_at))) throw new Error('manifest_published_at_invalid');
  if (!Number.isSafeInteger(manifest.data_version) || (manifest.data_version ?? 0) < 0) throw new Error('manifest_data_version_invalid');
  if (!Number.isSafeInteger(manifest.schema_version) || (manifest.schema_version ?? 0) < 1) throw new Error('manifest_schema_version_invalid');
  if (!Number.isSafeInteger(manifest.database_size) || (manifest.database_size ?? 0) <= 0) throw new Error('manifest_size_invalid');
  if (typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(manifest.sha256)) throw new Error('manifest_sha256_invalid');
  if (typeof manifest.min_app_version !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.min_app_version)) throw new Error('manifest_min_app_version_invalid');
}
