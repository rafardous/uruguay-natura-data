import React, { act, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { MobileAuthProvider, useMobileAuth } from '../MobileAuthProvider';
import { getEditorAccess } from '../../lib/mobileApi';
import { mobileSupabase } from '../../lib/supabase';

let mockAuthEvent: (_event: string, session: Session | null) => void;
jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  mobileSupabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn((callback) => { mockAuthEvent = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; }),
    },
    from: jest.fn(),
  },
}));
jest.mock('../../lib/mobileApi', () => ({ getEditorAccess: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn() }));
jest.mock('expo-auth-session/build/QueryParams', () => ({ getQueryParams: jest.fn() }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-linking', () => ({ addEventListener: () => ({ remove: jest.fn() }), getInitialURL: async () => null }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: React.ReactElement) => { unmount: () => void } };
let root: ReturnType<typeof renderer.create>;
let auth: ReturnType<typeof useMobileAuth>;
function Probe() { const value = useMobileAuth(); useEffect(() => { auth = value; }, [value]); return null; }
const session = (id: string) => ({ user: { id } }) as Session;
beforeEach(() => {
  jest.mocked(mobileSupabase!.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
  jest.mocked(mobileSupabase!.from).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) } as never);
  jest.mocked(getEditorAccess).mockReset().mockResolvedValue(true);
});
afterEach(async () => { await act(async () => root.unmount()); });
async function mount() { await act(async () => { root = renderer.create(<MobileAuthProvider><Probe /></MobileAuthProvider>); }); }

test('la sesión móvil ordinaria no habilita el permiso editorial', async () => {
  jest.mocked(getEditorAccess).mockResolvedValue(false);
  await mount();
  await act(async () => mockAuthEvent('SIGNED_IN', session('mobile')));
  expect(auth.session?.user.id).toBe('mobile');
  expect(auth.editorAccess).toBe(false);
});
test('un error de red deja el acceso desconocido sin bloquear el arranque', async () => {
  jest.mocked(getEditorAccess).mockRejectedValue(new Error('offline'));
  await mount();
  await act(async () => mockAuthEvent('SIGNED_IN', session('editor')));
  expect(auth.loading).toBe(false);
  expect(auth.editorAccess).toBeNull();
});
test('una respuesta editorial atrasada no vuelve a habilitar acceso después de salir', async () => {
  let finish!: (value: boolean) => void;
  jest.mocked(getEditorAccess).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await mount();
  await act(async () => mockAuthEvent('SIGNED_IN', session('editor')));
  expect(auth.editorAccess).toBeNull();
  await act(async () => mockAuthEvent('SIGNED_OUT', null));
  await act(async () => finish(true));
  expect(auth.session).toBeNull();
  expect(auth.editorAccess).toBeNull();
});
