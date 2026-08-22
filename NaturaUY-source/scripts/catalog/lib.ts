import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');
export const DATA = resolve(ROOT, 'data');
export const PATHS = {
  raw: resolve(DATA, 'raw'),
  biodiversity: resolve(DATA, 'raw/biodiversidata/tetrapodos-de-uruguay.zip'),
  ministry: resolve(DATA, 'raw/ministerio/listas-rojas-fauna-uy.zip'),
  historical: resolve(DATA, 'raw/otras_fuentes/outputSNAP.json'),
  cache: resolve(DATA, 'cache'),
  gbif: resolve(DATA, 'cache/gbif/species-match.json'),
  normalized: resolve(DATA, 'normalized'),
  candidates: resolve(DATA, 'normalized/candidates.json'),
  resolved: resolve(DATA, 'normalized/resolved.json'),
  catalog: resolve(DATA, 'catalog'),
  reports: resolve(DATA, 'reports'),
} as const;

export const GROUPS = ['Mammalia', 'Aves', 'Reptilia', 'Amphibia', 'Actinopterygii', 'Chondrichthyes'] as const;
export type Group = (typeof GROUPS)[number];

export function ensureDirs(): void {
  for (const dir of [PATHS.raw, resolve(PATHS.raw, 'biodiversidata'), resolve(PATHS.raw, 'ministerio'),
    resolve(PATHS.raw, 'otras_fuentes'), PATHS.cache, resolve(PATHS.cache, 'gbif'), PATHS.normalized,
    PATHS.catalog, PATHS.reports]) mkdirSync(dir, { recursive: true });
}

export function writeJson(file: string, value: unknown): void {
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  let lastError: unknown;
  for (let attempt = 0; attempt < 12; attempt++) {
    try { renameSync(temp, file); return; }
    catch (error) {
      lastError = error;
      // Antivirus and file indexers can briefly hold a just-written file on Windows.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
  throw lastError;
}

export function readJson<T>(file: string): T { return JSON.parse(readFileSync(file, 'utf8')) as T; }

export const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

export async function downloadOnce(url: string, target: string): Promise<'cached' | 'downloaded'> {
  if (existsSync(target)) return 'cached';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);
      const response = await fetch(url, { headers: { 'User-Agent': 'NaturaUY-data-pipeline/1.0', Accept: '*/*' }, signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length < 100) throw new Error('download is unexpectedly small');
      writeFileSync(`${target}.tmp`, body);
      renameSync(`${target}.tmp`, target);
      return 'downloaded';
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(1_000 * 2 ** attempt);
    }
  }
  throw new Error('unreachable');
}

/** Minimal ZIP reader for public DwC-A archives (stored or deflated entries). */
export function readZipEntries(file: string): Map<string, Buffer> {
  const data = readFileSync(file);
  const eocd = 0x06054b50;
  let pos = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) if (data.readUInt32LE(i) === eocd) { pos = i; break; }
  if (pos < 0) throw new Error(`invalid ZIP: no end record in ${file}`);
  const count = data.readUInt16LE(pos + 10);
  let cursor = data.readUInt32LE(pos + 16);
  const entries = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (data.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`invalid ZIP central directory: ${file}`);
    const method = data.readUInt16LE(cursor + 10);
    const compressedSize = data.readUInt32LE(cursor + 20);
    const nameLength = data.readUInt16LE(cursor + 28);
    const extraLength = data.readUInt16LE(cursor + 30);
    const commentLength = data.readUInt16LE(cursor + 32);
    const localOffset = data.readUInt32LE(cursor + 42);
    const name = data.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (data.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`invalid ZIP local header: ${name}`);
    const localNameLength = data.readUInt16LE(localOffset + 26);
    const localExtraLength = data.readUInt16LE(localOffset + 28);
    const compressed = data.subarray(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
    entries.set(name, method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : (() => { throw new Error(`unsupported ZIP compression ${method}: ${name}`); })());
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function parseXmlAttributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:]+)="([^"]*)"/g)].map((match) => [match[1]!, match[2]!]));
}

export interface DwcaRow { [term: string]: string | null; }

/** Reads a Darwin Core core table according to meta.xml without hard-coding its filename. */
export function readDwcaCore(file: string): DwcaRow[] {
  const entries = readZipEntries(file);
  const meta = entries.get('meta.xml')?.toString('utf8');
  if (!meta) throw new Error(`DwC-A without meta.xml: ${file}`);
  const core = meta.match(/<core\b[\s\S]*?<\/core>/i)?.[0];
  if (!core) throw new Error(`DwC-A without core: ${file}`);
  const location = core.match(/<location>([^<]+)<\/location>/i)?.[1];
  if (!location) throw new Error(`DwC-A core without location: ${file}`);
  const content = entries.get(location)?.toString('utf8');
  if (content === undefined) throw new Error(`DwC-A core table missing: ${location}`);
  const attrs = parseXmlAttributes(core.match(/<core\b[^>]*>/i)?.[0] ?? '');
  const delimiter = attrs.fieldsTerminatedBy === '\\t' ? '\t' : attrs.fieldsTerminatedBy ?? '\t';
  const ignoreHeader = Number(attrs.ignoreHeaderLines ?? '0');
  const columns = new Map<number, string>();
  for (const tag of core.matchAll(/<field\b[^>]*\/>/gi)) {
    const field = parseXmlAttributes(tag[0]);
    if (field.index !== undefined && field.term) columns.set(Number(field.index), field.term.split('/').at(-1)!);
  }
  return content.split(/\r?\n/).slice(ignoreHeader).filter(Boolean).map((line) => {
    const values = parseDelimited(line, delimiter);
    return Object.fromEntries([...columns].map(([index, term]) => [term, values[index]?.trim() || null]));
  });
}

function parseDelimited(line: string, delimiter: string): string[] {
  const values: string[] = []; let value = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') { if (quoted && line[i + 1] === '"') { value += char; i++; } else quoted = !quoted; }
    else if (char === delimiter && !quoted) { values.push(value); value = ''; } else value += char;
  }
  values.push(value); return values;
}

export function cleanName(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim().replace(/\s+\([^)]*\)$/, '');
  const words = cleaned.split(' ');
  return words.length >= 2 && /^[A-Z][a-z-]+$/.test(words[0]!) && /^[a-z-]+$/.test(words[1]!) ? `${words[0]} ${words[1]}` : null;
}

export const slug = (name: string): string => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
