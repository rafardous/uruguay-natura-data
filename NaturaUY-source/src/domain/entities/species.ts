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
  externalId?: string | null;
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
  subfilo?: string;
  clase: string;
  orden: string;
  familia: string;
  genero: string;
  epiteto: string;
}

export interface SpeciesSource {
  source: string;
  record: string | null;
  /** Schema 11 field path. Older catalogues use `record` for this value. */
  fieldPath?: string;
  sourceCode?: string | null;
  name?: string | null;
  version?: string | null;
  url?: string | null;
  citation?: string | null;
  license?: string | null;
}

export interface SpeciesTaxonIdentifiers {
  gbif?: { usageKey: number; name?: string | null };
  catalogueOfLife?: { taxonId: string; datasetId?: string | null; version?: string | null };
  worms?: { aphiaId: number; name?: string | null };
  iNaturalist?: { taxonId: number; name?: string | null };
}

export interface ArthropodNaturalHistory {
  /** Historical schema 11 sources remain readable after ecology is normalized. */
  ecology?: { sources?: SpeciesSource[] };
  morphology?: { bodyRegions?: string[]; exoskeleton?: string | null; legs?: number | null; antennae?: string | null; wings?: string | null; cheliceraePedipalps?: string | null; sources?: SpeciesSource[] };
  identification?: { diagnosticCharacters?: string[]; similarSpecies?: string[]; sources?: SpeciesSource[] };
  lifeCycle?: { stages?: string[]; metamorphosis?: 'none' | 'incomplete' | 'complete' | 'variable' | null; sources?: SpeciesSource[] };
  humanRelevance?: { vector?: boolean; pest?: boolean; venomous?: boolean; veterinaryImportance?: boolean; note?: string | null; sources?: SpeciesSource[] };
  sources?: SpeciesSource[];
}

export interface PlantNaturalHistory {
  habit?: string | null;
  lifeForm?: string | null;
  heightCm?: { min: number | null; max: number | null };
  phenology?: { floweringMonths?: number[]; fruitingMonths?: number[] };
  nomenclature?: { authorship?: string | null; publication?: string | null; familyAliases?: string[] };
  sources?: SpeciesSource[];
}

export interface BirdNaturalHistory {
  guide: { sourceCode: 'azpiroz_2003'; year: number; number: number; page: number | null; commonName: string | null; englishName: string | null; scientificName: string | null } | null;
  measurements: { kind: 'body_length' | 'wingspan'; valueCm: number; sex?: 'male' | 'female' }[];
  presence: { code: string; label: string; months: number[]; note: string; outsidePeriod: boolean } | null;
  habitat: string[];
  diet: string[];
  abundanceCode: string | null;
}
export interface SpeciesNaturalHistory { version: 1; arthropod?: ArthropodNaturalHistory; plant?: PlantNaturalHistory; bird?: BirdNaturalHistory }
export type MeasurementKind = 'body_length' | 'body_mass' | 'wing_length' | 'tail_length' | 'tarsus_length' | 'max_length';
export type MeasurementBasis = 'TL' | 'SL' | 'FL' | 'SVL' | 'body_length' | null;
export interface SpeciesMeasurement {
  kind: MeasurementKind;
  value: number;
  unit: 'mm' | 'g';
  basis: MeasurementBasis;
  estimated: boolean;
  sourceCode: string;
  sourceRecordId: string | null;
  provenance: 'verified' | 'legacy_unverified';
}
export interface SpeciesEcology {
  habitats: string[];
  habitatGameGroups?: string[];
  diet: string[];
  lifeModes: string[];
  activity: string[];
  aquaticEnvironments: string[];
  waterZones: string[];
  depthMinM: number | null;
  depthMaxM: number | null;
  microhabitats: string[];
  trophicRoles: string[];
  hosts: string[];
  plantAssociations: string[];
  vegetationFormations: string[];
}

export type IucnCategory = 'DD' | 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';
export type NationalCategory = 'DD' | 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'RE';
export interface ConservationAssessment<T extends string> { category: T; sourceCode: string; version: string | null; assessedAt: string | null }
export interface SpeciesConservation {
  nationalRedList: ConservationAssessment<NationalCategory> | null;
  iucnGlobal: ConservationAssessment<IucnCategory> | null;
  nationalDesignations: ('priority' | 'threatened' | 'snap')[];
}
export function conservationRank(conservation: SpeciesConservation): number {
  if (conservation.nationalDesignations.includes('threatened') || ['VU','EN','CR','EW','EX','RE'].includes(conservation.nationalRedList?.category ?? '') || ['VU','EN','CR','EW','EX'].includes(conservation.iucnGlobal?.category ?? '')) return 3;
  if (conservation.nationalDesignations.includes('priority') || conservation.nationalDesignations.includes('snap')) return 2;
  return conservation.nationalRedList || conservation.iucnGlobal ? 1 : 0;
}
export function conservationLabel(conservation: SpeciesConservation): string {
  if (conservation.nationalDesignations.includes('threatened')) return 'Amenazada en Uruguay';
  if (conservation.nationalDesignations.includes('priority')) return 'Prioritaria';
  if (conservation.nationalDesignations.includes('snap')) return 'Vinculada al SNAP';
  if (conservation.nationalRedList) return `Lista Roja UY: ${conservation.nationalRedList.category}`;
  if (conservation.iucnGlobal) return `UICN: ${conservation.iucnGlobal.category}`;
  return '';
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
  taxonIdentifiers?: SpeciesTaxonIdentifiers;
  conservation: SpeciesConservation;
  nativa: boolean;
  /** Explicit origin; null means the sources do not establish it. */
  origin: 'native' | 'introduced' | null;
  seasonality: string | null;
  abundanceStatus: 'abundant' | 'common' | 'fairly_common' | 'rare' | 'uncommon' | 'scarce' | 'occasional' | null;
  abundance: { category: string | null; label: string | null };
  observability: {
    methodVersion: string; periodStart: string; periodEnd: string; occurrenceCount: number;
    occupiedCells: number; yearsObserved: number; score: number;
    band: 'high' | 'medium' | 'low' | 'insufficient_data'; comparisonClass: string;
  } | null;
  knowledgeLevel: KnowledgeLevel;
  gameRules: SpeciesGameRule[];
  facts: SpeciesFact[];
  measurements: SpeciesMeasurement[];
  ecology: SpeciesEcology;
  relevantNote: string | null;
  sources: SpeciesSource[];
  descripcion: string;
  naturalHistory?: SpeciesNaturalHistory | null;
  photo: SpeciesPhoto | null;
  audioUrl: string | null;
  /** Full approved gallery from SQLite schema 8. Primary fields above remain for cards and games. */
  media: SpeciesMedia[];
  palette: SpeciesPalette;
}

/** True when the species has enough imagery to appear in the quiz. */
export const isQuizEligible = (species: Species): boolean => species.photo !== null;
