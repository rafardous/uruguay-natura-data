import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adminClient, required } from './shared';

const client = adminClient(); const output = resolve(import.meta.dirname, '../dist/catalog');
const metadata = JSON.parse(readFileSync(resolve(output, 'build-metadata.json'), 'utf8')) as { releaseId: string; dataVersion: number; speciesCount: number; databaseSize: number; sha256: string };
const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8')) as Record<string, unknown>;
const repository = required('GITHUB_REPOSITORY'); const tag = `catalog-v${metadata.dataVersion}`; const base = `https://github.com/${repository}/releases/download/${tag}`; const publishedAt = new Date().toISOString();
Object.assign(manifest, { published_at: publishedAt, database_url: `${base}/natura.db`, compressed_database_url: `${base}/natura.db.gz`, quality_report_url: `${base}/quality-report.json` });
const manifestBody = JSON.stringify(manifest, null, 2); writeFileSync(resolve(output, 'manifest.json'), manifestBody);
const { error: uploadError } = await client.storage.from('catalog-public').upload('manifest.json', new Blob([manifestBody], { type: 'application/json' }), { upsert: true, cacheControl: '60' }); if (uploadError) throw uploadError;
const { data: release, error: releaseError } = await client.from('catalog_releases').update({ status: 'published', published_at: publishedAt, species_count: metadata.speciesCount, database_size: metadata.databaseSize, database_url: manifest.database_url, database_sha256: metadata.sha256, quality_report_url: manifest.quality_report_url, github_release_url: `https://github.com/${repository}/releases/tag/${tag}`, error: null }).eq('id', metadata.releaseId).select('source_revision,requested_by').single(); if (releaseError) throw releaseError;
const contentEvents = ['species.created','species.updated','species.retired','species.restored','media.ready'];
const { count: newerCount, error: countError } = await client.from('audit_events').select('id', { count: 'exact', head: true }).gt('id', release.source_revision ?? 0).in('event_type', contentEvents); if (countError) throw countError;
await client.from('catalog_state').update({ dirty: (newerCount ?? 0) > 0, dirty_changes: newerCount ?? 0, last_release_version: metadata.dataVersion, last_published_at: publishedAt }).eq('singleton', true);
await client.from('audit_events').insert({ actor_id: release.requested_by, event_type: 'catalog.published', entity_type: 'release', entity_id: metadata.releaseId, payload: { dataVersion: metadata.dataVersion, speciesCount: metadata.speciesCount, sha256: metadata.sha256 } });
console.log(`Finalized catalog v${metadata.dataVersion}. Newer editorial changes: ${newerCount ?? 0}.`);
