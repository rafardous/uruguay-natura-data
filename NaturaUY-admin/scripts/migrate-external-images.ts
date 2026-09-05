import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import sharp from 'sharp';

import { adminClient, required } from './shared';

const client = adminClient();
const dryRun = process.argv.includes('--dry-run');
const actor = dryRun ? null : required('EDITORIAL_SYSTEM_USER_ID');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1])) : 1000;
const acceptedLicenses = new Set(['CC0', 'CC0 1.0', 'CC BY 4.0', 'CC-BY-4.0', 'PUBLIC DOMAIN', 'Public domain']);
const sha = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');

const { data: assets, error } = await client.from('species_media')
  .select('id,species_id,ordinal,source_url,license,species!inner(catalog_code,primary_image_id)')
  .eq('type', 'image').eq('status', 'archived').is('storage_path', null).not('source_url', 'is', null).limit(limit);
if (error) throw error;

let eligible = 0; let migrated = 0; let skipped = 0; let failed = 0;
const review: Array<{ mediaId: string; license: string; sourceUrl: string; reason: string }> = [];
for (const asset of assets ?? []) {
  if (!acceptedLicenses.has(String(asset.license).trim())) {
    skipped += 1;
    review.push({ mediaId: asset.id, license: String(asset.license || ''), sourceUrl: String(asset.source_url || ''), reason: 'license_review_required' });
    console.log(`SKIP ${asset.id}: license_review_required (${asset.license || 'missing'})`); continue;
  }
  eligible += 1;
  if (dryRun) { console.log(`WOULD_MIGRATE ${asset.id}: ${asset.source_url}`); continue; }
  try {
    const response = await fetch(String(asset.source_url), { redirect: 'follow', signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'Natura-UY-media-migration/2.0' } });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const original = new Uint8Array(await response.arrayBuffer());
    if (original.length > 20 * 1024 * 1024) throw new Error('image_too_large');
    const input = sharp(original, { failOn: 'error', limitInputPixels: 50_000_000 });
    const metadata = await input.metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 50_000_000) throw new Error('image_dimensions_invalid');
    const main = await input.clone().rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
    const thumbnail = await input.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
    const species = Array.isArray(asset.species) ? asset.species[0] : asset.species;
    const ordinal = String(asset.ordinal).padStart(2, '0');
    const mainPath = `species/${species.catalog_code}/${ordinal}.webp`;
    const thumbnailPath = `species/${species.catalog_code}/thumbs/${ordinal}.webp`;
    for (const [path, body] of [[mainPath, main], [thumbnailPath, thumbnail]] as const) {
      const { error: uploadError } = await client.storage.from('media-public').upload(path, body, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const { data: copy, error: verifyError } = await client.storage.from('media-public').download(path);
      if (verifyError || !copy || sha(new Uint8Array(await copy.arrayBuffer())) !== sha(body)) throw new Error(`verification_failed:${path}`);
    }
    const { error: updateError } = await client.from('species_media').update({ storage_path: mainPath, thumbnail_path: thumbnailPath, status: 'approved' }).eq('id', asset.id);
    if (updateError) throw updateError;
    if (!species.primary_image_id) await client.from('species').update({ primary_image_id: asset.id }).eq('id', asset.species_id);
    await client.from('audit_events').insert({ actor_id: actor, event_type: 'media.initial_import_approved', entity_type: 'species_media', entity_id: asset.id, payload: { checksum: sha(main) } });
    migrated += 1; console.log(`MIGRATED ${asset.id}`);
  } catch (reason) {
    failed += 1;
    review.push({ mediaId: asset.id, license: String(asset.license || ''), sourceUrl: String(asset.source_url || ''), reason: reason instanceof Error ? reason.message : String(reason) });
    console.error(`FAILED ${asset.id}: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
}

if (migrated) {
  const { data: state } = await client.from('catalog_state').select('dirty_changes').eq('singleton', true).single();
  await client.from('catalog_state').update({ dirty: true, dirty_changes: Number(state?.dirty_changes ?? 0) + migrated, last_changed_at: new Date().toISOString() }).eq('singleton', true);
}
const reportDirectory = resolve(import.meta.dirname, '../dist');
mkdirSync(reportDirectory, { recursive: true });
writeFileSync(resolve(reportDirectory, 'media-import-review.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), inspected: assets?.length ?? 0, eligible, migrated, skipped, failed, dryRun, review }, null, 2)}\n`);
console.log(JSON.stringify({ inspected: assets?.length ?? 0, eligible, migrated, skipped, failed, dryRun, reviewReport: 'dist/media-import-review.json' }));
if (failed > 0) process.exitCode = 1;
