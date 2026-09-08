import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { useMobileAuth } from '../src/auth/MobileAuthProvider';
import { submitUserReport } from '../src/lib/mobileApi';
import { speciesRepository } from '../src/data/repositories/speciesRepository';
import type { Species } from '../src/domain/entities/species';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { BugIcon, CloseIcon, LeafIcon, SettingsIcon, TrophyIcon } from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

type Area = 'species' | 'general' | 'app' | 'games';
const AREAS: { id: Area; label: string; description: string; icon: typeof BugIcon }[] = [
  { id: 'species', label: 'Ficha de especie', description: 'Foto, nombres o clasificación', icon: LeafIcon },
  { id: 'general', label: 'Información general', description: 'Contenido del catálogo', icon: SettingsIcon },
  { id: 'app', label: 'Funcionamiento de la app', description: 'Pantallas, acceso o rendimiento', icon: BugIcon },
  { id: 'games', label: 'Juegos', description: 'Partidas, puntajes o reglas', icon: TrophyIcon },
];
let pendingDraft: string | null = null;

export default function ReportScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; codigo?: string; area?: string }>();
  const { session } = useMobileAuth();
  const catalog = useSQLiteContext();
  const { colors, radius, spacing, typography } = useTheme();
  const initialArea: Area = params.area === 'species' || params.area === 'general' || params.area === 'app' || params.area === 'games' ? params.area : params.kind === 'review' ? 'species' : 'general';
  const [area, setArea] = useState<Area>(initialArea);
  const [description, setDescription] = useState(() => pendingDraft ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [selectedCodigo, setSelectedCodigo] = useState<string | null>(params.codigo ?? null);
  const [speciesMatches, setSpeciesMatches] = useState<Species[]>([]);
  const title = area === 'species' ? 'Revisar una ficha' : area === 'games' ? 'Reportar en Juegos' : area === 'app' ? 'Reportar un problema' : 'Enviar un reporte';
  const selected = useMemo(() => AREAS.find((entry) => entry.id === area)!, [area]);
  useEffect(() => {
    if (area !== 'species' || params.codigo || speciesQuery.trim().length < 2) { setSpeciesMatches([]); return; }
    let active = true;
    void speciesRepository.findPaged(catalog, { search: speciesQuery.trim() }, 8, 0).then((page) => { if (active) setSpeciesMatches(page.items); });
    return () => { active = false; };
  }, [area, catalog, params.codigo, speciesQuery]);

  async function submit(): Promise<void> {
    setBusy(true); setMessage('');
    try {
      await submitUserReport({ kind: area === 'species' ? 'review' : params.kind === 'suggestion' ? 'suggestion' : 'bug', area, catalogCode: selectedCodigo ?? undefined, description, appVersion: Constants.expoConfig?.version ?? '1.0.0' });
      setMessage('Reporte enviado. Gracias por ayudarnos a mejorar Natura UY.');
      setDescription('');
      pendingDraft = null;
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'No se pudo enviar el reporte. El texto quedó listo para reintentar.');
    } finally { setBusy(false); }
  }

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader eyebrow="COLABORAR" title={title}><Pressable onPress={() => { haptics.tap(); router.back(); }} hitSlop={10} accessibilityLabel="Volver"><CloseIcon color={colors.text} /></Pressable></AppHeader>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
      {!session ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}><Text style={[typography.body, { color: colors.text }]}>Para evitar spam, los reportes requieren una cuenta.</Text><Pressable onPress={() => { pendingDraft = description; router.push({ pathname: '/login', params: { returnTo: `/report?area=${area}${params.codigo ? `&codigo=${params.codigo}` : ''}` } }); }} style={[styles.button, { backgroundColor: colors.primary, borderRadius: radius.pill, marginTop: spacing.md }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Continuar con Google</Text></Pressable></View> : <>
        <Text style={[typography.label, { color: colors.text }]}>¿Qué querés reportar?</Text>
        <View style={styles.areaGrid}>{AREAS.map(({ id, label, description: copy, icon: Icon }) => <Pressable key={id} onPress={() => setArea(id)} style={[styles.areaCard, { backgroundColor: area === id ? colors.primaryContainer : colors.surface, borderColor: area === id ? colors.primary : colors.border, borderRadius: radius.md }]}><Icon color={area === id ? colors.onPrimaryContainer : colors.textMuted} size={20} /><Text style={[typography.label, { color: colors.text, flex: 1 }]}>{label}</Text><Text style={[typography.caption, { color: colors.textMuted, width: '100%' }]}>{copy}</Text></Pressable>)}</View>
        {area === 'species' && (params.codigo ? <Text style={[typography.caption, { color: colors.textMuted }]}>Especie: {params.codigo}</Text> : <View style={{ gap: 6 }}><TextInput value={speciesQuery} onChangeText={(value) => { setSpeciesQuery(value); setSelectedCodigo(null); }} placeholder="Buscá la especie por nombre" placeholderTextColor={colors.textMuted} style={[styles.speciesInput, typography.body, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]} />{speciesMatches.map((candidate) => <Pressable key={candidate.codigo} onPress={() => { setSelectedCodigo(candidate.codigo); setSpeciesQuery(candidate.displayName); setSpeciesMatches([]); }} style={[styles.speciesChoice, { backgroundColor: selectedCodigo === candidate.codigo ? colors.primaryContainer : colors.surfaceVariant, borderRadius: radius.sm }]}><Text style={[typography.label, { color: colors.text }]}>{candidate.displayName}</Text><Text style={[typography.caption, { color: colors.textMuted }]}>{candidate.scientificName}</Text></Pressable>)}<Text style={[typography.caption, { color: colors.textMuted }]}>{selectedCodigo ? `Especie seleccionada: ${speciesQuery}` : 'Seleccioná una especie para continuar.'}</Text></View>)}
        <Text style={[typography.body, { color: colors.textSecondary }]}>{selected.description}. Contanos qué debería revisarse o qué ocurrió.</Text>
        <TextInput multiline value={description} onChangeText={setDescription} maxLength={4000} textAlignVertical="top" placeholder="Escribí al menos 10 caracteres" placeholderTextColor={colors.textMuted} style={[styles.input, typography.body, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]} />
        {message ? <Text style={[typography.caption, { color: colors.textMuted }]}>{message}</Text> : null}
        <Pressable disabled={busy || description.trim().length < 10 || (area === 'species' && !selectedCodigo)} onPress={() => void submit()} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, borderRadius: radius.pill, opacity: busy || description.trim().length < 10 || (area === 'species' && !selectedCodigo) ? 0.45 : pressed ? 0.85 : 1 }]}>{busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[typography.label, { color: colors.onPrimary }]}>Enviar reporte</Text>}</Pressable>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, card: { borderWidth: StyleSheet.hairlineWidth }, areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, areaCard: { width: '48%', minHeight: 92, padding: 12, borderWidth: StyleSheet.hairlineWidth, gap: 6 }, input: { minHeight: 180, borderWidth: StyleSheet.hairlineWidth, padding: 16 }, speciesInput: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 }, speciesChoice: { padding: 10, gap: 2 }, button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 } });
