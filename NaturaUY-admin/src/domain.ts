export type Role = 'admin' | 'collaborator';
export type Lifecycle = 'active' | 'retired';
export type ValidationState = 'unreviewed' | 'validated' | 'needs_review';
export type IucnCategory = 'DD' | 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';
export type NationalCategory = 'DD' | 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'RE';

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface TaxonomyPayload {
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
}

export interface AssessmentPayload<T extends string> { category: T | ''; sourceCode: string; version: string; assessedAt: string }
export interface ConservationPayload { nationalRedList: AssessmentPayload<NationalCategory>; iucnGlobal: AssessmentPayload<IucnCategory>; nationalDesignations: Array<'priority'|'threatened'|'snap'> }

export interface TraitMeasurement {
  kind: 'body_length' | 'body_mass' | 'wing_length' | 'tail_length' | 'tarsus_length' | 'max_length';
  value: number;
  unit: 'mm' | 'g';
  basis: 'TL' | 'SL' | 'FL' | 'SVL' | 'body_length' | null;
  estimated: boolean;
  sourceCode: string;
  sourceRecordId: string | null;
  provenance: 'verified' | 'legacy_unverified';
}

export interface SpeciesEcologyPayload {
  habitats: string[];
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

export interface SpeciesNaturalHistoryPayload {
  version: 1;
  arthropod?: {
    morphology?: { bodyRegions?: string[]; exoskeleton?: string; legs?: number | null; antennae?: string; wings?: string; cheliceraePedipalps?: string; sources?: string[] };
    identification?: { diagnosticCharacters?: string[]; similarSpecies?: string[]; sources?: string[] };
    lifeCycle?: { stages?: string[]; metamorphosis?: 'none' | 'incomplete' | 'complete' | 'variable' | null; sources?: string[] };
    humanRelevance?: { vector?: boolean; pest?: boolean; venomous?: boolean; veterinaryImportance?: boolean; note?: string; sources?: string[] };
    sources?: string[];
  };
  plant?: {
    habit?: string | null;
    lifeForm?: string | null;
    heightCm?: { min: number | null; max: number | null };
    phenology?: { floweringMonths?: number[]; fruitingMonths?: number[] };
    nomenclature?: { authorship?: string | null; publication?: string | null; familyAliases?: string[] };
    sources?: string[];
  };
}

export interface SpeciesPayload {
  scientificName: string;
  acceptedName: string;
  commonNames: string[];
  taxonomy: TaxonomyPayload;
  origin: 'native' | 'introduced' | 'unknown';
  seasonality: 'resident' | 'migratory' | 'occasional' | 'summer_visitor' | 'unknown';
  abundanceStatus: 'abundant' | 'common' | 'uncommon' | 'scarce' | 'occasional' | '';
  conservation: ConservationPayload;
  description: string;
  measurements: TraitMeasurement[];
  ecology: SpeciesEcologyPayload;
  naturalHistory: SpeciesNaturalHistoryPayload | null;
  relevantNote: string;
  fieldSources: Record<string, string[]>;
  sourceReferences: string[];
}

export interface SpeciesSummary {
  id: string;
  catalogCode: string;
  lifecycle: Lifecycle;
  revision: number;
  validationState: ValidationState;
  validatedBy: string | null;
  validatedAt: string | null;
  payload: SpeciesPayload;
  updatedAt: string;
  updatedBy: string;
  imageUrl: string | null;
  imageSourceUrl: string | null;
  imageIsLegacy: boolean;
  hasAudio: boolean;
}

export interface Revision {
  id: string;
  revision: number;
  payload: SpeciesPayload;
  validationState: ValidationState;
  editedBy: string;
  editedAt: string;
  validatedBy: string | null;
  validatedAt: string | null;
  reason: string;
}

export interface DashboardStats {
  activeSpecies: number;
  retiredSpecies: number;
  unreviewedSpecies: number;
  withImage: number;
  withAudio: number;
  pendingMedia: number;
  dirtyChanges: boolean;
  lastRelease: string | null;
  lastPublishedAt: string | null;
}

export interface MediaAsset {
  id: string;
  jobId: string | null;
  speciesId: string;
  speciesName: string;
  kind: 'image' | 'audio';
  state: 'incoming' | 'processing' | 'pending' | 'ready' | 'failed' | 'rejected' | 'archived';
  author: string;
  license: 'CC0' | 'CC-BY-4.0' | 'permission' | 'legacy';
  originalLicense: string | null;
  externalId: string | null;
  authorizationEvidenceRef: string | null;
  sourceUrl: string;
  uploadedBy: string;
  createdAt: string;
  error: string | null;
}

export interface CatalogRelease {
  id: string;
  dataVersion: number;
  status: 'pending' | 'building' | 'published' | 'failed';
  requestedBy: string;
  requestedAt: string;
  publishedAt: string | null;
  speciesCount: number | null;
  databaseSize: number | null;
  qualityReportUrl: string | null;
  error: string | null;
}

export interface UserReport {
  id: string;
  kind: 'review' | 'bug' | 'suggestion';
  speciesId: string | null;
  description: string;
  area: 'species' | 'general' | 'app' | 'games';
  platform: 'android' | 'ios' | 'web' | 'unknown';
  appVersion: string | null;
  referenceUrl: string | null;
  speciesName: string | null;
  catalogCode: string | null;
  reporterName: string | null;
  state: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  reporterId: string;
  createdAt: string;
  resolutionNote: string | null;
}

export interface ChangeRequest {
  id: string;
  speciesId: string | null;
  catalogCode: string | null;
  scientificName: string | null;
  commonName: string | null;
  changeType: 'create' | 'update' | 'media';
  currentValues: Record<string, unknown>;
  proposedChanges: Record<string, unknown>;
  proposedBy: string;
  proposedByName: string;
  comment: string;
  createdAt: string;
  imageUrl: string | null;
}

export interface NavigationCounts {
  pendingReviews: number;
  pendingContent: number;
  openReports: number;
}

export interface HomeNews {
  id: string;
  title: string;
  source: string;
  articleUrl: string;
  imageUrl: string | null;
  publishedAt: string | null;
  status: 'draft' | 'published' | 'archived';
  sortOrder: number;
  updatedAt: string;
}

export type CollaboratorApplicationStatus = 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'withdrawn';
export interface CollaboratorApplication {
  id: string;
  contactName: string;
  contactEmail: string;
  interests: string[];
  experience: string;
  motivation: string;
  availability: string;
  referenceUrl: string | null;
  status: CollaboratorApplicationStatus;
  reviewerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export const emptySpeciesPayload = (): SpeciesPayload => ({
  scientificName: '', acceptedName: '', commonNames: [],
  taxonomy: { kingdom: 'Animalia', phylum: 'Chordata', class: '', order: '', family: '', genus: '' },
  origin: 'unknown', seasonality: 'unknown',
  abundanceStatus: '', conservation: { nationalRedList: { category: '', sourceCode: '', version: '', assessedAt: '' }, iucnGlobal: { category: '', sourceCode: '', version: '', assessedAt: '' }, nationalDesignations: [] },
  description: '', measurements: [],
  ecology: { habitats: [], diet: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [], depthMinM: null, depthMaxM: null, microhabitats: [], trophicRoles: [], hosts: [], plantAssociations: [], vegetationFormations: [] }, naturalHistory: null,
  relevantNote: '', fieldSources: {}, sourceReferences: [],
});
