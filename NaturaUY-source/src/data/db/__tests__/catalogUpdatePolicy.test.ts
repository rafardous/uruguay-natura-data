import { compareVersions, decideCatalogUpdate, shouldActivateBundledCatalog } from '../catalogUpdatePolicy';

describe('catalog update policy', () => {
  test('skips the same or an older data release', () => {
    expect(decideCatalogUpdate({ dataVersion: 9, schemaVersion: 5, minAppVersion: '1.0.0' }, 10, 5, 5, '1.0.0')).toBe('current');
    expect(decideCatalogUpdate({ dataVersion: 10, schemaVersion: 5, minAppVersion: '1.0.0' }, 10, 5, 5, '1.0.0')).toBe('current');
  });

  test('can skip intermediate releases', () => {
    expect(decideCatalogUpdate({ dataVersion: 42, schemaVersion: 5, minAppVersion: '1.0.0' }, 3, 5, 5, '1.2.0')).toBe('stage');
  });

  test('keeps the local database when app or schema support is insufficient', () => {
    expect(decideCatalogUpdate({ dataVersion: 11, schemaVersion: 6, minAppVersion: '1.0.0' }, 10, 5, 5, '1.0.0')).toBe('app_update_required');
    expect(decideCatalogUpdate({ dataVersion: 11, schemaVersion: 5, minAppVersion: '1.1.0' }, 10, 5, 5, '1.0.9')).toBe('app_update_required');
  });

  test('requires an app update before an older client opens schema 14', () => {
    const schema14 = { dataVersion: 14, schemaVersion: 14, minAppVersion: '1.3.0' };
    expect(decideCatalogUpdate(schema14, 13, 13, 13, '1.2.0')).toBe('app_update_required');
    expect(decideCatalogUpdate(schema14, 13, 13, 14, '1.3.0')).toBe('stage');
  });

  test('never downgrades the installed catalogue schema', () => {
    expect(decideCatalogUpdate({ dataVersion: 3, schemaVersion: 8, minAppVersion: '1.0.0' }, 1, 10, 11, '1.0.0')).toBe('current');
  });

  test('compares semantic numeric segments', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
  });

  test('activates a bundled schema upgrade even when the data release number is unchanged', () => {
    expect(shouldActivateBundledCatalog({ dataVersion: 8, schemaVersion: 7 }, { dataVersion: 8, schemaVersion: 8 })).toBe(true);
    expect(shouldActivateBundledCatalog({ dataVersion: 9, schemaVersion: 7 }, { dataVersion: 8, schemaVersion: 8 })).toBe(true);
    expect(shouldActivateBundledCatalog({ dataVersion: 8, schemaVersion: 8 }, { dataVersion: 8, schemaVersion: 8 })).toBe(false);
    expect(shouldActivateBundledCatalog({ dataVersion: 8, schemaVersion: 8 }, { dataVersion: 9, schemaVersion: 8 })).toBe(true);
  });
});
