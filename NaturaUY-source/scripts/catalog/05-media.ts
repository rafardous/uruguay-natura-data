/**
 * Stage 05 — find one redistributable image per accepted species name.
 *
 * Results, including explicit misses, are persisted after every species so the
 * stage can resume safely. Delete data/cache/media/species-media.json or pass
 * --retry-missing to revisit species for which no image was previously found.
 */
import { existsSync } from 'node:fs';

import { fetchJson, RateLimiter } from '../lib/http';
import { PATHS, ensureDirs, readJson, writeJson } from './lib';
import type { CatalogImage } from './lib';

interface ResolvedItem {
  scientificName: string;
  resolution: { acceptedName: string | null };
}

interface InatPhoto {
  url?: string;
  license_code?: string | null;
  attribution?: string;
}

interface InatObservation {
  id?: number;
  photos?: InatPhoto[];
}

interface InatResponse {
  results?: InatObservation[];
}

interface WikiPageImages {
  query?: {
    pages?: Record<string, { pageimage?: string; original?: { source?: string } }>;
  };
}

interface WikiImageInfo {
  query?: {
    pages?: Record<string, {
      imageinfo?: Array<{
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: string }>;
      }>;
    }>;
  };
}

const ALLOWED_INAT_LICENSES = new Set(['cc0', 'cc-by']);
const ALLOWED_WIKI_LICENSE = /^(cc0|public domain|pd|cc by 4\.0|cc by 3\.0|cc by 2\.\d|cc by-sa)/i;
const inatLimiter = new RateLimiter(1_000);
const wikiLimiter = new RateLimiter(150);

const inatSize = (url: string, size: 'medium' | 'large'): string =>
  url.replace(/\/(square|small|medium|large|original)\.(jpe?g|png|gif)/i, `/${size}.$2`);

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function pickInatPhoto(response: InatResponse | null): CatalogImage | null {
  for (const observation of response?.results ?? []) {
    for (const photo of observation.photos ?? []) {
      const license = photo.license_code?.toLowerCase();
      if (!photo.url || !license || !ALLOWED_INAT_LICENSES.has(license)) continue;
      return {
        url: inatSize(photo.url, 'medium'),
        fullUrl: inatSize(photo.url, 'large'),
        license: license.toUpperCase(),
        attribution: photo.attribution ?? 'iNaturalist',
        source: 'inaturalist',
        sourcePage: observation.id ? `https://www.inaturalist.org/observations/${observation.id}` : null,
      };
    }
  }
  return null;
}

async function queryInaturalist(name: string, researchGradeOnly: boolean): Promise<CatalogImage | null> {
  const params = new URLSearchParams({
    taxon_name: name,
    photo_license: 'cc0,cc-by',
    per_page: '5',
    order_by: 'votes',
  });
  if (researchGradeOnly) params.set('quality_grade', 'research');
  return pickInatPhoto(await fetchJson<InatResponse>(
    `https://api.inaturalist.org/v1/observations?${params}`,
    { limiter: inatLimiter },
  ));
}

async function queryWikimedia(name: string, lang: 'es' | 'en'): Promise<CatalogImage | null> {
  const pageParams = new URLSearchParams({
    action: 'query',
    prop: 'pageimages',
    piprop: 'original|name',
    format: 'json',
    redirects: '1',
    titles: name,
  });
  const page = await fetchJson<WikiPageImages>(
    `https://${lang}.wikipedia.org/w/api.php?${pageParams}`,
    { limiter: wikiLimiter },
  );
  const entry = Object.values(page?.query?.pages ?? {})[0];
  if (!entry?.pageimage || !entry.original?.source) return null;

  const infoParams = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    format: 'json',
    titles: `File:${entry.pageimage}`,
  });
  const info = await fetchJson<WikiImageInfo>(
    `https://commons.wikimedia.org/w/api.php?${infoParams}`,
    { limiter: wikiLimiter },
  );
  const imageInfo = Object.values(info?.query?.pages ?? {})[0]?.imageinfo?.[0];
  const metadata = imageInfo?.extmetadata;
  const license = stripHtml(metadata?.LicenseShortName?.value ?? '');
  if (!license || !ALLOWED_WIKI_LICENSE.test(license)) return null;
  const artist = stripHtml(metadata?.Artist?.value ?? '') || 'Wikimedia Commons';
  return {
    url: entry.original.source,
    fullUrl: entry.original.source,
    license: license.toUpperCase(),
    attribution: `${artist} (${license}) vía Wikimedia Commons`,
    source: 'wikimedia',
    sourcePage: imageInfo?.descriptionurl ?? null,
  };
}

function readLimit(): number {
  const inline = process.argv.find((arg) => arg.startsWith('--limit='));
  if (inline) return Number(inline.slice('--limit='.length));
  const index = process.argv.indexOf('--limit');
  return index >= 0 ? Number(process.argv[index + 1]) : Number.POSITIVE_INFINITY;
}

async function findImage(acceptedName: string, originalNames: string[]): Promise<CatalogImage | null> {
  const names = [acceptedName, ...originalNames.filter((name) => name !== acceptedName)];
  for (const name of names) {
    const researchGrade = await queryInaturalist(name, true);
    if (researchGrade) return researchGrade;
  }
  const anyGrade = await queryInaturalist(acceptedName, false);
  if (anyGrade) return anyGrade;
  return await queryWikimedia(acceptedName, 'es') ?? await queryWikimedia(acceptedName, 'en');
}

async function main(): Promise<void> {
  ensureDirs();
  const resolved = readJson<ResolvedItem[]>(PATHS.resolved);
  const cache = existsSync(PATHS.media)
    ? readJson<Record<string, CatalogImage | null>>(PATHS.media)
    : {};
  const retryMissing = process.argv.includes('--retry-missing');
  const limit = readLimit();
  if ((!Number.isFinite(limit) && limit !== Number.POSITIVE_INFINITY) || limit <= 0) {
    throw new Error('--limit must be a positive number');
  }

  const originalsByAccepted = new Map<string, string[]>();
  for (const row of resolved) {
    const accepted = row.resolution.acceptedName;
    if (!accepted) continue;
    const originals = originalsByAccepted.get(accepted) ?? [];
    if (!originals.includes(row.scientificName)) originals.push(row.scientificName);
    originalsByAccepted.set(accepted, originals);
  }

  const pending = [...originalsByAccepted].filter(([name]) =>
    !(name in cache) || (retryMissing && cache[name] === null),
  ).slice(0, limit);
  console.log(`05-media: ${pending.length} pending; ${Object.keys(cache).length}/${originalsByAccepted.size} cached`);
  console.log('  iNaturalist research grade → iNaturalist any grade → Wikimedia es/en');

  let completed = 0;
  let found = 0;
  const started = Date.now();
  for (const [acceptedName, originalNames] of pending) {
    const image = await findImage(acceptedName, originalNames);
    cache[acceptedName] = image;
    writeJson(PATHS.media, cache);
    if (image) found++;
    completed++;
    if (completed % 25 === 0 || completed === pending.length) {
      const elapsedSeconds = Math.max(1, (Date.now() - started) / 1_000);
      const rate = completed / elapsedSeconds;
      const etaMinutes = Math.round((pending.length - completed) / rate / 60);
      console.log(`  ${completed}/${pending.length} · ${found} found in this run · ~${etaMinutes} min left`);
    }
  }

  const hits = Object.values(cache).filter((image): image is CatalogImage => image !== null);
  const bySource = hits.reduce<Record<string, number>>((counts, image) => {
    counts[image.source] = (counts[image.source] ?? 0) + 1;
    return counts;
  }, {});
  console.log(`  total coverage ${hits.length}/${originalsByAccepted.size} (${Math.round(hits.length / originalsByAccepted.size * 100)}%)`);
  console.log(`  by source: ${JSON.stringify(bySource)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
