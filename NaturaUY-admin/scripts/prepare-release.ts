import { appendFileSync } from 'node:fs';

import { adminClient, required } from './shared';

const client = adminClient();
let releaseId = process.env.CATALOG_RELEASE_ID?.trim() ?? '';
let lastPublishedAt: string | null = null;

if (!releaseId) {
  const [
    { data: latestPublished, error: publishedError },
    { data: newestChange, error: dirtyError },
    { data: newestMedia, error: mediaError },
  ] = await Promise.all([
    client.from('catalog_releases').select('published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('species_changes').select('reviewed_at').eq('status', 'approved').order('reviewed_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('species_media').select('processed_at').eq('status', 'approved').order('processed_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (publishedError || dirtyError || mediaError) throw publishedError ?? dirtyError ?? mediaError;
  lastPublishedAt = latestPublished?.published_at ?? null;
  const newestDirtyAt = [newestChange?.reviewed_at, newestMedia?.processed_at]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0];
  if (newestDirtyAt && (!latestPublished?.published_at || newestDirtyAt > latestPublished.published_at)) {
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
      const { data: created, error: createError } = await client.from('catalog_releases').insert({
        version: Number(latest?.version ?? 0) + 1,
        schema_version: 14,
        requested_by: required('EDITORIAL_SYSTEM_USER_ID'),
        min_app_version: '1.3.0',
      }).select('id').single();
      if (createError) throw createError;
      releaseId = created.id;
    }
  }
}

const shouldPublish = Boolean(releaseId);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `should_publish=${shouldPublish}\nrelease_id=${releaseId}\n`);
console.log(JSON.stringify({ shouldPublish, releaseId, lastPublishedAt }));
