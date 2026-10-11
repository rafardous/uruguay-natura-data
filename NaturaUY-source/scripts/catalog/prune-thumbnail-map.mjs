import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Depura las referencias de miniaturas; conserva archivos y derechos históricos.
const root = resolve(import.meta.dirname, '../..');
const db = new DatabaseSync(resolve(root, 'assets/db/natura.db'), { readOnly: true });
const species = db.prepare('select codigo, scientific_name, kingdom from species').all();
db.close();
const codes = new Set(species.map((row) => row.codigo));
const seed = JSON.parse(readFileSync(resolve(root, 'data/raw/curated-plants/seed-100.json'), 'utf8'));
const plants = new Set([...seed.arboles, ...seed.otras_plantas_nativas].map((row) => row.nombre_cientifico));
assert.equal(codes.size, 1048);
assert.equal(plants.size, 100);
assert.deepEqual(new Set(species.filter((row) => row.kingdom === 'Plantae').map((row) => row.scientific_name)), plants);
const target = resolve(root, 'src/data/assets/thumbMap.ts');
const old = readFileSync(target, 'utf8');
const entries = [...old.matchAll(/^  '([^']+)': require\('[^']+'\),$/gm)];
assert.ok(entries.length > 0, 'El mapa debe tener entradas de assets estáticos');
const kept = entries.filter(([, code]) => codes.has(code));
const next = `// Miniaturas del catálogo incluido. Depurar con npm run data:thumbnail-map -- --write.\nexport const THUMBNAILS: Record<string, number> = {\n${kept.map(([line]) => line).join('\n')}\n};\n\nexport const thumbnailFor = (codigo: string | null | undefined): number | null =>\n  codigo ? (THUMBNAILS[codigo] ?? null) : null;\n`;
if (process.argv.includes('--write')) writeFileSync(target, next);
console.log(JSON.stringify({ before: entries.length, kept: kept.length, removed: entries.length - kept.length, written: process.argv.includes('--write') }));
