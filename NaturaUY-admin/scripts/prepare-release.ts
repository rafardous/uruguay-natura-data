import { appendFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

import { adminClient, required } from './shared';

const client = adminClient();
let releaseId = process.env.CATALOG_RELEASE_ID?.trim() ?? '';
let lastPublishedAt: string | null = null;

if (!releaseId) {
  const [publishedResult, ...changes] = await Promise.all([
    client.from('catalog_releases').select('published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('species_changes').select('reviewed_at').eq('status', 'approved').order('reviewed_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('content_changes').select('reviewed_at').eq('status', 'approved').order('reviewed_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('species_media').select('processed_at').eq('status', 'approved').order('processed_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('species_observability_snapshots').select('generated_at').order('generated_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('taxon_content').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: latestPublished, error: publishedError } = publishedResult;
  const dirtyError = changes.find((result) => result.error)?.error;
  if (publishedError || dirtyError) throw publishedError ?? dirtyError;
  lastPublishedAt = latestPublished?.published_at ?? null;
  const dirty = changes.some(({ data }) => {
    const timestamp = data && Object.values(data)[0];
    return typeof timestamp === 'string' && (!lastPublishedAt || timestamp > lastPublishedAt);
  });
  if (dirty) {
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
      const [{ data: latest, error: latestError }] = await Promise.all([
        client.from('catalog_releases').select('version').order('version', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (latestError) throw latestError;
      const bundled = new DatabaseSync(resolve(import.meta.dirname, '../../NaturaUY-source/assets/db/natura.db'), { readOnly: true });
      const bundledVersion = Number((bundled.prepare("select value from meta where key='data_version'").get() as { value: string } | undefined)?.value ?? 0);
      bundled.close();
      const versionFloor = Number(process.env.CATALOG_DATA_VERSION_FLOOR ?? 1);
      if (!Number.isSafeInteger(versionFloor) || versionFloor < 1) throw new Error('CATALOG_DATA_VERSION_FLOOR inválido');
      const { data: created, error: createError } = await client.from('catalog_releases').insert({
        version: Math.max(Number(latest?.version ?? 0) + 1, bundledVersion + 1, versionFloor),
        schema_version: Number(process.env.CATALOG_SCHEMA_VERSION ?? 14),
        requested_by: required('EDITORIAL_SYSTEM_USER_ID'),
        min_app_version: '1.3.1',
      }).select('id').single();
      if (createError) throw createError;
      releaseId = created.id;
    }
  }
}

const shouldPublish = Boolean(releaseId);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `should_publish=${shouldPublish}\nrelease_id=${releaseId}\n`);
console.log(JSON.stringify({ shouldPublish, releaseId, lastPublishedAt }));
