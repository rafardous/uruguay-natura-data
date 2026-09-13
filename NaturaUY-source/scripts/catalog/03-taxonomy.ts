import { existsSync } from 'node:fs';
import { GROUPS, PATHS, cleanName, ensureDirs, readJson, sleep, writeJson } from './lib';

interface Candidate { scientificName: string; class: string | null; evidence: Array<{ source: string; sourceName: string; scientificName: string; commonNames: string[]; taxonomy: Record<string, string | null>; origin: string | null; sourceRecord: string | null }>; }
interface Match {
  usageKey?: number;
  scientificName?: string;
  canonicalName?: string;
  rank?: string;
  status?: string;
  matchType?: string;
  confidence?: number;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
  acceptedName?: string;
  acceptedUsage?: {
    key?: number | string;
    canonicalName?: string;
    rank?: string;
    status?: string;
  } | null;
  classification?: Array<{ key?: number | string; name?: string; rank?: string }>;
  diagnostics?: { matchType?: string; confidence?: number };
  usage?: {
    key?: number | string;
    scientificName?: string;
    canonicalName?: string;
    rank?: string;
    status?: string;
    kingdom?: string;
    phylum?: string;
    class?: string;
    order?: string;
    family?: string;
    genus?: string;
    species?: string;
  } | null;
}
const MATCHER_VERSION = 'gbif-species-v2-accepted-usage-v2';
interface Resolution { inputName: string; status: 'resolved' | 'needs_review' | 'unresolved' | 'conflict'; acceptedName: string | null; matchType: string | null; confidence: number | null; sourceStatus: string | null; taxonomy: Record<string, string | null>; gbifUsageKey: number | null; sourceCode: 'gbif'; sourceVersion: string; matcherVersion: string; retrievedAt: string; parameters: { scientificName: string }; }

const delay = 180;
const compatibleClass = (sourceClass: string, gbifClass: string): boolean =>
  sourceClass === gbifClass ||
  (sourceClass === 'Reptilia' && ['Squamata', 'Testudines', 'Crocodylia'].includes(gbifClass)) ||
  (sourceClass === 'Actinopterygii' && ['Actinopteri', 'Teleostei'].includes(gbifClass)) ||
  (sourceClass === 'Chondrichthyes' && gbifClass === 'Elasmobranchii');

async function match(name: string): Promise<Match | null> {
  for (let attempt = 0; attempt < 4; attempt++) try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25_000);
    const response = await fetch(`https://api.gbif.org/v2/species/match?scientificName=${encodeURIComponent(name)}`, { headers: { 'User-Agent': 'NaturaUY-data-pipeline/1.0' }, signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) {
      const raw = await response.json() as Match;
      // GBIF v2 wraps the matched name in `usage`; keep the internal shape
      // flat so the rest of the resolver can also read legacy cache entries.
      if (raw.usage) {
        const acceptedUsage = raw.acceptedUsage ?? raw.usage;
        const classification = new Map((raw.classification ?? []).map((item) => [item.rank?.toUpperCase(), item.name]).filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])));
        const speciesClassification = raw.classification?.find((item) => item.rank?.toUpperCase() === 'SPECIES');
        const acceptedName = acceptedUsage.rank?.toUpperCase() === 'SPECIES'
          ? acceptedUsage.canonicalName
          : speciesClassification?.name ?? acceptedUsage.canonicalName;
        const acceptedKey = acceptedUsage.rank?.toUpperCase() === 'SPECIES'
          ? acceptedUsage.key
          : speciesClassification?.key ?? acceptedUsage.key;
        const numericKey = Number(acceptedKey);
        return {
          ...raw,
          ...acceptedUsage,
          acceptedName,
          rank: acceptedName && speciesClassification ? 'SPECIES' : acceptedUsage.rank,
          // Keep the status of the requested usage so synonym decisions are
          // visible even when the acceptedUsage object is also present.
          status: raw.usage.status,
          matchType: raw.diagnostics?.matchType,
          confidence: raw.diagnostics?.confidence,
          kingdom: classification.get('KINGDOM'),
          phylum: classification.get('PHYLUM'),
          class: classification.get('CLASS'),
          order: classification.get('ORDER'),
          family: classification.get('FAMILY'),
          genus: classification.get('GENUS'),
          usageKey: Number.isFinite(numericKey) ? numericKey : undefined,
        };
      }
      return raw;
    }
    if (response.status < 500 && response.status !== 429) return null;
  } catch { /* retry */ }
  finally { await sleep(delay * 2 ** attempt); }
  return null;
}

function resolution(candidate: Candidate, value: Match | null, retrievedAt = new Date().toISOString()): Resolution {
  const rank = value?.rank?.toUpperCase(); const accepted = cleanName(value?.acceptedName ?? value?.species ?? value?.canonicalName ?? value?.scientificName);
  const tax = { kingdom: value?.kingdom ?? null, phylum: value?.phylum ?? null, class: value?.class ?? null, order: value?.order ?? null, family: value?.family ?? null, genus: value?.genus ?? null };
  const evidenceClasses = new Set(candidate.evidence.map((item) => item.taxonomy.class).filter((value): value is string => Boolean(value)));
  const evidenceOrders = new Set(candidate.evidence.map((item) => item.taxonomy.order).filter((value): value is string => Boolean(value)));
  if (candidate.class) evidenceClasses.add(candidate.class);
  // Isoptera is retained in the historical source, but modern backbones place
  // termites inside Blattodea. Keep the accepted order from GBIF and flag the
  // disagreement for a human decision rather than silently rewriting history.
  const orderConflict = Boolean(tax.order && evidenceOrders.size > 0 && ![...evidenceOrders].some((order) => order === tax.order || (order === 'Isoptera' && tax.order === 'Blattodea')));
  const sourceConflict = evidenceClasses.size > 1 || Boolean(tax.class && evidenceClasses.size > 0 && ![...evidenceClasses].some((sourceClass) => compatibleClass(sourceClass, tax.class!))) || orderConflict;
  const metadata = { sourceCode: 'gbif' as const, sourceVersion: 'GBIF Species API v2', matcherVersion: MATCHER_VERSION, retrievedAt, parameters: { scientificName: candidate.scientificName } };
  if (!value || value.matchType === 'NONE') return { inputName: candidate.scientificName, status: 'unresolved', acceptedName: null, matchType: value?.matchType ?? null, confidence: value?.confidence ?? null, sourceStatus: value?.status ?? null, taxonomy: tax, gbifUsageKey: value?.usageKey ?? null, ...metadata };
  if (!accepted || rank !== 'SPECIES') return { inputName: candidate.scientificName, status: 'needs_review', acceptedName: null, matchType: value.matchType ?? null, confidence: value.confidence ?? null, sourceStatus: value.status ?? null, taxonomy: tax, gbifUsageKey: value.usageKey ?? null, ...metadata };
  return { inputName: candidate.scientificName, status: sourceConflict ? 'conflict' : 'resolved', acceptedName: accepted, matchType: value.matchType ?? null, confidence: value.confidence ?? null, sourceStatus: value.status ?? null, taxonomy: tax, gbifUsageKey: value.usageKey ?? null, ...metadata };
}

async function main(): Promise<void> {
  ensureDirs(); const candidates = readJson<Candidate[]>(PATHS.candidates); const cache = existsSync(PATHS.gbif) ? readJson<Record<string, Resolution>>(PATHS.gbif) : {};
  const requestedBatch = process.argv.find((arg) => arg.startsWith('--batch='));
  const batchSize = requestedBatch ? Number(requestedBatch.slice('--batch='.length)) : Number.POSITIVE_INFINITY;
  const offline = process.argv.includes('--offline');
  if (!Number.isFinite(batchSize) && batchSize !== Number.POSITIVE_INFINITY || batchSize <= 0) throw new Error('--batch must be a positive number');
  // Existing cache records are reclassified locally when compatibility rules evolve;
  // no request is repeated merely for a status calculation.
  for (const candidate of candidates) {
    const cached = cache[candidate.scientificName];
    const canUpgradeCache = Boolean(cached?.acceptedName && cached.gbifUsageKey && (cached.matcherVersion === MATCHER_VERSION || cached.sourceStatus !== 'SYNONYM'));
    if (canUpgradeCache) cache[candidate.scientificName] = resolution(candidate, { acceptedName: cached!.acceptedName!, scientificName: cached!.acceptedName!, species: cached!.acceptedName!, rank: 'SPECIES', matchType: cached!.matchType ?? undefined, confidence: cached!.confidence ?? undefined, status: cached!.sourceStatus ?? undefined, usageKey: cached!.gbifUsageKey!, ...cached!.taxonomy }, cached!.retrievedAt);
  }
  writeJson(PATHS.gbif, cache);
  const pending = candidates.filter((candidate) => {
    const cached = cache[candidate.scientificName];
    const emptyResponse = Boolean(cached && !cached.acceptedName && !cached.matchType && !cached.sourceStatus && !cached.gbifUsageKey);
    const missingAuthority = Boolean(cached?.acceptedName && (!cached.gbifUsageKey || !cached.taxonomy.class));
    const synonymRefresh = cached?.sourceStatus === 'SYNONYM' && cached.matcherVersion !== MATCHER_VERSION;
    return !cached || synonymRefresh || emptyResponse || missingAuthority;
  }).slice(0, batchSize);
  if (offline && pending.length > 0) throw new Error(`03-taxonomy offline: faltan ${pending.length} resoluciones en data/cache/gbif/species-match.json; ejecutá data:catalog-refresh`);
  console.log(`03-taxonomy: resolving ${pending.length} pending name(s); ${Object.keys(cache).length}/${candidates.length} already cached`);
  let completed = 0;
  for (const candidate of pending) { cache[candidate.scientificName] = resolution(candidate, await match(candidate.scientificName)); writeJson(PATHS.gbif, cache); if (++completed % 50 === 0) console.log(`  ${completed}/${pending.length} in this batch`); }
  if (Object.keys(cache).length < candidates.length) { console.log(`  checkpoint saved: ${Object.keys(cache).length}/${candidates.length}; rerun to continue`); return; }
  const resolved = candidates.map((candidate) => ({ ...candidate, resolution: cache[candidate.scientificName]! })); writeJson(PATHS.resolved, resolved);
  console.log(`03-taxonomy: ${resolved.filter((x) => x.resolution.status === 'resolved').length}/${resolved.length} resolved at species rank`);
}

main().catch((error: unknown) => { console.error(error); process.exit(1); });
