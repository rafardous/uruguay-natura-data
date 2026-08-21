/**
 * Stage 02 — ask GBIF what each name resolves to.
 *
 * SNAP contains typos ("Cerathosanthes multiloba" -> Ceratosanthes) and
 * outdated synonyms ("Panicum validum" -> an accepted name elsewhere). iNaturalist
 * indexes by accepted name, so resolving here measurably lifts stage 03's hit rate.
 * The original name is still tried as a fallback, in case GBIF over-corrects.
 */
import { resolve } from 'node:path';

import { JsonCache, readJson, writeJson } from './lib/cache';
import { fetchJson, RateLimiter } from './lib/http';
import { ensureDirs, PATHS } from './lib/paths';
import type { NormalizedSpecies, TaxonomyMatch } from './lib/types';

interface GbifMatch {
  scientificName?: string;
  species?: string;
  canonicalName?: string;
  status?: string;
  matchType?: string;
  confidence?: number;
}

const CONCURRENCY = 6;
const limiter = new RateLimiter(60);

async function resolveOne(species: NormalizedSpecies): Promise<TaxonomyMatch> {
  const url = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(species.scientificName)}`;
  const match = await fetchJson<GbifMatch>(url, { limiter });

  if (!match || match.matchType === 'NONE') {
    return { acceptedName: null, status: null, matchType: match?.matchType ?? null, confidence: null };
  }

  // `species` is the binomial without the author string, which is what the
  // media APIs want. canonicalName is the next best thing for higher ranks.
  const accepted = match.species ?? match.canonicalName ?? null;

  return {
    acceptedName: accepted,
    status: match.status ?? null,
    matchType: match.matchType ?? null,
    confidence: match.confidence ?? null,
  };
}

async function main(): Promise<void> {
  ensureDirs();

  const species = readJson<NormalizedSpecies[]>(resolve(PATHS.out, 'species.json'));
  const cache = new JsonCache<TaxonomyMatch>('taxonomy');

  const pending = species.filter((s) => !cache.has(s.codigo));
  console.log(`02-resolve-taxonomy: ${pending.length} to resolve (${cache.size} cached)`);

  let done = 0;
  const queue = [...pending];

  const worker = async (): Promise<void> => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;

      cache.set(next.codigo, await resolveOne(next));

      if (++done % 200 === 0) console.log(`  ${done}/${pending.length}`);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  cache.flush();

  const all = Object.fromEntries(cache.entries());
  writeJson(resolve(PATHS.out, 'taxonomy.json'), all);

  const values = Object.values(all);
  const resolved = values.filter((m) => m.acceptedName).length;
  const fuzzy = values.filter((m) => m.matchType === 'FUZZY').length;
  const synonyms = values.filter((m) => m.status === 'SYNONYM').length;

  console.log(`  resolved ${resolved}/${species.length}`);
  console.log(`  ${fuzzy} fuzzy matches (typos corrected), ${synonyms} synonyms`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
