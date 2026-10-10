export function assertCatalogIntegrity(integrity: string | undefined): void {
  if (integrity !== 'ok') throw new Error(`catalog_integrity_failed:${integrity}`);
}

export function assertCatalogTables(schemaVersion: number, tables: string[]): void {
  if (schemaVersion < 14) return;
  const required = ['species', 'meta', 'taxa', 'species_taxa', 'taxon_names', 'taxon_closure', 'species_media', 'learning_paths'];
  const missing = required.filter((table) => !tables.includes(table));
  if (missing.length) throw new Error(`catalog_tables_missing:${missing.join(',')}`);
}

export function assertCatalogDownload(input: {
  actualSize: number;
  expectedSize: number;
  actualSha256: string;
  expectedSha256: string;
  actualDataVersion: number;
  expectedDataVersion: number;
  actualSchemaVersion: number;
  expectedSchemaVersion: number;
}): void {
  if (input.actualSize !== input.expectedSize) throw new Error(`catalog_size_mismatch:${input.actualSize}`);
  if (input.actualSha256.toLowerCase() !== input.expectedSha256.toLowerCase()) throw new Error('catalog_sha256_mismatch');
  if (input.actualDataVersion !== input.expectedDataVersion || input.actualSchemaVersion !== input.expectedSchemaVersion) throw new Error('catalog_version_mismatch');
}

export const recoverySource = (previousCopyIsValid: boolean): 'previous' | 'bundled' => previousCopyIsValid ? 'previous' : 'bundled';
