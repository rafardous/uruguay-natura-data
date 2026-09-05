import { adminClient } from './shared';

const client = adminClient();
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data: jobs, error } = await client.from('species_media').select('id,incoming_path').eq('status', 'failed').lt('created_at', cutoff);
if (error) throw error;
for (const job of jobs ?? []) {
  const { error: removeError } = await client.storage.from('incoming').remove([job.incoming_path]);
  if (removeError) { console.error(`${job.id}: ${removeError.message}`); continue; }
  await client.from('species_media').update({ incoming_path: `expired/${job.id}` }).eq('id', job.id);
}
console.log(`Expired ${jobs?.length ?? 0} failed incoming uploads.`);
