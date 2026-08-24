import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

import { adminClient, required } from './shared';

const jobId = required('MEDIA_JOB_ID'); const client = adminClient();
const { data: job, error: jobError } = await client.from('media_jobs').select('*, media_assets(*)').eq('id', jobId).single(); if (jobError) throw jobError;
const asset = job.media_assets; const temp = mkdtempSync(join(tmpdir(), 'natura-media-'));
const r2 = new S3Client({ region: 'auto', endpoint: required('R2_ENDPOINT'), credentials: { accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') } }); const bucket = required('R2_BUCKET');
const sha = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');
const color = (rgb: { r: number; g: number; b: number }) => `#${[rgb.r, rgb.g, rgb.b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
const mix = (rgb: { r: number; g: number; b: number }, target: number, amount: number) => ({ r: rgb.r + (target - rgb.r) * amount, g: rgb.g + (target - rgb.g) * amount, b: rgb.b + (target - rgb.b) * amount });
const readable = (rgb: { r: number; g: number; b: number }) => (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b > 150 ? '#293832' : '#FFFDF6');
async function putBoth(key: string, body: Uint8Array, contentType: string): Promise<string> {
  const checksum = sha(body); const { error } = await client.storage.from('media-public').upload(key, body, { contentType, upsert: true, cacheControl: '31536000' }); if (error) throw error;
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable', Metadata: { sha256: checksum } }));
  const [{ data: copy, error: readError }, head] = await Promise.all([client.storage.from('media-public').download(key), r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))]);
  if (readError || !copy || sha(new Uint8Array(await copy.arrayBuffer())) !== checksum || head.Metadata?.sha256 !== checksum) throw new Error(`verification_failed:${key}`);
  return checksum;
}

await client.from('media_jobs').update({ state: 'processing', started_at: new Date().toISOString(), attempts: Number(job.attempts) + 1, error: null }).eq('id', jobId);
await client.from('media_assets').update({ state: 'processing', processing_error: null, updated_at: new Date().toISOString() }).eq('id', asset.id);
try {
  const { data: incoming, error } = await client.storage.from('incoming').download(asset.incoming_key); if (error || !incoming) throw error ?? new Error('incoming_missing');
  const original = new Uint8Array(await incoming.arrayBuffer()); const scanPath = join(temp, 'original-upload'); writeFileSync(scanPath, original); execFileSync('clamscan', ['--no-summary', scanPath], { stdio: 'inherit' }); const base = `media/${asset.species_id}/${asset.id}`; let checksum = ''; let update: Record<string, unknown>;
  if (asset.kind === 'image') {
    if (original.length > 40 * 1024 * 1024) throw new Error('image_too_large'); const input = sharp(original, { failOn: 'error', limitInputPixels: 50_000_000 }); const metadata = await input.metadata(); if (!metadata.format || !['jpeg', 'png', 'webp', 'heif'].includes(metadata.format)) throw new Error(`image_format_invalid:${metadata.format ?? 'unknown'}`); if (!metadata.width || !metadata.height || metadata.width * metadata.height > 50_000_000) throw new Error('image_dimensions_invalid');
    const main = await input.clone().rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84, effort: 5 }).toBuffer(); const thumb = await input.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toBuffer(); const stats = await sharp(main).stats(); const dominantRgb = stats.dominant; const lightContainer = mix(dominantRgb, 255, 0.78); const darkContainer = mix(dominantRgb, 0, 0.52); const palette = { dominant: color(dominantRgb), accentLight: color(dominantRgb), accentDark: color(mix(dominantRgb, 255, 0.34)), containerLight: color(lightContainer), onContainerLight: readable(lightContainer), containerDark: color(darkContainer), onContainerDark: readable(darkContainer) };
    const mainKey = `${base}/main.webp`; const thumbKey = `${base}/thumb.webp`; checksum = await putBoth(mainKey, main, 'image/webp'); await putBoth(thumbKey, thumb, 'image/webp'); update = { main_key: mainKey, thumbnail_key: thumbKey, r2_main_key: mainKey, r2_thumbnail_key: thumbKey, width: metadata.width, height: metadata.height, palette, checksum_sha256: checksum };
  } else {
    if (original.length > 45 * 1024 * 1024) throw new Error('audio_too_large'); const inputPath = join(temp, `input${extname(asset.incoming_key) || '.audio'}`); const outputPath = join(temp, 'app.mp3'); writeFileSync(inputPath, original); const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration:stream=channels','-of','json',inputPath], { encoding: 'utf8' })) as { format?: { duration?: string }; streams?: Array<{ channels?: number }> }; const duration = Number(probe.format?.duration ?? 0); if (!duration || duration > 900) throw new Error('audio_duration_invalid'); const channels = Math.min(2, Math.max(1, probe.streams?.[0]?.channels ?? 1)); execFileSync('ffmpeg', ['-y','-i',inputPath,'-vn','-map_metadata','-1','-ar','48000','-ac',String(channels),'-codec:a','libmp3lame','-q:a','4',outputPath], { stdio: 'inherit' }); const audio = readFileSync(outputPath); const audioKey = `${base}/app.mp3`; checksum = await putBoth(audioKey, audio, 'audio/mpeg'); update = { app_audio_key: audioKey, r2_audio_key: audioKey, duration_seconds: duration, checksum_sha256: checksum };
  }
  await client.from('media_assets').update({ ...update, state: 'ready', updated_at: new Date().toISOString() }).eq('id', asset.id); await client.from('media_jobs').update({ state: 'ready', finished_at: new Date().toISOString() }).eq('id', jobId); await client.storage.from('incoming').remove([asset.incoming_key]); await client.from('audit_events').insert({ actor_id: job.requested_by, event_type: 'media.ready', entity_type: 'media', entity_id: asset.id, payload: { kind: asset.kind, checksum } }); const { data: state } = await client.from('catalog_state').select('dirty_changes').eq('singleton', true).single(); await client.from('catalog_state').update({ dirty: true, dirty_changes: Number(state?.dirty_changes ?? 0) + 1, last_changed_at: new Date().toISOString() }).eq('singleton', true); console.log(`Media ${asset.id} ready and verified in Supabase + R2.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error); await client.from('media_assets').update({ state: 'failed', processing_error: message, updated_at: new Date().toISOString() }).eq('id', asset.id); await client.from('media_jobs').update({ state: 'failed', error: message, finished_at: new Date().toISOString() }).eq('id', jobId); throw error;
} finally { rmSync(temp, { recursive: true, force: true }); }
