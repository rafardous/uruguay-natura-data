import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { adminClient, required } from './shared';

interface BuildMetadata {
  releaseId: string;
  version: number;
  speciesCount: number;
  databaseSize: number;
  sha256: string;
}

const client = adminClient();
const output = resolve(import.meta.dirname, '../dist/catalog');
const metadata = JSON.parse(readFileSync(resolve(output, 'build-metadata.json'), 'utf8')) as BuildMetadata;
const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8')) as Record<string, unknown>;
const repository = required('GITHUB_REPOSITORY');
const tag = `catalog-v${metadata.version}`;
const base = `https://github.com/${repository}/releases/download/${tag}`;
const publishedAt = new Date().toISOString();

Object.assign(manifest, {
  published_at: publishedAt,
  database_url: `${base}/natura.db`,
  compressed_database_url: `${base}/natura.db.gz`,
  quality_report_url: `${base}/quality-report.json`,
});
const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(resolve(output, 'manifest.json'), manifestBody);

const { error: uploadError } = await client.storage.from('catalog-public').upload(
  'manifest.json',
  new Blob([manifestBody], { type: 'application/json' }),
  { upsert: true, cacheControl: '60' },
);
if (uploadError) throw uploadError;

const { data: release, error: releaseError } = await client.from('catalog_releases').update({
  status: 'published',
  published_at: publishedAt,
  species_count: metadata.speciesCount,
  database_size: metadata.databaseSize,
  database_sha256: metadata.sha256,
  quality_report_url: manifest.quality_report_url,
  github_release_url: `https://github.com/${repository}/releases/tag/${tag}`,
  error: null,
}).eq('id', metadata.releaseId).select('requested_by').single();
if (releaseError) throw releaseError;

const { count: newerCount, error: countError } = await client.from('species_changes')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'approved')
  .gt('reviewed_at', publishedAt);
if (countError) throw countError;

console.log(`Finalized catalog v${metadata.version}. Newer approved changes: ${newerCount ?? 0}.`);
