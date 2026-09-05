import { assertCatalogDownload, assertCatalogIntegrity, recoverySource } from '../catalogUpdateValidation';

const valid = {
  actualSize: 10, expectedSize: 10, actualSha256: 'abc', expectedSha256: 'ABC',
  actualDataVersion: 5, expectedDataVersion: 5, actualSchemaVersion: 5, expectedSchemaVersion: 5,
};

describe('catalog candidate validation', () => {
  test('accepts a matching candidate', () => expect(() => assertCatalogDownload(valid)).not.toThrow());
  test('rejects an invalid checksum', () => expect(() => assertCatalogDownload({ ...valid, actualSha256: 'bad' })).toThrow('catalog_sha256_mismatch'));
  test('rejects mismatched metadata', () => expect(() => assertCatalogDownload({ ...valid, actualSchemaVersion: 4 })).toThrow('catalog_version_mismatch'));
  test('rejects an invalid SQLite integrity result', () => expect(() => assertCatalogIntegrity('malformed')).toThrow('catalog_integrity_failed:malformed'));
  test('restores the previous valid copy, otherwise the bundled database', () => {
    expect(recoverySource(true)).toBe('previous');
    expect(recoverySource(false)).toBe('bundled');
  });
});
