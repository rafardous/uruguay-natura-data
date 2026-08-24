import { existsSync } from 'node:fs';
import { GROUPS, PATHS, cleanName, ensureDirs, readJson, sleep, writeJson } from './lib';

interface Candidate { scientificName: string; class: string | null; evidence: Array<{ source: string; sourceName: string; scientificName: string; commonNames: string[]; taxonomy: Record<string, string | null>; origin: string | null; sourceRecord: string | null }>; }
interface Match { usageKey?: number; scientificName?: string; canonicalName?: string; rank?: string; status?: string; matchType?: string; confidence?: number; kingdom?: string; phylum?: string; class?: string; order?: string; family?: string; genus?: string; species?: string; }
interface Resolution { inputName: string; status: 'resolved' | 'needs_review' | 'unresolved' | 'conflict'; acceptedName: string | null; matchType: string | null; confidence: number | null; sourceStatus: string | null; taxonomy: Record<string, string | null>; }
const delay = 180;
const compatibleClass = (sourceClass: string, gbifClass: string): boolean =>
  sourceClass === gbifClass ||
  (sourceClass === 'Reptilia' && ['Squamata', 'Testudines', 'Crocodylia'].includes(gbifClass)) ||
  (sourceClass === 'Actinopterygii' && ['Actinopteri', 'Teleostei'].includes(gbifClass)) ||
  (sourceClass === 'Chondrichthyes' && gbifClass === 'Elasmobranchii');
async function match(name: string): Promise<Match | null> {
  for (let attempt = 0; attempt < 4; attempt++) try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25_000);
    const response = await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}`, { headers: { 'User-Agent': 'NaturaUY-data-pipeline/1.0' }, signal: controller.signal }); clearTimeout(timer);
    if (response.ok) return await response.json() as Match; if (response.status < 500 && response.status !== 429) return null;
  } catch { /* retry */ }
  finally { await sleep(delay * 2 ** attempt); }
  return null;
}
function resolution(candidate: Candidate, value: Match | null): Resolution {
  const rank = value?.rank?.toUpperCase(); const accepted = cleanName(value?.species ?? value?.canonicalName ?? value?.scientificName);
  const tax = { kingdom: value?.kingdom ?? null, phylum: value?.phylum ?? null, class: value?.class ?? null, order: value?.order ?? null, family: value?.family ?? null, genus: value?.genus ?? null };
  const evidenceClasses = new Set(candidate.evidence.map((item) => item.taxonomy.class).filter((value): value is string => Boolean(value))); if (candidate.class) evidenceClasses.add(candidate.class);
  const sourceConflict = evidenceClasses.size > 1 || Boolean(tax.class && evidenceClasses.size > 0 && ![...evidenceClasses].some((sourceClass) => compatibleClass(sourceClass, tax.class!)));
  if (!value || value.matchType === 'NONE') return { inputName: candidate.scientificName, status: 'unresolved', acceptedName: null, matchType: value?.matchType ?? null, confidence: value?.confidence ?? null, sourceStatus: value?.status ?? null, taxonomy: tax };
  if (!accepted || rank !== 'SPECIES') return { inputName: candidate.scientificName, status: 'needs_review', acceptedName: null, matchType: value.matchType ?? null, confidence: value.confidence ?? null, sourceStatus: value.status ?? null, taxonomy: tax };
  return { inputName: candidate.scientificName, status: sourceConflict ? 'conflict' : 'resolved', acceptedName: accepted, matchType: value?.matchType ?? null, confidence: value?.confidence ?? null, sourceStatus: value?.status ?? null, taxonomy: tax };
}
async function main(): Promise<void> {
  ensureDirs(); const candidates = readJson<Candidate[]>(PATHS.candidates); const cache = existsSync(PATHS.gbif) ? readJson<Record<string, Resolution>>(PATHS.gbif) : {};
  const requestedBatch = process.argv.find((arg) => arg.startsWith('--batch='));
  const batchSize = requestedBatch ? Number(requestedBatch.slice('--batch='.length)) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(batchSize) && batchSize !== Number.POSITIVE_INFINITY || batchSize <= 0) throw new Error('--batch must be a positive number');
  // Existing cache records are reclassified locally when compatibility rules evolve;
  // no request is repeated merely for a status calculation.
  for (const candidate of candidates) {
    const cached = cache[candidate.scientificName];
    if (cached?.acceptedName) cache[candidate.scientificName] = resolution(candidate, { scientificName: cached.acceptedName, species: cached.acceptedName, rank: 'SPECIES', matchType: cached.matchType ?? undefined, confidence: cached.confidence ?? undefined, status: cached.sourceStatus ?? undefined, ...cached.taxonomy });
  }
  writeJson(PATHS.gbif, cache);
  const pending = candidates.filter((candidate) => !cache[candidate.scientificName]).slice(0, batchSize);
  console.log(`03-taxonomy: resolving ${pending.length} pending name(s); ${Object.keys(cache).length}/${candidates.length} already cached`);
  let completed = 0; for (const candidate of pending) { cache[candidate.scientificName] = resolution(candidate, await match(candidate.scientificName)); writeJson(PATHS.gbif, cache); if (++completed % 50 === 0) console.log(`  ${completed}/${pending.length} in this batch`); }
  if (Object.keys(cache).length < candidates.length) { console.log(`  checkpoint saved: ${Object.keys(cache).length}/${candidates.length}; rerun to continue`); return; }
  const resolved = candidates.map((candidate) => ({ ...candidate, resolution: cache[candidate.scientificName]! })); writeJson(PATHS.resolved, resolved);
  console.log(`03-taxonomy: ${resolved.filter((x) => x.resolution.status === 'resolved').length}/${resolved.length} resolved at species rank`);
}
main().catch((error: unknown) => { console.error(error); process.exit(1); });
