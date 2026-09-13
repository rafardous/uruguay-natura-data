import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { LearningQuestion } from '../../domain/entities/learning';
import { learningRepository } from '../../data/repositories/learningRepository';
import { useTheme } from '../theme/ThemeProvider';
import { haptics } from '../haptics';

export function LearningQuestionCard({ db, question, onAnswered }: { db: SQLiteDatabase; question: LearningQuestion; onAnswered(correct: boolean): void }): React.JSX.Element {
  const { colors, radius, typography } = useTheme();
  const [selected, setSelected] = useState<string[]>([]);
  const [classified, setClassified] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<boolean | null>(null);
  const isClassify = question.type === 'classify';
  const ready = isClassify ? question.options.every((item) => classified[item]) : question.type === 'multi' ? selected.length > 0 : selected.length === question.correct.length;
  const correct = useMemo(() => {
    if (isClassify) return question.options.every((item) => classified[item] === question.classification?.[item]);
    return selected.length === question.correct.length && question.correct.every((item, index) => question.type === 'order' ? selected[index] === item : selected.includes(item));
  }, [classified, isClassify, question, selected]);

  const choose = (option: string) => {
    if (submitted !== null) return;
    haptics.tap();
    if (question.type === 'single') setSelected([option]);
    else if (question.type === 'order') setSelected((items) => items.includes(option) ? items.filter((item) => item !== option) : [...items, option]);
    else setSelected((items) => items.includes(option) ? items.filter((item) => item !== option) : [...items, option]);
  };
  const submit = async () => {
    if (!ready || submitted !== null) return;
    haptics.success();
    setSubmitted(correct);
    await learningRepository.recordAnswer(db, question.objectiveId, question.version, correct);
    onAnswered(correct);
  };

  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
    <Text style={[typography.eyebrow, { color: colors.primary }]}>COMPROBÁ TU IDEA</Text>
    <Text style={[typography.cardTitle, { color: colors.text, marginTop: 8 }]}>{question.prompt}</Text>
    {question.type === 'order' && selected.length > 0 && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Tu orden: {selected.map((item, index) => `${index + 1}. ${item}`).join('  ·  ')}</Text>}
    <View style={styles.options}>
      {question.options.map((option) => isClassify ? <View key={option} style={styles.classifyRow}>
        <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{option}</Text>
        <View style={styles.categories}>{question.categories?.map((category) => <Pressable key={category} disabled={submitted !== null} onPress={() => setClassified((value) => ({ ...value, [option]: category }))} style={[styles.category, { borderColor: colors.outline, borderRadius: radius.pill }, classified[option] === category && { backgroundColor: colors.primary, borderColor: colors.primary }]}><Text style={[typography.caption, { color: classified[option] === category ? colors.onPrimary : colors.text }]}>{category}</Text></Pressable>)}</View>
      </View> : <Pressable key={option} disabled={submitted !== null} onPress={() => choose(option)} style={[styles.option, { borderColor: colors.outline, borderRadius: radius.md }, selected.includes(option) && { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}>
        {question.type === 'order' && <Text style={[typography.label, { color: colors.primary, width: 22 }]}>{selected.includes(option) ? selected.indexOf(option) + 1 : '·'}</Text>}
        <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{option}</Text>
      </Pressable>)}
    </View>
    {submitted === null ? <Pressable accessibilityRole="button" disabled={!ready} onPress={() => void submit()} style={[styles.submit, { backgroundColor: ready ? colors.primary : colors.surfaceVariant, borderRadius: radius.pill }]}><Text style={[typography.label, { color: ready ? colors.onPrimary : colors.textMuted }]}>Comprobar</Text></Pressable> : <View accessibilityLiveRegion="polite" style={[styles.feedback, { backgroundColor: submitted ? colors.primaryContainer : colors.surfaceVariant, borderRadius: radius.md }]}>
      <Text style={[typography.cardTitle, { color: submitted ? colors.success : colors.danger }]}>{submitted ? 'Lo entendiste' : 'Vale la pena repasarlo'}</Text>
      <Text style={[typography.body, { color: colors.text, marginTop: 4 }]}>{question.explanation}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 18, marginTop: 20 }, options: { gap: 9, marginTop: 16 }, option: { minHeight: 50, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }, classifyRow: { gap: 8, paddingVertical: 8 }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, category: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 }, submit: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, feedback: { padding: 14, marginTop: 16 },
});
