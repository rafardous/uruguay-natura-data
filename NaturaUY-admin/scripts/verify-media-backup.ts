import { createHash } from 'node:crypto';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { adminClient, required } from './shared';

const client = adminClient(); const r2 = new S3Client({ region: 'auto', endpoint: required('R2_ENDPOINT'), credentials: { accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') } }); const bucket = required('R2_BUCKET');
const { data, error } = await client.from('media_assets').select('id,main_key,thumbnail_key,app_audio_key,checksum_sha256').eq('state', 'ready').not('checksum_sha256', 'is', null); if (error) throw error;
const failures: string[] = [];
for (const asset of data ?? []) { for (const key of [asset.main_key, asset.thumbnail_key, asset.app_audio_key].filter((value): value is string => Boolean(value))) { try { const [{ data: primary, error: primaryError }, head] = await Promise.all([client.storage.from('media-public').download(key), r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))]); if (primaryError || !primary) { failures.push(`${asset.id}:${key}:primary_missing`); continue; } const checksum = createHash('sha256').update(new Uint8Array(await primary.arrayBuffer())).digest('hex'); if (!head.Metadata?.sha256) failures.push(`${asset.id}:${key}:missing_checksum`); else if (head.Metadata.sha256 !== checksum) failures.push(`${asset.id}:${key}:checksum_mismatch`); } catch { failures.push(`${asset.id}:${key}:backup_missing`); } } }
if (failures.length) throw new Error(`Media backup verification failed:\n${failures.join('\n')}`);
console.log(`Verified ${(data ?? []).length} ready media assets in R2.`);
