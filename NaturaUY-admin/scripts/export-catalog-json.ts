import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadApprovedCatalog, writeCatalogJson } from './catalog-data';

const output = resolve(import.meta.dirname, '../dist/catalog-json');
rmSync(output, { recursive: true, force: true });
const records = await loadApprovedCatalog();
writeCatalogJson(output, records);
console.log(`Exported ${records.length} active species to catalog-full.json and six class files.`);
