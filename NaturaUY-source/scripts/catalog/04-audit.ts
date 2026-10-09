import { existsSync, writeFileSync } from 'node:fs';
import { ARTHROPOD_GROUPS, GROUPS, PATHS, readJson, writeJson } from './lib';

interface Item { scientificName: string; evidence: Array<{ source: string; sourceRecord?: string | null; taxonomy: Record<string, string | null> }>; resolution: { status: string; acceptedName: string | null; sourceStatus: string | null; taxonomy: Record<string, string | null> }; }
interface IncompleteRecord { inputName?: string; source?: string; sourceRecord?: string | null; taxonomy?: Record<string, string | null>; }
function main(): void {
  const all = readJson<Item[]>(PATHS.resolved);
  const incomplete = existsSync(`${PATHS.reports}/incomplete-name-candidates.json`)
    ? readJson<{ records?: IncompleteRecord[] }>(`${PATHS.reports}/incomplete-name-candidates.json`).records ?? []
    : [];
  const report: Record<string, unknown> = {};
  for (const group of GROUPS) {
    // Group scope comes from the Uruguay-source evidence. GBIF may return a
    // compatible subordinate class (e.g. Testudines under Reptilia).
    const rows = all.filter((row) => row.evidence.some((e) => e.taxonomy.class === group));
    const incompleteRows = incomplete.filter((row) => row.taxonomy?.class === group);
    const sourceOnly = (source: string) => [
      ...rows.filter((row) => new Set(row.evidence.map((e) => e.source)).size === 1 && row.evidence[0]?.source === source).map((row) => row.scientificName),
      ...incompleteRows.filter((row) => row.source === source).map((row) => row.inputName).filter((name): name is string => Boolean(name)),
    ];
    const exactTaxonomy = rows.filter((row) => row.resolution.acceptedName && row.evidence.some((e) => ['class', 'order', 'family', 'genus'].every((rank) => !e.taxonomy[rank] || e.taxonomy[rank] === row.resolution.taxonomy[rank]))).length;
    const scientificNamesUpdated = rows.filter((row) => row.resolution.acceptedName && row.resolution.acceptedName !== row.scientificName).map((row) => ({ input: row.scientificName, accepted: row.resolution.acceptedName }));
    report[group] = { total: rows.length + incompleteRows.length, resolved: rows.filter((row) => row.resolution.status === 'resolved').length, exactTaxonomy, scientificNamesUpdated, needs_review: [...rows.filter((row) => row.resolution.status === 'needs_review').map((row) => row.scientificName), ...incompleteRows.map((row) => row.inputName).filter((name): name is string => Boolean(name))], unresolved: rows.filter((row) => row.resolution.status === 'unresolved').map((row) => row.scientificName), conflicts: rows.filter((row) => row.resolution.status === 'conflict').map((row) => row.scientificName), synonyms: rows.filter((row) => row.resolution.sourceStatus === 'SYNONYM').map((row) => ({ input: row.scientificName, accepted: row.resolution.acceptedName })), only: { biodiversidata: sourceOnly('biodiversidata'), ministerio: sourceOnly('ministerio'), snap: sourceOnly('snap') } };
  }
  const totals = Object.values(report) as Array<{ total: number; resolved: number; needs_review: unknown[]; unresolved: unknown[]; conflicts: unknown[] }>;
  const historicalArthropodsByClass = Object.fromEntries(ARTHROPOD_GROUPS.map((group) => [
    group,
    all.filter((row) => row.evidence.some((e) => e.source === 'snap' && e.taxonomy.class === group)).length
      + incomplete.filter((row) => row.source === 'snap' && row.taxonomy?.class === group).length,
  ]));
  const historicalArthropodsTotal = Object.values(historicalArthropodsByClass).reduce((sum, count) => sum + count, 0);
  const historicalArthropodRows = all
    .filter((row) => row.evidence.some((e) => e.source === 'snap' && e.taxonomy.phylum === 'Arthropoda'))
    .map((row) => ({
      sourceRecord: row.evidence.find((e) => e.source === 'snap')?.sourceRecord ?? null,
      inputName: row.scientificName,
      state: row.resolution.status === 'resolved' ? 'published_species' : row.resolution.status === 'conflict' ? 'candidate_conflict' : 'candidate_review',
      acceptedName: row.resolution.acceptedName,
      reason: row.resolution.status === 'resolved' ? 'Resolución taxonómica con evidencia de presencia y fuente de origen.' : `Resolución ${row.resolution.status}; requiere decisión editorial antes de publicar.`,
      taxonomy: row.resolution.taxonomy,
    }));
  const incompleteArthropodRows = incomplete
    .filter((row) => row.source === 'snap' && row.taxonomy?.phylum === 'Arthropoda')
    .map((row) => ({
      sourceRecord: row.sourceRecord ?? null,
      inputName: row.inputName ?? null,
      state: 'incomplete_name',
      acceptedName: null,
      reason: 'Entrada sin epíteto específico; se conserva en revisión y no se publica como especie.',
      taxonomy: row.taxonomy ?? {},
    }));
  writeJson(`${PATHS.reports}/historical-arthropods-reconciliation.json`, {
    generatedAt: new Date().toISOString(),
    source: 'SNAP historical export',
    total: historicalArthropodsTotal,
    byClass: historicalArthropodsByClass,
    records: [...historicalArthropodRows, ...incompleteArthropodRows].sort((a, b) => (a.sourceRecord ?? '').localeCompare(b.sourceRecord ?? '')),
  });
  const result = {
    generatedAt: new Date().toISOString(), groups: report,
    total: all.length + incomplete.length,
    resolved: totals.reduce((n, x) => n + x.resolved, 0),
    unresolved: totals.reduce((n, x) => n + x.unresolved.length, 0),
    conflicts: totals.reduce((n, x) => n + x.conflicts.length, 0),
    incompleteNames: incomplete.length,
    historicalArthropods: { total: historicalArthropodsTotal, byClass: historicalArthropodsByClass },
    incomplete,
  };
  writeJson(`${PATHS.reports}/audit.json`, result);
  const lines = ['# Arapy — auditoría del catálogo provisional', '', `Total de registros auditados: ${result.total}`, `Resueltos a especie: ${result.resolved}`, `No resueltos: ${result.unresolved}`, `Conflictos: ${result.conflicts}`, `Nombres incompletos en revisión: ${result.incompleteNames}`, `Artrópodos históricos: ${historicalArthropodsTotal} (Arachnida ${historicalArthropodsByClass.Arachnida}, Insecta ${historicalArthropodsByClass.Insecta}, Malacostraca ${historicalArthropodsByClass.Malacostraca})`, '', '## Por grupo', ''];
  for (const [group, value] of Object.entries(report)) {
    const item = value as { total: number; resolved: number; exactTaxonomy: number; scientificNamesUpdated: unknown[]; synonyms: unknown[]; needs_review: unknown[]; unresolved: unknown[]; conflicts: unknown[]; only: Record<string, unknown[]> };
    lines.push(`### ${group}`, `- Total: ${item.total}; resueltos: ${item.resolved}; coincidencia taxonómica exacta: ${item.exactTaxonomy}.`, `- Sinónimos: ${item.synonyms.length}; nombres actualizados: ${item.scientificNamesUpdated.length}; needs_review: ${item.needs_review.length}; no resueltos: ${item.unresolved.length}; conflictos: ${item.conflicts.length}.`, `- Exclusivas: Biodiversidata ${(item.only.biodiversidata ?? []).length}, Ministerio ${(item.only.ministerio ?? []).length}, SNAP ${(item.only.snap ?? []).length}.`, '');
  }
  if (incomplete.length > 0) {
    lines.push('## Registros incompletos', '', 'Se preservan para revisión editorial y no se convierten en especies publicables automáticamente.', '');
    for (const item of incomplete) lines.push(`- ${item.inputName ?? 'sin nombre'} (${item.sourceRecord ?? 'sin registro'})`);
    lines.push('');
  }
  lines.push('## Reconciliación de artrópodos históricos', '', 'Cada registro SNAP queda contabilizado; los conflictos y nombres incompletos permanecen fuera de la publicación hasta revisión editorial.', '');
  for (const row of [...historicalArthropodRows, ...incompleteArthropodRows].sort((a, b) => (a.sourceRecord ?? '').localeCompare(b.sourceRecord ?? ''))) lines.push(`- ${row.sourceRecord ?? 'sin registro'} · ${row.inputName ?? 'sin nombre'} · ${row.state} · ${row.reason}`);
  lines.push('');
  writeFileSync(`${PATHS.reports}/audit.md`, `${lines.join('\n')}\n`, 'utf8');
  console.log(`04-audit: ${result.total} records audited (${result.incompleteNames} incomplete); see data/reports/audit.json`);
}
main();
