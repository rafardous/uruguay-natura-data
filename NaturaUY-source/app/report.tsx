import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useMobileAuth } from '../src/auth/MobileAuthProvider';
import { submitUserReport } from '../src/lib/mobileApi';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { CloseIcon } from '../src/presentation/components/TabIcons';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function ReportScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; codigo?: string }>();
  const { session } = useMobileAuth();
  const { colors, radius, spacing, typography } = useTheme();
  const kind = params.kind === 'data_error' ? 'data_error' : 'app_bug';
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(): Promise<void> {
    setBusy(true); setMessage('');
    try {
      await submitUserReport({
        kind,
        catalogCode: params.codigo,
        description,
        appVersion: Constants.expoConfig?.version ?? '1.0.0',
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android',
      });
      setMessage('Reporte enviado. Gracias por ayudarnos a mejorar Natura UY.');
      setDescription('');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudo enviar el reporte.');
    } finally {
      setBusy(false);
    }
  }

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader eyebrow="COLABORAR" title={kind === 'data_error' ? 'Reportar un dato' : 'Reportar un problema'}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver"><CloseIcon color={colors.text} /></Pressable>
    </AppHeader>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {!session ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}><Text style={[typography.body, { color: colors.text }]}>Para evitar spam, los reportes requieren una cuenta.</Text><Pressable onPress={() => router.push('/login')} style={[styles.button, { backgroundColor: colors.primary, borderRadius: radius.pill, marginTop: spacing.md }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Continuar con Google</Text></Pressable></View> : <>
        {params.codigo && <Text style={[typography.caption, { color: colors.textMuted }]}>Especie: {params.codigo}</Text>}
        <Text style={[typography.body, { color: colors.textSecondary }]}>Contanos qué está mal, cuál debería ser el dato correcto o qué estabas haciendo cuando apareció el problema.</Text>
        <TextInput multiline value={description} onChangeText={setDescription} maxLength={4000} textAlignVertical="top" placeholder="Escribí al menos 10 caracteres" placeholderTextColor={colors.textMuted} style={[styles.input, typography.body, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]} />
        {message ? <Text style={[typography.caption, { color: colors.textMuted }]}>{message}</Text> : null}
        <Pressable disabled={busy || description.trim().length < 10} onPress={() => void submit()} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, borderRadius: radius.pill, opacity: busy || description.trim().length < 10 ? 0.45 : pressed ? 0.85 : 1 }]}>{busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[typography.label, { color: colors.onPrimary }]}>Enviar reporte</Text>}</Pressable>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, card: { borderWidth: StyleSheet.hairlineWidth },
  input: { minHeight: 180, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
});
