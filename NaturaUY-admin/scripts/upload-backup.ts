import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { required } from './shared';

const path = required('BACKUP_FILE'); const bucket = required('R2_BUCKET'); const client = new S3Client({ region: 'auto', endpoint: required('R2_ENDPOINT'), credentials: { accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') } });
const now = new Date(); const dailyKey = `backups/editorial/daily/${basename(path)}`; await client.send(new PutObjectCommand({ Bucket: bucket, Key: dailyKey, Body: readFileSync(path), ContentType: 'application/octet-stream' }));
if (now.getUTCDate() === 1) await client.send(new PutObjectCommand({ Bucket: bucket, Key: `backups/editorial/monthly/${now.toISOString().slice(0, 7)}.sql.gz.enc`, Body: readFileSync(path), ContentType: 'application/octet-stream' }));
async function retain(prefix: string, count: number) { const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })); const objects = [...(list.Contents ?? [])].sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0)); for (const item of objects.slice(count)) if (item.Key) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: item.Key })); }
await retain('backups/editorial/daily/', 30); await retain('backups/editorial/monthly/', 12); console.log(`Uploaded encrypted backup ${dailyKey}.`);
