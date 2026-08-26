import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMobileAuth } from '../../src/auth/MobileAuthProvider';
import { QUIZ_MODES, QUIZ_SCOPES, QUIZ_SCOPE_ORDER, type QuizMode, type QuizScope } from '../../src/domain/entities/quiz';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';
import { quizRepository, type QuizRecord } from '../../src/data/repositories/quizRepository';
import { getQuizLeaderboard, type LeaderboardEntry } from '../../src/lib/mobileApi';
import { Chip } from '../../src/presentation/components/Chip';
import { BackIcon, ClockIcon, HeartIcon, TrophyIcon, type IconProps } from '../../src/presentation/components/TabIcons';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';

const MODES: QuizMode[] = ['classic', 'timed', 'survival'];
const ICONS: Record<QuizMode, (p: IconProps) => React.JSX.Element> = { classic: TrophyIcon, timed: ClockIcon, survival: HeartIcon };

export default function RecordsScreen(): React.JSX.Element {
  const db = useUserDatabase(); const router = useRouter(); const insets = useSafeAreaInsets();
  const { configured } = useMobileAuth();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const [scope, setScope] = useState<QuizScope>('animals_all');
  const [view, setView] = useState<'personal' | 'global'>('personal');
  const [records, setRecords] = useState<Record<string, QuizRecord>>({});
  const [leaderboards, setLeaderboards] = useState<Partial<Record<QuizMode, LeaderboardEntry[]>>>({});
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const load = useCallback(() => {
    void quizRepository.listRecords(db).then(setRecords);
    if (!configured) return;
    setLoadingGlobal(true);
    void Promise.all(MODES.map(async (mode) => [mode, await getQuizLeaderboard(mode, scope)] as const))
      .then((entries) => setLeaderboards(Object.fromEntries(entries)))
      .finally(() => setLoadingGlobal(false));
  }, [configured, db, scope]);
  useFocusEffect(load);

  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
    <View style={[styles.header, { paddingHorizontal: spacing.lg }]}><Pressable onPress={() => router.back()} style={[styles.back, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.pill }]}><BackIcon color={colors.text} /></Pressable><View style={styles.flex}><Text style={[typography.eyebrow, { color: colors.play }]}>JUEGOS</Text><Text style={[typography.title, { color: colors.text }]}>Récords y ranking</Text></View></View>
    <View style={[styles.viewTabs, { paddingHorizontal: spacing.lg, marginTop: spacing.lg }]}>
      <Chip label="Mis récords" selected={view === 'personal'} accent={colors.play} onAccent={colors.onPlay} onPress={() => setView('personal')} />
      <Chip label="Ranking global" selected={view === 'global'} accent={colors.play} onAccent={colors.onPlay} onPress={() => setView('global')} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { paddingHorizontal: spacing.lg }]}>{QUIZ_SCOPE_ORDER.map((item) => <Chip key={item} label={QUIZ_SCOPES[item].label} selected={scope === item} accent={colors.play} onAccent={colors.onPlay} onPress={() => setScope(item)} />)}</ScrollView>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {view === 'personal' ? MODES.map((mode) => {
        const item = records[`${scope}:${mode}`]; const Icon = ICONS[mode];
        return <View key={mode} style={[styles.card, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }]}><View style={[styles.icon, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md }]}><Icon color={colors.play} /></View><View style={styles.flex}><Text style={[typography.cardTitle, { color: colors.text }]}>{QUIZ_MODES[mode].title}</Text><Text style={[typography.caption, { color: colors.textMuted }]}>{item ? `Mejor racha ${item.bestStreak}` : 'Todavía no jugaste esta categoría'}</Text></View><Text style={[typography.display, { color: colors.play }]}>{item?.bestScore ?? '—'}</Text></View>;
      }) : !configured ? <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>El ranking se habilitará al completar la conexión con Supabase.</Text> : loadingGlobal ? <ActivityIndicator color={colors.play} /> : MODES.map((mode) => {
        const rows = leaderboards[mode] ?? []; const Icon = ICONS[mode];
        return <View key={mode} style={[styles.ranking, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }]}><View style={styles.rankingTitle}><Icon color={colors.play} /><Text style={[typography.cardTitle, { color: colors.text }]}>{QUIZ_MODES[mode].title}</Text></View>{rows.length === 0 ? <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.md }]}>Todavía no hay puntajes públicos.</Text> : rows.slice(0, 10).map((entry) => <View key={`${mode}-${entry.position}-${entry.publicAlias}`} style={[styles.rankRow, { borderTopColor: colors.border }]}><Text style={[typography.label, { color: colors.play, width: 28 }]}>{entry.position}</Text><Text style={[typography.body, styles.flex, { color: colors.text }]}>{entry.publicAlias}</Text><Text style={[typography.label, { color: colors.text }]}>{entry.bestScore}</Text></View>)}</View>;
      })}
      <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }]}>{view === 'personal' ? 'Tus récords permanecen disponibles offline y se respaldan al iniciar sesión.' : 'El ranking muestra sólo el alias público elegido por cada persona.'}</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  tabs: { gap: 8, paddingTop: 14, paddingBottom: 12, paddingRight: 24 },
  viewTabs: { flexDirection: 'row', gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ranking: { gap: 4 }, rankingTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
