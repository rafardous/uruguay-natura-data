/** User-reviewed historical reference. Dry-run by default; never changes taxonomy. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const directory = resolve(root, 'data/reference/azpiroz-2003');
const read = (name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
const write = (name, value) => writeFileSync(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`);
export const HABITATS = { C: 'Costa', I: 'Islas y océano', P: 'Pastizales y praderas', M: 'Bosques autóctonos y palmares', PM: 'Pastizales con árboles', A: 'Ambientes acuáticos', H: 'Ambientes antrópicos' };
export const DIETS = { Hb: 'Vegetales verdes', Se: 'Semillas y granos', Fr: 'Frutos', Ne: 'Néctar', In: 'Insectos', Ib: 'Invertebrados litorales y bentónicos', Ps: 'Peces, crustáceos y otras presas acuáticas', Tp: 'Pequeños vertebrados', 'Cñ': 'Carroña' };
export const ABUNDANCE = { C: 'common', BC: 'fairly_common', PC: 'uncommon', R: 'rare' };
export const STATUS = {
  RN: { label: 'Residente todo el año', months: [1,2,3,4,5,6,7,8,9,10,11,12], note: 'Habita durante todo el año en Uruguay y se estima nidificante.' },
  RV: { label: 'Residente de verano', months: [1,2,3,9,10,11,12], note: 'Nidifica en Uruguay; presente entre setiembre y marzo.' },
  VV: { label: 'Visitante de verano', months: [1,2,3,9,10,11,12], note: 'Incluye aves de paso, principalmente entre setiembre y noviembre y entre marzo y mayo; el período es variable.' },
  VI: { label: 'Visitante de invierno', months: [4,5,6,7,8,9], note: 'Presente de abril a setiembre.' },
  V: { label: 'Visitante', months: [], note: 'La guía no establece una estacionalidad clara.' },
  DR: { label: 'Registro reciente en la guía', months: [], note: 'Reciente respecto de la edición de 2003; no implica un registro reciente en la actualidad.' },
  IN: { label: 'Introducida según la guía', months: [], note: 'Introducida o asilvestrada a partir de animales escapados del cautiverio. No reemplaza la evaluación actual de origen.' },
  O: { label: 'Ocasional', months: [], note: 'Presencia ocasional según la guía de 2003.' },
  Ex: { label: 'Extinta según la guía', months: [], note: 'Categoría histórica de la guía; no reemplaza el estado actual de conservación.' },
};

export function scientificKey(value) {
  const words = String(value ?? '').replace(/[^A-Za-z. -]/g, ' ').trim().split(/\s+/);
  // OCR sometimes prefixes a name with a lower-case fragment of its English name.
  const genusIndex = words.findIndex((word) => /^[A-Z][a-z]{2,}$/.test(word));
  const clean = words.slice(Math.max(0, genusIndex)).filter((word) => !/^[A-Za-z]\.$/.test(word));
  return clean.slice(0, 2).join(' ').toLowerCase();
}
const commonKey = (value) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseCodes(raw, dictionary, corrections = {}) {
  const original = String(raw ?? '').trim();
  if (!original || /^[-.]$/.test(original)) return { codes: [], unresolved: null };
  let text = corrections[original] ?? original;
  // Only documented separators are removed; leftover OCR characters are reported.
  text = text.replace(/[•·*\s,;#+_]/g, '');
  const keys = Object.keys(dictionary).sort((a,b) => b.length-a.length);
  const codes = [];
  while (text) {
    const key = keys.find((item) => text.toLowerCase().startsWith(item.toLowerCase()));
    if (!key) return { codes: [], unresolved: original };
    codes.push(key); text = text.slice(key.length);
  }
  return { codes: [...new Set(codes)], unresolved: null };
}

export function parseSize(row) {
  const raw = String(row.tamano_cm_guia ?? '');
  const parts = raw.split('/').map(Number);
  if (parts.some((value) => !Number.isFinite(value) || value < 5 || value > 300)) return [];
  const measures = parts.length === 2
    ? [{ kind: 'body_length', valueCm: parts[0], sex: 'male' }, { kind: 'body_length', valueCm: parts[1], sex: 'female' }]
    : [{ kind: 'body_length', valueCm: parts[0] }];
  const second = Number(row.tamano_segundo_valor_guia);
  if (second > 0) measures.push({ kind: 'wingspan', valueCm: second });
  return measures;
}

export function buildProfile(row, corrections) {
  const fields = corrections.fields ?? {};
  const habitat = parseCodes(row.habitat_guia, HABITATS, fields.habitat);
  const diet = parseCodes(row.alimentacion_guia, DIETS, fields.diet);
  const abundance = parseCodes(row.abundancia_guia, ABUNDANCE, fields.abundance);
  const rawStatus = String(row.estatus_guia ?? '').trim();
  const statusCode = fields.status?.[rawStatus] ?? Object.keys(STATUS).find((key) => key.toLowerCase() === rawStatus.replace(/["*]/g, '').toLowerCase()) ?? null;
  const measures = parseSize(row);
  const issues = [];
  for (const [field, parsed] of [['habitat',habitat],['diet',diet],['abundance',abundance]]) if (parsed.unresolved) issues.push({ field, raw: parsed.unresolved });
  if (rawStatus && !statusCode) issues.push({ field: 'presence', raw: rawStatus });
  if (!measures.length) issues.push({ field: 'measurements', raw: row.tamano_cm_guia });
  const abundanceCode = abundance.codes.length === 1 ? abundance.codes[0] : null;
  if (abundance.codes.length > 1) issues.push({ field: 'abundance', raw: row.abundancia_guia });
  const profile = {
    guide: { sourceCode: 'azpiroz_2003', year: 2003, number: row.numero_guia, page: Number(row.pagina_guia) || null, commonName: row.nombre_comun_guia, englishName: row.nombre_ingles_guia, scientificName: row.nombre_cientifico_guia },
    measurements: measures, presence: statusCode ? { code: statusCode, ...STATUS[statusCode], outsidePeriod: rawStatus.includes('*') } : null,
    habitat: habitat.codes, diet: diet.codes, abundanceCode,
  };
  return { profile, issues };
}

export function guideSize(profile) {
  return profile.measurements.filter((m) => m.kind === 'body_length').map((m) => `${m.sex === 'male' ? 'Macho: ' : m.sex === 'female' ? 'Hembra: ' : ''}${m.valueCm} cm`).join(' · ');
}

export function run(apply) {
  const original = read('original.json');
  const corrections = read('corrections.json');
  const path = resolve(root, 'data/catalog/aves.json');
  const catalog = JSON.parse(readFileSync(path, 'utf8'));
  const unique = [...new Map(catalog.map((row) => [row.id, row])).values()];
  const crosswalk = [], normalized = [], issues = [];
  for (const row of original) {
    const override = corrections.matches?.[row.numero_guia];
    let candidates = [...new Map(catalog.filter((item) => [item.scientificName, item.acceptedName].some((name) => name && scientificKey(name) === scientificKey(row.nombre_cientifico_guia))).map((item) => [item.id, item])).values()];
    let method = 'scientific';
    if (override) { candidates = unique.filter((item) => item.id === override.id); method = 'documented_alias'; }
    if (!candidates.length) { candidates = [...new Map(catalog.filter((item) => [item.commonName, ...(item.commonNames ?? [])].some((name) => commonKey(name) === commonKey(row.nombre_comun_guia))).map((item) => [item.id, item])).values()]; method = 'common_name_exact'; }
    if (corrections.excluded?.[row.numero_guia]) { candidates = []; method = 'historical_conflict'; }
    const match = candidates.length === 1 ? candidates[0] : null;
    const { profile, issues: fieldIssues } = buildProfile(row, corrections);
    const result = { number: row.numero_guia, speciesId: match?.id ?? null, scientificName: match?.scientificName ?? null, method: match ? method : corrections.excluded?.[row.numero_guia] ? 'historical_conflict' : candidates.length ? 'ambiguous' : 'unmatched', guideScientificName: row.nombre_cientifico_guia, guideCommonName: row.nombre_comun_guia, ...(override ? { rationale: override.rationale } : {}), ...(corrections.excluded?.[row.numero_guia] ? { rationale: corrections.excluded[row.numero_guia] } : {}) };
    crosswalk.push(result); normalized.push({ number: row.numero_guia, speciesId: result.speciesId, profile });
    issues.push(...fieldIssues.map((issue) => ({ number: row.numero_guia, ...issue })));
  }
  const assigned = crosswalk.filter((row) => row.speciesId).map((row) => row.speciesId);
  if (new Set(assigned).size !== assigned.length) {
    console.log(JSON.stringify(crosswalk.filter((row) => row.speciesId && assigned.filter((id) => id === row.speciesId).length > 1)));
    throw new Error('Multiple guide entries target one species; resolve before applying');
  }
  const byId = new Map(normalized.filter((row) => row.speciesId).map((row) => [row.speciesId, row.profile]));
  let changed = 0;
  for (const item of catalog) {
    const profile = byId.get(item.id); if (!profile) continue;
    const before = JSON.stringify(item);
    item.naturalHistory = { ...item.naturalHistory, version: 1, bird: profile };
    if (profile.measurements.length) item.size = guideSize(profile);
    if (profile.abundanceCode) item.abundanceStatus = ABUNDANCE[profile.abundanceCode];
    const fields = ['naturalHistory.bird.guide', ...['measurements','presence','habitat','diet','abundanceCode'].filter((field) => Array.isArray(profile[field]) ? profile[field].length : profile[field]).map((field) => `naturalHistory.bird.${field}`), ...(profile.measurements.length ? ['size'] : []), ...(profile.abundanceCode ? ['abundance_status'] : [])];
    item.sources = [...item.sources.filter((source) => source.source !== 'azpiroz_2003'), ...fields.map((fieldPath) => ({ source: 'azpiroz_2003', record: String(profile.guide.number), fieldPath }))];
    if (before !== JSON.stringify(item)) changed++;
  }
  const report = { guideRows: original.length, matchedSpecies: assigned.length, unmatched: crosswalk.filter((row) => !row.speciesId), fieldIssues: issues, changedRecords: changed };
  if (apply) { write('crosswalk.json', crosswalk); write('normalized.json', normalized); write('report.json', report); write('legend.json', { habitat: HABITATS, diet: DIETS, abundance: ABUNDANCE, presence: STATUS }); writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`); }
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run(process.argv.includes('--apply'));
