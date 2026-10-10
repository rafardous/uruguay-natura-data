import { readdir, readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const originals = process.argv[2];
if (!originals) throw new Error('Uso: node scripts/audit-guide-bird-names.mjs <carpeta-originales>');
const catalogueFile = new URL('../data/guide-birds/aves_catalogo_para_correspondencias.csv', import.meta.url);
const catalogue = (await readFile(catalogueFile, 'utf8')).trim().split(/\r?\n/).slice(1).map((line) => {
  const [id, code, common, scientific, state] = line.match(/(?:"[^"]*"|[^,]+)(?=,|$)/g).map((value) => value.replace(/^"|"$/g, ''));
  return { id, code, common, scientific, state };
});
const norm = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const byScientific = new Map(catalogue.map((item) => [norm(item.scientific), item]));
const byCommon = new Map();
for (const item of catalogue) byCommon.set(norm(item.common), [...(byCommon.get(norm(item.common)) ?? []), item]);

const groups = new Map();
for (const dirent of await readdir(originals, { withFileTypes: true })) {
  if (!dirent.isFile()) continue;
  const name = dirent.name;
  const stem = basename(name, extname(name));
  const prefix = /^(\d{1,3})(?:\s*\((\d+)\))?\s+(.+)$/.exec(stem)
    ?? /^(\d{1,3})\s*\((\d+)\)\s*(\S.+)$/.exec(stem);
  if (!prefix) continue;
  const number = Number(prefix[1]);
  if (number < 1 || number > 435) continue;
  const label = prefix[3].trim();
  if (!label || /^[\d_-]+$/.test(label) || /^(DSC|IMG|DSCN|P\d)/i.test(label)) continue;
  const scientificNames = [...label.matchAll(/\(([A-Z][a-z]+\s+[a-z][a-z-]+)(?:\s+[a-z][a-z-]+)?\)/g)].map((m) => m[1]);
  const scientificMatches = scientificNames.map((value) => byScientific.get(norm(value))).filter(Boolean);
  const commonLabel = label.split(/\s*[-–]\s*|\s*\(/)[0].trim();
  const commonMatches = byCommon.get(norm(commonLabel)) ?? [];
  const matches = scientificMatches.length ? scientificMatches : commonMatches;
  groups.set(number, [...(groups.get(number) ?? []), { name, label, scientificNames, commonLabel, matchBasis: scientificMatches.length ? 'scientific' : commonMatches.length ? 'common' : null, matches: matches.map((item) => ({ id: item.id, scientific: item.scientific, common: item.common })) }]);
}
const summary = { numbersWithLabels: groups.size, uniqueExact: 0, conflict: 0, unmatched: 0 };
const rows = [...groups].sort(([a], [b]) => a - b).map(([number, evidence]) => {
  const ids = [...new Set(evidence.flatMap((item) => item.matches.map((match) => match.id)))];
  const status = ids.length === 1 ? 'unique' : ids.length > 1 ? 'conflict' : 'unmatched';
  if (status === 'unique') summary.uniqueExact++;
  else summary[status]++;
  return { number, status, ids, evidence };
});
console.log(JSON.stringify(process.argv.includes('--compact')
  ? { summary, rows: rows.map(({ number, status, ids, evidence }) => ({ number, status, ids, labels: evidence.map((item) => item.label).filter((label) => label.length > 8).slice(0, 3), basis: evidence.some((item) => item.matchBasis === 'scientific') ? 'scientific' : evidence.some((item) => item.matchBasis === 'common') ? 'common' : '', target: evidence.flatMap((item) => item.matches)[0] ?? null })) }
  : { summary, rows }, null, process.argv.includes('--compact') ? 0 : 2));
