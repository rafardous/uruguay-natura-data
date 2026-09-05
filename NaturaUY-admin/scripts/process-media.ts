import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';

import { adminClient, required } from './shared';

const mediaId = required('MEDIA_ID');
const client = adminClient();
const { data: media, error: mediaError } = await client.from('species_media').select('*').eq('id', mediaId).single();
if (mediaError || !media) throw mediaError ?? new Error('media_not_found');
if (!['reserved', 'failed'].includes(media.status)) throw new Error(`media_not_processable:${media.status}`);
if (!media.incoming_path) throw new Error('incoming_path_missing');

const temp = mkdtempSync(join(tmpdir(), 'natura-media-'));
const sha = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');
const basePath = `${media.species_id ?? `change-${media.change_id}`}/${media.id}`;

async function putVerified(path: string, body: Uint8Array, contentType: string) {
  const checksum = sha(body);
  const { error } = await client.storage.from('media-public').upload(path, body, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  const { data: copy, error: readError } = await client.storage.from('media-public').download(path);
  if (readError || !copy || sha(new Uint8Array(await copy.arrayBuffer())) !== checksum) throw new Error(`storage_verification_failed:${path}`);
  return checksum;
}

await client.from('species_media').update({ status: 'processing', processing_error: null }).eq('id', mediaId);

try {
  const { data: incoming, error } = await client.storage.from('incoming').download(media.incoming_path);
  if (error || !incoming) throw error ?? new Error('incoming_missing');
  const original = new Uint8Array(await incoming.arrayBuffer());
  const scanPath = join(temp, 'original-upload');
  writeFileSync(scanPath, original);
  execFileSync('clamscan', ['--no-summary', scanPath], { stdio: 'inherit' });
  let checksum: string;
  let storagePath: string;
  let thumbnailPath: string | null = null;

  if (media.type === 'image') {
    if (original.length > 20 * 1024 * 1024) throw new Error('image_too_large');
    const input = sharp(original, { failOn: 'error', limitInputPixels: 50_000_000 });
    const metadata = await input.metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'heif'].includes(metadata.format) || !metadata.width || !metadata.height || metadata.width * metadata.height > 50_000_000) throw new Error('image_invalid');
    const main = await input.clone().rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
    const thumbnail = await input.clone().rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76, effort: 5 }).toBuffer();
    storagePath = `${basePath}.webp`; thumbnailPath = `${basePath}-480.webp`;
    checksum = await putVerified(storagePath, main, 'image/webp');
    await putVerified(thumbnailPath, thumbnail, 'image/webp');
  } else if (media.type === 'audio') {
    if (original.length > 5 * 1024 * 1024) throw new Error('audio_too_large');
    const inputPath = join(temp, 'clip.wav'); const outputPath = join(temp, 'app.mp3');
    writeFileSync(inputPath, original);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=channels,sample_rate', '-of', 'json', inputPath], { encoding: 'utf8' })) as { format?: { duration?: string }; streams?: Array<{ channels?: number; sample_rate?: string }> };
    const duration = Number(probe.format?.duration ?? 0); const audio = probe.streams?.[0];
    if (!duration || duration > 15.05 || audio?.channels !== 1 || Number(audio.sample_rate) !== 48000) throw new Error('audio_clip_invalid');
    execFileSync('ffmpeg', ['-y', '-i', inputPath, '-vn', '-map_metadata', '-1', '-ar', '48000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', outputPath], { stdio: 'inherit' });
    storagePath = `${basePath}.mp3`; checksum = await putVerified(storagePath, readFileSync(outputPath), 'audio/mpeg');
  } else throw new Error(`unsupported_media_type:${media.type}`);

  const { error: readyError } = await client.from('species_media').update({ status: 'ready', storage_path: storagePath, thumbnail_path: thumbnailPath, checksum_sha256: checksum, processed_at: new Date().toISOString(), processing_error: null }).eq('id', mediaId);
  if (readyError) throw readyError;
  const { error: removeError } = await client.storage.from('incoming').remove([media.incoming_path]);
  if (removeError) throw removeError;
  console.log(`Media ${media.id} processed and verified; the temporary original was removed.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await client.from('species_media').update({ status: 'failed', processing_error: message }).eq('id', mediaId);
  throw error;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
