/** The catalogue's core entity, as the presentation layer sees it. */

export interface SpeciesPalette {
  /** Readable as text on the light theme's card surface. */
  accentLight: string;
  /** Readable as text on the dark theme's card surface. */
  accentDark: string;
  containerLight: string;
  onContainerLight: string;
  containerDark: string;
  onContainerDark: string;
}

export interface SpeciesPhoto {
  /** Medium resolution, used by cards. */
  url: string;
  /** Large resolution, used by the detail sheet. */
  fullUrl: string;
  /** Filename inside `assets/thumbs`, or null when none was bundled. */
  thumbAsset: string | null;
  license: string;
  originalLicense?: string | null;
  attribution: string;
  source: string;
  page: string | null;
}

export interface SpeciesMedia {
  id: string;
  type: 'image' | 'audio';
  ordinal: number;
  isPrimary: boolean;
  url: string;
  thumbnailUrl: string | null;
  attribution: string;
  license: string;
  originalLicense?: string | null;
  source: string;
  page: string | null;
  durationSeconds: number | null;
}

export interface Taxonomy {
  kingdom: string;
  phylum: string;
  clase: string;
  orden: string;
  familia: string;
  genero: string;
  epiteto: string;
}

export interface SpeciesSource {
  source: string;
  record: string | null;
  /** Schema 10 field path. Older catalogues use `record` for this value. */
  fieldPath?: string;
  sourceCode?: string | null;
  name?: string | null;
  url?: string | null;
  citation?: string | null;
  license?: string | null;
}

export type MeasurementKind = 'body_length' | 'body_mass' | 'wing_length' | 'tail_length' | 'tarsus_length' | 'max_length';
export type MeasurementBasis = 'TL' | 'SL' | 'FL' | 'SVL' | 'body_length' | null;
export interface SpeciesMeasurement {
  kind: MeasurementKind;
  value: number;
  unit: 'mm' | 'g';
  basis: MeasurementBasis;
  estimated: boolean;
}
export interface SpeciesTraits {
  measurements: SpeciesMeasurement[];
  lifeModes: ('terrestrial' | 'arboreal' | 'aquatic' | 'aerial' | 'fossorial' | 'perching' | 'generalist')[];
  activity: ('diurnal' | 'nocturnal' | 'both')[];
  aquaticEnvironments: ('freshwater' | 'brackish' | 'marine')[];
  waterZones: ('benthic' | 'demersal' | 'pelagic')[];
  depthMinM: number | null;
  depthMaxM: number | null;
  sources: string[];
}

export type KnowledgeLevel = 'easy' | 'medium' | 'hard';
export interface SpeciesFact {
  id: string;
  body: string;
  sortOrder: number;
  sourceCode?: string | null;
  sourceRecordId?: string | null;
}
export interface SpeciesGameRule { gameKey: string; enabled: boolean; minKnowledgeLevel: KnowledgeLevel | null }

export interface Species {
  codigo: string;
  /** What the card shows: vernacular name, or the scientific name when absent. */
  displayName: string;
  scientificName: string;
  acceptedName: string | null;
  commonNames: string[];
  taxonomy: Taxonomy;
  conservation: {
    raw: string;
    label: string;
    /** 0 unassessed · 1 not a priority · 2 priority · 3 threatened. */
    rank: number;
  };
  nativa: boolean;
  /** Explicit origin; null means the sources do not establish it. */
  origin: 'native' | 'introduced' | null;
  seasonality: string | null;
  abundanceStatus: string | null;
  abundance: { category: string | null; label: string | null };
  observability: {
    methodVersion: string; periodStart: string; periodEnd: string; occurrenceCount: number;
    occupiedCells: number; yearsObserved: number; score: number;
    band: 'high' | 'medium' | 'low' | 'insufficient_data'; comparisonClass: string;
  } | null;
  knowledgeLevel: KnowledgeLevel;
  gameRules: SpeciesGameRule[];
  facts: SpeciesFact[];
  habitat: string[];
  diet: string[];
  relevantNote: string | null;
  sources: SpeciesSource[];
  descripcion: string;
  alimentacion: string;
  tamano: string;
  /** Structured schema-9 traits. Schema 10 adds source metadata around them. */
  traits: SpeciesTraits;
  photo: SpeciesPhoto | null;
  audioUrl: string | null;
  /** Full approved gallery from SQLite schema 8. Primary fields above remain for cards and games. */
  media: SpeciesMedia[];
  palette: SpeciesPalette;
}

/** True when the species has enough imagery to appear in the quiz. */
export const isQuizEligible = (species: Species): boolean => species.photo !== null;
