import { appendFileSync } from 'node:fs';
import { adminClient, required } from './shared';

const client = adminClient(); const requestedId = process.env.CATALOG_RELEASE_ID?.trim();
let releaseId = requestedId ?? '';
if (!releaseId) {
  const { data: state, error: stateError } = await client.from('catalog_state').select('dirty').eq('singleton', true).single(); if (stateError) throw stateError;
  if (state.dirty) {
    const { data: pending } = await client.from('catalog_releases').select('id').in('status', ['pending', 'building']).order('requested_at', { ascending: false }).limit(1).maybeSingle();
    if (pending) releaseId = pending.id;
    else {
      const [{ data: latest }, { data: audit }] = await Promise.all([client.from('catalog_releases').select('data_version').order('data_version', { ascending: false }).limit(1).maybeSingle(), client.from('audit_events').select('id').order('id', { ascending: false }).limit(1).maybeSingle()]);
      const { data: created, error } = await client.from('catalog_releases').insert({ data_version: Number(latest?.data_version ?? 0) + 1, requested_by: required('EDITORIAL_SYSTEM_USER_ID'), source_revision: audit?.id ?? 0 }).select('id').single(); if (error) throw error; releaseId = created.id;
    }
  }
}
const shouldPublish = Boolean(releaseId); const output = process.env.GITHUB_OUTPUT;
if (output) appendFileSync(output, `should_publish=${shouldPublish}\nrelease_id=${releaseId}\n`);
console.log(JSON.stringify({ shouldPublish, releaseId }));
