import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useMobileAuth } from '../src/auth/MobileAuthProvider';
import { getOwnCollaboratorApplication, submitCollaboratorApplication, type OwnCollaboratorApplication } from '../src/lib/mobileApi';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { CloseIcon, CollaborateIcon } from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

const INTERESTS = ['Datos y nombres', 'Descripción y ecología', 'Conservación', 'Fotos y audios', 'Tecnología y diseño', 'Otro'] as const;
const AVAILABILITY: { value: 'occasional' | 'monthly' | 'weekly' | 'more'; label: string }[] = [
  { value: 'occasional', label: 'De vez en cuando' },
  { value: 'monthly', label: 'Unas horas al mes' },
  { value: 'weekly', label: 'Todas las semanas' },
  { value: 'more', label: 'Más disponibilidad' },
];
type Availability = (typeof AVAILABILITY)[number]['value'];
type Draft = { interests: string[]; experience: string; motivation: string; availability: Availability; referenceUrl: string; consent: boolean };
const initialDraft: Draft = { interests: [], experience: '', motivation: '', availability: 'occasional', referenceUrl: '', consent: false };
let savedDraft: Draft = { ...initialDraft };

function statusLabel(status: OwnCollaboratorApplication['status']): string {
  return { pending: 'Recibida', reviewing: 'En revisión', accepted: 'Aceptada', rejected: 'No seleccionada', withdrawn: 'Retirada' }[status];
}

export default function CollaborateScreen(): React.JSX.Element {
  const router = useRouter();
  const { session, profile, signInWithGoogle } = useMobileAuth();
  const { colors, radius, spacing, typography } = useTheme();
  const [draft, setDraft] = useState<Draft>(savedDraft);
  const [application, setApplication] = useState<OwnCollaboratorApplication | null>(null);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const contactName = profile?.displayName ?? (typeof session?.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name : '');
  const contactEmail = session?.user.email ?? '';
  const googleSession = Boolean(session && (session.user.app_metadata?.provider === 'google' || session.user.identities?.some((identity) => identity.provider === 'google')));
  const readyToSubmit = draft.interests.length > 0 && draft.experience.trim().length >= 20 && draft.motivation.trim().length >= 40 && draft.consent;
  const openApplication = application?.status === 'pending' || application?.status === 'reviewing';

  useEffect(() => { savedDraft = draft; }, [draft]);
  useEffect(() => {
    if (!googleSession) { setApplication(null); return; }
    let active = true;
    setLoadingApplication(true);
    void getOwnCollaboratorApplication().then((result) => { if (active) setApplication(result); }).catch(() => undefined).finally(() => { if (active) setLoadingApplication(false); });
    return () => { active = false; };
  }, [googleSession, session]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]): void => setDraft((current) => ({ ...current, [key]: value }));
  const toggleInterest = (value: string): void => update('interests', draft.interests.includes(value) ? draft.interests.filter((item) => item !== value) : [...draft.interests, value]);

  async function connect(): Promise<void> {
    savedDraft = draft;
    setBusy(true); setMessage('');
    const error = await signInWithGoogle('/collaborate');
    if (error) setMessage(error);
    setBusy(false);
  }

  async function submit(): Promise<void> {
    if (!readyToSubmit) return;
    setBusy(true); setMessage('');
    try {
      await submitCollaboratorApplication({ ...draft, experience: draft.experience.trim(), motivation: draft.motivation.trim(), referenceUrl: draft.referenceUrl.trim() || null });
      setApplication(await getOwnCollaboratorApplication());
      setMessage('Recibimos tu solicitud. Gracias por querer ser parte de Natura UY.');
      savedDraft = { ...initialDraft };
      setDraft({ ...initialDraft });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No pudimos enviar la solicitud. El formulario quedó guardado para reintentar.');
    } finally { setBusy(false); }
  }

  const intro = useMemo(() => googleSession ? 'Completá estos datos y el equipo editorial va a revisar tu propuesta.' : 'Nos gustaría conocer tus intereses para sumar colaboraciones cuidadas y con fuentes.', [googleSession]);

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader eyebrow="COLABORAR" title="Sumate a Natura UY"><Pressable onPress={() => { haptics.tap(); router.back(); }} hitSlop={10} accessibilityLabel="Volver"><CloseIcon color={colors.text} /></Pressable></AppHeader>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={[styles.intro, { backgroundColor: colors.primaryContainer, borderRadius: radius.lg, padding: spacing.lg }]}><View style={[styles.introIcon, { backgroundColor: colors.surface, borderRadius: radius.pill }]}><CollaborateIcon color={colors.primary} size={25} /></View><Text style={[typography.body, { color: colors.onPrimaryContainer, flex: 1 }]}>{intro}</Text></View>
      {!googleSession ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}>
        <Text style={[typography.title, { color: colors.text }]}>Primero, iniciá sesión</Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>Usamos tu cuenta de Google para saber quién envía la solicitud y poder responderte. El borrador queda guardado en este dispositivo.</Text>
        {message ? <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.md }]}>{message}</Text> : null}
        <Pressable disabled={busy} onPress={() => void connect()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, borderRadius: radius.pill, marginTop: spacing.lg, opacity: busy ? 0.5 : pressed ? 0.82 : 1 }]}>{busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[typography.label, { color: colors.onPrimary }]}>Continuar con Google</Text>}</Pressable>
      </View> : loadingApplication ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : openApplication ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}><Text style={[typography.title, { color: colors.text }]}>Solicitud {statusLabel(application!.status).toLocaleLowerCase('es')}</Text><Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>Ya tenemos una solicitud abierta a nombre de {application!.contactName}. Te vamos a contactar por {application!.contactEmail} cuando haya novedades.</Text></View> : <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}>
        <Text style={[typography.eyebrow, { color: colors.textMuted }]}>DATOS DE CONTACTO</Text>
        <View style={[styles.identity, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.sm }]}><Text style={[typography.label, { color: colors.text }]}>{contactName || 'Tu nombre de Google'}</Text><Text style={[typography.caption, { color: colors.textMuted, marginTop: 3 }]}>{contactEmail}</Text></View>
        <Text style={[typography.eyebrow, { color: colors.textMuted, marginTop: spacing.lg }]}>ÁREAS DE INTERÉS</Text>
        <View style={styles.chips}>{INTERESTS.map((item) => <Pressable key={item} onPress={() => toggleInterest(item)} style={[styles.chip, { backgroundColor: draft.interests.includes(item) ? colors.primaryContainer : colors.background, borderColor: draft.interests.includes(item) ? colors.primary : colors.border, borderRadius: radius.pill }]}><Text style={[typography.caption, { color: draft.interests.includes(item) ? colors.onPrimaryContainer : colors.textSecondary }]}>{item}</Text></Pressable>)}</View>
        <Field label="Experiencia" hint="¿Qué experiencia tenés con naturaleza, datos, divulgación, fotografía, audio o tecnología?" value={draft.experience} onChange={(value) => update('experience', value)} placeholder="Contanos brevemente…" multiline colors={colors} radius={radius} typography={typography} />
        <Field label="Motivación" hint="¿Qué te gustaría aportar al catálogo?" value={draft.motivation} onChange={(value) => update('motivation', value)} placeholder="Me interesa…" multiline colors={colors} radius={radius} typography={typography} />
        <Text style={[typography.eyebrow, { color: colors.textMuted, marginTop: spacing.md }]}>DISPONIBILIDAD</Text>
        <View style={styles.availability}>{AVAILABILITY.map((item) => <Pressable key={item.value} onPress={() => update('availability', item.value)} style={[styles.availabilityItem, { backgroundColor: draft.availability === item.value ? colors.primaryContainer : colors.background, borderColor: draft.availability === item.value ? colors.primary : colors.border, borderRadius: radius.md }]}><Text style={[typography.caption, { color: draft.availability === item.value ? colors.onPrimaryContainer : colors.textSecondary }]}>{item.label}</Text></Pressable>)}</View>
        <Field label="Referencia o portafolio (opcional)" value={draft.referenceUrl} onChange={(value) => update('referenceUrl', value)} placeholder="https://…" colors={colors} radius={radius} typography={typography} autoCapitalize="none" keyboardType="url" />
        <Pressable onPress={() => update('consent', !draft.consent)} accessibilityRole="checkbox" accessibilityState={{ checked: draft.consent }} style={styles.consent}><View style={[styles.checkbox, { borderColor: draft.consent ? colors.primary : colors.border, backgroundColor: draft.consent ? colors.primary : colors.surface, borderRadius: 5 }]}>{draft.consent && <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>✓</Text>}</View><Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>Acepto que Natura UY me contacte sobre esta solicitud de colaboración.</Text></Pressable>
        {message ? <Text style={[typography.caption, { color: message.startsWith('Recibimos') ? colors.primary : colors.danger, marginTop: spacing.md }]}>{message}</Text> : null}
        <Pressable disabled={busy || !readyToSubmit} onPress={() => void submit()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, borderRadius: radius.pill, marginTop: spacing.lg, opacity: busy || !readyToSubmit ? 0.45 : pressed ? 0.82 : 1 }]}>{busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[typography.label, { color: colors.onPrimary }]}>Enviar solicitud</Text>}</Pressable>
      </View>}
    </ScrollView>
  </View>;
}

function Field({ label, hint, value, onChange, placeholder, multiline = false, colors, radius, typography, autoCapitalize, keyboardType }: { label: string; hint?: string; value: string; onChange(value: string): void; placeholder: string; multiline?: boolean; colors: ReturnType<typeof useTheme>['colors']; radius: ReturnType<typeof useTheme>['radius']; typography: ReturnType<typeof useTheme>['typography']; autoCapitalize?: 'none' | 'sentences'; keyboardType?: 'default' | 'url' }): React.JSX.Element {
  return <View style={{ marginTop: 16, gap: 6 }}><Text style={[typography.eyebrow, { color: colors.textMuted }]}>{label}</Text>{hint && <Text style={[typography.caption, { color: colors.textMuted }]}>{hint}</Text>}<TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} multiline={multiline} autoCapitalize={autoCapitalize} keyboardType={keyboardType} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, typography.body, multiline && styles.multiline, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md }]} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  introIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  identity: { padding: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 11, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 11, borderWidth: StyleSheet.hairlineWidth },
  multiline: { minHeight: 112, paddingTop: 12 },
  availability: { gap: 8, marginTop: 10 },
  availabilityItem: { minHeight: 45, justifyContent: 'center', paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18 },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
});
