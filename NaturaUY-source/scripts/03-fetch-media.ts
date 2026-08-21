/**
 * Stage 03 — find one freely licensed photo per species.
 *
 * Only CC0 and CC BY are accepted. iNaturalist's `default_photo` is *not* used:
 * sampling showed it is mostly CC BY-NC or All Rights Reserved. Filtering the
 * observations endpoint by `photo_license` instead yields ~80% coverage with
 * genuinely reusable images.
 *
 * Three passes, cheapest and most trustworthy first. The cache makes the whole
 * thing resumable — re-running only fetches what is still missing.
 */
import { resolve } from 'node:path';

import { JsonCache, readJson, writeJson } from './lib/cache';
import { fetchJson, RateLimiter } from './lib/http';
import { ensureDirs, PATHS } from './lib/paths';
import type { MediaRecord, NormalizedSpecies, TaxonomyMatch } from './lib/types';

/** Licences that permit redistribution inside a published app. */
const ALLOWED_INAT_LICENSES = new Set(['cc0', 'cc-by']);
const ALLOWED_WIKI_LICENSE = /^(cc0|public domain|pd|cc by 4\.0|cc by 3\.0|cc by 2\.\d|cc by-sa)/i;

// iNaturalist asks for <=60 requests/minute. Wikimedia is far more permissive.
const inatLimiter = new RateLimiter(1000);
const wikiLimiter = new RateLimiter(150);

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
  total_results?: number;
  results?: InatObservation[];
}

/** iNat serves one file per size; the path segment is the only difference. */
const inatSize = (url: string, size: 'medium' | 'large'): string =>
  url.replace(/\/(square|small|medium|large|original)\.(jpe?g|png|gif)/i, `/${size}.$2`);

function pickInatPhoto(response: InatResponse | null): MediaRecord | null {
  for (const observation of response?.results ?? []) {
    for (const photo of observation.photos ?? []) {
      // The filter matches observations that *contain* an acceptable photo, so
      // each individual photo still has to be checked.
      const license = photo.license_code?.toLowerCase();
      if (!photo.url || !license || !ALLOWED_INAT_LICENSES.has(license)) continue;

      return {
        imageUrl: inatSize(photo.url, 'medium'),
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

async function queryInat(name: string, researchGradeOnly: boolean): Promise<MediaRecord | null> {
  const params = new URLSearchParams({
    taxon_name: name,
    photo_license: 'cc0,cc-by',
    per_page: '5',
    order_by: 'votes',
  });
  if (researchGradeOnly) params.set('quality_grade', 'research');

  const response = await fetchJson<InatResponse>(
    `https://api.inaturalist.org/v1/observations?${params}`,
    { limiter: inatLimiter },
  );
  return pickInatPhoto(response);
}

interface WikiPageImages {
  query?: {
    pages?: Record<string, { pageimage?: string; original?: { source?: string }; title?: string }>;
  };
}
interface WikiImageInfo {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: {
          url?: string;
          descriptionurl?: string;
          extmetadata?: Record<string, { value?: string }>;
        }[];
      }
    >;
  };
}

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/**
 * Wikipedia lead images live on Commons, where the licence is per-file and can
 * still be non-free-enough for us, so the licence is verified before accepting.
 */
async function queryWikimedia(name: string, lang: 'es' | 'en'): Promise<MediaRecord | null> {
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
  const file = entry?.pageimage;
  const original = entry?.original?.source;
  if (!file || !original) return null;

  const infoParams = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    format: 'json',
    titles: `File:${file}`,
  });

  const info = await fetchJson<WikiImageInfo>(
    `https://commons.wikimedia.org/w/api.php?${infoParams}`,
    { limiter: wikiLimiter },
  );

  const imageinfo = Object.values(info?.query?.pages ?? {})[0]?.imageinfo?.[0];
  const meta = imageinfo?.extmetadata;
  const license = stripHtml(meta?.LicenseShortName?.value ?? '');
  if (!license || !ALLOWED_WIKI_LICENSE.test(license)) return null;

  const artist = stripHtml(meta?.Artist?.value ?? '') || 'Wikimedia Commons';

  return {
    imageUrl: original,
    fullUrl: original,
    license: license.toUpperCase(),
    attribution: `${artist} (${license}) vía Wikimedia Commons`,
    source: 'wikimedia',
    sourcePage: imageinfo?.descriptionurl ?? null,
  };
}

async function main(): Promise<void> {
  ensureDirs();

  const species = readJson<NormalizedSpecies[]>(resolve(PATHS.out, 'species.json'));
  const taxonomy = readJson<Record<string, TaxonomyMatch>>(resolve(PATHS.out, 'taxonomy.json'));
  const cache = new JsonCache<MediaRecord | null>('media');

  // `--limit N` keeps a dry run cheap while validating the cascade.
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

  const pending = species.filter((s) => !cache.has(s.codigo)).slice(0, limit);
  console.log(`03-fetch-media: ${pending.length} pending (${cache.size} cached)`);
  console.log('  pass 1 iNaturalist (research grade) · pass 2 iNaturalist (any) · pass 3 Wikimedia');

  let done = 0;
  let found = 0;
  const started = Date.now();

  for (const item of pending) {
    const accepted = taxonomy[item.codigo]?.acceptedName ?? null;
    const primary = accepted ?? item.scientificName;

    let record = await queryInat(primary, true);

    if (!record && accepted && accepted !== item.scientificName) {
      record = await queryInat(item.scientificName, true);
    }
    if (!record) {
      record = await queryInat(primary, false);
    }
    if (!record) {
      record = await queryWikimedia(primary, 'es');
    }
    if (!record) {
      record = await queryWikimedia(primary, 'en');
    }

    if (record) found++;
    cache.set(item.codigo, record);

    if (++done % 50 === 0) {
      const rate = done / ((Date.now() - started) / 1000);
      const etaMin = Math.round((pending.length - done) / rate / 60);
      console.log(
        `  ${done}/${pending.length} · ${found} found (${Math.round((found / done) * 100)}%) · ~${etaMin} min left`,
      );
    }
  }

  cache.flush();

  const all = Object.fromEntries(cache.entries());
  writeJson(resolve(PATHS.out, 'media.json'), all);

  const hits = Object.values(all).filter(Boolean) as MediaRecord[];
  const bySource = hits.reduce<Record<string, number>>((acc, m) => {
    acc[m.source] = (acc[m.source] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`  coverage ${hits.length}/${species.length} (${Math.round((hits.length / species.length) * 100)}%)`);
  console.log(`  by source: ${JSON.stringify(bySource)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
