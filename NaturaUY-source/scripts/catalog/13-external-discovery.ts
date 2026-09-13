/**
 * Stage 13 — query secondary taxonomic and molecular services for arthropods.
 *
 * This stage is deliberately candidate-only. The responses are cached with
 * their request parameters and a checksum, then exposed to the editorial
 * review queue by report; nothing here edits data/catalog/*.json.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { fetchJson, RateLimiter } from '../lib/http';
import { ARTHROPOD_GROUPS, PATHS, ensureDirs, readJson, slug, writeJson } from './lib';

type ExternalSource = 'catalogue_of_life' | 'worms' | 'bold';
type CandidateStatus = 'accepted' | 'needs_review' | 'unresolved' | 'conflict';

interface ResolvedItem {
  scientificName: string;
  evidence: Array<{ taxonomy: Record<string, string | null> }>;
  resolution: { acceptedName: string | null };
}

interface ExternalCandidate {
  source: ExternalSource;
  version: string;
  retrievedAt: string;
  parameters: Record<string, string>;
  remoteId: string | null;
  originalName: string;
  normalizedName: string | null;
  fieldPath: 'taxonIdentifiers.catalogueOfLife' | 'taxonIdentifiers.worms' | 'external.bold';
  proposedValue: Record<string, unknown> | null;
  referenceAcceptedName: string | null;
  license: string | null;
  licenseUrl: string | null;
  url: string;
  checksum: string | null;
  status: CandidateStatus;
  evidence: {
    response: unknown;
    note: string;
  };
}

interface CacheEnvelope {
  schemaVersion: 1;
  candidate: ExternalCandidate;
}

type JsonRecord = Record<string, unknown>;

const SOURCE_VERSIONS: Record<ExternalSource, string> = {
  catalogue_of_life: 'ChecklistBank Catalogue of Life dataset 3LR match/nameusage v2',
  worms: 'WoRMS Aphia webservice',
  bold: 'BOLD Portal API',
};
const SOURCE_LICENSES: Record<ExternalSource, { license: string | null; licenseUrl: string | null }> = {
  catalogue_of_life: { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  worms: { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  bold: { license: null, licenseUrl: null },
};
const COL_DATASET_ID = process.env.NATURA_COL_DATASET_ID ?? '3LR';
const COL_LIMITER = new RateLimiter(250);
const WORMS_LIMITER = new RateLimiter(400);
const BOLD_LIMITER = new RateLimiter(500);

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
}

function stringValue(...values: unknown[]): string | null {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ?? null;
}

function numberValue(...values: unknown[]): number | null {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value)) ?? null;
}

function recordsFrom(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  });
  const record = asRecord(value);
  if (!record) return [];
  for (const key of ['results', 'result', 'nameUsages', 'items', 'data']) {
    if (record[key] !== undefined) {
      const nested = recordsFrom(record[key]);
      if (nested.length > 0) return nested;
    }
  }
  return [record];
}

function normalizedName(value: string | null): string | null {
  if (!value) return null;
  const words = value.normalize('NFKC').replace(/\s+\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().split(' ');
  return words.length >= 2 ? `${words[0]} ${words[1]}` : null;
}

function checksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cachePath(source: ExternalSource, name: string): string {
  const directory = resolve(PATHS.cache, 'external', source);
  mkdirSync(directory, { recursive: true });
  return resolve(directory, `${slug(name)}.json`);
}

function candidateFromResponse(
  source: ExternalSource,
  originalName: string,
  referenceAcceptedName: string | null,
  parameters: Record<string, string>,
  url: string,
  response: unknown,
  note: string,
): ExternalCandidate {
  const records = recordsFrom(response);
  const exact = records.find((record) => {
    const usage = asRecord(record.usage);
    const name = stringValue(record.name, record.scientificname, record.scientificName, record.nameUsage, usage?.name, usage?.canonicalName);
    return name?.toLocaleLowerCase() === originalName.toLocaleLowerCase();
  });
  const first = exact ?? records[0];
  const usage = asRecord(first?.usage);
  const acceptedUsage = asRecord(first?.acceptedUsage);
  const accepted = stringValue(
    acceptedUsage?.canonicalName,
    acceptedUsage?.name,
    first?.acceptedName,
    first?.accepted_name,
    asRecord(first?.accepted)?.name,
    first?.valid_name,
    first?.validName,
    usage?.acceptedName,
    usage?.accepted_name,
    usage?.canonicalName,
    usage?.name,
    first?.scientificname,
    first?.scientificName,
    first?.name,
  );
  const remoteId = stringValue(
    acceptedUsage?.id,
    acceptedUsage?.key,
    usage?.id,
    usage?.key,
    first?.id,
    first?.usageId,
    first?.nameUsageId,
    first?.taxonID,
    first?. AphiaID,
    first?.aphiaID,
    first?.processid,
  );
  const found = Boolean(first && (accepted || remoteId));
  const conflict = Boolean(found && referenceAcceptedName && accepted && normalizedName(accepted) !== normalizedName(referenceAcceptedName));
  const status: CandidateStatus = !found ? 'unresolved' : conflict ? 'conflict' : 'needs_review';
  const sourceLicense = SOURCE_LICENSES[source];
  const fieldPath = source === 'catalogue_of_life' ? 'taxonIdentifiers.catalogueOfLife' : source === 'worms' ? 'taxonIdentifiers.worms' : 'external.bold';
  const proposedValue = source === 'catalogue_of_life' && remoteId
    ? { taxonId: remoteId, datasetId: parameters.datasetId ?? null, version: SOURCE_VERSIONS[source] }
    : source === 'worms' && remoteId && Number.isFinite(Number(remoteId))
      ? { aphiaId: Number(remoteId), name: accepted }
      : null;
  return {
    source,
    version: SOURCE_VERSIONS[source],
    retrievedAt: new Date().toISOString(),
    parameters,
    remoteId,
    originalName,
    normalizedName: normalizedName(accepted),
    fieldPath,
    proposedValue,
    referenceAcceptedName,
    license: sourceLicense.license,
    licenseUrl: sourceLicense.licenseUrl,
    url,
    checksum: response === null ? null : checksum(response),
    status,
    evidence: { response, note },
  };
}

async function queryCatalogueOfLife(name: string, acceptedName: string | null): Promise<ExternalCandidate> {
  const parameters = { datasetId: COL_DATASET_ID, q: name };
  // ChecklistBank's one-by-one matching route takes the name as `q`; the
  // dataset is already encoded in the path. Keeping datasetId in parameters
  // preserves the reproducibility record without sending an unsupported
  // duplicate query parameter to the API.
  const query = new URLSearchParams({ q: name });
  const url = `https://api.checklistbank.org/dataset/${encodeURIComponent(COL_DATASET_ID)}/match/nameusage?${query}`;
  const response = await fetchJson<unknown>(url, { limiter: COL_LIMITER });
  return candidateFromResponse('catalogue_of_life', name, acceptedName, parameters, url, response, 'Segunda opinión taxonómica; requiere cotejo con GBIF y fuentes locales.');
}

async function queryWorms(name: string, acceptedName: string | null): Promise<ExternalCandidate> {
  const parameters = { name };
  const url = `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(name)}`;
  const response = await fetchJson<unknown>(url, { limiter: WORMS_LIMITER });
  return candidateFromResponse('worms', name, acceptedName, parameters, url, response, 'Consulta complementaria para Malacostraca; no se hace harvesting completo de WoRMS.');
}

async function queryBold(name: string, acceptedName: string | null): Promise<ExternalCandidate> {
  const rawQuery = `tax:species:${name};geo:country/ocean:Uruguay`;
  const preprocessorParameters = { query: rawQuery };
  const preprocessorUrl = `https://portal.boldsystems.org/api/query/preprocessor?${new URLSearchParams(preprocessorParameters)}`;
  const preprocessor = await fetchJson<unknown>(preprocessorUrl, { limiter: BOLD_LIMITER });
  const preprocessed = asRecord(preprocessor);
  const query = stringValue(preprocessed?.query, preprocessed?.normalizedQuery, preprocessed?.value) ?? rawQuery;
  const summaryParameters = { query, fields: 'specimens,bin_uri,species' };
  const summaryUrl = `https://portal.boldsystems.org/api/summary?${new URLSearchParams(summaryParameters)}`;
  const summary = await fetchJson<unknown>(summaryUrl, { limiter: BOLD_LIMITER });
  const response = { preprocessor, summary };
  const record = asRecord(summary);
  const specimenCount = numberValue(record?.specimens, record?.specimenCount);
  const bins = Array.isArray(record?.bin_uri) ? record?.bin_uri.length : stringValue(record?.bin_uri) ? 1 : 0;
  const found = specimenCount !== null || bins > 0 || Boolean(record && Object.keys(record).length > 0 && summary !== null);
  const status: CandidateStatus = !found ? 'unresolved' : 'needs_review';
  return {
    source: 'bold',
    version: SOURCE_VERSIONS.bold,
    retrievedAt: new Date().toISOString(),
    parameters: { preprocessorQuery: rawQuery, query, fields: summaryParameters.fields },
    remoteId: stringValue(preprocessed && (preprocessed.query_id ?? preprocessed.queryId)),
    originalName: name,
    normalizedName: acceptedName,
    fieldPath: 'external.bold',
    proposedValue: null,
    referenceAcceptedName: acceptedName,
    license: null,
    licenseUrl: null,
    url: summaryUrl,
    checksum: summary === null && preprocessor === null ? null : checksum(response),
    status,
    evidence: {
      response,
      note: 'Sólo cobertura de barcodes/BINs; no se incorporan secuencias ni imágenes al catálogo.',
    },
  };
}

function readCached(path: string): ExternalCandidate | null {
  if (!existsSync(path)) return null;
  try {
    const candidate = readJson<CacheEnvelope>(path).candidate;
    return candidate.version === SOURCE_VERSIONS[candidate.source] ? candidate : null;
  } catch {
    return null;
  }
}

function arthropodClass(item: ResolvedItem): string | null {
  return item.evidence.map((evidence) => evidence.taxonomy.class).find((value): value is string => Boolean(value && (ARTHROPOD_GROUPS as readonly string[]).includes(value))) ?? null;
}

function readLimit(): number {
  const value = process.argv.find((argument) => argument.startsWith('--batch='))?.slice('--batch='.length) ?? '25';
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) throw new Error('--batch debe ser un número positivo');
  return limit;
}

async function main(): Promise<void> {
  ensureDirs();
  const resolved = readJson<ResolvedItem[]>(PATHS.resolved);
  const species = resolved
    .filter((item) => arthropodClass(item) !== null && item.resolution.acceptedName !== null)
    .map((item) => ({ originalName: item.scientificName, acceptedName: item.resolution.acceptedName!, group: arthropodClass(item)! }));
  const cached: ExternalCandidate[] = [];
  const requiredSources = (group: string): ExternalSource[] => group === 'Malacostraca' ? ['catalogue_of_life', 'bold', 'worms'] : ['catalogue_of_life', 'bold'];
  const pending = species.filter((item) => requiredSources(item.group).some((source) => !readCached(cachePath(source, item.acceptedName))));
  const batch = readLimit();
  const toQuery = pending.slice(0, batch);
  console.log(`13-external-discovery: ${toQuery.length} especie(s) pendientes; caché por fuente habilitada`);

  for (const [index, item] of toQuery.entries()) {
    const requests: Array<[ExternalSource, Promise<ExternalCandidate>]> = [
      ['catalogue_of_life', queryCatalogueOfLife(item.acceptedName, item.acceptedName)],
      ['bold', queryBold(item.acceptedName, item.acceptedName)],
    ];
    if (item.group === 'Malacostraca') requests.push(['worms', queryWorms(item.acceptedName, item.acceptedName)]);
    for (const [source, request] of requests) {
      const candidate = await request;
      writeJson(cachePath(source, item.acceptedName), { schemaVersion: 1, candidate } satisfies CacheEnvelope);
    }
    console.log(`  ${index + 1}/${toQuery.length} ${item.acceptedName}`);
  }

  for (const item of species) {
    for (const source of requiredSources(item.group)) {
      const value = readCached(cachePath(source, item.acceptedName));
      if (value) cached.push(value);
    }
  }
  const queriedNames = new Set(cached.map((item) => item.originalName));
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dataset: 'arthropods_uy',
    sourceVersions: SOURCE_VERSIONS,
    catalogueOfLifeDatasetId: COL_DATASET_ID,
    speciesCount: species.length,
    queriedSpeciesCount: queriedNames.size,
    pendingSpeciesCount: species.length - queriedNames.size,
    candidateCount: cached.length,
    policy: 'Sólo candidatos: una persona editora debe aprobar cualquier dato antes del release.',
    candidates: cached,
  };
  writeJson(resolve(PATHS.reports, 'external-enrichment-candidates.json'), report);
  console.log(`  ${cached.length} respuestas cacheadas; ${report.pendingSpeciesCount} especie(s) todavía pendientes`);
}

main().catch((error: unknown) => { console.error(error); process.exit(1); });
