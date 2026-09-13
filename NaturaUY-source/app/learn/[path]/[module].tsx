import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react-native';
import { LEARNING_PATHS, LEARNING_SOURCES } from '../../../src/content/learningContent';
import { useUserDatabase } from '../../../src/data/db/UserDatabaseProvider';
import { learningRepository } from '../../../src/data/repositories/learningRepository';
import { LearningQuestionCard } from '../../../src/presentation/components/LearningQuestionCard';
import { useMobileSync } from '../../../src/sync/MobileSyncProvider';
import { useTheme } from '../../../src/presentation/theme/ThemeProvider';

export default function LearningModuleScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ path: string; module: string }>(); const router = useRouter(); const insets = useSafeAreaInsets(); const db = useUserDatabase(); const { requestSync } = useMobileSync();
  const { colors, radius, typography } = useTheme(); const path = LEARNING_PATHS.find((item) => item.id === params.path); const module = path?.modules.find((item) => item.id === params.module);
  const [answered, setAnswered] = useState<string[]>([]); const [finished, setFinished] = useState(false);
  const sources = LEARNING_SOURCES.filter((source) => module?.sourceCodes.includes(source.code));
  if (!path || !module) return <Redirect href={'/learn' as never} />;
  const complete = async () => { await learningRepository.completeModule(db, path.id, module.id, 1); setFinished(true); void requestSync(); };
  return <View style={[styles.screen, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
    <View style={[styles.top, { paddingTop: insets.top + 8 }]}><Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}><ArrowLeft color={colors.text} /></Pressable><Text style={[typography.caption, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>{path.title}</Text><View style={styles.back} /></View>
    <View style={styles.content}><Text style={[typography.eyebrow, { color: path.color }]}>MÓDULO · {module.minutes} MIN</Text><Text style={[typography.display, { color: colors.text, marginTop: 6 }]}>{module.title}</Text><View style={[styles.hook, { backgroundColor: colors.surfaceVariant, borderRadius: radius.lg }]}><Text style={[typography.label, { color: colors.textSecondary }]}>Antes de seguir</Text><Text style={[typography.title, { color: colors.text, marginTop: 5 }]}>{module.hook}</Text></View>
      {module.blocks.map((block, index) => <View key={block.title} style={styles.block}>{block.eyebrow && <Text style={[typography.eyebrow, { color: path.color }]}>{block.eyebrow}</Text>}<Text style={[typography.title, { color: colors.text }]}>{block.title}</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 7 }]}>{block.body}</Text>{block.callout && <View style={[styles.callout, { borderLeftColor: path.color, backgroundColor: colors.surface }]}><Text style={[typography.body, { color: colors.text }]}>{block.callout}</Text></View>}{index < module.blocks.length - 1 && <View style={[styles.rule, { backgroundColor: colors.border }]} />}</View>)}
      {module.questions.map((question) => <LearningQuestionCard key={question.id} db={db} question={question} onAnswered={() => setAnswered((value) => value.includes(question.id) ? value : [...value, question.id])} />)}
      <View style={[styles.sources, { borderTopColor: colors.border }]}><Text style={[typography.eyebrow, { color: colors.textMuted }]}>FUENTES Y ADAPTACIÓN</Text>{sources.map((source) => <Pressable key={source.code} accessibilityRole="link" onPress={() => void Linking.openURL(source.url)} style={styles.source}><View style={styles.flex}><Text style={[typography.label, { color: colors.text }]}>{source.name}</Text>{source.note && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 3 }]}>{source.note}</Text>}</View><ExternalLink color={colors.primary} size={17} /></Pressable>)}<Text style={[typography.caption, { color: colors.textMuted, marginTop: 10 }]}>Texto original de Natura UY, adaptado y sintetizado a partir de estas fuentes. Consultá la fuente para alcance, método y vigencia.</Text></View>
      <Pressable disabled={answered.length < module.questions.length} onPress={() => void complete()} style={[styles.finish, { borderRadius: radius.pill, backgroundColor: answered.length === module.questions.length ? colors.primary : colors.surfaceVariant }]}><Text style={[typography.label, { color: answered.length === module.questions.length ? colors.onPrimary : colors.textMuted }]}>{finished ? 'Módulo guardado' : 'Terminar módulo'}</Text><ArrowRight color={answered.length === module.questions.length ? colors.onPrimary : colors.textMuted} size={18} /></Pressable>
    </View>
  </ScrollView></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, top: { paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }, back: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }, content: { paddingHorizontal: 20, paddingTop: 20 }, hook: { padding: 17, marginTop: 20 }, block: { paddingTop: 24 }, callout: { marginTop: 14, padding: 14, borderLeftWidth: 4 }, rule: { height: StyleSheet.hairlineWidth, marginTop: 24 }, sources: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 26, paddingTop: 22 }, source: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 8 }, flex: { flex: 1 }, finish: { marginTop: 24, minHeight: 52, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 } });
