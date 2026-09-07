import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { useMobileAuth } from '../src/auth/MobileAuthProvider';
import { BackIcon, CheckIcon, LoginIcon } from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useMobileSync } from '../src/sync/MobileSyncProvider';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

function GoogleMark(): React.JSX.Element {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityLabel="Google">
      <Path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.25-.2-1.8H12v3.4h5.52a4.72 4.72 0 0 1-2.05 3.1v2.2h3.31c1.94-1.78 3.05-4.4 3.05-7.4l-.23.5Z" />
      <Path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.61-2.42l-3.14-2.43c-.87.58-1.98.93-3.47.93-2.6 0-4.8-1.76-5.59-4.12H3.17v2.5A10 10 0 0 0 12 22Z" />
      <Path fill="#FBBC05" d="M6.41 13.96A6.04 6.04 0 0 1 6.1 12c0-.68.12-1.34.31-1.96v-2.5H3.17A10 10 0 0 0 2 12c0 1.61.39 3.14 1.17 4.46l3.24-2.5Z" />
      <Path fill="#EA4335" d="M12 5.92c1.47 0 2.79.5 3.82 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.83 5.54l3.24 2.5C7.2 7.68 9.4 5.92 12 5.92Z" />
    </Svg>
  );
}

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const { configured, loading, session, profile, signInWithGoogle, signOut, setPublicAlias } = useMobileAuth();
  const { status, requestSync } = useMobileSync();
  const [alias, setAlias] = useState(profile?.publicAlias ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => setAlias(profile?.publicAlias ?? ''), [profile?.publicAlias]);
  const avatarUrl = profile?.avatarUrl ?? (typeof session?.user.user_metadata?.avatar_url === 'string' ? session.user.user_metadata.avatar_url : typeof session?.user.user_metadata?.picture === 'string' ? session.user.user_metadata.picture : null);
  useEffect(() => setAvatarFailed(false), [avatarUrl]);
  useEffect(() => {
    if (session && params.returnTo) router.replace(params.returnTo as never);
  }, [params.returnTo, router, session]);
  useEffect(() => {
    if (session) setMessage('');
  }, [session]);

  const goBack = (): void => {
    haptics.tap();
    if (session) router.replace('/');
    else router.back();
  };

  async function connect(): Promise<void> {
    haptics.press();
    setBusy(true); setMessage('');
    const error = await signInWithGoogle(params.returnTo);
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
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Volver" style={({ pressed }) => [styles.back, elevation.low, { backgroundColor: pressed ? colors.surfaceContainer : colors.surface, borderColor: colors.border, borderRadius: radius.pill }]}>
          <BackIcon color={colors.text} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={[styles.card, elevation.medium, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl }]}>
          <View style={[styles.icon, { backgroundColor: colors.primaryContainer, borderRadius: radius.pill }]}>
            {session && avatarUrl && !avatarFailed ? <Image source={{ uri: avatarUrl }} contentFit="cover" onError={() => setAvatarFailed(true)} style={styles.avatar} /> : session ? <CheckIcon color={colors.onPrimaryContainer} size={30} /> : <LoginIcon color={colors.onPrimaryContainer} size={30} />}
          </View>

          {session ? <>
            <Text style={[typography.title, styles.center, { color: colors.text, marginTop: spacing.lg }]}>Tu cuenta Natura UY</Text>
            <Text style={[typography.body, styles.center, { color: colors.textMuted, marginTop: spacing.sm }]}>Conectado como {profile?.displayName ?? session.user.email ?? 'usuario'}.</Text>
            {message ? <Text style={[typography.caption, styles.center, { color: message.startsWith('Alias guardado') ? colors.primary : colors.favorite, marginTop: spacing.md }]}>{message}</Text> : null}

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
              <Text style={[typography.caption, { color: colors.textMuted }]}>Sincroniza tus favoritos y récords de este teléfono con tu cuenta para recuperarlos en otros dispositivos. El catálogo sigue disponible sin conexión.</Text>
              <Pressable onPress={() => void signOut()} style={styles.signOut}><Text style={[typography.label, { color: colors.textMuted }]}>Cerrar sesión</Text></Pressable>
            </View>
          </> : <>
            <Text style={[typography.title, styles.center, { color: colors.text, marginTop: spacing.lg }]}>Guardá todo lo que aprendés</Text>
            <Text style={[typography.body, styles.center, { color: colors.textMuted, marginTop: spacing.sm }]}>¡Iniciá sesión para no perder tus avances de aprendizaje, favoritos y récords de juego! También vas a acceder a nuevas funcionalidades a medida que lleguen.</Text>

            <View style={[styles.benefits, { marginTop: spacing.lg }]}>
              {['Aprendizaje', 'Favoritos', 'Récords'].map((benefit) => <View key={benefit} style={[styles.benefit, { backgroundColor: colors.primaryContainer, borderRadius: radius.pill }]}><Text style={[typography.caption, { color: colors.onPrimaryContainer }]}>{benefit}</Text></View>)}
            </View>

            {!configured && <Text style={[typography.caption, styles.center, { color: colors.textMuted, marginTop: spacing.lg }]}>Este build necesita las variables públicas de Supabase para habilitar Google y la sincronización.</Text>}
            {message ? <Text style={[typography.caption, styles.center, { color: colors.favorite, marginTop: spacing.md }]}>{message}</Text> : null}

            {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : (
              <Pressable disabled={!configured || busy} onPress={() => void connect()} style={({ pressed }) => [styles.googleButton, { borderRadius: radius.md, opacity: !configured || busy ? 0.45 : pressed ? 0.84 : 1, marginTop: spacing.xl }]}>
                {busy ? <ActivityIndicator color="#4285F4" /> : <><GoogleMark /><Text style={[typography.label, styles.googleText]}>Continuar con Google</Text></>}
              </Pressable>
            )}

            <View style={[styles.dividerRow, { marginVertical: spacing.lg }]}><View style={[styles.divider, { backgroundColor: colors.border }]} /><Text style={[typography.caption, { color: colors.textMuted }]}>o</Text><View style={[styles.divider, { backgroundColor: colors.border }]} /></View>

            <View style={[styles.emailPanel, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.lg }]}>
              <View style={styles.emailHeading}><Text style={[typography.label, { color: colors.text }]}>Usar correo electrónico</Text><Text style={[typography.eyebrow, { color: colors.textMuted }]}>PRÓXIMAMENTE</Text></View>
              <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="Correo electrónico" placeholderTextColor={colors.textMuted} style={[styles.input, typography.body, { color: colors.text, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }]} />
              <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="Contraseña" placeholderTextColor={colors.textMuted} style={[styles.input, typography.body, { color: colors.text, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface }]} />
              <Pressable disabled style={[styles.primaryButton, { backgroundColor: colors.surfaceVariant, borderRadius: radius.pill, opacity: 0.68 }]} accessibilityLabel="Ingresar o crear cuenta, próximamente">
                <Text style={[typography.label, { color: colors.textMuted }]}>Ingresar o crear cuenta</Text>
              </Pressable>
            </View>
          </>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  card: { width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center' },
  center: { textAlign: 'center' },
  icon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: 76, height: 76 },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  benefit: { paddingHorizontal: 12, paddingVertical: 7 },
  googleButton: { minHeight: 52, width: '100%', paddingHorizontal: 18, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DADCE0', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  googleText: { color: '#3C4043' },
  dividerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: StyleSheet.hairlineWidth, flex: 1 },
  emailPanel: { width: '100%', padding: 14, gap: 10, borderWidth: StyleSheet.hairlineWidth },
  emailHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  primaryButton: { minHeight: 50, width: '100%', paddingHorizontal: 20, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  signOut: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
