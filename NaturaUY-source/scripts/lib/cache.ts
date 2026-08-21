import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PATHS } from './paths';

/**
 * A flush-to-disk key/value store keyed by species code.
 *
 * The media stage makes thousands of rate-limited network calls; if it dies
 * halfway (or you Ctrl-C it) the next run must resume rather than start over.
 * Writes go through a temp file + rename so an interrupted flush can never
 * leave a truncated JSON behind.
 */
export class JsonCache<T> {
  private readonly file: string;
  private data: Record<string, T>;
  private dirty = 0;

  constructor(name: string) {
    this.file = resolve(PATHS.cache, `${name}.json`);
    this.data = existsSync(this.file)
      ? (JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, T>)
      : {};
  }

  get size(): number {
    return Object.keys(this.data).length;
  }

  has(key: string): boolean {
    return key in this.data;
  }

  get(key: string): T | undefined {
    return this.data[key];
  }

  entries(): [string, T][] {
    return Object.entries(this.data);
  }

  /** Stores a value, flushing to disk every `every` writes. */
  set(key: string, value: T, every = 25): void {
    this.data[key] = value;
    if (++this.dirty >= every) this.flush();
  }

  flush(): void {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.file);
    this.dirty = 0;
  }
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function writeJson(file: string, value: unknown): void {
  writeFileSync(file, JSON.stringify(value, null, 2));
}
