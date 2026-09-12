import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import sharp from 'sharp';

import { adminClient } from './shared';

const client = adminClient();
const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1])) : 1000;
const acceptedLicenses = new Set(['CC0', 'CC-BY-4.0']);
const sha = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');

const { data: assets, error } = await client.from('species_media')
  .select('id,species_id,ordinal,source_url,license,license_url,source_width,source_height,selection_details,species!inner(catalog_code)')
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
  const expectedLicenseUrl=asset.license==='CC0'?'https://creativecommons.org/publicdomain/zero/1.0/':'https://creativecommons.org/licenses/by/4.0/';
  if(asset.license_url!==expectedLicenseUrl){skipped+=1;review.push({mediaId:asset.id,license:String(asset.license),sourceUrl:String(asset.source_url),reason:'license_url_not_verified'});continue;}
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
    if (Math.max(metadata.width,metadata.height) < 1200) throw new Error('image_resolution_too_small');
    const stats = await input.clone().stats();
    const visibleChannels = stats.channels.slice(0, Math.min(3, stats.channels.length));
    const meanExposure = visibleChannels.reduce((sum, channel) => sum + channel.mean, 0) / Math.max(1, visibleChannels.length);
    if (meanExposure < 8 || meanExposure > 247) throw new Error('image_exposure_outlier');
    if (stats.entropy < 1.25 || stats.sharpness < 0.4) throw new Error('image_low_information_or_blur');
    const main = await input.clone().rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
    const thumbnail = await input.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
    const mainChecksum = sha(main);
    const { data: duplicate, error: duplicateError } = await client.from('species_media')
      .select('id,species_id').eq('checksum_sha256', mainChecksum).eq('type', 'image').eq('status', 'approved')
      .neq('species_id', asset.species_id).limit(1).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) throw new Error(`duplicate_image_checksum:${duplicate.id}`);
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
    const { error: updateError } = await client.from('species_media').update({ storage_path: mainPath, thumbnail_path: thumbnailPath, checksum_sha256: mainChecksum, source_width: metadata.width, source_height: metadata.height, selection_details: { ...(asset.selection_details && typeof asset.selection_details === 'object' ? asset.selection_details : {}), pixelEntropy: stats.entropy, pixelSharpness: stats.sharpness, meanExposure }, processed_at: new Date().toISOString(), status: 'approved' }).eq('id', asset.id);
    if (updateError) throw updateError;
    const {error:primaryError}=await client.from('species').update({primary_image_id:asset.id}).eq('id',asset.species_id);if(primaryError)throw primaryError;
    const {error:archiveError}=await client.from('species_media').update({status:'archived',is_primary:false}).eq('species_id',asset.species_id).eq('type','image').neq('id',asset.id).eq('status','approved');if(archiveError)throw archiveError;
    const {error:markPrimaryError}=await client.from('species_media').update({is_primary:true}).eq('id',asset.id);if(markPrimaryError)throw markPrimaryError;
    migrated += 1; console.log(`MIGRATED ${asset.id}`);
  } catch (reason) {
    failed += 1;
    review.push({ mediaId: asset.id, license: String(asset.license || ''), sourceUrl: String(asset.source_url || ''), reason: reason instanceof Error ? reason.message : String(reason) });
    console.error(`FAILED ${asset.id}: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
}

const reportDirectory = resolve(import.meta.dirname, '../dist');
mkdirSync(reportDirectory, { recursive: true });
writeFileSync(resolve(reportDirectory, 'media-import-review.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), inspected: assets?.length ?? 0, eligible, migrated, skipped, failed, dryRun, review }, null, 2)}\n`);
console.log(JSON.stringify({ inspected: assets?.length ?? 0, eligible, migrated, skipped, failed, dryRun, reviewReport: 'dist/media-import-review.json' }));
if (failed > 0) process.exitCode = 1;
