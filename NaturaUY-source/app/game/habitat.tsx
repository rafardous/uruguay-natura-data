import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';

import type { Species } from '../../src/domain/entities/species';
import { buildHabitatQuestions, scheduleHabitatRetry, type HabitatQuestion, type MacroHabitat } from '../../src/domain/services/habitatGame';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { BackIcon, CheckIcon, CloseIcon, BiomesIcon, ChevronRightIcon } from '../../src/presentation/components/TabIcons';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { PhotoLightbox } from '../../src/presentation/components/PhotoLightbox';
import { haptics } from '../../src/presentation/haptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';

const OPTION_LABELS: Record<MacroHabitat, string> = {
  'Campo natural': 'Campo natural',
  'Monte y matorral': 'Monte y matorral',
  'Humedales y aguas continentales': 'Humedales y aguas continentales',
  'Costa y mar': 'Costa y mar',
  'Sierras y roquedales': 'Sierras y roquedales',
  'Ambientes humanos': 'Ambientes humanos',
};

export default function HabitatGameScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, elevation, radius, spacing, typography } = useTheme();
  const [pool, setPool] = useState<Species[]>([]);
  const [questions, setQuestions] = useState<HabitatQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<MacroHabitat | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void speciesRepository.findHabitatPool(db).then((items) => { if (active) { setPool(items); setQuestions(buildHabitatQuestions(items, 10)); setLoading(false); } }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db]);

  const question = questions[position];
  const finished = questions.length > 0 && position >= questions.length;

  const restart = (): void => {
    setQuestions(buildHabitatQuestions(pool, 10));
    setPosition(0); setScore(0); setAnswer(null); setLightboxOpen(false);
  };

  const choose = (option: MacroHabitat): void => {
    if (!question || answer !== null) return;
    setAnswer(option);
    if (question.correctAnswers.includes(option)) { setScore((value) => value + 1); haptics.success(); }
    else {
      haptics.error();
      setQuestions((current) => scheduleHabitatRetry(current, question, position));
    }
  };

  const advance = (): void => { setAnswer(null); setPosition((value) => value + 1); haptics.tick(); };

  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
    <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderColor: colors.border }]}><Pressable onPress={() => router.back()} accessibilityLabel="Volver" style={[styles.roundButton, { backgroundColor: colors.surface, borderRadius: radius.pill }]}><BackIcon color={colors.text} /></Pressable><View style={styles.flex}><Text style={[typography.eyebrow, { color: colors.primary }]}>JUEGOS · AMBIENTES</Text><Text style={[typography.title, { color: colors.text }]}>¿Dónde vive?</Text></View>{!loading && !finished && <Text style={[typography.label, { color: colors.textSecondary }]}>{Math.min(position + 1, questions.length)} / {questions.length}</Text>}</View>
    {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>Preparando ambientes…</Text></View>
      : questions.length === 0 ? <View style={[styles.center, { padding: spacing.xl }]}><BiomesIcon color={colors.outline} size={52} /><Text style={[typography.title, { color: colors.text, textAlign: 'center', marginTop: 14 }]}>Todavía no hay suficientes hábitats</Text><Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 7 }]}>Necesitamos especies con foto y ambiente cargado para armar la ronda.</Text></View>
      : finished ? <View style={[styles.center, { padding: spacing.xl }]}><MotiView from={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} style={[styles.resultIcon, { borderRadius: radius.pill, backgroundColor: colors.primaryContainer }]}><BiomesIcon color={colors.primary} size={42} /></MotiView><Text style={[typography.display, { color: colors.text, textAlign: 'center', marginTop: 18 }]}>¡Ronda completa!</Text><Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>Relacionaste correctamente {score} de {questions.length} especies con sus ambientes.</Text><Pressable onPress={restart} style={[styles.primaryButton, { backgroundColor: colors.primary, borderRadius: radius.pill, marginTop: 22 }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Jugar otra ronda</Text></Pressable></View>
      : question && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <MotiView key={`${question.id}-${position}`} from={{ opacity: 0, translateX: 24 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220 }}>
          <Text style={[typography.eyebrow, { color: colors.primary, marginTop: spacing.sm }]}>{question.isRetry ? 'VOLVEMOS A ESTA ESPECIE' : 'ELEGÍ EL AMBIENTE'}</Text>
          <Pressable onPress={() => setLightboxOpen(true)} accessibilityLabel={`Ampliar foto de ${question.species.displayName}`} style={[styles.photo, elevation.low, { borderRadius: radius.xl, marginTop: spacing.md }]}><SpeciesImage species={question.species} full height={240} borderRadius={radius.xl} bordered={false} /><View style={[styles.zoomHint, { backgroundColor: 'rgba(24,42,34,.78)', borderRadius: radius.pill }]}><Text style={[typography.caption, { color: '#FFFFFF' }]}>Tocá para ampliar · pellizcá para zoom</Text></View></Pressable>
          <Text style={[typography.title, { color: colors.text, marginTop: spacing.md }]}>{question.species.displayName}</Text><Text style={[typography.body, styles.scientific, { color: colors.textSecondary }]}>{question.species.scientificName}</Text>
          <View style={[styles.options, { marginTop: spacing.lg }]}>{question.options.map((option, index) => { const correct = answer !== null && question.correctAnswers.includes(option); const wrong = answer === option && !correct; return <Pressable key={option} onPress={() => choose(option)} disabled={answer !== null} style={[styles.option, { borderRadius: radius.lg, borderColor: correct ? colors.success : wrong ? colors.danger : colors.border, backgroundColor: correct ? colors.primaryContainer : colors.surface }]}><View style={[styles.optionMark, { borderRadius: radius.pill, backgroundColor: correct ? colors.success : wrong ? colors.danger : colors.surfaceVariant }]}>{correct ? <CheckIcon color="#FFFFFF" size={17} /> : wrong ? <CloseIcon color="#FFFFFF" size={17} /> : <Text style={[typography.label, { color: colors.text }]}>{String.fromCharCode(65 + index)}</Text>}</View><Text style={[typography.body, styles.flex, { color: colors.text }]}>{OPTION_LABELS[option]}</Text></Pressable>; })}</View>
          {answer !== null && <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} style={[styles.feedback, { backgroundColor: colors.surfaceContainer, borderRadius: radius.lg, marginTop: spacing.md }]}><Text style={[typography.label, { color: question.correctAnswers.includes(answer) ? colors.success : colors.danger }]}>{question.correctAnswers.includes(answer) ? '¡Correcto!' : 'Casi, probemos de nuevo más adelante.'}</Text><Text style={[typography.body, { color: colors.text, marginTop: 5 }]}>{question.explanation}</Text><Pressable onPress={advance} style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: radius.pill }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Siguiente</Text><ChevronRightIcon color={colors.onPrimary} /></Pressable></MotiView>}
        </MotiView>
      </ScrollView>}
    {question && <PhotoLightbox visible={lightboxOpen} uri={question.species.photo?.fullUrl} label={question.species.displayName} onClose={() => setLightboxOpen(false)} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  roundButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, photo: { overflow: 'hidden' }, zoomHint: { position: 'absolute', bottom: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6 }, scientific: { fontStyle: 'italic' }, options: { gap: 9 }, option: { minHeight: 58, padding: 12, borderWidth: 1, flexDirection: 'row', gap: 11, alignItems: 'center' }, optionMark: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }, feedback: { padding: 15 }, nextButton: { minHeight: 44, marginTop: 12, alignSelf: 'flex-end', paddingHorizontal: 17, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' }, resultIcon: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }, primaryButton: { minHeight: 48, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
});
