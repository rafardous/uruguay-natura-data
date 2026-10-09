/** Buscar candidatas redistribuibles para los artrópodos ya presentes en el catálogo. */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findImage } from './05-media';
import { PATHS, readJson, writeJson, type CatalogImage } from './lib';

const CLASSES = ['Arachnida', 'Insecta', 'Malacostraca'] as const;
type ClassName = (typeof CLASSES)[number];
type Arthropod = {
  scientificName: string;
  acceptedName?: string | null;
  taxonomy: { class: string | null };
};

export function arthropodTargets(catalog: Record<ClassName, Arthropod[]>) {
  const targets = new Map<string, { className: ClassName; names: string[] }>();
  for (const className of CLASSES) {
    for (const species of catalog[className]) {
      if (species.taxonomy.class !== className || !species.scientificName) {
        throw new Error(`Especie inválida en ${className}: ${species.scientificName}`);
      }
      const accepted = species.acceptedName ?? species.scientificName;
      if (targets.has(accepted)) throw new Error(`Artrópodo duplicado: ${accepted}`);
      targets.set(accepted, { className, names: [species.scientificName] });
    }
  }
  return targets;
}

export function publishableCandidate(image: CatalogImage | null | undefined): image is CatalogImage {
  if (!image || !image.width || !image.height || Math.max(image.width, image.height) < 1200) return false;
  return (image.license === 'CC0' && image.licenseUrl === 'https://creativecommons.org/publicdomain/zero/1.0/')
    || (image.license === 'CC-BY-4.0' && image.licenseUrl === 'https://creativecommons.org/licenses/by/4.0/');
}

async function main(): Promise<void> {
  const catalog = Object.fromEntries(CLASSES.map((className) => [className,
    readJson<Arthropod[]>(resolve(PATHS.catalog, `${className.toLowerCase()}.json`))])) as Record<ClassName, Arthropod[]>;
  const targets = arthropodTargets(catalog);
  const cache = existsSync(PATHS.media) ? readJson<Record<string, CatalogImage | null>>(PATHS.media) : {};
  const refresh = process.argv.includes('--refresh');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Number.POSITIVE_INFINITY;
  if (!Number.isInteger(limit) && limit !== Number.POSITIVE_INFINITY || limit <= 0) throw new Error('--limit debe ser positivo');
  const pending = [...targets].filter(([name]) => refresh || !publishableCandidate(cache[name])).slice(0, limit);
  console.log(`Artrópodos: ${targets.size} especies; ${pending.length} consultas de fotos pendientes`);
  for (const [index, [name, target]] of pending.entries()) {
    const image = await findImage(name, target.names);
    const usedElsewhere = image?.externalId && Object.entries(cache).some(([other, prior]) => other !== name && prior?.externalId === image.externalId);
    cache[name] = usedElsewhere ? null : image;
    writeJson(PATHS.media, cache);
    if ((index + 1) % 10 === 0 || index + 1 === pending.length) console.log(`  ${index + 1}/${pending.length} consultadas`);
  }
  const missing = [...targets].filter(([name]) => !publishableCandidate(cache[name])).map(([scientificName, target]) => ({ scientificName, className: target.className }));
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: 'Arthropoda',
    speciesCount: targets.size,
    candidateCount: targets.size - missing.length,
    byClass: Object.fromEntries(CLASSES.map((className) => [className, {
      species: [...targets.values()].filter((target) => target.className === className).length,
      candidates: [...targets].filter(([name, target]) => target.className === className && publishableCandidate(cache[name])).length,
    }])),
    missing,
    approvalRequired: false,
  };
  writeJson(resolve(PATHS.reports, 'arthropod-image-selection-report.json'), report);
  console.log(`Fotos válidas seleccionadas automáticamente: ${report.candidateCount}/${targets.size}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
