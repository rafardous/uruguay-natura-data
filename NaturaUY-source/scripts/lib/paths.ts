import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

export const PATHS = {
  root,
  /** Untouched input from SNAP. */
  source: resolve(root, 'resources/outputSNAP.json'),
  /** Resumable per-stage caches — safe to delete, costs a re-fetch. */
  cache: resolve(root, 'scripts/.cache'),
  /** Stage hand-off files. */
  out: resolve(root, 'scripts/out'),
  /** Assets that ship inside the app bundle. */
  thumbs: resolve(root, 'assets/thumbs'),
  db: resolve(root, 'assets/db/natura.db'),
} as const;

export function ensureDirs(): void {
  for (const dir of [PATHS.cache, PATHS.out, PATHS.thumbs, resolve(root, 'assets/db')]) {
    mkdirSync(dir, { recursive: true });
  }
}
