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
  seasonality?: unknown;
  abundanceStatus?: unknown;
  description?: unknown;
  habitat?: unknown;
  diet?: unknown;
  size?: unknown;
  relevantNote?: unknown;
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

function main(): void {
  const all = readJson<Item[]>(PATHS.resolved);
  const media = existsSync(PATHS.media)
    ? readJson<Record<string, CatalogImage | null>>(PATHS.media)
    : {};

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
        const commonNames = [...new Set(row.evidence.flatMap((evidence) => evidence.commonNames).map((name) => name.trim()).filter(Boolean))];
        const originEvidence = [...new Set(row.evidence.map((evidence) => evidence.origin).filter(Boolean))];
        const origin = originEvidence.length === 1 && ['native', 'introduced'].includes(originEvidence[0]!)
          ? originEvidence[0]
          : null;
        const id = slug(acceptedName);
        const previous = existingById.get(id)?.shift();
        const cachedImage = Object.prototype.hasOwnProperty.call(media, acceptedName)
          ? media[acceptedName] ?? null
          : previous?.media?.image ?? null;
        const generated = {
          id,
          scientificName: acceptedName,
          commonName: previous?.commonName ?? commonNames[0] ?? null,
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
          media: { image: cachedImage, audio: previous?.media?.audio ?? null },
          sources: row.evidence.map((evidence) => ({ source: evidence.source, record: evidence.sourceRecord })),
          reviewStatus: row.resolution.status === 'resolved' ? 'unreviewed' : 'needs_review',
        };
        // Keep editorial enrichment, but always refresh identity, taxonomy,
        // origin evidence and sources from the reproducible pipeline.
        return previous ? { ...previous, ...generated } : generated;
      });
    if (JSON.stringify(existing) !== JSON.stringify(catalog)) writeJson(target, catalog);
    const withImage = catalog.filter((item) => item.media.image !== null).length;
    console.log(`  ${group}: ${catalog.length} (${withImage} with image)`);
  }
}

main();
