/**
 * Stage 01b — discover arthropod taxa reported in Uruguay through GBIF.
 *
 * This is a candidate backlog only. It never writes data/catalog/*.json and
 * therefore cannot publish an observation just because GBIF returned it.
 * The occurrence facet provides a fast, reproducible first inventory; species
 * details are fetched in bounded batches and cached individually for later
 * editorial review. The published report intentionally keeps a small
 * prioritized backlog, while the facet response remains in the cache.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { fetchJson, RateLimiter } from '../lib/http';
import { PATHS, ensureDirs, readJson, writeJson } from './lib';

const METHOD_VERSION = 'gbif-uy-arthropod-discovery-v4-paginated';
const SOURCE_VERSION = 'GBIF Occurrence API v1 paginated + Species API v1';
const OCCURRENCE_ENDPOINT = 'https://api.gbif.org/v1/occurrence/search';
const SPECIES_ENDPOINT = 'https://api.gbif.org/v1/species';
const ARTHROPODA_KEY = '54';
const FACET_LIMIT = 1000;
const OCCURRENCE_PAGE_SIZE = 300;
const MAX_OCCURRENCE_PAGES = 500;
const DEFAULT_BACKLOG_SIZE = 150;
const LIMITER = new RateLimiter(180);

interface OccurrenceSearch {
  count?: number;
  facets?: Array<{ field?: string; counts?: Array<{ name?: string; count?: number }> }>;
  results?: Array<{ speciesKey?: number }>;
}

interface SpeciesDetail {
  key?: number;
  scientificName?: string;
  canonicalName?: string;
  rank?: string;
  status?: string | null;
  taxonomicStatus?: string | null;
  acceptedKey?: number | null;
  acceptedName?: string | null;
  synonym?: boolean | null;
  kingdom?: string | null;
  phylum?: string | null;
  class?: string | null;
  order?: string | null;
  family?: string | null;
  genus?: string | null;
  species?: string | null;
  authorship?: string | null;
}

interface SpeciesCache {
  schemaVersion: 1;
  methodVersion: string;
  sourceCode: 'gbif';
  sourceVersion: string;
  endpoint: string;
  parameters: { speciesKey: string };
  retrievedAt: string;
  responseChecksum: string | null;
  response: SpeciesDetail | null;
}

interface OccurrenceCache {
  schemaVersion: 1;
  methodVersion: string;
  sourceCode: 'gbif';
  sourceVersion: string;
  endpoint: string;
  parameters: Record<string, string>;
  retrievedAt: string;
  responseChecksum: string | null;
  response: OccurrenceSearch;
  speciesCounts: Record<string, number>;
  capped: boolean;
  pageCount: number;
}

interface DiscoveryCandidate {
  source: 'gbif';
  sourceVersion: string;
  methodVersion: string;
  retrievedAt: string;
  fieldPath: 'candidate.discovery';
  remoteId: string;
  originalName: string | null;
  normalizedName: string | null;
  rank: string | null;
  taxonomy: Record<string, string | null>;
  occurrenceCount: number;
  status: 'candidate_only' | 'needs_review' | 'unresolved';
  url: string;
  license: string | null;
  licenseUrl: string | null;
  checksum: string | null;
  evidence: { occurrenceQuery: Record<string, string>; speciesResponse: SpeciesDetail | null };
}

interface DiscoveryReport {
  schemaVersion: 1;
  generatedAt: string;
  dataset: 'arthropods_uy';
  sourceCode: 'gbif';
  sourceVersion: string;
  methodVersion: string;
  endpoint: string;
  parameters: Record<string, string>;
  responseChecksum: string | null;
  occurrenceCount: number | null;
  discoveredTaxonCount: number;
  taxonCount: number;
  omittedTaxonCount: number | null;
  inventoryCapped: boolean;
  pageCount: number;
  detailedCount: number;
  pendingDetailCount: number;
  policy: string;
  candidates: DiscoveryCandidate[];
}

const detailDirectory = resolve(PATHS.cache, 'gbif/arthropod-species');

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function inventoryFromPages(parameters: Record<string, string>): Promise<{ response: OccurrenceSearch; speciesCounts: Record<string, number>; checksum: string; pageCount: number; complete: boolean }> {
  const facetQuery = new URLSearchParams({
    taxon_key: String(parameters.taxonKey),
    country: String(parameters.country),
    occurrence_status: String(parameters.occurrenceStatus),
    taxon_rank: String(parameters.taxonRank),
    facet: String(parameters.facet),
    facetMincount: String(parameters.facetMinCount),
    facetLimit: String(FACET_LIMIT),
    limit: '0',
  });
  const first = await fetchJson<OccurrenceSearch>(`${OCCURRENCE_ENDPOINT}?${facetQuery}`, { limiter: LIMITER, retries: 4 });
  if (!first) throw new Error('GBIF no devolvió el inventario de artrópodos');
  const speciesCounts = new Map<string, number>();
  for (const item of first.facets?.find((facet) => facet.field?.toUpperCase() === 'SPECIES_KEY')?.counts ?? []) {
    if (/^\d+$/.test(item.name ?? '') && (item.count ?? 0) > 0) speciesCounts.set(item.name!, item.count!);
  }
  // Facets are capped by GBIF. Page occurrence records to recover every
  // species key instead of silently publishing only the most observed 1,000.
  let pageCount = 1;
  let complete = speciesCounts.size < FACET_LIMIT;
  if (!complete) {
    for (let page = 0; page < MAX_OCCURRENCE_PAGES; page++) {
      const query = new URLSearchParams({ taxon_key: String(parameters.taxonKey), country: String(parameters.country), occurrence_status: String(parameters.occurrenceStatus), taxon_rank: String(parameters.taxonRank), limit: String(OCCURRENCE_PAGE_SIZE), offset: String(page * OCCURRENCE_PAGE_SIZE) });
      const response = await fetchJson<OccurrenceSearch>(`${OCCURRENCE_ENDPOINT}?${query}`, { limiter: LIMITER, retries: 4 });
      const results = response?.results ?? [];
      pageCount += 1;
      for (const row of results) {
        const key = String(row.speciesKey ?? '');
        if (/^\d+$/.test(key)) speciesCounts.set(key, (speciesCounts.get(key) ?? 0) + 1);
      }
      if (results.length < OCCURRENCE_PAGE_SIZE || (first.count ?? 0) <= (page + 1) * OCCURRENCE_PAGE_SIZE) {
        complete = true;
        break;
      }
    }
  }
  const normalized = Object.fromEntries([...speciesCounts].sort(([a], [b]) => a.localeCompare(b)));
  return { response: first, speciesCounts: normalized, checksum: digest({ first, speciesCounts: normalized }), pageCount, complete };
}

function speciesCachePath(key: string): string {
  mkdirSync(detailDirectory, { recursive: true });
  return resolve(detailDirectory, `${key}.json`);
}

function readSpeciesCache(key: string): SpeciesCache | null {
  const path = speciesCachePath(key);
  if (!existsSync(path)) return null;
  try {
    const value = readJson<SpeciesCache>(path);
    return value.methodVersion === METHOD_VERSION ? value : null;
  } catch {
    return null;
  }
}

function cleanName(value: string | null | undefined): string | null {
  if (!value) return null;
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  return words.length >= 2 ? `${words[0]} ${words[1]}` : null;
}

function candidate(key: string, count: number, detail: SpeciesCache | null, parameters: Record<string, string>): DiscoveryCandidate {
  const response = detail?.response ?? null;
  const originalName = cleanName(response?.canonicalName ?? response?.species ?? response?.scientificName);
  const acceptedName = cleanName(response?.acceptedName ?? response?.canonicalName ?? response?.species ?? response?.scientificName);
  const complete = response?.rank?.toUpperCase() === 'SPECIES' && Boolean(originalName);
  return {
    source: 'gbif',
    sourceVersion: SOURCE_VERSION,
    methodVersion: METHOD_VERSION,
    retrievedAt: detail?.retrievedAt ?? new Date().toISOString(),
    fieldPath: 'candidate.discovery',
    remoteId: key,
    originalName,
    normalizedName: acceptedName,
    rank: response?.rank ?? null,
    taxonomy: {
      kingdom: response?.kingdom ?? null,
      phylum: response?.phylum ?? null,
      class: response?.class ?? null,
      order: response?.order ?? null,
      family: response?.family ?? null,
      genus: response?.genus ?? null,
    },
    occurrenceCount: count,
    status: !detail ? 'unresolved' : complete ? 'candidate_only' : 'needs_review',
    url: `${SPECIES_ENDPOINT}/${encodeURIComponent(key)}`,
    license: null,
    licenseUrl: null,
    checksum: detail?.responseChecksum ?? null,
    evidence: { occurrenceQuery: parameters, speciesResponse: response },
  };
}

async function main(): Promise<void> {
  ensureDirs();
  const parameters = {
    taxonKey: ARTHROPODA_KEY,
    country: 'UY',
    occurrenceStatus: 'PRESENT',
    taxonRank: 'SPECIES',
    facet: 'species_key',
    facetMinCount: '1',
    facetLimit: String(FACET_LIMIT),
    limit: '0',
  };
  const query = new URLSearchParams({
    taxon_key: parameters.taxonKey,
    country: parameters.country,
    occurrence_status: parameters.occurrenceStatus,
    taxon_rank: parameters.taxonRank,
    facet: parameters.facet,
    facetMincount: parameters.facetMinCount,
    facetLimit: parameters.facetLimit,
    limit: parameters.limit,
  });
  const occurrenceUrl = `${OCCURRENCE_ENDPOINT}?${query}`;
  const refresh = process.argv.includes('--refresh');
  let cachedInventory: OccurrenceCache | null = null;
  if (!refresh && existsSync(PATHS.arthropodDiscovery)) {
    try {
      const value = readJson<OccurrenceCache>(PATHS.arthropodDiscovery);
      if (value.methodVersion === METHOD_VERSION) cachedInventory = value;
    } catch { /* regenerate a corrupt or obsolete cache */ }
  }
  let inventory = cachedInventory;
  if (!inventory || refresh) {
    const inventoryResult = await inventoryFromPages(parameters);
    const occurrence = inventoryResult.response;
    const speciesCounts = inventoryResult.speciesCounts;
    inventory = {
      schemaVersion: 1,
      methodVersion: METHOD_VERSION,
      sourceCode: 'gbif',
      sourceVersion: SOURCE_VERSION,
      endpoint: OCCURRENCE_ENDPOINT,
      parameters,
      retrievedAt: new Date().toISOString(),
      responseChecksum: inventoryResult.checksum,
      response: occurrence,
      speciesCounts,
      capped: !inventoryResult.complete,
      pageCount: inventoryResult.pageCount,
    } satisfies OccurrenceCache;
    writeJson(PATHS.arthropodDiscovery, inventory);
  }

  const discoveredTaxa = Object.entries(inventory.speciesCounts ?? {})
    .map(([key, count]) => ({ key, count }))
    .filter((item) => /^\d+$/.test(item.key) && item.count > 0)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const maxTaxa = Number(process.argv.find((arg) => arg.startsWith('--max-taxa='))?.slice('--max-taxa='.length) ?? DEFAULT_BACKLOG_SIZE);
  if (!Number.isFinite(maxTaxa) || maxTaxa <= 0) throw new Error('--max-taxa debe ser un número positivo');
  const taxa = discoveredTaxa.slice(0, maxTaxa);
  const requested = Number(process.argv.find((arg) => arg.startsWith('--batch='))?.slice('--batch='.length) ?? '50');
  if (!Number.isFinite(requested) || requested <= 0) throw new Error('--batch debe ser un número positivo');
  const pending = taxa.filter((item) => !readSpeciesCache(item.key)).slice(0, requested);
  console.log(`01b-discover-arthropods: ${discoveredTaxa.length} taxones descubiertos; backlog editorial ${taxa.length}; ${pending.length} detalles pendientes en este lote`);
  for (const [index, item] of pending.entries()) {
    const url = `${SPECIES_ENDPOINT}/${encodeURIComponent(item.key)}`;
    const response = await fetchJson<SpeciesDetail>(url, { limiter: LIMITER, retries: 4 });
    const envelope: SpeciesCache = {
      schemaVersion: 1,
      methodVersion: METHOD_VERSION,
      sourceCode: 'gbif',
      sourceVersion: SOURCE_VERSION,
      endpoint: SPECIES_ENDPOINT,
      parameters: { speciesKey: item.key },
      retrievedAt: new Date().toISOString(),
      responseChecksum: response === null ? null : digest(response),
      response,
    };
    writeJson(speciesCachePath(item.key), envelope);
    console.log(`  ${index + 1}/${pending.length} ${item.key} ${response?.canonicalName ?? response?.scientificName ?? '(sin detalle)'}`);
  }

  const candidates = taxa.map((item) => candidate(item.key, item.count, readSpeciesCache(item.key), parameters));
  const report: DiscoveryReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dataset: 'arthropods_uy',
    sourceCode: 'gbif',
    sourceVersion: SOURCE_VERSION,
    methodVersion: METHOD_VERSION,
    endpoint: occurrenceUrl,
    parameters,
    responseChecksum: inventory.responseChecksum,
    occurrenceCount: inventory.response.count ?? null,
    discoveredTaxonCount: discoveredTaxa.length,
    taxonCount: taxa.length,
    omittedTaxonCount: inventory.capped ? null : Math.max(0, discoveredTaxa.length - taxa.length),
    inventoryCapped: inventory.capped,
    pageCount: inventory.pageCount ?? 1,
    detailedCount: candidates.filter((item) => item.status !== 'unresolved').length,
    pendingDetailCount: candidates.filter((item) => item.status === 'unresolved').length,
    policy: 'Sólo backlog candidate-only: requiere resolución taxonómica, revisión editorial y evidencia de Uruguay antes de entrar al catálogo.',
    candidates,
  };
  writeJson(resolve(PATHS.reports, 'arthropod-discovery-candidates.json'), report);
  console.log(`  ${report.detailedCount}/${report.taxonCount} del backlog con detalle; ${report.pendingDetailCount} pendientes; ${report.occurrenceCount ?? 0} ocurrencias totales`);
}

main().catch((error: unknown) => { console.error(error); process.exit(1); });
