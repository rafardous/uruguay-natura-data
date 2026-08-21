/**
 * The SNAP dataset stores conservation status as six shouty free-text strings.
 * The app needs a short label for badges and a numeric rank for sorting and
 * filtering, so the mapping lives here and is applied once at build time.
 */

export interface ConservationInfo {
  label: string;
  /** 0 = unassessed, 1 = not a priority, 2 = priority, 3 = threatened. */
  rank: number;
}

const TABLE: Record<string, ConservationInfo> = {
  'No evaluada': { label: 'No evaluada', rank: 0 },
  'No Prioritaria': { label: 'No prioritaria', rank: 1 },
  PRIORITARIA: { label: 'Prioritaria', rank: 2 },
  'PRIORITARIA SNAP': { label: 'Prioritaria SNAP', rank: 2 },
  'PRIORITARIA AMENAZADA': { label: 'Amenazada', rank: 3 },
  'PRIORITARIA SNAP AMENAZADA': { label: 'Amenazada SNAP', rank: 3 },
};

export function classifyConservation(raw: string): ConservationInfo {
  return TABLE[raw.trim()] ?? { label: 'No evaluada', rank: 0 };
}

/** Every status string the pipeline knows how to classify. */
export const KNOWN_CONSERVATION_STATUSES = Object.keys(TABLE);
