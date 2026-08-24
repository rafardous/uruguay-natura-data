import { requireActor, serviceClient } from '../_shared/auth.ts';
import { json, options } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const preflight = options(request); if (preflight) return preflight;
  try {
    const actor = await requireActor(request); const { jobId } = await request.json();
    const { data: job } = await serviceClient().from('media_jobs').select('id,requested_by,state').eq('id', jobId).single();
    if (!job || (job.requested_by !== actor.user.id && actor.role !== 'admin') || !['incoming', 'failed'].includes(job.state)) return json({ error: 'job_not_dispatchable' }, 409);
    const response = await fetch(`https://api.github.com/repos/${Deno.env.get('GITHUB_REPOSITORY')}/dispatches`, { method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('GITHUB_DISPATCH_TOKEN')}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'process-media', client_payload: { job_id: jobId } }) });
    if (!response.ok) return json({ error: `github_dispatch_${response.status}` }, 502);
    return json({ ok: true });
  } catch (error) { const message = error instanceof Error ? error.message : 'internal_error'; return json({ error: message }, message === 'unauthorized' ? 401 : ['forbidden', 'mfa_required'].includes(message) ? 403 : 500); }
});
