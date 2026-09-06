import { assertCatalogManifest } from '../catalogManifestValidation';

const valid = { data_version: 2, schema_version: 6, published_at: '2026-09-06T00:00:00Z', database_url: 'https://example.com/catalog.db', database_size: 100, sha256: 'a'.repeat(64), min_app_version: '1.0.0', quality_report_url: 'https://example.com/quality.json' };

describe('assertCatalogManifest', () => {
  test('accepts the strict public contract', () => expect(() => assertCatalogManifest(valid)).not.toThrow());
  test('rejects insecure URLs and malformed hashes', () => expect(() => assertCatalogManifest({ ...valid, database_url: 'http://example.com/catalog.db' })).toThrow('manifest_url_invalid'));
  test('rejects invalid size/version metadata', () => expect(() => assertCatalogManifest({ ...valid, database_size: 0 })).toThrow('manifest_size_invalid'));
});
