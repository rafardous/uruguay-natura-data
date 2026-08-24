import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import type { Profile } from '../domain';
import { demoProfile } from '../lib/demo';
import { isDemoMode, supabase } from '../lib/supabase';

interface AuthState {
  loading: boolean;
  profile: Profile | null;
  demo: boolean;
  mfa: { factorId: string; qrCode: string | null; secret: string | null } | null;
  passwordFlow: 'invite' | 'recovery' | null;
  signIn(email: string, password: string): Promise<string | null>;
  verifyMfa(code: string): Promise<string | null>;
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
  const { data, error } = await supabase.from('profiles').select('id, display_name, role, is_active, mfa_required').eq('id', session.user.id).single();
  if (error || !data?.is_active) return null;
  return { id: data.id, displayName: data.display_name, email: session.user.email ?? '', role: data.role, active: data.is_active, mfaRequired: data.mfa_required };
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [loading, setLoading] = useState(!isDemoMode);
  const [profile, setProfile] = useState<Profile | null>(isDemoMode ? demoProfile : null);
  const [mfa, setMfa] = useState<AuthState['mfa']>(null);
  const [passwordFlow, setPasswordFlow] = useState<AuthState['passwordFlow']>(initialPasswordFlow);

  async function resolveSession(session: Session): Promise<void> {
    if (!supabase) return;
    const nextProfile = await loadProfile(session);
    if (!nextProfile) { setProfile(null); setLoading(false); return; }
    if (nextProfile.role !== 'admin' && !nextProfile.mfaRequired) { setProfile(nextProfile); setMfa(null); setLoading(false); return; }
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel === 'aal2') { setProfile(nextProfile); setMfa(null); setLoading(false); return; }
    const { data: factors } = await supabase.auth.mfa.listFactors(); const verified = factors?.totp.find((factor) => factor.status === 'verified');
    if (verified) setMfa({ factorId: verified.id, qrCode: null, secret: null });
    else { const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Natura UY' }); if (error) { await supabase.auth.signOut(); setProfile(null); setLoading(false); return; } setMfa({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }); }
    setProfile(null); setLoading(false);
  }

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(async ({ data }) => { if (data.session && !passwordFlow) await resolveSession(data.session); else { setProfile(null); setLoading(false); } });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) { setProfile(null); setMfa(null); setLoading(false); return; }
      if (event === 'PASSWORD_RECOVERY') { setPasswordFlow('recovery'); setProfile(null); setLoading(false); return; }
      if (passwordFlow) { setProfile(null); setLoading(false); return; }
      void resolveSession(session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => ({
    loading, profile, demo: isDemoMode, mfa, passwordFlow,
    async signIn(email, password) {
      if (!supabase) { setProfile(demoProfile); return null; }
      const { error } = await supabase.auth.signInWithPassword({ email, password }); return error?.message ?? null;
    },
    async verifyMfa(code) {
      if (!supabase || !mfa) return 'No hay una verificación pendiente.';
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfa.factorId, code: code.trim() });
      if (error) return error.message;
      const { data } = await supabase.auth.getSession(); if (data.session) await resolveSession(data.session);
      return null;
    },
    async setPassword(password) {
      if (!supabase) return null;
      if (password.length < 12) return 'Usá al menos 12 caracteres.';
      const { error } = await supabase.auth.updateUser({ password }); if (error) return error.message;
      setPasswordFlow(null); window.history.replaceState({}, '', '/login'); const { data } = await supabase.auth.getSession(); if (data.session) await resolveSession(data.session);
      return null;
    },
    async resetPassword(email) {
      if (!supabase) return null;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login?reset=1` }); return error?.message ?? null;
    },
    async signOut() { if (supabase) await supabase.auth.signOut(); setMfa(null); setProfile(null); },
  }), [loading, profile, mfa, passwordFlow]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value;
}
