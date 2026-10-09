import { resolve } from 'node:path';

import { PATHS, readJson, writeJson } from './lib';

type Evidence = { scientificName: string; sourceUrl: string; originLabel: string | null; habit: string | null; lifeForm: string | null; habitat: string | null };
type Plant = { id: string; scientificName: string; origin: string | null; naturalHistory: { plant?: { habit?: string | null; lifeForm?: string | null } } };

const evidence = readJson<{ records: Evidence[] }>(PATHS.curatedPlantPageEvidence).records;
const plants = readJson<Plant[]>(resolve(PATHS.catalog, 'plantae.json'));
if (plants.length !== 100 || evidence.length !== 100) throw new Error('El enriquecimiento botánico requiere exactamente 100 especies');
const byName = new Map(evidence.map((item) => [item.scientificName, item]));
const candidates: Array<Record<string, unknown>> = [];
const gaps: Array<{ scientificName: string; fields: string[] }> = [];
for (const plant of plants) {
  const item = byName.get(plant.scientificName);
  if (!item) throw new Error(`Falta registro de fuente para ${plant.scientificName}`);
  const missing: string[] = [];
  const add = (fieldPath: string, currentValue: unknown, proposedValue: unknown, rationale: string) => {
    if (proposedValue === null || proposedValue === currentValue) return;
    candidates.push({ speciesId: plant.id, scientificName: plant.scientificName, fieldPath, currentValue, proposedValue,
      sourceCode: 'flora_uruguaya', sourceRecordId: item.sourceUrl, confidence: 0.9, decision: 'review', rationale });
  };
  const native = ['Nativa', 'Endémica regional', 'Endémica nacional'].includes(item.originLabel ?? '');
  if (native) add('origin', plant.origin, 'native', `Flora Uruguaya indica ${item.originLabel}; requiere aprobación editorial.`);
  else missing.push('origin');
  if (item.habit) add('naturalHistory.plant.habit', plant.naturalHistory.plant?.habit ?? null, item.habit, 'Hábito indicado en la ficha de Flora Uruguaya.');
  else missing.push('habit');
  if (item.lifeForm) add('naturalHistory.plant.lifeForm', plant.naturalHistory.plant?.lifeForm ?? null, item.lifeForm, 'Forma de vida indicada en la ficha de Flora Uruguaya.');
  else missing.push('lifeForm');
  missing.push('heightCm', 'floweringMonths', 'fruitingMonths', 'approvedPhoto');
  gaps.push({ scientificName: plant.scientificName, fields: missing });
}
writeJson(resolve(PATHS.reports, 'plant-enrichment-candidates.json'), {
  schemaVersion: 1, generatedAt: new Date().toISOString(), targetClasses: ['Plantae'],
  sourceVersions: { flora_uruguaya: 'v1.3 / fichas consultadas 2026-09-23' },
  candidateCount: candidates.length, candidates, gaps,
  guidance: {
    heightCm: ['Guía de identificación de especies arbóreas nativas de Uruguay (Ministerio de Ambiente)', 'Guía de jardinería ecológica para las zonas costeras de Uruguay'],
    phenology: ['Flora Uruguaya Online: revisar el calendario visual de cada ficha; no inferir meses del texto extraído'],
    approvedPhoto: ['Wikimedia Commons: CC0 o CC BY 4.0 por archivo', 'iNaturalist: verificar licencia de la foto, no de la observación', 'Permiso documentado del autor'],
  },
});
console.log(`16-plant-enrichment-candidates: ${candidates.length} candidatos; ${gaps.filter((item) => item.fields.includes('origin')).length} orígenes por revisar`);
