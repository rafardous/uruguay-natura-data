import { writeFileSync } from 'node:fs';
import { GROUPS, PATHS, readJson, writeJson } from './lib';

interface Item { scientificName: string; evidence: Array<{ source: string; taxonomy: Record<string, string | null> }>; resolution: { status: string; acceptedName: string | null; sourceStatus: string | null; taxonomy: Record<string, string | null> }; }
function main(): void {
  const all = readJson<Item[]>(PATHS.resolved); const report: Record<string, unknown> = {};
  for (const group of GROUPS) {
    // Group scope comes from the Uruguay-source evidence. GBIF may return a
    // compatible subordinate class (e.g. Testudines under Reptilia).
    const rows = all.filter((row) => row.evidence.some((e) => e.taxonomy.class === group));
    const sourceOnly = (source: string) => rows.filter((row) => new Set(row.evidence.map((e) => e.source)).size === 1 && row.evidence[0]?.source === source).map((row) => row.scientificName);
    const exactTaxonomy = rows.filter((row) => row.resolution.acceptedName && row.evidence.some((e) => ['class', 'order', 'family', 'genus'].every((rank) => !e.taxonomy[rank] || e.taxonomy[rank] === row.resolution.taxonomy[rank]))).length;
    const scientificNamesUpdated = rows.filter((row) => row.resolution.acceptedName && row.resolution.acceptedName !== row.scientificName).map((row) => ({ input: row.scientificName, accepted: row.resolution.acceptedName }));
    report[group] = { total: rows.length, resolved: rows.filter((row) => row.resolution.status === 'resolved').length, exactTaxonomy, scientificNamesUpdated, needs_review: rows.filter((row) => row.resolution.status === 'needs_review').map((row) => row.scientificName), unresolved: rows.filter((row) => row.resolution.status === 'unresolved').map((row) => row.scientificName), conflicts: rows.filter((row) => row.resolution.status === 'conflict').map((row) => row.scientificName), synonyms: rows.filter((row) => row.resolution.sourceStatus === 'SYNONYM').map((row) => ({ input: row.scientificName, accepted: row.resolution.acceptedName })), only: { biodiversidata: sourceOnly('biodiversidata'), ministerio: sourceOnly('ministerio'), snap: sourceOnly('snap') } };
  }
  const totals = Object.values(report) as Array<{ total: number; resolved: number; needs_review: unknown[]; unresolved: unknown[]; conflicts: unknown[] }>;
  const result = { generatedAt: new Date().toISOString(), groups: report, total: all.length, resolved: totals.reduce((n, x) => n + x.resolved, 0), unresolved: totals.reduce((n, x) => n + x.unresolved.length, 0), conflicts: totals.reduce((n, x) => n + x.conflicts.length, 0) };
  writeJson(`${PATHS.reports}/audit.json`, result);
  const lines = ['# Natura UY — auditoría del catálogo provisional', '', `Total de nombres candidatos: ${result.total}`, `Resueltos a especie: ${result.resolved}`, `No resueltos: ${result.unresolved}`, `Conflictos: ${result.conflicts}`, '', '## Por grupo', ''];
  for (const [group, value] of Object.entries(report)) {
    const item = value as { total: number; resolved: number; exactTaxonomy: number; scientificNamesUpdated: unknown[]; synonyms: unknown[]; needs_review: unknown[]; unresolved: unknown[]; conflicts: unknown[]; only: Record<string, unknown[]> };
    lines.push(`### ${group}`, `- Total: ${item.total}; resueltos: ${item.resolved}; coincidencia taxonómica exacta: ${item.exactTaxonomy}.`, `- Sinónimos: ${item.synonyms.length}; nombres actualizados: ${item.scientificNamesUpdated.length}; needs_review: ${item.needs_review.length}; no resueltos: ${item.unresolved.length}; conflictos: ${item.conflicts.length}.`, `- Exclusivas: Biodiversidata ${(item.only.biodiversidata ?? []).length}, Ministerio ${(item.only.ministerio ?? []).length}, SNAP ${(item.only.snap ?? []).length}.`, '');
  }
  writeFileSync(`${PATHS.reports}/audit.md`, `${lines.join('\n')}\n`, 'utf8');
  console.log(`04-audit: ${all.length} candidates audited; see data/reports/audit.json`);
}
main();
