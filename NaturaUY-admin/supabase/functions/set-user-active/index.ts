import { requireActor, serviceClient } from '../_shared/auth.ts';
import { json, options } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const preflight = options(request); if (preflight) return preflight;
  try {
    const actor = await requireActor(request, true); const { userId, active } = await request.json();
    if (typeof userId !== 'string' || typeof active !== 'boolean' || userId === actor.user.id) return json({ error: 'invalid_user_change' }, 400);
    const { error } = await serviceClient().from('profiles').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', userId);
    if (error) return json({ error: error.message }, 400);
    await serviceClient().from('audit_events').insert({ actor_id: actor.user.id, event_type: active ? 'user.activated' : 'user.disabled', entity_type: 'user', entity_id: userId });
    return json({ ok: true });
  } catch (error) { const message = error instanceof Error ? error.message : 'internal_error'; return json({ error: message }, message === 'unauthorized' ? 401 : ['forbidden', 'mfa_required'].includes(message) ? 403 : 500); }
});
