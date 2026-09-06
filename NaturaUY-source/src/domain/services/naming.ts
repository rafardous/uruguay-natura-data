import type { Species } from '../entities/species';

export const normalizeName = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

/** Offline autocomplete ranking shared by the naming game and its tests. */
export function rankNameMatches(pool: readonly Species[], query: string, limit = 8): Species[] {
  const needle = normalizeName(query);
  if (needle.length < 2) return [];
  return pool.map((species) => {
    const common = normalizeName(species.displayName);
    const scientific = normalizeName(species.scientificName);
    const haystack = `${common} ${scientific}`;
    const score = common.startsWith(needle) ? 0 : scientific.startsWith(needle) ? 1 : haystack.includes(needle) ? 2 : 9;
    return { species, score };
  }).filter((entry) => entry.score < 9).sort((a, b) => a.score - b.score || a.species.displayName.localeCompare(b.species.displayName, 'es')).slice(0, limit).map((entry) => entry.species);
}
