import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { required } from './shared.js';

const CONTRIBUTOR_NAME = 'Pedro Rinaldi';
const CONTRIBUTOR_ID = 'VKQHDAFQDZ';
const API_URL = 'https://xeno-canto.org/api/3/recordings';
const CATALOG_DIR = resolve(import.meta.dirname, '../../NaturaUY-source/data/catalog');
const REPORT_PATH = resolve(import.meta.dirname, '../data/reports/xenocanto-inventory.json');

type JsonObject = Record<string, unknown>;

interface CatalogRecord {
  scientificName?: unknown;
  taxonomy?: { class?: unknown };
}

interface XenoRecording {
  id: string;
  scientificName: string;
  commonName: string | null;
  recordist: string;
  contributorId: string | null;
  country: string | null;
  location: string | null;
  date: string | null;
  quality: string | null;
  type: string | null;
  length: string | null;
  pageUrl: string;
  downloadUrl: string | null;
  originalLicense: string | null;
  remarks: string | null;
  score: number;
  priority: { uruguay: boolean; quality: boolean; cleanSoundHeuristic: boolean };
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeName(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
}

function field(row: JsonObject, ...names: string[]): unknown {
  for (const name of names) if (row[name] !== undefined && row[name] !== null) return row[name];
  return null;
}

function catalogBirdNames(): Set<string> {
  return new Set(readdirSync(CATALOG_DIR)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const rows = JSON.parse(readFileSync(resolve(CATALOG_DIR, file), 'utf8')) as CatalogRecord[];
      return rows
        .filter((row) => normalizeName(String(row.taxonomy?.class ?? '')) === 'aves')
        .map((row) => stringValue(row.scientificName))
        .filter((name): name is string => Boolean(name));
    }));
}

async function fetchPage(apiKey: string, page: number): Promise<{ recordings: JsonObject[]; numPages: number }> {
  const url = new URL(API_URL);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('query', `rec:"${CONTRIBUTOR_NAME}"`);
  url.searchParams.set('page', String(page));
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'NaturaUY-audio-inventory/1.0' } });
  if (!response.ok) throw new Error(`Xeno-canto API HTTP ${response.status}`);
  const payload = asObject(await response.json());
  const recordings = Array.isArray(payload.recordings) ? payload.recordings.map(asObject) : [];
  const numPages = Math.max(1, Number(payload.numPages ?? page) || page);
  return { recordings, numPages };
}

function makeCandidate(row: JsonObject, acceptedBirdNames: Set<string>): XenoRecording | null {
  const id = stringValue(field(row, 'id'));
  const genus = stringValue(field(row, 'gen', 'genus'));
  const species = stringValue(field(row, 'sp', 'specificEpithet'));
  const scientificName = stringValue(field(row, 'scientific_name', 'scientificName')) ?? (genus && species ? `${genus} ${species}` : null);
  const recordist = stringValue(field(row, 'rec', 'recordist'));
  const contributorId = stringValue(field(row, 'contributor_id', 'contributorId'));
  if (!id || !scientificName || !recordist) return null;
  if (normalizeName(recordist) !== normalizeName(CONTRIBUTOR_NAME) && contributorId !== CONTRIBUTOR_ID) return null;
  if (!acceptedBirdNames.has(normalizeName(scientificName))) return null;

  const country = stringValue(field(row, 'cnt', 'country'));
  const quality = stringValue(field(row, 'q', 'quality'))?.toUpperCase() ?? null;
  const remarks = stringValue(field(row, 'rmk', 'remarks'));
  const cleanSoundHeuristic = !/(noise|wind|traffic|rain|distortion|clipping)/i.test(remarks ?? '');
  const inUruguay = normalizeName(country ?? '') === 'uruguay';
  const qualityOk = quality === 'A' || quality === 'B';
  const score = (inUruguay ? 5 : 0) + (quality === 'A' ? 3 : quality === 'B' ? 2 : 0) + (cleanSoundHeuristic ? 1 : 0) + (stringValue(field(row, 'file')) ? 1 : 0);
  return {
    id,
    scientificName,
    commonName: stringValue(field(row, 'en', 'commonName')),
    recordist,
    contributorId,
    country,
    location: stringValue(field(row, 'loc', 'location')),
    date: stringValue(field(row, 'date')),
    quality,
    type: stringValue(field(row, 'type')),
    length: stringValue(field(row, 'length')),
    pageUrl: `https://xeno-canto.org/${encodeURIComponent(id)}`,
    downloadUrl: stringValue(field(row, 'file', 'downloadUrl')),
    originalLicense: stringValue(field(row, 'lic', 'license')),
    remarks,
    score,
    priority: { uruguay: inUruguay, quality: qualityOk, cleanSoundHeuristic },
  };
}

async function main(): Promise<void> {
  const apiKey = required('XENO_CANTO_API_KEY');
  const acceptedBirdNames = catalogBirdNames();
  const candidates: XenoRecording[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await fetchPage(apiKey, page);
    totalPages = result.numPages;
    for (const row of result.recordings) {
      const candidate = makeCandidate(row, acceptedBirdNames);
      if (candidate) candidates.push(candidate);
    }
    page += 1;
  } while (page <= totalPages);

  const unique = [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()]
    .sort((a, b) => b.score - a.score || a.scientificName.localeCompare(b.scientificName));
  const report = {
    generatedAt: new Date().toISOString(),
    contributor: { name: CONTRIBUTOR_NAME, id: CONTRIBUTOR_ID, sourcePage: `https://xeno-canto.org/contributor/${CONTRIBUTOR_ID}` },
    query: `rec:"${CONTRIBUTOR_NAME}"`,
    catalogClass: 'Aves',
    matchedSpecies: [...new Set(unique.map((candidate) => candidate.scientificName))].sort(),
    candidates: unique.map((candidate) => ({
      ...candidate,
      approved: false,
      reviewStatus: 'pending_human_review',
      authorizationEvidenceRef: null,
      clipStartSeconds: null,
      clipDurationSeconds: null,
      approvedBy: null,
    })),
    reviewInstructions: 'Ningún candidato se publica ni se aprueba automáticamente. Completar evidencia de autorización, inicio y duración antes de crear un clip.',
  };
  mkdirSync(resolve(REPORT_PATH, '..'), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Xeno-canto inventory written: ${unique.length} candidates for ${report.matchedSpecies.length} species`);
}

await main();
