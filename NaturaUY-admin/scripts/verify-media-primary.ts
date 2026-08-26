import { createHash } from 'node:crypto';
import { adminClient } from './shared';

const client = adminClient();
const { data, error } = await client.from('media_assets').select('id,kind,main_key,thumbnail_key,app_audio_key,checksum_sha256').eq('state', 'ready').not('checksum_sha256', 'is', null);
if (error) throw error;
const failures: string[] = [];
for (const asset of data ?? []) {
  const keys = [asset.main_key, asset.thumbnail_key, asset.app_audio_key].filter((value): value is string => Boolean(value));
  for (const key of keys) {
    const { data: stored, error: downloadError } = await client.storage.from('media-public').download(key);
    if (downloadError || !stored) { failures.push(`${asset.id}:${key}:missing`); continue; }
    if (key === asset.main_key || key === asset.app_audio_key) {
      const checksum = createHash('sha256').update(new Uint8Array(await stored.arrayBuffer())).digest('hex');
      if (checksum !== asset.checksum_sha256) failures.push(`${asset.id}:${key}:checksum_mismatch`);
    }
  }
}
if (failures.length) throw new Error(`Supabase media verification failed:\n${failures.join('\n')}`);
console.log(`Verified ${(data ?? []).length} ready media assets in Supabase Storage.`);
