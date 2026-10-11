import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { LEARNING_PATHS } from '../../../src/content/learningContent';
import { useUserDatabase } from '../../../src/data/db/UserDatabaseProvider';
import { learningRepository } from '../../../src/data/repositories/learningRepository';
import type { LearningObjectiveProgress } from '../../../src/domain/entities/learning';
import { useTheme } from '../../../src/presentation/theme/ThemeProvider';
import { learningModuleState } from '../../../src/domain/services/learningProgress';
import { LearningIllustration } from '../../../src/presentation/components/LearningIllustration';

export default function LearningPathScreen(): React.JSX.Element {
  const { path: pathId } = useLocalSearchParams<{ path: string }>(); const router = useRouter(); const insets = useSafeAreaInsets(); const db = useUserDatabase();
  const { colors, radius, typography } = useTheme(); const path = LEARNING_PATHS.find((item) => item.id === pathId); const [done, setDone] = useState<string[]>([]); const [objectives, setObjectives] = useState<LearningObjectiveProgress[]>([]); const [now, setNow] = useState(0);
  const refresh = useCallback(async () => { setDone((await learningRepository.listModules(db)).filter((item) => item.pathId === pathId).map((item) => item.moduleId)); setObjectives(await learningRepository.listObjectives(db)); setNow(Date.now()); }, [db, pathId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  if (!path) return <Redirect href={'/learn' as never} />;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
    <View style={[styles.hero, { backgroundColor: path.color, paddingTop: insets.top + 10 }]}><Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}><ArrowLeft color="#FFFFFF" /></Pressable><Text style={[typography.eyebrow, styles.white, { marginTop: 20 }]}>{path.shortTitle.toUpperCase()}</Text><Text style={[typography.display, styles.white, { marginTop: 5 }]}>{path.title}</Text><Text style={[typography.body, styles.soft, { marginTop: 8 }]}>{path.description}</Text></View>
    <View style={styles.list}>{path.illustration && <LearningIllustration illustration={path.illustration} />}{path.modules.map((module, index) => { const complete = done.includes(module.id); const state = learningModuleState(module, complete, objectives, now); return <Pressable key={module.id} accessibilityRole="button" onPress={() => router.push(`/learn/${path.id}/${module.id}` as never)} style={[styles.module, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}><View style={[styles.step, { backgroundColor: complete ? colors.primary : colors.surfaceVariant, borderRadius: radius.pill }]}>{complete ? <Check color={colors.onPrimary} size={18} /> : <Text style={[typography.label, { color: colors.text }]}>{index + 1}</Text>}</View><View style={styles.flex}><Text style={[typography.cardTitle, { color: colors.text }]}>{module.title}</Text><Text style={[typography.caption, { color: state === 'Para repasar' ? colors.danger : colors.textSecondary, marginTop: 4 }]}>{state}</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]} numberOfLines={2}>{module.hook}</Text></View><ArrowRight color={colors.textMuted} size={20} /></Pressable>; })}</View>
  </ScrollView></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, hero: { paddingHorizontal: 22, paddingBottom: 28, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }, back: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginLeft: -12 }, white: { color: '#FFFFFF' }, soft: { color: 'rgba(255,255,255,.88)' }, list: { padding: 18, gap: 12 }, module: { padding: 15, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12 }, step: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1 } });
