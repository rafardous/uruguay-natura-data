import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QUIZ_MODES, QUIZ_SCOPES, QUIZ_SCOPE_ORDER, type QuizMode, type QuizScope } from '../../src/domain/entities/quiz';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';
import { quizRepository, type QuizRecord } from '../../src/data/repositories/quizRepository';
import { Chip } from '../../src/presentation/components/Chip';
import { BackIcon, ClockIcon, HeartIcon, TrophyIcon, type IconProps } from '../../src/presentation/components/TabIcons';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';

const MODES: QuizMode[] = ['classic', 'timed', 'survival'];
const ICONS: Record<QuizMode, (p: IconProps) => React.JSX.Element> = { classic: TrophyIcon, timed: ClockIcon, survival: HeartIcon };

export default function RecordsScreen(): React.JSX.Element {
  const db = useUserDatabase(); const router = useRouter(); const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const [scope, setScope] = useState<QuizScope>('animals_all'); const [records, setRecords] = useState<Record<string, QuizRecord>>({});
  useFocusEffect(useCallback(() => { void quizRepository.listRecords(db).then(setRecords); }, [db]));
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
    <View style={[styles.header, { paddingHorizontal: spacing.lg }]}><Pressable onPress={() => router.back()} style={[styles.back, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.pill }]}><BackIcon color={colors.text} /></Pressable><View style={styles.flex}><Text style={[typography.eyebrow, { color: colors.play }]}>JUEGOS</Text><Text style={[typography.title, { color: colors.text }]}>Récords locales</Text></View></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { paddingHorizontal: spacing.lg }]}>{QUIZ_SCOPE_ORDER.map((item) => <Chip key={item} label={QUIZ_SCOPES[item].label} selected={scope === item} accent={colors.play} onAccent={colors.onPlay} onPress={() => setScope(item)} />)}</ScrollView>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {MODES.map((mode) => { const item = records[`${scope}:${mode}`]; const Icon = ICONS[mode]; return <View key={mode} style={[styles.card, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }]}><View style={[styles.icon, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md }]}><Icon color={colors.play} /></View><View style={styles.flex}><Text style={[typography.cardTitle, { color: colors.text }]}>{QUIZ_MODES[mode].title}</Text><Text style={[typography.caption, { color: colors.textMuted }]}>{item ? `Mejor racha ${item.bestStreak}` : 'Todavía no jugaste esta categoría'}</Text></View><Text style={[typography.display, { color: colors.play }]}>{item?.bestScore ?? '—'}</Text></View>; })}
      <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }]}>Estos récords viven sólo en este dispositivo. El ranking entre usuarios llegará más adelante.</Text>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, tabs: { gap: 8, paddingTop: 20, paddingBottom: 12, paddingRight: 24 }, card: { flexDirection: 'row', alignItems: 'center', gap: 14 }, icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' } });
