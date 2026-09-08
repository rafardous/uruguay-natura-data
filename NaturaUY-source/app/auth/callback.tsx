import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useMobileAuth } from '../../src/auth/MobileAuthProvider';
import { BackIcon } from '../../src/presentation/components/TabIcons';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { haptics } from '../../src/presentation/haptics';

/**
 * Explicit deep-link landing screen for Google OAuth. The provider also listens
 * globally, so completing the same URL twice is safe and the screen can remain
 * a very small router boundary.
 */
export default function AuthCallbackScreen(): React.JSX.Element {
  const router = useRouter();
  const url = Linking.useURL();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const { completeOAuthFromUrl } = useMobileAuth();
  const { colors, radius, spacing, typography } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const paramsUrl = useMemo(() => {
    const query = Object.entries(params).flatMap(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      return values.filter((item): item is string => typeof item === 'string').map((item) => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
    }).join('&');
    return query ? `naturauy://auth/callback?${query}` : null;
  }, [params]);
  const callbackUrl = url ?? paramsUrl;

  useEffect(() => {
    if (!callbackUrl) {
      const timeout = setTimeout(() => setError('No recibimos la respuesta de Google. Volvé a intentar el acceso.'), 8000);
      return () => clearTimeout(timeout);
    }
    let cancelled = false;
    void completeOAuthFromUrl(callbackUrl)
      .then((returnTo) => {
        if (!cancelled) router.replace(returnTo as never);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'No se pudo completar el acceso con Google.');
      });
    return () => {
      cancelled = true;
    };
  }, [callbackUrl, completeOAuthFromUrl, router]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, padding: spacing.xl }]}>
      {error ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl }]}>
          <Text style={[typography.title, { color: colors.text, textAlign: 'center' }]}>No pudimos conectar tu cuenta</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' }]}>{error}</Text>
          <Pressable onPress={() => { haptics.tap(); router.replace('/login'); }} style={[styles.button, { backgroundColor: colors.primary, borderRadius: radius.pill, marginTop: spacing.xl }]}>
            <Text style={[typography.label, { color: colors.onPrimary }]}>Volver al acceso</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}>Conectando tu cuenta…</Text>
          <Pressable onPress={() => { haptics.tap(); router.replace('/login'); }} accessibilityRole="button" accessibilityLabel="Cancelar acceso" style={styles.cancel}>
            <BackIcon color={colors.textMuted} size={18} />
            <Text style={[typography.label, { color: colors.textMuted }]}>Cancelar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { alignItems: 'center' },
  card: { width: '100%', maxWidth: 440, alignItems: 'center' },
  button: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center' },
  cancel: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 28, padding: 12 },
});
