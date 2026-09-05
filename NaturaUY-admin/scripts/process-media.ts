import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

import sharp from 'sharp';

import { adminClient, required } from './shared';

const jobId = required('MEDIA_JOB_ID');
const client = adminClient();
const { data: job, error: jobError } = await client.from('media_jobs').select('*, species_media(*)').eq('id', jobId).single();
if (jobError) throw jobError;
if (!job.species_media) throw new Error('media_not_found');
if (!['pending', 'failed'].includes(job.status)) throw new Error(`job_not_processable:${job.status}`);
const media = job.species_media;
const temp = mkdtempSync(join(tmpdir(), 'natura-media-'));
const sha = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');

async function putVerified(path: string, body: Uint8Array, contentType: string) {
  const checksum = sha(body);
  const { error } = await client.storage.from('media-public').upload(path, body, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  const { data: copy, error: readError } = await client.storage.from('media-public').download(path);
  if (readError || !copy || sha(new Uint8Array(await copy.arrayBuffer())) !== checksum) throw new Error(`storage_verification_failed:${path}`);
  return checksum;
}

await client.from('media_jobs').update({
  status: 'processing',
  started_at: new Date().toISOString(),
  finished_at: null,
  attempts: Number(job.attempts ?? 0) + 1,
  error: null,
}).eq('id', jobId);

try {
  const { data: incoming, error } = await client.storage.from('incoming').download(job.incoming_path);
  if (error || !incoming) throw error ?? new Error('incoming_missing');
  const original = new Uint8Array(await incoming.arrayBuffer());
  const scanPath = join(temp, 'original-upload');
  writeFileSync(scanPath, original);
  execFileSync('clamscan', ['--no-summary', scanPath], { stdio: 'inherit' });
  let checksum: string;

  if (media.type === 'image') {
    if (original.length > 20 * 1024 * 1024) throw new Error('image_too_large');
    const input = sharp(original, { failOn: 'error', limitInputPixels: 50_000_000 });
    const metadata = await input.metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'heif'].includes(metadata.format)) throw new Error(`image_format_invalid:${metadata.format ?? 'unknown'}`);
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > 50_000_000) throw new Error('image_dimensions_invalid');
    const main = await input.clone().rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
    const thumbnail = await input.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
    checksum = await putVerified(media.storage_path, main, 'image/webp');
    await putVerified(media.thumbnail_path, thumbnail, 'image/webp');
  } else if (media.type === 'audio') {
    if (original.length > 45 * 1024 * 1024) throw new Error('audio_too_large');
    const inputPath = join(temp, `input${extname(job.incoming_path) || '.audio'}`);
    const outputPath = join(temp, 'app.mp3');
    writeFileSync(inputPath, original);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', inputPath], { encoding: 'utf8' })) as { format?: { duration?: string } };
    const sourceDuration = Number(probe.format?.duration ?? 0);
    const clipStart = Number(job.clip_start_seconds);
    const requestedDuration = Number(job.clip_duration_seconds);
    if (!sourceDuration || sourceDuration > 900 || !Number.isFinite(clipStart) || clipStart < 0 || !Number.isFinite(requestedDuration) || requestedDuration <= 0 || requestedDuration > 15 || clipStart >= sourceDuration) throw new Error('audio_clip_invalid');
    const clipDuration = Math.min(requestedDuration, 15, sourceDuration - clipStart);
    execFileSync('ffmpeg', ['-y', '-ss', clipStart.toFixed(3), '-i', inputPath, '-t', clipDuration.toFixed(3), '-vn', '-map_metadata', '-1', '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', outputPath], { stdio: 'inherit' });
    checksum = await putVerified(media.storage_path, readFileSync(outputPath), 'audio/mpeg');
  } else {
    throw new Error(`unsupported_media_type:${media.type}`);
  }

  const finishedAt = new Date().toISOString();
  const { error: readyError } = await client.from('media_jobs').update({ status: 'ready', finished_at: finishedAt }).eq('id', jobId);
  if (readyError) throw readyError;
  await client.storage.from('incoming').remove([job.incoming_path]);
  await client.from('audit_events').insert({
    actor_id: job.requested_by,
    event_type: 'media.processed',
    entity_type: 'species_media',
    entity_id: media.id,
    payload: { type: media.type, checksum },
  });
  console.log(`Media ${media.id} processed and verified in Supabase Storage; editorial approval remains pending.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await client.from('media_jobs').update({ status: 'failed', error: message, finished_at: new Date().toISOString() }).eq('id', jobId);
  throw error;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
