import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const output = process.argv[2];
const numbers = new Set(process.argv.slice(3).map(Number));
if (!output || !numbers.size) throw new Error('Uso: node scripts/find-guide-bird-duplicates.mjs <carpeta-reducidas> <números...>');
const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
const targets = manifest.selected.filter((item) => numbers.has(item.number));
const byHash = new Map();
for (const item of targets) byHash.set(item.mainSha256, [...(byHash.get(item.mainSha256) ?? []), item]);
const hits = [];
for (const file of await readdir(join(output, 'todas'))) {
  if (!file.endsWith('.webp')) continue;
  const hash = createHash('sha256').update(await readFile(join(output, 'todas', file))).digest('hex');
  for (const target of byHash.get(hash) ?? []) {
    if (file !== `${target.original}.webp`) hits.push({ number: target.number, selected: target.original, identical: file.slice(0, -5) });
  }
}
console.log(JSON.stringify({ targets: targets.length, hits }));
