/**
 * Promueve en lote únicamente candidatos observados, exactos y redistribuibles.
 * Los sinónimos, imputaciones y fuentes review_only quedan en el informe.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const catalogDir = resolve(root, 'data/catalog');
const reportPath = resolve(root, 'data/reports/trait-enrichment-candidates.json');
const files = ['aves', 'mammalia', 'amphibia', 'actinopterygii', 'chondrichthyes', 'reptilia'];
const allowed = new Set(['avonet', 'tetrapodtraits3', 'amphibio', 'fishmorph']);
const catalogs = new Map();
for (const file of files) {
  const path = resolve(catalogDir, `${file}.json`);
  const rows = JSON.parse(readFileSync(path, 'utf8'));
  catalogs.set(path, rows);
}
const byId = new Map([...catalogs.values()].flat().map((row) => [row.id, row]));
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const applied = new Map();
const rank = { avonet: 0, tetrapodtraits3: 1, amphibio: 2, fishmorph: 3 };

const mergeUnique = (left, right, key = (value) => JSON.stringify(value)) => {
  const values = [...(left ?? []), ...(right ?? [])];
  return [...new Map(values.map((value) => [key(value), value])).values()];
};

for (const candidate of report.candidates) {
  if (candidate.decision !== 'update' || candidate.taxonomicMatch !== 'exact' || !allowed.has(candidate.sourceCode)) continue;
  const species = byId.get(candidate.speciesId);
  if (!species) continue;
  const state = applied.get(species.id) ?? { traits: null, habitat: null, diet: null, sourceCodes: new Set(), fields: 0 };
  state.sourceCodes.add(candidate.sourceCode);
  state.fields += 1;
  if (candidate.fieldPath === 'traits') {
    const next = candidate.proposedValue;
    if (!state.traits || rank[candidate.sourceCode] < rank[state.traits.sourceCode]) {
      state.traits = { ...next, sourceCode: candidate.sourceCode };
    } else {
      state.traits = {
        ...state.traits,
        measurements: mergeUnique(state.traits.measurements, next.measurements, (value) => `${value.kind}:${value.value}:${value.unit}:${value.basis ?? ''}`),
        lifeModes: mergeUnique(state.traits.lifeModes, next.lifeModes),
        activity: mergeUnique(state.traits.activity, next.activity),
        aquaticEnvironments: mergeUnique(state.traits.aquaticEnvironments, next.aquaticEnvironments),
        waterZones: mergeUnique(state.traits.waterZones, next.waterZones),
        sources: mergeUnique(state.traits.sources, next.sources),
        depthMinM: state.traits.depthMinM ?? next.depthMinM ?? null,
        depthMaxM: state.traits.depthMaxM ?? next.depthMaxM ?? null,
      };
    }
  } else if (candidate.fieldPath === 'habitat' || candidate.fieldPath === 'diet') {
    const current = state[candidate.fieldPath];
    if (!current || rank[candidate.sourceCode] < rank[current.sourceCode]) state[candidate.fieldPath] = { value: candidate.proposedValue, sourceCode: candidate.sourceCode };
  }
  applied.set(species.id, state);
}

const label = { body_length: 'Largo corporal', max_length: 'Longitud máxima', body_mass: 'Masa', wing_length: 'Ala', tail_length: 'Cola', tarsus_length: 'Tarso' };
for (const [id, state] of applied) {
  const species = byId.get(id);
  if (!species || !state.traits) continue;
  const { sourceCode, ...traits } = state.traits;
  traits.sources = mergeUnique(traits.sources, [...state.sourceCodes]);
  species.traits = traits;
  if (state.habitat) species.habitat = state.habitat.value;
  if (state.diet) species.diet = state.diet.value;
  species.size = ((traits.measurements ?? []).map((measurement) => `${label[measurement.kind] ?? measurement.kind}: ${measurement.value} ${measurement.unit}`).join(' · ') || species.size || null);
}

for (const [path, rows] of catalogs) writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ candidates: report.candidates.length, approvedSpecies: applied.size, updatedFields: [...applied.values()].reduce((sum, value) => sum + value.fields, 0), excluded: report.candidates.length - [...applied.values()].reduce((sum, value) => sum + value.fields, 0) }));
