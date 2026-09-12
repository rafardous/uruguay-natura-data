import { existsSync } from 'node:fs';

import { GROUPS, PATHS, readJson, slug, writeJson } from './lib';
import type { CatalogImage } from './lib';

interface Item {
  scientificName: string;
  evidence: Array<{
    source: string;
    sourceName: string;
    commonNames: string[];
    origin: string | null;
    sourceRecord: string | null;
    taxonomy: Record<string, string | null>;
  }>;
  resolution: {
    status: string;
    acceptedName: string | null;
    sourceStatus: string | null;
    taxonomy: Record<string, string | null>;
  };
}

interface ExistingCatalogItem {
  id: string;
  commonName?: string | null;
  commonNames?: string[];
  seasonality?: unknown;
  abundanceStatus?: unknown;
  description?: unknown;
  habitat?: unknown;
  diet?: unknown;
  size?: unknown;
  relevantNote?: unknown;
  traits?: unknown;
  media?: { image?: CatalogImage | null; audio?: unknown };
}

// GBIF's backbone historically exposes these reptile groups in `class`
// instead of `order`. They are the three orders represented by the current
// Uruguayan reptile catalogue, so normalize only this documented shape and
// leave every other unresolved order visible to the audit pipeline.
const REPTILE_ORDERS = new Set(['Crocodylia', 'Squamata', 'Testudines']);

function resolvedOrder(group: string, row: Item): string | null {
  const order = row.resolution.taxonomy.order;
  if (order) return order;
  const resolutionClass = row.resolution.taxonomy.class;
  return group === 'Reptilia' && resolutionClass && REPTILE_ORDERS.has(resolutionClass)
    ? resolutionClass
    : null;
}

function queueExisting(items: ExistingCatalogItem[]): Map<string, ExistingCatalogItem[]> {
  const byId = new Map<string, ExistingCatalogItem[]>();
  for (const item of items) {
    const queue = byId.get(item.id) ?? [];
    queue.push(item);
    byId.set(item.id, queue);
  }
  return byId;
}

function publishableImage(image: CatalogImage | null | undefined): CatalogImage | null {
  if (!image) return null;
  const expectedLicenseUrl = image.license === 'CC0'
    ? 'https://creativecommons.org/publicdomain/zero/1.0/'
    : image.license === 'CC-BY-4.0'
      ? 'https://creativecommons.org/licenses/by/4.0/'
      : null;
  return expectedLicenseUrl && image.licenseUrl === expectedLicenseUrl && image.width && image.height && Math.max(image.width, image.height) >= 1200 ? image : null;
}

const cleanCommonName = (name: string): string => name.normalize('NFC').replace(/\s+/g, ' ').trim();
const commonNameKey = (name: string): string => cleanCommonName(name).normalize('NFKC').replace(/\p{Cf}/gu, '').toLocaleLowerCase('es');

function uniqueCommonNames(names: string[]): string[] {
  const result = new Map<string, string>();
  for (const rawName of names) {
    const name = cleanCommonName(rawName);
    if (name && !result.has(commonNameKey(name))) result.set(commonNameKey(name), name);
  }
  return [...result.values()];
}

function main(): void {
  const all = readJson<Item[]>(PATHS.resolved);
  const media = existsSync(PATHS.media)
    ? readJson<Record<string, CatalogImage | null>>(PATHS.media)
    : {};
  const reportItems: Array<{ id: string; scientificName: string; commonName: string | null; commonNames: string[] }> = [];

  for (const group of GROUPS) {
    const target = `${PATHS.catalog}/${group.toLowerCase()}.json`;
    const existing = existsSync(target) ? readJson<ExistingCatalogItem[]>(target) : [];
    const existingById = queueExisting(existing);
    // An unresolved name has no accepted species name and must remain an audit
    // item, never become a guessed entry in the provisional catalogue.
    const catalog = all
      .filter((row) => row.evidence.some((evidence) => evidence.taxonomy.class === group) && row.resolution.acceptedName !== null)
      .map((row) => {
        const acceptedName = row.resolution.acceptedName!;
        const id = slug(acceptedName);
        const previous = existingById.get(id)?.shift();
        const previousNames = previous?.commonNames ?? (previous?.commonName ? [previous.commonName] : []);
        const preferredCommonName = previous?.commonName ? cleanCommonName(previous.commonName) : null;
        const commonNames = uniqueCommonNames([
          ...(preferredCommonName ? [preferredCommonName] : []),
          ...previousNames,
          ...row.evidence.flatMap((evidence) => evidence.commonNames),
        ]);
        const originEvidence = [...new Set(row.evidence.map((evidence) => evidence.origin).filter(Boolean))];
        const origin = originEvidence.length === 1 && ['native', 'introduced'].includes(originEvidence[0]!)
          ? originEvidence[0]
          : null;
        const cachedImage = publishableImage(Object.prototype.hasOwnProperty.call(media, acceptedName)
          ? media[acceptedName]
          : previous?.media?.image);
        const generated = {
          id,
          scientificName: acceptedName,
          commonName: preferredCommonName ?? commonNames[0] ?? null,
          commonNames,
          taxonomy: {
            kingdom: 'Animalia',
            phylum: 'Chordata',
            class: group,
            order: resolvedOrder(group, row),
            family: row.resolution.taxonomy.family,
            genus: row.resolution.taxonomy.genus,
          },
          origin,
          seasonality: previous?.seasonality ?? null,
          abundanceStatus: previous?.abundanceStatus ?? null,
          description: previous?.description ?? null,
          habitat: previous?.habitat ?? [],
          diet: previous?.diet ?? null,
          size: previous?.size ?? null,
          relevantNote: previous?.relevantNote ?? null,
          traits: previous?.traits ?? { measurements: [], lifeModes: [], activity: [], aquaticEnvironments: [], waterZones: [], depthMinM: null, depthMaxM: null, sources: [] },
          media: { image: cachedImage, audio: previous?.media?.audio ?? null },
          sources: row.evidence.map((evidence) => ({ source: evidence.source, record: evidence.sourceRecord })),
          reviewStatus: row.resolution.status === 'resolved' ? 'unreviewed' : 'needs_review',
        };
        // Keep editorial enrichment, but always refresh identity, taxonomy,
        // origin evidence and sources from the reproducible pipeline.
        return previous ? { ...previous, ...generated } : generated;
      });
    if (JSON.stringify(existing) !== JSON.stringify(catalog)) writeJson(target, catalog);
    reportItems.push(...catalog.map((item) => ({ id: item.id, scientificName: item.scientificName, commonName: item.commonName, commonNames: item.commonNames })));
    const withImage = catalog.filter((item) => item.media.image !== null).length;
    console.log(`  ${group}: ${catalog.length} (${withImage} with image)`);
  }
  const byId = new Map<string, typeof reportItems[number]>();
  for (const item of reportItems) {
    const previous = byId.get(item.id);
    byId.set(item.id, previous ? { ...previous, commonNames: uniqueCommonNames([previous.commonName ?? '', ...previous.commonNames, item.commonName ?? '', ...item.commonNames]) } : item);
  }
  const looseKey = (name: string) => commonNameKey(name).normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const possibleVariants = [...byId.values()].flatMap((item) => {
    const groups = new Map<string, string[]>();
    for (const name of item.commonNames) groups.set(looseKey(name), [...(groups.get(looseKey(name)) ?? []), name]);
    return [...groups.values()].filter((names) => new Set(names.map(commonNameKey)).size > 1).map((names) => ({ speciesId: item.id, scientificName: item.scientificName, names }));
  });
  writeJson(`${PATHS.reports}/common-name-report.json`, { schemaVersion: 1, generatedAt: new Date().toISOString(), speciesCount: byId.size, speciesWithAlternateNames: [...byId.values()].filter((item) => item.commonNames.length > 1).length, possibleVariants });
}

main();
