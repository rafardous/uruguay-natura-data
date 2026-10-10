import { resolve } from 'node:path';

import { PATHS, readJson } from './lib';

export type MeasurementKind = 'body_length' | 'max_length' | 'body_mass' | 'wing_length' | 'tail_length' | 'tarsus_length';
export type MeasurementBasis = 'body_length' | 'TL' | 'SL' | 'FL' | 'SVL' | null;

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

interface LegacyBirdFile { measurements: Array<{ catalogCode: string; scientificName: string; valueMm: number }> }

const EMPTY_ECOLOGY: SpeciesEcology = {
  habitats: [], diet: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [],
  depthMinM: null, depthMaxM: null, microhabitats: [], trophicRoles: [], hosts: [],
  plantAssociations: [], vegetationFormations: [],
};

const legacyBirds = readJson<LegacyBirdFile>(resolve(PATHS.catalog, '../raw/legacy/bird-body-lengths.json'));
const legacyBirdLength = new Map(legacyBirds.measurements.flatMap((row) => [
  [row.scientificName.toLocaleLowerCase('es'), row.valueMm] as const,
  [row.catalogCode.toLocaleLowerCase('es'), row.valueMm] as const,
]));

const residualMeasurements = new Map<string, SpeciesMeasurement[]>([
  ['Acanthochelys spixii', [{ kind: 'max_length', value: 170, unit: 'mm', basis: null, estimated: true, sourceCode: 'legacy_catalog', sourceRecordId: 'A_spixii', provenance: 'legacy_unverified' }]],
  ['Potamotrygon brachyura', [{ kind: 'max_length', value: 750, unit: 'mm', basis: null, estimated: true, sourceCode: 'legacy_catalog', sourceRecordId: 'P_brachyur', provenance: 'legacy_unverified' }]],
  ['Rhinella diptycha', [
    { kind: 'body_length', value: 184.8, unit: 'mm', basis: 'body_length', estimated: true, sourceCode: 'legacy_catalog', sourceRecordId: 'Rhi_schnei', provenance: 'legacy_unverified' },
    { kind: 'body_mass', value: 500, unit: 'g', basis: null, estimated: true, sourceCode: 'legacy_catalog', sourceRecordId: 'Rhi_schnei', provenance: 'legacy_unverified' },
  ]],
]);

const strings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
  : [];

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.normalize('NFKC').toLocaleLowerCase('es');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
  ? value as Record<string, unknown> : {};

export function schema14Fields(input: Record<string, unknown>, scientificName: string, catalogCode: string, taxonomicClass: string): {
  measurements: SpeciesMeasurement[];
  ecology: SpeciesEcology;
  naturalHistory: Record<string, unknown> | null;
} {
  const oldTraits = object(input.traits);
  const providedMeasurements = Array.isArray(input.measurements) ? input.measurements : oldTraits.measurements;
  const traitSources = strings(oldTraits.sources);
  const measurements: SpeciesMeasurement[] = Array.isArray(providedMeasurements) ? providedMeasurements.flatMap((candidate) => {
    const row = object(candidate);
    const value = typeof row.value === 'number' ? row.value : Number.NaN;
    const kind = row.kind as MeasurementKind;
    const unit = row.unit as 'mm' | 'g';
    if (!['body_length','max_length','body_mass','wing_length','tail_length','tarsus_length'].includes(kind) || !Number.isFinite(value) || value <= 0 || !['mm','g'].includes(unit)) return [];
    const sourceCode = typeof row.sourceCode === 'string' && row.sourceCode ? row.sourceCode : traitSources[0] ?? 'legacy_catalog';
    const legacy = sourceCode === 'legacy_catalog';
    return [{
      kind, value, unit,
      basis: (row.basis ?? null) as MeasurementBasis,
      estimated: typeof row.estimated === 'boolean' ? row.estimated : legacy,
      sourceCode,
      sourceRecordId: typeof row.sourceRecordId === 'string' ? row.sourceRecordId : null,
      provenance: row.provenance === 'legacy_unverified' || legacy ? 'legacy_unverified' : 'verified',
    }];
  }) : [];

  if (taxonomicClass === 'Aves' && !measurements.some((item) => item.kind === 'body_length')) {
    const value = legacyBirdLength.get(scientificName.toLocaleLowerCase('es')) ?? legacyBirdLength.get(catalogCode.toLocaleLowerCase('es'));
    if (value) measurements.unshift({ kind: 'body_length', value, unit: 'mm', basis: 'body_length', estimated: true, sourceCode: 'legacy_catalog', sourceRecordId: catalogCode, provenance: 'legacy_unverified' });
  }
  if (measurements.length === 0) measurements.push(...(residualMeasurements.get(scientificName) ?? []));

  const oldEcology = object(input.ecology);
  const naturalHistory = object(input.naturalHistory);
  const arthropod = object(naturalHistory.arthropod);
  const arthropodEcology = object(arthropod.ecology);
  const plant = object(naturalHistory.plant);
  const ecology: SpeciesEcology = {
    ...EMPTY_ECOLOGY,
    habitats: unique([...strings(oldEcology.habitats), ...strings(input.habitat)]),
    diet: unique([...strings(oldEcology.diet), ...strings(input.diet)]),
    lifeModes: unique([...strings(oldEcology.lifeModes), ...strings(oldTraits.lifeModes)]),
    activity: unique([...strings(oldEcology.activity), ...strings(oldTraits.activity), ...strings(arthropodEcology.activity)]),
    aquaticEnvironments: unique([...strings(oldEcology.aquaticEnvironments), ...strings(oldTraits.aquaticEnvironments)]),
    waterZones: unique([...strings(oldEcology.waterZones), ...strings(oldTraits.waterZones)]),
    depthMinM: typeof oldEcology.depthMinM === 'number' ? oldEcology.depthMinM : typeof oldTraits.depthMinM === 'number' ? oldTraits.depthMinM : null,
    depthMaxM: typeof oldEcology.depthMaxM === 'number' ? oldEcology.depthMaxM : typeof oldTraits.depthMaxM === 'number' ? oldTraits.depthMaxM : null,
    microhabitats: unique([...strings(oldEcology.microhabitats), ...strings(arthropodEcology.microhabitat)]),
    trophicRoles: unique([...strings(oldEcology.trophicRoles), ...strings(arthropodEcology.trophicRole)]),
    hosts: unique([...strings(oldEcology.hosts), ...strings(arthropodEcology.hosts)]),
    plantAssociations: unique([...strings(oldEcology.plantAssociations), ...strings(arthropodEcology.plantAssociations)]),
    vegetationFormations: unique([...strings(oldEcology.vegetationFormations), ...strings(plant.vegetationFormations)]),
  };

  if ('ecology' in arthropod) delete arthropod.ecology;
  if ('vegetationFormations' in plant) delete plant.vegetationFormations;
  if (Object.keys(arthropod).length) naturalHistory.arthropod = arthropod;
  if (Object.keys(plant).length) naturalHistory.plant = plant;
  return { measurements, ecology, naturalHistory: Object.keys(naturalHistory).length ? naturalHistory : null };
}
