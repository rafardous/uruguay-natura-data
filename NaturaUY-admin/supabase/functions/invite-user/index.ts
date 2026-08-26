import { requireActor, serviceClient } from '../_shared/auth.ts';
import { json, options } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const preflight = options(request); if (preflight) return preflight;
  try {
    const actor = await requireActor(request, true);
    const { email, displayName, role } = await request.json();
    if (typeof email !== 'string' || typeof displayName !== 'string' || !['admin', 'collaborator'].includes(role)) return json({ error: 'invalid_invitation' }, 400);
    const admin = serviceClient();
    const normalizedEmail = email.trim().toLowerCase();
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return json({ error: listError.message }, 400);
    const existing = listed.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    let user = existing;
    let invitationSent = false;
    if (!user) {
      const redirectTo = `${Deno.env.get('PUBLIC_APP_ORIGIN')}/login`;
      const { data, error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo, data: { display_name: displayName.trim() } });
      if (error) return json({ error: error.message }, 400);
      user = data.user; invitationSent = true;
    }
    await admin.from('profiles').update({ display_name: displayName.trim(), updated_at: new Date().toISOString() }).eq('id', user.id);
    const { error: membershipError } = await admin.from('editor_memberships').upsert({
      user_id: user.id,
      role,
      is_active: true,
      mfa_required: role === 'admin',
      invited_by: actor.user.id,
      updated_at: new Date().toISOString(),
    });
    if (membershipError) {
      if (invitationSent) await admin.auth.admin.deleteUser(user.id);
      return json({ error: membershipError.message }, 400);
    }
    await admin.from('audit_events').insert({ actor_id: actor.user.id, event_type: 'user.invited', entity_type: 'user', entity_id: user.id, payload: { role, invitationSent } });
    return json({ userId: user.id, invitationSent });
  } catch (error) { const message = error instanceof Error ? error.message : 'internal_error'; return json({ error: message }, message === 'unauthorized' ? 401 : ['forbidden', 'mfa_required'].includes(message) ? 403 : 500); }
});
