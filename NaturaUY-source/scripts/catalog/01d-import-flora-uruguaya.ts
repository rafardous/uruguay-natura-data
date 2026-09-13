import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PATHS, ensureDirs, readJson, slug, writeJson, type CatalogImage } from './lib';

interface FloraRow {
  Familia: string;
  Nombre: string;
  Autor: string;
  'Pub.': string;
  'Hábito': string;
  'Formaciones vegetales': string;
  'Forma de vida': string;
  'Link stand alone': string;
}

const EXPECTED_SHA256 = 'b0b301134f7476e34ab2b98adabaccfd43e6cf1c62616821d68198f5e96d7956';
const FERN_FAMILIES = new Set(['Anemiaceae','Aspleniaceae','Athyriaceae','Blechnaceae','Cyatheaceae','Cystopteridaceae','Dennstaedtiaceae','Dicksoniaceae','Didymochlaenaceae','Dryopteridaceae','Equisetaceae','Gleicheniaceae','Hymenophyllaceae','Marsileaceae','Nephrolepidaceae','Ophioglossaceae','Osmundaceae','Polypodiaceae','Psilotaceae','Pteridaceae','Salviniaceae','Thelypteridaceae','Woodsiaceae']);
const LYCOPHYTE_FAMILIES = new Set(['Isoetaceae','Lycopodiaceae','Selaginellaceae']);
const GYMNOSPERM_FAMILIES = new Set(['Araucariaceae','Cupressaceae','Ephedraceae','Pinaceae']);
const FAMILY_ALIASES: Record<string, string[]> = {
  Compositae: ['Asteraceae'], Cruciferae: ['Brassicaceae'], Gramineae: ['Poaceae'],
  Labiatae: ['Lamiaceae'], Leguminosae: ['Fabaceae'], Palmae: ['Arecaceae'], Umbelliferae: ['Apiaceae'],
};

function parseCsv(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { value += '"'; index++; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[index + 1] === '\n') index++;
      row.push(value); value = ''; if (row.some(Boolean)) rows.push(row); row = [];
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function groupFor(family: string): { name: string; simpleName: string } {
  if (LYCOPHYTE_FAMILIES.has(family)) return { name: 'Lycopodiopsida', simpleName: 'Licófitas' };
  if (FERN_FAMILIES.has(family)) return { name: 'Polypodiopsida', simpleName: 'Helechos y afines' };
  if (GYMNOSPERM_FAMILIES.has(family)) return { name: 'Gymnospermae', simpleName: 'Gimnospermas' };
  return { name: 'Angiospermae', simpleName: 'Plantas con flor' };
}

function list(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.replace(/\u00a0/gu, ' ').replace(/\s+/gu, ' ').trim()).filter(Boolean))];
}

function publishableImage(image: CatalogImage | null | undefined): CatalogImage | null {
  if (!image) return null;
  const expectedLicenseUrl = image.license === 'CC0'
    ? 'https://creativecommons.org/publicdomain/zero/1.0/'
    : image.license === 'CC-BY-4.0'
      ? 'https://creativecommons.org/licenses/by/4.0/'
      : null;
  return expectedLicenseUrl && image.licenseUrl === expectedLicenseUrl
    && image.width && image.height && Math.max(image.width, image.height) >= 1200 ? image : null;
}

function main(): void {
  ensureDirs();
  const bytes = readFileSync(PATHS.floraUruguaya);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  if (checksum !== EXPECTED_SHA256) throw new Error(`Flora Uruguaya checksum mismatch: ${checksum}`);
  const parsed = parseCsv(bytes.toString('utf8'));
  const header = parsed.shift();
  if (!header || header.join('|') !== 'Familia|Nombre|Autor|Pub.|Hábito|Formaciones vegetales|Forma de vida|Link stand alone') throw new Error('Unexpected Flora Uruguaya columns');
  const rows = parsed.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index]?.normalize('NFC').trim() ?? ''])) as unknown as FloraRow);
  const media = existsSync(PATHS.media) ? readJson<Record<string, CatalogImage | null>>(PATHS.media) : {};
  const seen = new Set<string>();
  const catalog = rows.map((row) => {
    if (!/^(?:×\s+)?[A-Z][\p{L}-]+\s+(?:(?:x|×)\s+)?[a-z][\p{L}-]+/u.test(row.Nombre)) throw new Error(`Invalid species name: ${row.Nombre}`);
    const key = row.Nombre.toLocaleLowerCase('es');
    if (seen.has(key)) throw new Error(`Duplicate Flora Uruguaya name: ${row.Nombre}`);
    seen.add(key);
    const nameParts = row.Nombre.split(/\s+/u);
    const genus = nameParts[0] === '×' ? nameParts[1]! : nameParts[0]!;
    const formations = list(row['Formaciones vegetales']);
    const group = groupFor(row.Familia);
    const habit = row['Hábito'] || null;
    const lifeForm = row['Forma de vida'] || null;
    const descriptionParts = [habit ? `${habit.charAt(0).toUpperCase()}${habit.slice(1)}` : null, formations.length ? `registrada en ${formations.join(', ')}` : null].filter(Boolean);
    const record = row['Link stand alone'] || row.Nombre;
    const image = publishableImage(media[row.Nombre]);
    const fieldPaths = ['taxonomy.kingdom','taxonomy.phylum','taxonomy.class','taxonomy.family','taxonomy.genus','presence'];
    if (habit) fieldPaths.push('naturalHistory.plant.habit','description');
    if (lifeForm) fieldPaths.push('naturalHistory.plant.lifeForm');
    if (formations.length) fieldPaths.push('habitat','naturalHistory.plant.vegetationFormations','description');
    return {
      id: `plant-${slug(row.Nombre)}`,
      catalogCode: `plant-${slug(row.Nombre)}`,
      scientificName: row.Nombre,
      acceptedName: null,
      commonName: null,
      commonNames: [],
      taxonomy: { kingdom: 'Plantae', phylum: 'Tracheophyta', class: group.name, order: null, family: row.Familia, genus },
      origin: null,
      presenceCertainty: 'confirmed',
      seasonality: null,
      abundanceStatus: null,
      description: descriptionParts.length ? `${descriptionParts.join(' ')}.` : null,
      habitat: formations,
      diet: null,
      size: null,
      relevantNote: null,
      traits: { measurements: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [], depthMinM: null, depthMaxM: null, sources: [] },
      taxonIdentifiers: {},
      naturalHistory: { version: 1, plant: { habit, lifeForm, vegetationFormations: formations, nomenclature: { authorship: row.Autor || null, publication: row['Pub.'] || null, familyAliases: FAMILY_ALIASES[row.Familia] ?? [] }, sources: [{ source: 'flora_uruguaya', record, fieldPath: 'naturalHistory.plant' }] } },
      distributionSummary: { country: 'Uruguay', confidence: 'high' },
      media: { image, audio: null },
      sources: [
        ...fieldPaths.map((fieldPath) => ({ source: 'flora_uruguaya', record, fieldPath })),
        ...(image ? [{ source: image.source, record: image.sourcePage ?? image.externalId ?? row.Nombre, fieldPath: 'media.image' }] : []),
      ],
      reviewStatus: 'source_accepted',
    };
  }).sort((left, right) => left.scientificName.localeCompare(right.scientificName, 'es'));
  writeJson(resolve(PATHS.catalog, 'plantae.json'), catalog);
  writeJson(resolve(PATHS.reports, 'flora-uruguaya-import.json'), {
    source: 'flora_uruguaya', version: '1.3', sha256: checksum, inputRows: rows.length,
    publishedSpecies: catalog.length, duplicates: 0, excluded: 0,
    images: catalog.filter((item) => item.media.image).length,
    groups: Object.fromEntries([...new Set(catalog.map((item) => item.taxonomy.class))].sort().map((group) => [group, catalog.filter((item) => item.taxonomy.class === group).length])),
  });
  console.log(`01d-import-flora-uruguaya: ${catalog.length} species from ${rows.length} rows`);
}

main();
