import { requireActor, serviceClient } from '../_shared/auth.ts';
import { json, options } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const preflight = options(request); if (preflight) return preflight;
  try {
    const actor = await requireActor(request, true);
    const { email, displayName, role } = await request.json();
    if (typeof email !== 'string' || typeof displayName !== 'string' || !['admin', 'collaborator'].includes(role)) return json({ error: 'invalid_invitation' }, 400);
    const redirectTo = `${Deno.env.get('PUBLIC_APP_ORIGIN')}/login`;
    const { data, error } = await serviceClient().auth.admin.inviteUserByEmail(email.trim().toLowerCase(), { redirectTo, data: { display_name: displayName.trim(), role } });
    if (error) return json({ error: error.message }, 400);
    await serviceClient().from('audit_events').insert({ actor_id: actor.user.id, event_type: 'user.invited', entity_type: 'user', entity_id: data.user.id, payload: { role } });
    return json({ userId: data.user.id });
  } catch (error) { const message = error instanceof Error ? error.message : 'internal_error'; return json({ error: message }, message === 'unauthorized' ? 401 : ['forbidden', 'mfa_required'].includes(message) ? 403 : 500); }
});
