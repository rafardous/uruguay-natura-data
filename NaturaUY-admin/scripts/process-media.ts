import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

import { adminClient, required } from './shared';

const jobId = required('MEDIA_JOB_ID');
const client = adminClient();
const { data: job, error: jobError } = await client.from('media_jobs').select('*, media_assets(*)').eq('id', jobId).single();
if (jobError) throw jobError;
const asset = job.media_assets;
const temp = mkdtempSync(join(tmpdir(), 'natura-media-'));

const r2Endpoint = process.env.R2_ENDPOINT?.trim();
const r2AccessKey = process.env.R2_ACCESS_KEY_ID?.trim();
const r2Secret = process.env.R2_SECRET_ACCESS_KEY?.trim();
const r2Bucket = process.env.R2_BUCKET?.trim();
const r2 = r2Endpoint && r2AccessKey && r2Secret && r2Bucket
  ? new S3Client({ region: 'auto', endpoint: r2Endpoint, credentials: { accessKeyId: r2AccessKey, secretAccessKey: r2Secret } })
  : null;

const sha = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');
const color = (rgb: { r: number; g: number; b: number }) => `#${[rgb.r, rgb.g, rgb.b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
const mix = (rgb: { r: number; g: number; b: number }, target: number, amount: number) => ({ r: rgb.r + (target - rgb.r) * amount, g: rgb.g + (target - rgb.g) * amount, b: rgb.b + (target - rgb.b) * amount });
const readable = (rgb: { r: number; g: number; b: number }) => (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b > 150 ? '#293832' : '#FFFDF6');

async function putVerified(key: string, body: Uint8Array, contentType: string): Promise<{ checksum: string; backedUp: boolean }> {
  const checksum = sha(body);
  const { error } = await client.storage.from('media-public').upload(key, body, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  const { data: copy, error: readError } = await client.storage.from('media-public').download(key);
  if (readError || !copy || sha(new Uint8Array(await copy.arrayBuffer())) !== checksum) throw new Error(`supabase_verification_failed:${key}`);
  if (!r2 || !r2Bucket) return { checksum, backedUp: false };
  await r2.send(new PutObjectCommand({ Bucket: r2Bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable', Metadata: { sha256: checksum } }));
  const head = await r2.send(new HeadObjectCommand({ Bucket: r2Bucket, Key: key }));
  if (head.Metadata?.sha256 !== checksum) throw new Error(`r2_verification_failed:${key}`);
  return { checksum, backedUp: true };
}

await client.from('media_jobs').update({ state: 'processing', started_at: new Date().toISOString(), attempts: Number(job.attempts) + 1, error: null }).eq('id', jobId);
await client.from('media_assets').update({ state: 'processing', processing_error: null, updated_at: new Date().toISOString() }).eq('id', asset.id);

try {
  const { data: incoming, error } = await client.storage.from('incoming').download(asset.incoming_key);
  if (error || !incoming) throw error ?? new Error('incoming_missing');
  const original = new Uint8Array(await incoming.arrayBuffer());
  const scanPath = join(temp, 'original-upload');
  writeFileSync(scanPath, original);
  execFileSync('clamscan', ['--no-summary', scanPath], { stdio: 'inherit' });
  const base = `media/${asset.species_id}/${asset.id}`;
  let checksum = '';
  let update: Record<string, unknown>;

  if (asset.kind === 'image') {
    if (original.length > 20 * 1024 * 1024) throw new Error('image_too_large');
    const input = sharp(original, { failOn: 'error', limitInputPixels: 50_000_000 });
    const metadata = await input.metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'heif'].includes(metadata.format)) throw new Error(`image_format_invalid:${metadata.format ?? 'unknown'}`);
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 50_000_000) throw new Error('image_dimensions_invalid');
    const main = await input.clone().rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
    const thumb = await input.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
    const [stats, outputMetadata] = await Promise.all([sharp(main).stats(), sharp(main).metadata()]);
    const dominantRgb = stats.dominant;
    const lightContainer = mix(dominantRgb, 255, 0.78); const darkContainer = mix(dominantRgb, 0, 0.52);
    const palette = { dominant: color(dominantRgb), accentLight: color(dominantRgb), accentDark: color(mix(dominantRgb, 255, 0.34)), containerLight: color(lightContainer), onContainerLight: readable(lightContainer), containerDark: color(darkContainer), onContainerDark: readable(darkContainer) };
    const mainKey = `${base}/main.webp`; const thumbKey = `${base}/thumb.webp`;
    const mainResult = await putVerified(mainKey, main, 'image/webp');
    const thumbResult = await putVerified(thumbKey, thumb, 'image/webp');
    checksum = mainResult.checksum;
    update = { main_key: mainKey, thumbnail_key: thumbKey, r2_main_key: mainResult.backedUp ? mainKey : null, r2_thumbnail_key: thumbResult.backedUp ? thumbKey : null, width: outputMetadata.width, height: outputMetadata.height, palette, checksum_sha256: checksum };
  } else {
    if (original.length > 45 * 1024 * 1024) throw new Error('audio_too_large');
    const inputPath = join(temp, `input${extname(asset.incoming_key) || '.audio'}`); const outputPath = join(temp, 'app.mp3');
    writeFileSync(inputPath, original);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', inputPath], { encoding: 'utf8' })) as { format?: { duration?: string } };
    const sourceDuration = Number(probe.format?.duration ?? 0);
    const clipStart = Number(asset.clip_start_seconds); const requestedDuration = Number(asset.clip_duration_seconds);
    if (!sourceDuration || sourceDuration > 900 || !Number.isFinite(clipStart) || clipStart < 0 || !Number.isFinite(requestedDuration) || requestedDuration <= 0 || requestedDuration > 15 || clipStart >= sourceDuration) throw new Error('audio_clip_invalid');
    const clipDuration = Math.min(requestedDuration, 15, sourceDuration - clipStart);
    execFileSync('ffmpeg', ['-y', '-ss', clipStart.toFixed(3), '-i', inputPath, '-t', clipDuration.toFixed(3), '-vn', '-map_metadata', '-1', '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', outputPath], { stdio: 'inherit' });
    const audio = readFileSync(outputPath); const audioKey = `${base}/app.mp3`;
    const result = await putVerified(audioKey, audio, 'audio/mpeg'); checksum = result.checksum;
    update = { app_audio_key: audioKey, r2_audio_key: result.backedUp ? audioKey : null, duration_seconds: clipDuration, checksum_sha256: checksum };
  }

  await client.from('media_assets').update({ ...update, state: 'ready', updated_at: new Date().toISOString() }).eq('id', asset.id);
  await client.from('media_jobs').update({ state: 'ready', finished_at: new Date().toISOString() }).eq('id', jobId);
  await client.storage.from('incoming').remove([asset.incoming_key]);
  await client.from('audit_events').insert({ actor_id: job.requested_by, event_type: 'media.ready', entity_type: 'media', entity_id: asset.id, payload: { kind: asset.kind, checksum, r2Backup: Boolean(r2) } });
  const { data: state } = await client.from('catalog_state').select('dirty_changes').eq('singleton', true).single();
  await client.from('catalog_state').update({ dirty: true, dirty_changes: Number(state?.dirty_changes ?? 0) + 1, last_changed_at: new Date().toISOString() }).eq('singleton', true);
  console.log(`Media ${asset.id} ready and verified in Supabase${r2 ? ' + R2' : ''}.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await client.from('media_assets').update({ state: 'failed', processing_error: message, updated_at: new Date().toISOString() }).eq('id', asset.id);
  await client.from('media_jobs').update({ state: 'failed', error: message, finished_at: new Date().toISOString() }).eq('id', jobId);
  throw error;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
