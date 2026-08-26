import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.112.3';

export interface Actor { user: User; role: 'admin' | 'collaborator'; }

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const serviceClient = (): SupabaseClient => createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

export async function requireActor(request: Request, adminOnly = false): Promise<Actor> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) throw new Error('unauthorized');
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('unauthorized');
  const { data: membership, error: membershipError } = await serviceClient()
    .from('editor_memberships')
    .select('role,is_active,mfa_required')
    .eq('user_id', data.user.id)
    .single();
  if (membershipError || !membership?.is_active || (adminOnly && membership.role !== 'admin')) throw new Error('forbidden');
  if (membership.mfa_required) { const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel(); if (assuranceError || assurance?.currentLevel !== 'aal2') throw new Error('mfa_required'); }
  return { user: data.user, role: membership.role };
}
