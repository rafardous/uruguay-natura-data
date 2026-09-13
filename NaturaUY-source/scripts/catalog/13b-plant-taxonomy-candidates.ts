/**
 * World Flora Online contrast for the national vascular-plant snapshot.
 * Results are candidates only: synonyms and higher ranks never rewrite the
 * published Flora Uruguaya record without editorial review.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { fetchJson, RateLimiter } from '../lib/http';
import { PATHS, ensureDirs, readJson, slug, writeJson } from './lib';

interface PlantItem {
  scientificName: string;
  taxonomy: { family: string | null };
}

interface WfoUsage {
  id?: string;
  name?: string;
  authorship?: string;
  rank?: string;
  status?: string;
  parentId?: string;
  classification?: WfoUsage[];
}

interface WfoResponse {
  match?: boolean;
  type?: string;
  id?: string;
  usage?: WfoUsage;
  issues?: Record<string, unknown>;
}

interface Candidate {
  scientificName: string;
  referenceFamily: string | null;
  matchedName: string | null;
  acceptedName: string | null;
  acceptedWfoId: string | null;
  matchedWfoId: string | null;
  family: string | null;
  order: string | null;
  status: 'consistent' | 'conflict' | 'unresolved';
  source: 'world_flora_online';
  sourceVersion: '2026-06';
  sourceDoi: '10.5281/zenodo.20782718';
  checklistBankDatasetId: '2004';
  requestUrl: string;
  retrievedAt: string;
  checksum: string;
  response: WfoResponse;
}

const DATASET_ID = '2004';
const limiter = new RateLimiter(250);
const cacheDirectory = resolve(PATHS.cache, 'external/world_flora_online');

function canonical(value: string | null | undefined): string | null {
  if (!value) return null;
  const words = value.normalize('NFKC').replace(/^(?:×|x)\s+/iu, '').replace(/\s+/gu, ' ').trim().split(' ');
  return words.length >= 2 ? `${words[0]} ${words[1]}` : null;
}

function acceptedUsage(usage: WfoUsage | undefined): WfoUsage | null {
  if (!usage) return null;
  if (usage.status === 'accepted') return usage;
  return usage.classification?.find((item) => item.rank === 'species' && item.status === 'accepted') ?? null;
}

function rank(usage: WfoUsage | undefined, value: string): WfoUsage | null {
  return usage?.classification?.find((item) => item.rank === value && item.status === 'accepted') ?? null;
}

function batchSize(): number {
  const raw = process.argv.find((argument) => argument.startsWith('--batch='))?.slice(8) ?? '25';
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error('--batch debe ser un entero positivo');
  return value;
}

function cachePath(name: string): string {
  return resolve(cacheDirectory, `${slug(name)}.json`);
}

async function query(plant: PlantItem): Promise<Candidate> {
  const requestUrl = `https://api.checklistbank.org/dataset/${DATASET_ID}/match/nameusage?${new URLSearchParams({ q: plant.scientificName })}`;
  const response = await fetchJson<WfoResponse>(requestUrl, { limiter });
  const accepted = acceptedUsage(response?.usage);
  const matchedName = canonical(response?.usage?.name);
  const acceptedName = canonical(accepted?.name);
  const expected = canonical(plant.scientificName);
  const found = Boolean(response?.match && response.usage?.id);
  return {
    scientificName: plant.scientificName,
    referenceFamily: plant.taxonomy.family,
    matchedName,
    acceptedName,
    acceptedWfoId: accepted?.id ?? null,
    matchedWfoId: response?.usage?.id ?? response?.id ?? null,
    family: rank(response?.usage, 'family')?.name ?? null,
    order: rank(response?.usage, 'order')?.name ?? null,
    status: !found ? 'unresolved' : acceptedName && acceptedName !== expected ? 'conflict' : 'consistent',
    source: 'world_flora_online',
    sourceVersion: '2026-06',
    sourceDoi: '10.5281/zenodo.20782718',
    checklistBankDatasetId: '2004',
    requestUrl,
    retrievedAt: new Date().toISOString(),
    checksum: createHash('sha256').update(JSON.stringify(response)).digest('hex'),
    response: response ?? {},
  };
}

async function main(): Promise<void> {
  ensureDirs();
  mkdirSync(cacheDirectory, { recursive: true });
  const plants = readJson<PlantItem[]>(resolve(PATHS.catalog, 'plantae.json'));
  const refresh = process.argv.includes('--refresh');
  const pending = plants.filter((plant) => refresh || !existsSync(cachePath(plant.scientificName))).slice(0, batchSize());
  console.log(`13b-plant-taxonomy-candidates: ${pending.length} consultas WFO pendientes en este lote`);
  for (const [index, plant] of pending.entries()) {
    const candidate = await query(plant);
    writeJson(cachePath(plant.scientificName), candidate);
    if ((index + 1) % 10 === 0) console.log(`  ${index + 1}/${pending.length}`);
  }
  const candidates = plants.flatMap((plant) => {
    const file = cachePath(plant.scientificName);
    return existsSync(file) ? [readJson<Candidate>(file)] : [];
  });
  writeJson(resolve(PATHS.reports, 'plant-taxonomy-candidates.json'), {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'world_flora_online',
    sourceVersion: '2026-06',
    sourceDoi: '10.5281/zenodo.20782718',
    complete: candidates.length === plants.length,
    catalogSpecies: plants.length,
    reviewedByService: candidates.length,
    consistent: candidates.filter((item) => item.status === 'consistent').length,
    conflicts: candidates.filter((item) => item.status === 'conflict').length,
    unresolved: candidates.filter((item) => item.status === 'unresolved').length,
    candidates,
  });
  console.log(`  ${candidates.length}/${plants.length} en caché; ningún cambio se publicó automáticamente`);
}

main().catch((error: unknown) => { console.error(error); process.exit(1); });
