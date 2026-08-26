export type Role = 'admin' | 'collaborator';
export type Lifecycle = 'active' | 'retired';
export type ValidationState = 'unreviewed' | 'validated' | 'needs_review';
export type ConservationCategory = 'NE' | 'DD' | 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  active: boolean;
  mfaRequired: boolean;
}

export interface TaxonomyPayload {
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
}

export interface ConservationPayload {
  system: string;
  category: ConservationCategory;
  source: string;
  assessedAt: string;
}

export interface FieldSourcePayload {
  fieldPath: string;
  name: string;
  citation: string;
  url: string;
  note: string;
}

export interface SpeciesPayload {
  scientificName: string;
  acceptedName: string;
  commonNames: string[];
  taxonomy: TaxonomyPayload;
  origin: 'native' | 'introduced' | 'unknown';
  establishment: 'established' | 'casual' | 'uncertain';
  seasonality: 'resident' | 'migratory' | 'occasional' | 'unknown';
  presenceCertainty: 'confirmed' | 'probable' | 'uncertain';
  abundanceStatus: string;
  conservation: ConservationPayload;
  description: string;
  habitat: string[];
  diet: string[];
  size: string;
  relevantNote: string;
  fieldSources: FieldSourcePayload[];
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
  dirtyChanges: number;
  lastRelease: string | null;
  lastPublishedAt: string | null;
}

export interface MediaAsset {
  id: string;
  jobId: string | null;
  speciesId: string;
  speciesName: string;
  kind: 'image' | 'audio';
  state: 'incoming' | 'processing' | 'ready' | 'failed' | 'retired';
  author: string;
  license: 'CC0' | 'CC-BY-4.0' | 'permission' | 'legacy';
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
  kind: 'data_error' | 'app_bug';
  catalogCode: string | null;
  description: string;
  appVersion: string;
  platform: string;
  state: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  reporterName: string;
  reporterAlias: string | null;
  createdAt: string;
}

export const emptySpeciesPayload = (): SpeciesPayload => ({
  scientificName: '', acceptedName: '', commonNames: [],
  taxonomy: { kingdom: 'Animalia', phylum: 'Chordata', class: '', order: '', family: '', genus: '' },
  origin: 'unknown', establishment: 'uncertain', seasonality: 'unknown', presenceCertainty: 'uncertain',
  abundanceStatus: '', conservation: { system: 'UICN', category: 'NE', source: '', assessedAt: '' },
  description: '', habitat: [], diet: [], size: '', relevantNote: '', fieldSources: [],
});
