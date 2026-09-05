import { adminClient } from './shared';

const client = adminClient();
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data: jobs, error } = await client.from('media_jobs').select('id,incoming_path,requested_by').eq('status', 'failed').lt('finished_at', cutoff);
if (error) throw error;
for (const job of jobs ?? []) {
  const { error: removeError } = await client.storage.from('incoming').remove([job.incoming_path]);
  if (removeError) { console.error(`${job.id}: ${removeError.message}`); continue; }
  await client.from('media_jobs').update({ incoming_path: `expired/${job.id}` }).eq('id', job.id);
  await client.from('audit_events').insert({ actor_id: job.requested_by, event_type: 'media.original_expired', entity_type: 'media_job', entity_id: job.id });
}
console.log(`Expired ${jobs?.length ?? 0} failed incoming uploads.`);
