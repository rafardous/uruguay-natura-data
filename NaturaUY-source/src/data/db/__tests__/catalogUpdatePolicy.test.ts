import { compareVersions, decideCatalogUpdate } from '../catalogUpdatePolicy';

describe('catalog update policy', () => {
  test('skips the same or an older data release', () => {
    expect(decideCatalogUpdate({ dataVersion: 9, schemaVersion: 5, minAppVersion: '1.0.0' }, 10, 5, '1.0.0')).toBe('current');
    expect(decideCatalogUpdate({ dataVersion: 10, schemaVersion: 5, minAppVersion: '1.0.0' }, 10, 5, '1.0.0')).toBe('current');
  });

  test('can skip intermediate releases', () => {
    expect(decideCatalogUpdate({ dataVersion: 42, schemaVersion: 5, minAppVersion: '1.0.0' }, 3, 5, '1.2.0')).toBe('stage');
  });

  test('keeps the local database when app or schema support is insufficient', () => {
    expect(decideCatalogUpdate({ dataVersion: 11, schemaVersion: 6, minAppVersion: '1.0.0' }, 10, 5, '1.0.0')).toBe('app_update_required');
    expect(decideCatalogUpdate({ dataVersion: 11, schemaVersion: 5, minAppVersion: '1.1.0' }, 10, 5, '1.0.9')).toBe('app_update_required');
  });

  test('compares semantic numeric segments', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
  });
});
