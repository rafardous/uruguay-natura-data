import type { CatalogRelease, DashboardStats, MediaAsset, Profile, Revision, SpeciesSummary } from '../domain';

export const demoProfile: Profile = {
  id: '00000000-0000-4000-8000-000000000001', displayName: 'Rafael Rinaldi',
  email: 'rafael@natura.uy', role: 'admin', active: true, mfaRequired: false,
};

const base = {
  acceptedName: '', commonNames: [] as string[],
  taxonomy: { kingdom: 'Animalia', phylum: 'Chordata', class: 'Aves', order: '', family: '', genus: '' },
  origin: 'native' as const, establishment: 'established' as const, seasonality: 'resident' as const,
  presenceCertainty: 'confirmed' as const, abundanceStatus: '',
  conservation: { system: 'UICN', category: 'NE' as const, source: '', assessedAt: '' },
  description: '', habitat: [] as string[], diet: [] as string[], size: '', relevantNote: '', fieldSources: [] as Array<{ fieldPath: string; name: string; citation: string; url: string; note: string }>,
};

const rows = [
  ['accipiter-bicolor', 'A_bicolor', 'Gavilán bicolor', 'Accipiter bicolor', 'Accipitriformes', 'Accipitridae', 'Accipiter', 'needs_review', true],
  ['actitis-macularius', 'A_maculari', 'Playerito manchado', 'Actitis macularius', 'Charadriiformes', 'Scolopacidae', 'Actitis', 'validated', true],
  ['aegolius-harrisii', 'A_harrisii', 'Lechucita canela', 'Aegolius harrisii', 'Strigiformes', 'Strigidae', 'Aegolius', 'needs_review', true],
  ['agelaioides-badius', 'A_badius', 'Músico', 'Agelaioides badius', 'Passeriformes', 'Icteridae', 'Agelaioides', 'unreviewed', true],
  ['melanophryniscus-montevidensis', 'M_montevi', 'Sapito de Darwin', 'Melanophryniscus montevidensis', 'Anura', 'Bufonidae', 'Melanophryniscus', 'unreviewed', false],
  ['hydrochoerus-hydrochaeris', 'H_hydrocha', 'Carpincho', 'Hydrochoerus hydrochaeris', 'Rodentia', 'Caviidae', 'Hydrochoerus', 'validated', true],
] as const;

export let demoSpecies: SpeciesSummary[] = rows.map((row, index) => ({
  id: row[0], catalogCode: row[1], lifecycle: 'active', revision: index + 1,
  validationState: row[7], validatedBy: row[7] === 'validated' ? 'Agustín Morelle' : null,
  validatedAt: row[7] === 'validated' ? new Date(Date.now() - 86400000).toISOString() : null,
  payload: {
    ...base, scientificName: row[3], acceptedName: row[3], commonNames: [row[2]],
    taxonomy: { ...base.taxonomy, order: row[4], family: row[5], genus: row[6], class: row[4] === 'Anura' ? 'Amphibia' : row[4] === 'Rodentia' ? 'Mammalia' : 'Aves' },
  },
  updatedAt: new Date(Date.now() - index * 7200000).toISOString(), updatedBy: index % 2 ? 'Agustín Morelle' : 'Rafael Rinaldi',
  imageUrl: row[8] ? `https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=160&q=60&sig=${index}` : null,
  hasAudio: index === 1,
}));

export const demoStats: DashboardStats = {
  activeSpecies: 902, retiredSpecies: 0, unreviewedSpecies: 902, withImage: 863,
  withAudio: 0, pendingMedia: 3, dirtyChanges: 17, lastRelease: '24',
  lastPublishedAt: new Date(Date.now() - 172800000).toISOString(),
};

export const demoMedia: MediaAsset[] = [
  { id: 'm1', jobId: null, speciesId: 'actitis-macularius', speciesName: 'Playerito manchado', kind: 'image', state: 'ready', author: 'RJ Baltierra', license: 'CC-BY-4.0', sourceUrl: '', uploadedBy: 'Rafael Rinaldi', createdAt: new Date().toISOString(), error: null },
  { id: 'm2', jobId: 'j2', speciesId: 'accipiter-bicolor', speciesName: 'Gavilán bicolor', kind: 'image', state: 'processing', author: 'Archivo Natura UY', license: 'CC-BY-4.0', sourceUrl: '', uploadedBy: 'Agustín Morelle', createdAt: new Date().toISOString(), error: null },
  { id: 'm3', jobId: 'j3', speciesId: 'aegolius-harrisii', speciesName: 'Lechucita canela', kind: 'audio', state: 'failed', author: 'Donación particular', license: 'permission', sourceUrl: '', uploadedBy: 'Rafael Rinaldi', createdAt: new Date().toISOString(), error: 'El archivo supera los 15 minutos permitidos.' },
];

export const demoReleases: CatalogRelease[] = [
  { id: 'r24', dataVersion: 24, status: 'published', requestedBy: 'Rafael Rinaldi', requestedAt: new Date(Date.now() - 172900000).toISOString(), publishedAt: new Date(Date.now() - 172800000).toISOString(), speciesCount: 902, databaseSize: 1604321, qualityReportUrl: '#', error: null },
  { id: 'r23', dataVersion: 23, status: 'published', requestedBy: 'Agustín Morelle', requestedAt: new Date(Date.now() - 604900000).toISOString(), publishedAt: new Date(Date.now() - 604800000).toISOString(), speciesCount: 1001, databaseSize: 1589200, qualityReportUrl: '#', error: null },
];

export function demoRevisions(species: SpeciesSummary): Revision[] {
  return [
    { id: `${species.id}-r${species.revision}`, revision: species.revision, payload: species.payload, validationState: species.validationState, editedBy: species.updatedBy, editedAt: species.updatedAt, validatedBy: species.validatedBy, validatedAt: species.validatedAt, reason: 'Actualización editorial' },
    { id: `${species.id}-r1`, revision: 1, payload: species.payload, validationState: 'unreviewed', editedBy: 'Importación inicial', editedAt: new Date(Date.now() - 2592000000).toISOString(), validatedBy: null, validatedAt: null, reason: 'Importación del catálogo existente' },
  ];
}
