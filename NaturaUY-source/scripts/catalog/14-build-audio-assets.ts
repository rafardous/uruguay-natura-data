import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE_ROOT = resolve(import.meta.dirname, '../..');
const PROJECT_ROOT = resolve(SOURCE_ROOT, '..');
const manifestPath = resolve(SOURCE_ROOT, 'data/cache/audio/xenocanto-approved.json');
const inputDirectory = resolve(PROJECT_ROOT, 'NaturaUY-admin/data/audio/generated');
const outputDirectory = resolve(SOURCE_ROOT, 'assets/audio');
const mapPath = resolve(SOURCE_ROOT, 'src/data/assets/audioMap.ts');

interface AudioCandidate {
  id: string;
  approved?: boolean;
}

async function main(): Promise<void> {
  if (!existsSync(manifestPath)) throw new Error(`Missing approved audio manifest: ${manifestPath}`);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { candidates?: AudioCandidate[] };
  await mkdir(outputDirectory, { recursive: true });
  const entries: string[] = [];
  for (const candidate of manifest.candidates ?? []) {
    if (candidate.approved === false) continue;
    const fileName = `xc-${candidate.id}.mp3`;
    const source = resolve(inputDirectory, fileName);
    if (!existsSync(source)) throw new Error(`Missing generated audio: ${source}`);
    await copyFile(source, resolve(outputDirectory, fileName));
    entries.push(`  '${fileName}': require('../../../assets/audio/${fileName}'),`);
  }
  const source = `/** Generated from data/cache/audio/xenocanto-approved.json. */\nconst AUDIO_ASSETS: Record<string, number> = {\n${entries.join('\n')}\n};\n\nexport function bundledAudioAsset(url: string): number | null {\n  if (!url.startsWith('bundled://')) return null;\n  return AUDIO_ASSETS[url.slice('bundled://'.length)] ?? null;\n}\n`;
  await writeFile(mapPath, source, 'utf8');
  console.log(`Bundled ${entries.length} audio assets`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
