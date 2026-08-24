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
  const { data: profile, error: profileError } = await serviceClient().from('profiles').select('role,is_active').eq('id', data.user.id).single();
  if (profileError || !profile?.is_active || (adminOnly && profile.role !== 'admin')) throw new Error('forbidden');
  if (profile.role === 'admin') { const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel(); if (assuranceError || assurance?.currentLevel !== 'aal2') throw new Error('mfa_required'); }
  return { user: data.user, role: profile.role };
}
