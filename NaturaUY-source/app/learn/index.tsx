import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react-native';
import { LEARNING_PATHS } from '../../src/content/learningContent';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';
import { learningRepository, type LearningModuleProgress } from '../../src/data/repositories/learningRepository';
import type { LearningObjectiveProgress } from '../../src/domain/entities/learning';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { LearningIllustration } from '../../src/presentation/components/LearningIllustration';

export default function LearnHub(): React.JSX.Element {
  const router = useRouter(); const insets = useSafeAreaInsets(); const db = useUserDatabase();
  const { colors, radius, typography, elevation } = useTheme();
  const [modules, setModules] = useState<LearningModuleProgress[]>([]); const [objectives, setObjectives] = useState<LearningObjectiveProgress[]>([]); const [now, setNow] = useState(0);
  const refresh = useCallback(async () => { setModules(await learningRepository.listModules(db)); setObjectives(await learningRepository.listObjectives(db)); setNow(Date.now()); }, [db]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const due = useMemo(() => objectives.filter((item) => { const question = LEARNING_PATHS.flatMap(path => path.modules.flatMap(module => module.questions)).find(question => question.objectiveId === item.objectiveId); return question && (item.dueAt <= now || item.questionVersion !== question.version); }).slice(0, 8), [now, objectives]);
  const dueTarget = useMemo(() => LEARNING_PATHS.flatMap((path) => path.modules.map((module) => ({ path, module }))).find(({ module }) => module.questions.some((question) => due.some((item) => item.objectiveId === question.objectiveId))), [due]);
  const total = LEARNING_PATHS.reduce((sum, path) => sum + path.modules.length, 0);

  return <View style={[styles.screen, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 28 }}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}><ArrowLeft color={colors.text} size={24} /></Pressable><Text style={[typography.eyebrow, { color: colors.textSecondary }]}>APRENDER</Text><View style={styles.back} /></View>
    <View style={styles.intro}><Text style={[typography.display, { color: colors.text }]}>Entender la naturaleza, de a una idea por vez</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 10 }]}>Recorridos breves, preguntas con explicación y repasos que vuelven cuando los necesitás.</Text>
      <View style={[styles.progress, { backgroundColor: colors.surfaceVariant, borderRadius: radius.pill }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${total ? Math.round(modules.length / total * 100) : 0}%` }]} /></View><Text style={[typography.caption, { color: colors.textMuted, marginTop: 7 }]}>{modules.length} de {total} módulos completados</Text>
    </View>
    {due.length > 0 && dueTarget && <Pressable onPress={() => router.push(`/learn/${dueTarget.path.id}/${dueTarget.module.id}` as never)} style={[styles.review, { backgroundColor: colors.primaryContainer, borderRadius: radius.lg }]}><RotateCcw color={colors.onPrimaryContainer} size={24} /><View style={styles.flex}><Text style={[typography.cardTitle, { color: colors.onPrimaryContainer }]}>Repaso listo</Text><Text style={[typography.caption, { color: colors.onPrimaryContainer, marginTop: 3 }]}>{due.length} {due.length === 1 ? 'idea necesita' : 'ideas necesitan'} un nuevo repaso</Text></View><ArrowRight color={colors.onPrimaryContainer} size={20} /></Pressable>}
    <View style={styles.list}>{LEARNING_PATHS.map((path) => { const completed = modules.filter((item) => item.pathId === path.id).length; return <Pressable key={path.id} accessibilityRole="button" accessibilityLabel={`${path.shortTitle}. ${completed} de ${path.modules.length} módulos completados`} onPress={() => router.push(`/learn/${path.id}` as never)} style={[styles.path, elevation.low, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
      {path.illustration && <LearningIllustration illustration={path.illustration} compact />}
      <View style={styles.pathFooter}><View style={styles.flex}><Text style={[typography.eyebrow, { color: path.color }]}>{path.shortTitle.toUpperCase()}</Text><Text style={[typography.title, { color: colors.text, marginTop: 4 }]}>{path.title}</Text><Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{completed} de {path.modules.length} módulos completados</Text></View><ArrowRight color={colors.textMuted} size={20} /></View>
    </Pressable>; })}</View>
  </ScrollView></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }, intro: { paddingHorizontal: 22, paddingTop: 22 }, progress: { height: 8, overflow: 'hidden', marginTop: 20 }, progressFill: { height: '100%', minWidth: 2 }, review: { marginHorizontal: 18, marginTop: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1 }, list: { paddingHorizontal: 18, gap: 14, marginTop: 22 }, path: { paddingHorizontal: 12, paddingBottom: 18, borderWidth: StyleSheet.hairlineWidth }, pathFooter: { paddingHorizontal: 6, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 13 } });
