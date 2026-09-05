import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useMobileAuth } from '../src/auth/MobileAuthProvider';
import { BackIcon, CheckIcon, LoginIcon } from '../src/presentation/components/TabIcons';
import { useMobileSync } from '../src/sync/MobileSyncProvider';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const { configured, loading, session, profile, signInWithGoogle, signOut, setPublicAlias } = useMobileAuth();
  const { status, requestSync } = useMobileSync();
  const [alias, setAlias] = useState(profile?.publicAlias ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setAlias(profile?.publicAlias ?? ''), [profile?.publicAlias]);

  async function connect(): Promise<void> {
    setBusy(true); setMessage('');
    const error = await signInWithGoogle();
    if (error) setMessage(error);
    setBusy(false);
  }

  async function saveAlias(): Promise<void> {
    setBusy(true); setMessage('');
    const error = await setPublicAlias(alias);
    setMessage(error ?? 'Alias guardado. Ya podés aparecer en los rankings.');
    setBusy(false);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" style={({ pressed }) => [styles.back, { backgroundColor: pressed ? colors.surfaceContainer : colors.surface, borderColor: colors.border, borderRadius: radius.pill }]}>
        <BackIcon color={colors.text} />
      </Pressable>

      <View style={[styles.card, elevation.medium, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl }]}>
        <View style={[styles.icon, { backgroundColor: colors.primaryContainer, borderRadius: radius.lg }]}>
          {session ? <CheckIcon color={colors.onPrimaryContainer} size={30} /> : <LoginIcon color={colors.onPrimaryContainer} size={30} />}
        </View>
        <Text style={[typography.title, { color: colors.text, marginTop: spacing.lg, textAlign: 'center' }]}>{session ? 'Tu cuenta Natura UY' : 'Guardá tus avances'}</Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
          {session ? `Conectado como ${profile?.displayName ?? session.user.email ?? 'usuario'}.` : 'La app sigue funcionando sin cuenta. Google permite recuperar favoritos y récords en otros dispositivos.'}
        </Text>

        {!configured && <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' }]}>La sincronización se habilitará al completar el despliegue de Supabase.</Text>}
        {message ? <Text style={[typography.caption, { color: message.startsWith('Alias guardado') ? colors.primary : colors.favorite, marginTop: spacing.md, textAlign: 'center' }]}>{message}</Text> : null}

        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} /> : !session ? (
          <Pressable disabled={!configured || busy} onPress={() => void connect()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, borderRadius: radius.pill, opacity: !configured || busy ? 0.45 : pressed ? 0.85 : 1, marginTop: spacing.xl }]}>
            {busy ? <ActivityIndicator color={colors.onPrimary} /> : <><LoginIcon color={colors.onPrimary} /><Text style={[typography.label, { color: colors.onPrimary }]}>Continuar con Google</Text></>}
          </Pressable>
        ) : (
          <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.md }}>
            <Text style={[typography.eyebrow, { color: colors.textMuted }]}>ALIAS PÚBLICO</Text>
            <TextInput value={alias} onChangeText={setAlias} autoCapitalize="none" autoCorrect={false} maxLength={24} placeholder="ejemplo: natura_uy" placeholderTextColor={colors.textMuted} style={[styles.input, typography.body, { color: colors.text, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background }]} />
            <Text style={[typography.caption, { color: colors.textMuted }]}>Entre 3 y 24 letras, números o guion bajo. Es lo único que verá el ranking.</Text>
            <Pressable disabled={busy || alias.length < 3} onPress={() => void saveAlias()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, borderRadius: radius.pill, opacity: busy || alias.length < 3 ? 0.45 : pressed ? 0.85 : 1 }]}>
              <Text style={[typography.label, { color: colors.onPrimary }]}>Guardar alias</Text>
            </Pressable>
            <Pressable disabled={status === 'syncing'} onPress={() => void requestSync()} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, borderRadius: radius.pill, opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[typography.label, { color: colors.text }]}>{status === 'syncing' ? 'Sincronizando…' : status === 'error' ? 'Reintentar sincronización' : 'Sincronizar ahora'}</Text>
            </Pressable>
            <Pressable onPress={() => void signOut()} style={styles.signOut}><Text style={[typography.label, { color: colors.textMuted }]}>Cerrar sesión</Text></Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  card: { marginTop: 'auto', marginBottom: 'auto', alignItems: 'center' },
  icon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { minHeight: 50, width: '100%', paddingHorizontal: 20, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 50, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  signOut: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
