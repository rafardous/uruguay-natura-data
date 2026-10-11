import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { LearningQuestion } from '../../domain/entities/learning';
import { learningRepository } from '../../data/repositories/learningRepository';
import { useTheme } from '../theme/ThemeProvider';
import { haptics } from '../haptics';
import { canCheckLearningAnswer, checkLearningAnswer } from '../../domain/services/learningAnswers';

export function LearningQuestionCard({ db, question, onAnswered }: { db: SQLiteDatabase; question: LearningQuestion; onAnswered(correct: boolean): void }): React.JSX.Element {
  const { colors, radius, typography } = useTheme();
  const [selected, setSelected] = useState<string[]>([]);
  const [classified, setClassified] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isClassify = question.type === 'classify';
  const ready = !saving && canCheckLearningAnswer(question, selected, classified);
  const correct = checkLearningAnswer(question, selected, classified);
  const instruction = question.type === 'multi' ? 'Elegí todas las opciones que te parezcan correctas.' : question.type === 'order' ? 'Tocá los pasos en orden. Tocá uno de nuevo para quitarlo.' : isClassify ? 'Elegí un grupo para cada opción.' : 'Elegí una opción.';

  const choose = (option: string) => {
    if (submitted !== null || saving) return;
    haptics.tap();
    if (question.type === 'single') setSelected([option]);
    else if (question.type === 'order') setSelected((items) => items.includes(option) ? items.filter((item) => item !== option) : [...items, option]);
    else setSelected((items) => items.includes(option) ? items.filter((item) => item !== option) : [...items, option]);
  };
  const submit = async () => {
    if (!ready || submitted !== null) return;
    setSaving(true); setError('');
    try {
      await learningRepository.recordAnswer(db, question.objectiveId, question.version, correct);
      if (correct) haptics.success();
      setSubmitted(correct);
      onAnswered(correct);
    } catch {
      setError('No pudimos guardar la respuesta. Probá de nuevo.');
    } finally { setSaving(false); }
  };

  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
    <Text style={[typography.eyebrow, { color: colors.primary }]}>COMPROBÁ TU IDEA</Text>
    <Text style={[typography.cardTitle, { color: colors.text, marginTop: 8 }]}>{question.prompt}</Text>
    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{instruction}</Text>
    {question.type === 'order' && selected.length > 0 && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Tu orden: {selected.map((item, index) => `${index + 1}. ${item}`).join('  ·  ')}</Text>}
    <View style={styles.options}>
      {question.options.map((option) => isClassify ? <View key={option} style={styles.classifyRow}>
        <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{option}</Text>
        <View style={styles.categories}>{question.categories?.map((category) => <Pressable key={category} accessibilityRole="radio" accessibilityLabel={`${option}: ${category}`} accessibilityState={{ selected: classified[option] === category, disabled: submitted !== null || saving }} disabled={submitted !== null || saving} onPress={() => setClassified((value) => ({ ...value, [option]: category }))} style={[styles.category, { borderColor: colors.outline, borderRadius: radius.pill }, classified[option] === category && { backgroundColor: colors.primary, borderColor: colors.primary }]}><Text style={[typography.caption, { color: classified[option] === category ? colors.onPrimary : colors.text }]}>{category}</Text></Pressable>)}</View>
      </View> : <Pressable key={option} accessibilityRole={question.type === 'single' ? 'radio' : 'checkbox'} accessibilityState={{ selected: selected.includes(option), checked: selected.includes(option), disabled: submitted !== null || saving }} disabled={submitted !== null || saving} onPress={() => choose(option)} style={[styles.option, { borderColor: colors.outline, borderRadius: radius.md }, selected.includes(option) && { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}>
        {question.type === 'order' && <Text style={[typography.label, { color: colors.primary, width: 22 }]}>{selected.includes(option) ? selected.indexOf(option) + 1 : '·'}</Text>}
        <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{option}</Text>
      </Pressable>)}
    </View>
    {!!error && <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: colors.danger, marginTop: 10 }]}>{error}</Text>}
    {submitted === null ? <Pressable accessibilityRole="button" disabled={!ready} onPress={() => void submit()} style={[styles.submit, { backgroundColor: ready ? colors.primary : colors.surfaceVariant, borderRadius: radius.pill }]}><Text style={[typography.label, { color: ready ? colors.onPrimary : colors.textMuted }]}>{saving ? 'Guardando…' : 'Comprobar'}</Text></Pressable> : <View accessibilityLiveRegion="polite" style={[styles.feedback, { backgroundColor: submitted ? colors.primaryContainer : colors.surfaceVariant, borderRadius: radius.md }]}>
      <Text style={[typography.cardTitle, { color: submitted ? colors.success : colors.danger }]}>{submitted ? 'Lo entendiste' : 'Vale la pena repasarlo'}</Text>
      <Text style={[typography.body, { color: colors.text, marginTop: 4 }]}>{question.explanation}</Text>
      {!submitted && <Pressable accessibilityRole="button" onPress={() => { setSubmitted(null); setSelected([]); setClassified({}); }} style={[styles.submit, { backgroundColor: colors.primary, borderRadius: radius.pill }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Volver a intentar</Text></Pressable>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 18, marginTop: 20 }, options: { gap: 9, marginTop: 16 }, option: { minHeight: 50, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }, classifyRow: { gap: 8, paddingVertical: 8 }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, category: { minHeight: 44, justifyContent: 'center', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 }, submit: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, feedback: { padding: 14, marginTop: 16 },
});
