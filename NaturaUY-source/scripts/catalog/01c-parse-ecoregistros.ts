import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PATHS, ensureDirs, writeJson } from './lib';

/**
 * EcoRegistros is a restricted reference. This parser produces an audit-only
 * inventory and never feeds data/catalog or any release artifact.
 */
const INPUT = process.env.NATURA_ECOREGISTROS_PATH
  ? resolve(process.env.NATURA_ECOREGISTROS_PATH)
  : resolve(PATHS.raw, 'ecoregistros.org/insectos-uruguay/restricted/insectos-Uruguay.xls');
const OUT = resolve(PATHS.reports, 'ecoregistros-reference.json');

function decode(value: string): string {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function rank(name: string): 'species' | 'genus' | 'higher' | 'uncertain' {
  if (/^(?:[A-Z][a-z-]+)\s+[a-z-]+(?:\s+(?:cf\.|aff\.)\s*[a-z-]+)?$/u.test(name)) return 'species';
  if (/\b(?:sp\.?|cf\.|aff\.)\b/iu.test(name)) return 'uncertain';
  if (/^[A-Z][a-z-]+$/u.test(name)) return 'genus';
  return 'higher';
}

function main(): void {
  ensureDirs();
  if (!existsSync(INPUT)) throw new Error(`No se encontró la fuente restringida: ${INPUT}`);
  const html = readFileSync(INPUT).toString('latin1');
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decode(cell[1]!)))
    .filter((cells) => cells.length > 0);
  const header = rows[0] ?? [];
  const detectedScientificColumn = header.findIndex((value) => /cient(?:&iacute;|í)?fico|scientific/i.test(value));
  const scientificColumn = detectedScientificColumn >= 0 ? detectedScientificColumn : 6;
  const names = rows.slice(1).map((cells) => cells[scientificColumn] ?? '')
    .filter((value) => /^[A-ZÁÉÍÓÚÑ][^,;]{1,80}$/u.test(value))
    .map((value) => value.replace(/\s+\([^)]*\)$/u, '').trim())
    .filter((value) => value && !/^(especie|nombre|taxón|taxon|familia|orden|clase)$/iu.test(value));
  const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'es'));
  const counts = Object.fromEntries(['species', 'genus', 'higher', 'uncertain'].map((key) => [key, unique.filter((name) => rank(name) === key).length]));
  writeJson(OUT, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceCode: 'ecoregistros_insectos_uruguay',
    sourcePath: INPUT.replace(`${resolve(PATHS.raw, '..')}\\`, '').replaceAll('\\', '/'),
    policy: 'discovery_only_no_redistribution',
    parser: 'html-table-latin1-v1',
    rowCount: rows.length,
    uniqueNameCount: unique.length,
    rankCounts: counts,
    candidates: unique.map((name) => ({ name, rank: rank(name), requiresIndependentOpenEvidence: true })),
  });
  console.log(`01c-parse-ecoregistros: ${rows.length} filas, ${unique.length} nombres; informe restringido escrito sin candidatos publicables`);
}

main();
