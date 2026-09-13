import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface Candidate {
  id: string;
  scientificName: string;
  country: string | null;
  quality: string | null;
  length: string | null;
  score: number;
  downloadUrl: string;
  [key: string]: unknown;
}

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`${name} is required`);
}

function durationSeconds(value: string | null): number {
  if (!value) return 15;
  const parts = value.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 15;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return Number.isFinite(parts[0]) ? parts[0]! : 15;
}

function rank(candidate: Candidate): number[] {
  const qualityRank = candidate.quality === 'A' ? 3 : candidate.quality === 'B' ? 2 : candidate.quality === 'C' ? 1 : 0;
  const countryRank = candidate.country?.toLocaleLowerCase('es') === 'uruguay' ? 1 : 0;
  const duration = durationSeconds(candidate.length);
  return [candidate.score || 0, qualityRank, countryRank, duration > 0 ? 1 : 0, duration];
}

function compare(a: Candidate, b: Candidate): number {
  const left = rank(a);
  const right = rank(b);
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return right[index]! - left[index]!;
  }
  return a.id.localeCompare(b.id);
}

async function main(): Promise<void> {
  const manifestPath = resolve(argument('--manifest', 'data/reports/xenocanto-inventory.json'));
  const outputPath = resolve(argument('--output', 'data/reports/xenocanto-approved.json'));
  const sourceOutputArgument = process.argv.indexOf('--source-output');
  const sourceOutput = sourceOutputArgument >= 0 && process.argv[sourceOutputArgument + 1]
    ? resolve(process.argv[sourceOutputArgument + 1]!)
    : null;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { candidates?: Candidate[]; [key: string]: unknown };
  const grouped = new Map<string, Candidate[]>();
  for (const candidate of manifest.candidates ?? []) {
    const key = candidate.scientificName.trim().toLocaleLowerCase('es');
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }

  const evidence = 'chat-authorization-2026-09-12';
  const approved = [...grouped.values()]
    .map((candidates) => candidates.sort(compare)[0]!)
    .filter((candidate) => candidate.downloadUrl.startsWith('https://') && durationSeconds(candidate.length) > 0)
    .map((candidate) => ({
      ...candidate,
      approved: true,
      reviewStatus: 'approved_by_owner_instruction',
      authorizationEvidenceRef: evidence,
      clipStartSeconds: 0,
      clipDurationSeconds: Math.min(15, durationSeconds(candidate.length)),
      approvedBy: 'Natura UY owner authorization',
    }));

  const approvedManifest = {
    ...manifest,
    generatedAt: new Date().toISOString(),
    approval: {
      mode: 'owner_authorized_immediate_publish',
      evidence,
      selectedPerSpecies: true,
      candidateCount: manifest.candidates?.length ?? 0,
      approvedCount: approved.length,
    },
    candidates: approved,
  };
  const serialized = `${JSON.stringify(approvedManifest, null, 2)}\n`;
  await writeFile(outputPath, serialized, 'utf8');
  if (sourceOutput) {
    await mkdir(resolve(sourceOutput, '..'), { recursive: true });
    await writeFile(sourceOutput, serialized, 'utf8');
  }
  console.log(`Auto-approved ${approved.length} Xeno-canto clips for ${approved.length} species`);
}

await main();
