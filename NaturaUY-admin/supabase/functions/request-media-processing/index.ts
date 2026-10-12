import { requireActor, serviceClient } from '../_shared/auth.ts';
import { json, options } from '../_shared/http.ts';

function isLocalSupabase(): boolean {
  try {
    const hostname = new URL(Deno.env.get('SUPABASE_URL') ?? '').hostname;
    return ['kong', 'localhost', '127.0.0.1', 'host.docker.internal'].includes(hostname);
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  const preflight = options(request); if (preflight) return preflight;
  const respond = (body: unknown, status = 200) => json(body, status, request);
  try {
    const actor = await requireActor(request); const { mediaId } = await request.json();
    const { data: media } = await serviceClient().from('species_media').select('id,uploaded_by,status').eq('id', mediaId).single();
    if (!media || (media.uploaded_by !== actor.user.id && actor.role !== 'admin') || !['reserved', 'failed'].includes(media.status)) return respond({ error: 'media_not_dispatchable' }, 409);
    const repository = Deno.env.get('GITHUB_REPOSITORY')?.trim();
    const dispatchToken = Deno.env.get('GITHUB_DISPATCH_TOKEN')?.trim();
    if (!repository || !dispatchToken) {
      if (isLocalSupabase()) return respond({ ok: true, queued: true, dispatched: false }, 202);
      return respond({ error: 'github_dispatch_not_configured' }, 503);
    }
    const response = await fetch(`https://api.github.com/repos/${repository}/dispatches`, { method: 'POST', headers: { Authorization: `Bearer ${dispatchToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'process-media', client_payload: { media_id: mediaId } }) });
    if (!response.ok) return respond({ error: `github_dispatch_${response.status}` }, 502);
    return respond({ ok: true });
  } catch (error) { const message = error instanceof Error ? error.message : 'internal_error'; return respond({ error: message }, message === 'unauthorized' ? 401 : message === 'forbidden' ? 403 : 500); }
});
