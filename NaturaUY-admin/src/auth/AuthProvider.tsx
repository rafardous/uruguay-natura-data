import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import type { Profile } from '../domain';
import { supabase, supabaseConfigurationError } from '../lib/supabase';

interface AuthState {
  loading: boolean;
  profile: Profile | null;
  configurationError: string | null;
  accessDenied: boolean;
  passwordFlow: 'invite' | 'recovery' | null;
  signIn(email: string, password: string): Promise<string | null>;
  signInWithGoogle(): Promise<string | null>;
  setPassword(password: string): Promise<string | null>;
  resetPassword(email: string): Promise<string | null>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const initialPasswordFlow = (): AuthState['passwordFlow'] => {
  if (typeof window === 'undefined') return null;
  if (new URLSearchParams(window.location.search).get('reset') === '1' || window.location.hash.includes('type=recovery')) return 'recovery';
  if (window.location.hash.includes('type=invite')) return 'invite';
  return null;
};

async function loadProfile(session: Session): Promise<Profile | null> {
  if (!supabase) return null;
  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from('profiles').select('user_id, display_name').eq('user_id', session.user.id).single(),
    supabase.from('editor_access').select('role, active').eq('user_id', session.user.id).single(),
  ]);
  if (profileError || membershipError || !profile || !membership?.active) return null;
  return { id: profile.user_id, displayName: profile.display_name, email: session.user.email ?? '', role: membership.role, active: membership.active };
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [loading, setLoading] = useState(Boolean(supabase));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [passwordFlow, setPasswordFlow] = useState<AuthState['passwordFlow']>(initialPasswordFlow);

  async function resolveSession(session: Session): Promise<void> {
    if (!supabase) return;
    const nextProfile = await loadProfile(session);
    setProfile(nextProfile);
    setAccessDenied(!nextProfile);
    setLoading(false);
  }

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(async ({ data }) => { if (data.session && !passwordFlow) await resolveSession(data.session); else { setProfile(null); setAccessDenied(false); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) { setProfile(null); setAccessDenied(false); setLoading(false); return; }
      if (event === 'PASSWORD_RECOVERY') { setPasswordFlow('recovery'); setProfile(null); setLoading(false); return; }
      if (passwordFlow) { setProfile(null); setLoading(false); return; }
      void resolveSession(session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => ({
    loading, profile, configurationError: supabaseConfigurationError, accessDenied, passwordFlow,
    async signIn(email, password) {
      if (!supabase) return supabaseConfigurationError ?? 'Supabase no está disponible.';
      const { error } = await supabase.auth.signInWithPassword({ email, password }); return error?.message ?? null;
    },
    async signInWithGoogle() {
      if (!supabase) return supabaseConfigurationError ?? 'Supabase no está disponible.';
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/login` } });
      return error?.message ?? null;
    },
    async setPassword(password) {
      if (!supabase) return supabaseConfigurationError ?? 'Supabase no está disponible.';
      if (password.length < 12) return 'Usá al menos 12 caracteres.';
      const { error } = await supabase.auth.updateUser({ password }); if (error) return error.message;
      setPasswordFlow(null); window.history.replaceState({}, '', '/login'); const { data } = await supabase.auth.getSession(); if (data.session) await resolveSession(data.session);
      return null;
    },
    async resetPassword(email) {
      if (!supabase) return supabaseConfigurationError ?? 'Supabase no está disponible.';
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login?reset=1` }); return error?.message ?? null;
    },
    async signOut() { if (supabase) await supabase.auth.signOut(); setProfile(null); setAccessDenied(false); },
  }), [loading, profile, accessDenied, passwordFlow]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value;
}
