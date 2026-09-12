import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

interface ApprovedClip {
  id: string;
  downloadUrl: string;
  scientificName: string;
  approved: boolean;
  approvedBy: string | null;
  authorizationEvidenceRef: string | null;
  clipStartSeconds: number | null;
  clipDurationSeconds: number | null;
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const manifestPath = resolve(argument('--manifest'));
  const outputDir = resolve(process.cwd(), 'data/audio/generated');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { candidates?: ApprovedClip[] };
  const approved = (manifest.candidates ?? []).filter((candidate) => candidate.approved);
  if (approved.length === 0) throw new Error('No approved clips in manifest');
  mkdirSync(outputDir, { recursive: true });
  const tempDir = mkdtempSync(join(tmpdir(), 'natura-xc-'));
  try {
    for (const clip of approved) {
      if (!clip.approvedBy || !clip.authorizationEvidenceRef) throw new Error(`Missing approval evidence for XC${clip.id}`);
      if (!clip.downloadUrl.startsWith('https://')) throw new Error(`Invalid download URL for XC${clip.id}`);
      const start = clip.clipStartSeconds ?? 0;
      const duration = clip.clipDurationSeconds ?? 15;
      if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0 || duration > 15) {
        throw new Error(`Invalid clip boundaries for XC${clip.id}`);
      }
      const input = join(tempDir, `${clip.id}-${basename(new URL(clip.downloadUrl).pathname) || 'source'}`);
      const response = await fetch(clip.downloadUrl, { headers: { 'User-Agent': 'NaturaUY-audio-pipeline/1.0' } });
      if (!response.ok) throw new Error(`XC${clip.id} download HTTP ${response.status}`);
      writeFileSync(input, Buffer.from(await response.arrayBuffer()));
      const output = join(outputDir, `xc-${clip.id}.mp3`);
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(start), '-i', input, '-t', String(duration), '-ac', '1', '-ar', '48000', '-b:a', '96k', output], { stdio: 'inherit' });
      console.log(`Generated ${output} for ${clip.scientificName}`);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

await main();
