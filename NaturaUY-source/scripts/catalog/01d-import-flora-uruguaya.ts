import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PATHS, ensureDirs, writeJson, type CatalogImage } from './lib';

type SeedEntry = { nombre: string; nombre_cientifico: string };
type Seed = { arboles: SeedEntry[]; otras_plantas_nativas: SeedEntry[] };
type Evidence = {
  scientificName: string;
  id: string;
  catalogCode: string;
  taxonomy: Record<string, string | null>;
  naturalHistory: Record<string, unknown>;
  ecology: Record<string, unknown>;
  sources: Array<{ source: string; record: string | null; fieldPath: string }>;
};

const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

function main(): void {
  ensureDirs();
  const seed = read<Seed>(PATHS.curatedPlants);
  const evidence = read<{ source: string; version: string; records: Evidence[] }>(PATHS.curatedPlantEvidence);
  if (seed.arboles.length !== 50 || seed.otras_plantas_nativas.length !== 50 || evidence.records.length !== 100) {
    throw new Error('La selección botánica debe contener 50 árboles, 50 otras plantas y 100 registros de evidencia');
  }
  const byName = new Map(evidence.records.map((item) => [item.scientificName, item]));
  const photoCache = existsSync(PATHS.media) ? read<Record<string, CatalogImage | null>>(PATHS.media) : {};
  const pagesPath = resolve(PATHS.raw, 'curated-plants/flora-page-evidence-100.json');
  const pages = existsSync(pagesPath) ? read<{ records: Array<{ scientificName: string; sourceUrl: string; originLabel: string | null }> }>(pagesPath).records : [];
  const pageByName = new Map(pages.map((page) => [page.scientificName, page]));
  const entries = [...seed.arboles, ...seed.otras_plantas_nativas];
  if (new Set(entries.map((item) => item.nombre_cientifico)).size !== 100 || byName.size !== 100) {
    throw new Error('Hay nombres científicos duplicados en la selección botánica');
  }
  const catalog = entries.map((entry) => {
    const prior = byName.get(entry.nombre_cientifico);
    if (!prior || prior.taxonomy.kingdom !== 'Plantae' || prior.taxonomy.phylum !== 'Tracheophyta') {
      throw new Error(`Falta evidencia taxonómica para ${entry.nombre_cientifico}`);
    }
    if (!prior.id || !prior.catalogCode || !prior.sources.some((source) => source.fieldPath === 'presence')) {
      throw new Error(`Falta identidad estable o evidencia de presencia para ${entry.nombre_cientifico}`);
    }
    const candidate = photoCache[entry.nombre_cientifico];
    const licenseUrl = candidate?.license === 'CC0' ? 'https://creativecommons.org/publicdomain/zero/1.0/'
      : candidate?.license === 'CC-BY-4.0' ? 'https://creativecommons.org/licenses/by/4.0/' : null;
    const image = candidate && licenseUrl && candidate.licenseUrl === licenseUrl
      && candidate.fullUrl && candidate.url && candidate.attribution && candidate.sourcePage
      && candidate.width && candidate.height && Math.max(candidate.width, candidate.height) >= 1200 ? candidate : null;
    const page = pageByName.get(entry.nombre_cientifico);
    const native = page && ['Nativa', 'Endémica regional'].includes(page.originLabel ?? '')
      && prior.sources.some((source) => source.record === page.sourceUrl && source.fieldPath === 'presence');
    return {
      id: prior.id,
      catalogCode: prior.catalogCode,
      scientificName: entry.nombre_cientifico,
      acceptedName: null,
      commonName: entry.nombre,
      commonNames: [entry.nombre],
      taxonomy: prior.taxonomy,
      origin: native ? 'native' : null,
      seasonality: null,
      abundanceStatus: null,
      description: null,
      measurements: [],
      ecology: prior.ecology,
      relevantNote: null,
      taxonIdentifiers: {},
      naturalHistory: prior.naturalHistory,
      media: { image, audio: null },
      sources: [...prior.sources, ...(native ? [{ source: 'flora_uruguaya', record: page.sourceUrl, fieldPath: 'origin' }] : []),
        { source: 'natura_uy_editorial', record: 'seed-100', fieldPath: 'commonName' }],
      reviewStatus: 'needs_review',
    };
  }).sort((a, b) => a.scientificName.localeCompare(b.scientificName, 'es'));
  if (new Set(catalog.map((item) => item.id)).size !== 100 || new Set(catalog.map((item) => item.catalogCode)).size !== 100) {
    throw new Error('La selección botánica contiene identidades duplicadas');
  }
  writeJson(resolve(PATHS.catalog, 'plantae.json'), catalog);
  writeJson(resolve(PATHS.reports, 'curated-plants-import.json'), {
    schemaVersion: 1,
    seed: 'raw/curated-plants/seed-100.json',
    evidence: 'raw/curated-plants/baseline-evidence-100.json',
    source: evidence.source,
    sourceVersion: evidence.version,
    species: catalog.length,
    nativeOriginVerified: catalog.filter((item) => item.origin === 'native').length,
    automaticImages: catalog.filter((item) => item.media.image !== null).length,
  });
  console.log(`01d-import-flora-uruguaya: ${catalog.length} especies seleccionadas`);
}

main();
