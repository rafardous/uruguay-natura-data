import { adminClient } from './shared';

const client = adminClient(); const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
const { data, error } = await client.from('media_assets').select('id,incoming_key,uploaded_by').eq('state', 'failed').lt('updated_at', cutoff).not('incoming_key', 'is', null); if (error) throw error;
for (const asset of data ?? []) { const { error: removeError } = await client.storage.from('incoming').remove([asset.incoming_key]); if (removeError) { console.error(`${asset.id}: ${removeError.message}`); continue; } await client.from('media_assets').update({ incoming_key: `expired/${asset.id}`, updated_at: new Date().toISOString() }).eq('id', asset.id); await client.from('audit_events').insert({ actor_id: asset.uploaded_by, event_type: 'media.original_expired', entity_type: 'media', entity_id: asset.id }); }
console.log(`Expired ${(data ?? []).length} failed incoming uploads.`);
