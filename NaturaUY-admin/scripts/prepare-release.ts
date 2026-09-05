import { appendFileSync } from 'node:fs';

import { adminClient, required } from './shared';

const client = adminClient();
let releaseId = process.env.CATALOG_RELEASE_ID?.trim() ?? '';

if (!releaseId) {
  const { data: state, error: stateError } = await client.from('catalog_state').select('dirty').eq('singleton', true).single();
  if (stateError) throw stateError;
  if (state.dirty) {
    const { data: pending, error: pendingError } = await client
      .from('catalog_releases')
      .select('id')
      .in('status', ['pending', 'building'])
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingError) throw pendingError;
    if (pending) {
      releaseId = pending.id;
    } else {
      const [{ data: latest, error: latestError }, { data: audit, error: auditError }] = await Promise.all([
        client.from('catalog_releases').select('version').order('version', { ascending: false }).limit(1).maybeSingle(),
        client.from('species_audit').select('id').order('id', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (latestError) throw latestError;
      if (auditError) throw auditError;
      const { data: created, error: createError } = await client.from('catalog_releases').insert({
        version: Number(latest?.version ?? 0) + 1,
        schema_version: 5,
        requested_by: required('EDITORIAL_SYSTEM_USER_ID'),
        source_audit_id: audit?.id ?? null,
      }).select('id').single();
      if (createError) throw createError;
      releaseId = created.id;
    }
  }
}

const shouldPublish = Boolean(releaseId);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `should_publish=${shouldPublish}\nrelease_id=${releaseId}\n`);
console.log(JSON.stringify({ shouldPublish, releaseId }));
