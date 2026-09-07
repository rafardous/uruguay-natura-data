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
  signInWithGoogle(returnTo?: string): Promise<string | null>;
  completeOAuthFromUrl(url: string): Promise<string>;
  signOut(): Promise<void>;
  setPublicAlias(alias: string): Promise<string | null>;
}

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);
const DEFAULT_RETURN_TO = '/login';
const handledAuthCodes = new Set<string>();
const inFlightAuthCodes = new Map<string, Promise<void>>();

function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_RETURN_TO;
  return value;
}

function redirectUriFor(returnTo?: string): string {
  const safe = safeReturnTo(returnTo);
  return makeRedirectUri({
    scheme: 'naturauy',
    path: 'auth/callback',
    queryParams: { returnTo: safe },
  });
}

async function createSessionFromUrl(url: string): Promise<void> {
  if (!mobileSupabase) return;
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode || params.error) throw new Error(String(params.error_description ?? params.error ?? errorCode));
  const code = typeof params.code === 'string' ? params.code : null;
  if (code) {
    if (handledAuthCodes.has(code)) return;
    const existing = inFlightAuthCodes.get(code);
    if (existing) return existing;
    const exchange = (async () => {
      const { error } = await mobileSupabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      handledAuthCodes.add(code);
    })();
    inFlightAuthCodes.set(code, exchange);
    try {
      await exchange;
    } finally {
      inFlightAuthCodes.delete(code);
    }
    return;
  }
  const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
  const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : null;
  if (accessToken && refreshToken) {
    const { error } = await mobileSupabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  }
}

function returnToFromUrl(url: string): string {
  const { params } = QueryParams.getQueryParams(url);
  return safeReturnTo(params.returnTo);
}

async function loadProfile(userId: string): Promise<MobileProfile | null> {
  if (!mobileSupabase) return null;
  const { data, error } = await mobileSupabase
    .from('profiles')
    .select('user_id,display_name,public_alias,avatar_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? {
    id: data.user_id,
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
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void createSessionFromUrl(url).catch(() => undefined);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void createSessionFromUrl(url).catch(() => undefined);
    });
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
    async signInWithGoogle(returnTo = DEFAULT_RETURN_TO) {
      if (!mobileSupabase) return 'La sincronización todavía no está configurada.';
      const redirectTo = redirectUriFor(returnTo);
      const { data, error } = await mobileSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
      });
      if (error) return error.message;
      if (Platform.OS === 'web') return null;
      const result = await WebBrowser.openAuthSessionAsync(data.url ?? '', redirectTo);
      if (result.type !== 'success') {
        // The deep-link listener can finish the exchange before the browser
        // session reports that it was dismissed. The session is authoritative
        // in that race, so never turn a successful login into a red error.
        const current = await mobileSupabase.auth.getSession();
        if (current.data.session || result.type === 'cancel' || result.type === 'dismiss') return null;
        return 'No se pudo completar el acceso con Google.';
      }
      try {
        await createSessionFromUrl(result.url);
        return null;
      } catch (reason) {
        const current = await mobileSupabase.auth.getSession();
        if (current.data.session) return null;
        return reason instanceof Error ? reason.message : 'No se pudo completar el acceso con Google.';
      }
    },
    async completeOAuthFromUrl(url) {
      try {
        await createSessionFromUrl(url);
        return returnToFromUrl(url);
      } catch (reason) {
        throw reason instanceof Error ? reason : new Error('No se pudo completar el acceso con Google.');
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
