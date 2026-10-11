import { assertCatalogDownload, assertCatalogIntegrity, assertCatalogTables, recoverySource } from '../catalogUpdateValidation';

const valid = {
  actualSize: 10, expectedSize: 10, actualSha256: 'abc', expectedSha256: 'ABC',
  actualDataVersion: 5, expectedDataVersion: 5, actualSchemaVersion: 5, expectedSchemaVersion: 5,
};

describe('catalog candidate validation', () => {
  test('schema 15 requires every offline habitat table and schema 14 remains supported',()=>{
    const legacy=['species','meta','taxa','species_taxa','taxon_names','taxon_closure','species_media','learning_paths'];
    const habitats=['habitats','habitat_relations','habitat_aliases','species_habitats','habitat_metrics','habitat_media'];
    expect(()=>assertCatalogTables(15,legacy)).toThrow('catalog_tables_missing:habitats');
    for(const missing of habitats)expect(()=>assertCatalogTables(15,[...legacy,...habitats.filter(t=>t!==missing)])).toThrow(`catalog_tables_missing:${missing}`);
    expect(()=>assertCatalogTables(15,[...legacy,...habitats])).not.toThrow();
    expect(()=>assertCatalogTables(14,legacy)).not.toThrow();
  });
  test('rejects schema 14 without offline taxonomy despite valid integrity and metadata', () => {
    expect(() => assertCatalogTables(14, ['species','meta','species_media','learning_paths'])).toThrow('catalog_tables_missing:taxa,species_taxa,taxon_names,taxon_closure');
    expect(() => assertCatalogTables(14, ['species','meta','taxa','species_taxa','taxon_names','taxon_closure','species_media','learning_paths'])).not.toThrow();
    expect(() => assertCatalogTables(12, ['species','meta'])).not.toThrow();
  });
  test('accepts a matching candidate', () => expect(() => assertCatalogDownload(valid)).not.toThrow());
  test('rejects an invalid checksum', () => expect(() => assertCatalogDownload({ ...valid, actualSha256: 'bad' })).toThrow('catalog_sha256_mismatch'));
  test('rejects mismatched metadata', () => expect(() => assertCatalogDownload({ ...valid, actualSchemaVersion: 4 })).toThrow('catalog_version_mismatch'));
  test('rejects an invalid SQLite integrity result', () => expect(() => assertCatalogIntegrity('malformed')).toThrow('catalog_integrity_failed:malformed'));
  test('restores the previous valid copy, otherwise the bundled database', () => {
    expect(recoverySource(true)).toBe('previous');
    expect(recoverySource(false)).toBe('bundled');
  });
});
