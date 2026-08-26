import { createHash } from 'node:crypto';
import sharp from 'sharp';

import { adminClient } from './shared';

const client = adminClient();
const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1])) : 1000;
const acceptedLicenses = new Set(['CC0', 'CC0 1.0', 'CC BY 4.0', 'CC-BY-4.0', 'PUBLIC DOMAIN', 'Public domain']);
const sha = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');

const { data: assets, error } = await client
  .from('media_assets')
  .select('id,species_id,external_url,source_url,license,original_license')
  .eq('kind', 'image')
  .eq('state', 'ready')
  .is('main_key', null)
  .not('external_url', 'is', null)
  .limit(limit);
if (error) throw error;

let eligible = 0; let migrated = 0; let skipped = 0; let failed = 0;
for (const asset of assets ?? []) {
  const originalLicense = String(asset.original_license ?? asset.license ?? '').trim();
  if (!acceptedLicenses.has(originalLicense)) {
    skipped += 1;
    console.log(`SKIP ${asset.id}: license_review_required (${originalLicense || 'missing'})`);
    continue;
  }
  eligible += 1;
  if (dryRun) { console.log(`WOULD_MIGRATE ${asset.id}: ${asset.external_url}`); continue; }
  try {
    const response = await fetch(String(asset.external_url), {
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'Natura-UY-media-migration/1.0 (+https://github.com/rafardous/uruguay-natura-data)' },
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(type)) throw new Error(`content_type_invalid:${type || 'missing'}`);
    const original = new Uint8Array(await response.arrayBuffer());
    if (original.length > 20 * 1024 * 1024) throw new Error('image_too_large');
    const input = sharp(original, { failOn: 'error', limitInputPixels: 50_000_000 });
    const metadata = await input.metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 50_000_000) throw new Error('image_dimensions_invalid');
    const main = await input.clone().rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
    const thumb = await input.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
    const outputMetadata = await sharp(main).metadata();
    const base = `media/${asset.species_id}/${asset.id}`; const mainKey = `${base}/main.webp`; const thumbKey = `${base}/thumb.webp`;
    for (const [key, body] of [[mainKey, main], [thumbKey, thumb]] as const) {
      const { error: uploadError } = await client.storage.from('media-public').upload(key, body, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const { data: copy, error: verifyError } = await client.storage.from('media-public').download(key);
      if (verifyError || !copy || sha(new Uint8Array(await copy.arrayBuffer())) !== sha(body)) throw new Error(`verification_failed:${key}`);
    }
    const { error: updateError } = await client.from('media_assets').update({ main_key: mainKey, thumbnail_key: thumbKey, checksum_sha256: sha(main), width: outputMetadata.width, height: outputMetadata.height, updated_at: new Date().toISOString() }).eq('id', asset.id);
    if (updateError) throw updateError;
    migrated += 1; console.log(`MIGRATED ${asset.id}`);
  } catch (reason) {
    failed += 1; console.error(`FAILED ${asset.id}: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
}

console.log(JSON.stringify({ inspected: assets?.length ?? 0, eligible, migrated, skipped, failed, dryRun }));
if (failed > 0) process.exitCode = 1;
