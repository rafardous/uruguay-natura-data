import { GROUPS, PATHS, cleanName, ensureDirs, readDwcaCore, readJson, writeJson } from './lib';

type SourceId = 'biodiversidata' | 'ministerio' | 'snap';
interface Evidence { source: SourceId; sourceName: string; scientificName: string; commonNames: string[]; taxonomy: Record<string, string | null>; origin: string | null; sourceRecord: string | null; }
interface Candidate { scientificName: string; class: string | null; evidence: Evidence[]; }
const wanted = new Set<string>(GROUPS);
const taxonomy = (row: Record<string, string | null>) => ({ kingdom: row.kingdom ?? null, phylum: row.phylum ?? null, class: row.class ?? null, order: row.order ?? null, family: row.family ?? null, genus: row.genus ?? null });
function add(map: Map<string, Candidate>, evidence: Evidence): void {
  const key = evidence.scientificName.toLowerCase(); const existing = map.get(key);
  if (existing) existing.evidence.push(evidence); else map.set(key, { scientificName: evidence.scientificName, class: evidence.taxonomy.class ?? null, evidence: [evidence] });
}
function fromDwca(file: string, source: SourceId, sourceName: string): Evidence[] {
  return readDwcaCore(file).flatMap((row) => {
    const name = cleanName(row.scientificName ?? row.acceptedNameUsage); const clazz = row.class;
    if (!name || !clazz || !wanted.has(clazz)) return [];
    return [{ source, sourceName, scientificName: name, commonNames: [row.vernacularName].filter((x): x is string => Boolean(x)), taxonomy: taxonomy(row), origin: row.establishmentMeans ?? null, sourceRecord: row.taxonID ?? row.occurrenceID ?? null }];
  });
}
function historical(): Evidence[] {
  return readJson<Array<{ codigo: string; nombres_comunes: string[]; clase: string; orden: string; familia: string; genero: string; epiteto_especifico: string; nativa: boolean }>>(PATHS.historical).flatMap((row) => {
    if (!wanted.has(row.clase)) return []; const name = cleanName(`${row.genero} ${row.epiteto_especifico}`); if (!name) return [];
    // `false` only states that the historical field did not mark it native;
    // it is not enough evidence to assert a specific introduced origin.
    return [{ source: 'snap', sourceName: 'SNAP historical export', scientificName: name, commonNames: row.nombres_comunes.filter(Boolean), taxonomy: { kingdom: 'Animalia', phylum: 'Chordata', class: row.clase, order: row.orden || null, family: row.familia || null, genus: row.genero || null }, origin: row.nativa ? 'native' : null, sourceRecord: row.codigo }];
  });
}
function main(): void {
  ensureDirs(); const records = [...fromDwca(PATHS.biodiversity, 'biodiversidata', 'Biodiversidata: Tetrápodos de Uruguay'), ...fromDwca(PATHS.ministry, 'ministerio', 'Ministerio de Ambiente: Listas Rojas'), ...historical()];
  const map = new Map<string, Candidate>(); records.forEach((record) => add(map, record));
  const candidates = [...map.values()].sort((a, b) => a.scientificName.localeCompare(b.scientificName));
  writeJson(PATHS.candidates, candidates);
  writeJson(`${PATHS.normalized}/normalization-summary.json`, { recordsRead: records.length, uniqueNames: candidates.length, bySource: Object.fromEntries(['biodiversidata', 'ministerio', 'snap'].map((id) => [id, records.filter((x) => x.source === id).length])) });
  console.log(`02-normalize: ${records.length} source records -> ${candidates.length} unique candidate names`);
}
main();
