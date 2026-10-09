import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

import { GROUPS, GROUP_METADATA, PATHS, ROOT, readJson, slug, writeJson } from './lib';
import type { CatalogImage } from './lib';
import { schema14Fields } from './schema14';

interface Item {
  scientificName: string;
  evidence: Array<{
    scientificName: string;
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
    gbifUsageKey?: number;
  };
}

interface ExistingCatalogItem {
  id: string;
  scientificName?: string;
  distributionSummary?: unknown;
  establishment?: unknown;
  presenceCertainty?: unknown;
  catalogCode?: string;
  commonName?: string | null;
  commonNames?: string[];
  acceptedName?: string | null;
  seasonality?: unknown;
  abundanceStatus?: unknown;
  description?: unknown;
  habitat?: unknown;
  diet?: unknown;
  size?: unknown;
  relevantNote?: unknown;
  traits?: unknown;
  measurements?: unknown;
  ecology?: unknown;
  taxonIdentifiers?: unknown;
  naturalHistory?: unknown;
  media?: { image?: CatalogImage | null; images?: CatalogImage[]; audio?: unknown };
  sources?: Array<{ source?: string; record?: string | null }>;
}

function withoutRetiredFields(item: ExistingCatalogItem | undefined): Record<string, unknown> {
  if (!item) return {};
  const {
    size: _size, traits: _traits, habitat: _habitat, diet: _diet,
    distributionSummary: _distributionSummary, establishment: _establishment,
    presenceCertainty: _presenceCertainty, ...current
  } = item;
  return current;
}

function schema14Source(source: { source?: string; record?: string | null; fieldPath?: string }): { source?: string; record?: string | null; fieldPath?: string } {
  const path = source.fieldPath;
  const fieldPath = path === 'habitat' ? 'ecology.habitats'
    : path === 'diet' ? 'ecology.diet'
      : path === 'traits' ? 'measurements'
        : path === 'naturalHistory.arthropod.ecology' ? 'ecology'
          : path === 'naturalHistory.plant.vegetationFormations' ? 'ecology.vegetationFormations'
            : path;
  return { ...source, fieldPath };
}

function uniqueSources(sources: Array<{ source?: string; record?: string | null; fieldPath?: string }>) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.source ?? ''}|${source.record ?? ''}|${source.fieldPath ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

/**
 * One-time bootstrap for the persistent identity map. Older catalog files
 * used accepted names as their display name and therefore cannot be matched
 * by the new source name alone. Reading the committed predecessor lets the
 * first schema-11 build retain those IDs; later runs use identity-map.json.
 */
function readLegacyCatalog(group: string): ExistingCatalogItem[] {
  try {
    const output = execFileSync('git', ['show', `HEAD:NaturaUY-source/data/catalog/${group.toLowerCase()}.json`], {
      cwd: resolve(ROOT, '..'), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(output) as ExistingCatalogItem[];
  } catch {
    return [];
  }
}

/** One-time bridge from the legacy SQLite `codigo` to the schema-11 map. */
function readLegacyCodes(): Map<string, string> {
  const path = resolve(PATHS.catalog, '../../assets/db/natura.db');
  if (!existsSync(path)) return new Map();
  try {
    const db = new DatabaseSync(path, { readOnly: true });
    // La base móvil publicada se conserva hasta el próximo release, pero sus
    // 3157 plantas históricas no pueden aportar identidad al pipeline nuevo.
    const rows = db.prepare("SELECT codigo, scientific_name, accepted_name FROM species WHERE kingdom <> 'Plantae'").all() as unknown as Array<{ codigo?: string; scientific_name?: string; accepted_name?: string | null }>;
    db.close();
    const result = new Map<string, string>();
    for (const row of rows) {
      if (!row.codigo) continue;
      for (const name of [row.scientific_name, row.accepted_name]) {
        if (name) result.set(name.toLocaleLowerCase('es'), row.codigo);
      }
    }
    return result;
  } catch {
    return new Map();
  }
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
  const guideVerifiedPath = resolve(PATHS.cache, 'media/guide-bird-media.json');
  if (!existsSync(guideVerifiedPath)) throw new Error('Falta verificar fotos de la guía: ejecutar data:guide-media');
  const guideVerified = readJson<{ schemaVersion: number; bucket: string; species: Record<string, CatalogImage[]> }>(guideVerifiedPath);
  if (guideVerified.schemaVersion !== 1 || guideVerified.bucket !== 'guia-aves') throw new Error('Verificación de aves incompatible');
  const reportItems: Array<{ id: string; scientificName: string; commonName: string | null; commonNames: string[] }> = [];
  const identityMapPath = `${PATHS.normalized}/identity-map.json`;
  const identityMap = existsSync(identityMapPath) ? readJson<Record<string, { id: string; catalogCode: string }>>(identityMapPath) : {};
  const legacyCodes = readLegacyCodes();

  for (const group of GROUPS) {
    const target = `${PATHS.catalog}/${group.toLowerCase()}.json`;
    const existing = existsSync(target) ? readJson<ExistingCatalogItem[]>(target) : [];
    const legacy = readLegacyCatalog(group);
    const existingById = queueExisting(existing);
    const legacyById = queueExisting(legacy);
    const existingByName = new Map<string, ExistingCatalogItem>();
    for (const item of existing) {
      for (const name of [item.scientificName, item.acceptedName]) {
        if (name && !existingByName.has(name.toLocaleLowerCase('es'))) existingByName.set(name.toLocaleLowerCase('es'), item);
      }
    }
    const legacyByName = new Map<string, ExistingCatalogItem>();
    for (const item of legacy) {
      for (const name of [item.scientificName, item.acceptedName]) {
        if (name && !legacyByName.has(name.toLocaleLowerCase('es'))) legacyByName.set(name.toLocaleLowerCase('es'), item);
      }
    }
    const existingByRecord = new Map<string, ExistingCatalogItem>();
    const legacyByRecord = new Map<string, ExistingCatalogItem>();
    for (const [items, map] of [[existing, existingByRecord], [legacy, legacyByRecord]] as const) {
      for (const item of items) {
        for (const source of item.sources ?? []) {
          if (source.record) {
            map.set(source.record, item);
            if (source.source) map.set(`${source.source}:${source.record}`, item);
          }
        }
      }
    }
    const existingIdentity = (name: string): { id: string; catalogCode: string } | undefined => {
      const item = legacyByName.get(name.toLocaleLowerCase('es')) ?? existingByName.get(name.toLocaleLowerCase('es'));
      return item ? { id: item.id, catalogCode: item.catalogCode ?? item.id } : undefined;
    };
    const legacyIds = new Set(legacy.map((item) => item.id));
    const legacyNames = new Set(legacy.flatMap((item) => [item.scientificName, item.acceptedName]).filter((name): name is string => Boolean(name)).map((name) => name.toLocaleLowerCase('es')));
    // An unresolved name has no accepted species name and must remain an audit
    // item, never become a guessed entry in the provisional catalogue.
    const catalog = all
      .filter((row) => row.evidence.some((evidence) => evidence.taxonomy.class === group) && row.resolution.acceptedName !== null)
      .map((row) => {
        const acceptedName = row.resolution.acceptedName!;
        // Existing catalog identity wins over a newly derived slug. This is
        // what keeps links/favourites stable when a backbone changes a
        // species' accepted name or a source uses a synonym.
        const sourceRecordExisting = row.evidence.map((evidence) =>
          legacyByRecord.get(`${evidence.source}:${evidence.sourceRecord}`)
          ?? legacyByRecord.get(evidence.sourceRecord ?? '')
          ?? existingByRecord.get(`${evidence.source}:${evidence.sourceRecord}`)
          ?? existingByRecord.get(evidence.sourceRecord ?? ''),
        ).find((item): item is ExistingCatalogItem => Boolean(item));
        const mapped = sourceRecordExisting
          ? { id: sourceRecordExisting.id, catalogCode: sourceRecordExisting.catalogCode ?? sourceRecordExisting.id }
          : existingIdentity(acceptedName)
          ?? existingIdentity(row.scientificName)
          ?? identityMap[acceptedName]
          ?? identityMap[acceptedName.toLocaleLowerCase('es')];
        const legacyCode = legacyCodes.get(row.scientificName.toLocaleLowerCase('es'))
          ?? legacyCodes.get(acceptedName.toLocaleLowerCase('es'));
        const provisionalId = mapped?.id ?? slug(acceptedName);
        const id = provisionalId;
        const previous = existingById.get(id)?.shift()
          ?? legacyById.get(id)?.shift()
          ?? existing.find((item) => item.scientificName === acceptedName || item.acceptedName === acceptedName)
          ?? legacy.find((item) => item.scientificName === acceptedName || item.acceptedName === acceptedName);
        const legacyIdentity = legacyIds.has(id)
          || legacyNames.has(acceptedName.toLocaleLowerCase('es'))
          || legacyNames.has(row.scientificName.toLocaleLowerCase('es'))
          || row.evidence.some((evidence) => legacyByRecord.has(`${evidence.source}:${evidence.sourceRecord}`) || legacyByRecord.has(evidence.sourceRecord ?? ''));
        // A conflict can remain visible when it belongs to the committed
        // catalogue (preserving existing links), but a newly discovered
        // conflict must stay in the review report until approved.
        if (row.resolution.status !== 'resolved' && !legacyIdentity) return null;
        identityMap[acceptedName] = { id, catalogCode: legacyCode ?? mapped?.catalogCode ?? previous?.catalogCode ?? id };
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
        const familyImages = group === 'Aves' ? guideVerified.species[identityMap[acceptedName]!.catalogCode] ?? [] : [];
        const selectedImages = familyImages.length
          ? [...familyImages, ...(familyImages.length === 1 && cachedImage ? [cachedImage] : [])].slice(0, 2)
          : cachedImage ? [cachedImage] : [];
        const sourceNames = row.evidence.flatMap((evidence) => [
          'taxonomy.kingdom', 'taxonomy.phylum', 'taxonomy.class', 'taxonomy.order', 'taxonomy.family', 'taxonomy.genus',
        ].map((fieldPath) => ({ source: evidence.source, record: evidence.sourceRecord, fieldPath })),
        );
        const acceptedTaxon = row.resolution.taxonomy;
        const schema14 = schema14Fields(previous as unknown as Record<string, unknown> ?? {}, acceptedName, identityMap[acceptedName]!.catalogCode, group);
        const schema14Sources = [
          ...schema14.measurements.map((measurement) => ({ source: measurement.sourceCode, record: measurement.sourceRecordId, fieldPath: `measurements.${measurement.kind}` })),
          ...sourceNames.filter((source) => source.fieldPath.startsWith('ecology.')),
        ];
        const generated = {
          id,
          catalogCode: identityMap[acceptedName]!.catalogCode,
          scientificName: row.evidence[0]?.scientificName ?? acceptedName,
          acceptedName: row.evidence[0]?.scientificName === acceptedName ? null : acceptedName,
          commonName: preferredCommonName ?? commonNames[0] ?? null,
          commonNames,
          taxonomy: {
            kingdom: acceptedTaxon.kingdom ?? row.evidence[0]?.taxonomy.kingdom ?? GROUP_METADATA[group].kingdom,
            phylum: acceptedTaxon.phylum ?? row.evidence[0]?.taxonomy.phylum ?? GROUP_METADATA[group].phylum,
            class: group,
            order: resolvedOrder(group, row),
            family: row.resolution.taxonomy.family,
            genus: row.resolution.taxonomy.genus,
          },
          origin,
          seasonality: previous?.seasonality ?? null,
          abundanceStatus: previous?.abundanceStatus ?? null,
          description: previous?.description ?? null,
          measurements: schema14.measurements,
          ecology: schema14.ecology,
          relevantNote: previous?.relevantNote ?? null,
          taxonIdentifiers: { gbif: row.resolution.gbifUsageKey ? { usageKey: row.resolution.gbifUsageKey } : undefined },
          naturalHistory: schema14.naturalHistory,
          media: { image: selectedImages[0] ?? null, images: selectedImages, audio: previous?.media?.audio ?? null },
          sources: uniqueSources([...(previous?.sources ?? []).map(schema14Source), ...sourceNames, ...schema14Sources]),
          reviewStatus: row.resolution.status === 'resolved' ? 'unreviewed' : 'needs_review',
        };
        // Keep editorial enrichment, but always refresh identity, taxonomy,
        // origin evidence and sources from the reproducible pipeline.
        return previous ? { ...withoutRetiredFields(previous), ...generated } : generated;
      }).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (JSON.stringify(existing) !== JSON.stringify(catalog)) writeJson(target, catalog);
    reportItems.push(...catalog.map((item) => ({ id: item.id, scientificName: item.scientificName, commonName: item.commonName, commonNames: item.commonNames })));
    const withImage = catalog.filter((item) => item.media.image !== null).length;
    console.log(`  ${group}: ${catalog.length} (${withImage} with image)`);
  }
  const plantTarget = `${PATHS.catalog}/plantae.json`;
  if (!existsSync(plantTarget)) throw new Error('Falta Plantae: ejecutar data:plants antes de construir el catálogo');
  {
    const plants = readJson<Array<ExistingCatalogItem & { taxonomy?: { class?: string | null } }>>(plantTarget);
    const seed = readJson<{ arboles: Array<{ nombre_cientifico: string }>; otras_plantas_nativas: Array<{ nombre_cientifico: string }> }>(PATHS.curatedPlants);
    const selected = new Set([...seed.arboles, ...seed.otras_plantas_nativas].map((row) => row.nombre_cientifico));
    if (selected.size !== 100 || plants.length !== 100 || plants.some((plant) => !selected.has(plant.scientificName ?? ''))) {
      throw new Error('Plantae no coincide con seed-100.json: el catálogo viejo no puede entrar al pipeline');
    }
    const migrated = plants.map((plant) => {
      const scientificName = plant.scientificName ?? plant.acceptedName ?? plant.id;
      const schema14 = schema14Fields(plant as unknown as Record<string, unknown>, scientificName, plant.catalogCode ?? plant.id, plant.taxonomy?.class ?? 'Plantae');
      return {
        ...withoutRetiredFields(plant), measurements: schema14.measurements, ecology: schema14.ecology,
        naturalHistory: schema14.naturalHistory,
        sources: uniqueSources([
          ...(plant.sources ?? []).map(schema14Source),
          ...schema14.measurements.map((measurement) => ({ source: measurement.sourceCode, record: measurement.sourceRecordId, fieldPath: `measurements.${measurement.kind}` })),
        ]),
      };
    });
    if (JSON.stringify(plants) !== JSON.stringify(migrated)) writeJson(plantTarget, migrated);
    console.log(`  Plantae: ${migrated.length}`);
  }
  writeJson(identityMapPath, identityMap);
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
