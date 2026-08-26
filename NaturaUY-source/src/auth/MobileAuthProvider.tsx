import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, mobileSupabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export interface MobileProfile {
  id: string;
  displayName: string;
  publicAlias: string | null;
  avatarUrl: string | null;
}

interface MobileAuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: MobileProfile | null;
  signInWithGoogle(): Promise<string | null>;
  signOut(): Promise<void>;
  setPublicAlias(alias: string): Promise<string | null>;
}

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);
const redirectTo = makeRedirectUri({ scheme: 'naturauy', path: 'auth/callback' });

async function createSessionFromUrl(url: string): Promise<void> {
  if (!mobileSupabase) return;
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(String(errorCode));
  const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
  const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;
  if (accessToken && refreshToken) {
    const { error } = await mobileSupabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  }
}

async function loadProfile(userId: string): Promise<MobileProfile | null> {
  if (!mobileSupabase) return null;
  const { data, error } = await mobileSupabase
    .from('profiles')
    .select('id,display_name,public_alias,avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? {
    id: data.id,
    displayName: data.display_name,
    publicAlias: data.public_alias,
    avatarUrl: data.avatar_url,
  } : null;
}

export function MobileAuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MobileProfile | null>(null);

  const resolveSession = useCallback(async (next: Session | null) => {
    setSession(next);
    if (!next) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      setProfile(await loadProfile(next.user.id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mobileSupabase) {
      setLoading(false);
      return;
    }
    void mobileSupabase.auth.getSession().then(({ data }) => resolveSession(data.session));
    const { data } = mobileSupabase.auth.onAuthStateChange((_event, next) => void resolveSession(next));
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => void createSessionFromUrl(url));
    void Linking.getInitialURL().then((url) => { if (url) void createSessionFromUrl(url); });
    return () => {
      data.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, [resolveSession]);

  const value = useMemo<MobileAuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    profile,
    async signInWithGoogle() {
      if (!mobileSupabase) return 'La sincronización todavía no está configurada.';
      const { data, error } = await mobileSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
      });
      if (error) return error.message;
      if (Platform.OS === 'web') return null;
      const result = await WebBrowser.openAuthSessionAsync(data.url ?? '', redirectTo);
      if (result.type !== 'success') return result.type === 'cancel' ? null : 'No se pudo completar el acceso con Google.';
      try {
        await createSessionFromUrl(result.url);
        return null;
      } catch (reason) {
        return reason instanceof Error ? reason.message : 'No se pudo completar el acceso con Google.';
      }
    },
    async signOut() {
      if (mobileSupabase) await mobileSupabase.auth.signOut();
    },
    async setPublicAlias(alias) {
      if (!mobileSupabase || !session) return 'Iniciá sesión para elegir un alias.';
      const { data, error } = await mobileSupabase.rpc('set_public_alias', { p_alias: alias.trim() });
      if (error) return error.message;
      setProfile((current) => current ? { ...current, publicAlias: String(data) } : current);
      return null;
    },
  }), [loading, profile, session]);

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>;
}

export function useMobileAuth(): MobileAuthContextValue {
  const value = useContext(MobileAuthContext);
  if (!value) throw new Error('useMobileAuth must be used inside <MobileAuthProvider>');
  return value;
}
