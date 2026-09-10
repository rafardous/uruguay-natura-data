import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';

import type { Species } from '../../src/domain/entities/species';
import {
  buildClassificationQuestions,
  CLASSIFICATION_LEVELS,
  type ClassificationLevel,
} from '../../src/domain/services/classificationGame';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { BackIcon, CheckIcon, ClassifyIcon, CloseIcon, ChevronRightIcon } from '../../src/presentation/components/TabIcons';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { PhotoLightbox } from '../../src/presentation/components/PhotoLightbox';
import { haptics } from '../../src/presentation/haptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';

const LEVEL_LABELS: Record<ClassificationLevel, string> = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' };

export default function ClassifyGameScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, elevation, radius, spacing, typography } = useTheme();
  const [pool, setPool] = useState<Species[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<ClassificationLevel>('easy');
  const [runSeed, setRunSeed] = useState(0);
  const [position, setPosition] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void speciesRepository.findClassificationPool(db).then((items) => {
      if (active) { setPool(items); setLoading(false); }
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db]);

  const questions = useMemo(() => {
    let state = (runSeed + 1) * 2654435761;
    const random = (): number => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
    return buildClassificationQuestions(pool, level, 8, random);
  }, [pool, level, runSeed]);
  const finished = questions.length > 0 && position >= questions.length;
  const question = questions[position];

  const restart = (nextLevel = level): void => {
    setLevel(nextLevel);
    setPosition(0);
    setScore(0);
    setAnswer(null);
    setRunSeed((value) => value + 1);
  };

  const choose = (option: string): void => {
    if (!question || answer !== null) return;
    setAnswer(option);
    if (option === question.correctAnswer) { setScore((value) => value + 1); haptics.success(); }
    else haptics.error();
  };

  const advance = (): void => {
    setAnswer(null);
    setPosition((value) => value + 1);
    haptics.tick();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Volver" style={[styles.roundButton, { backgroundColor: colors.surface, borderRadius: radius.pill }]}><BackIcon color={colors.text} /></Pressable>
        <View style={styles.flex}><Text style={[typography.eyebrow, { color: colors.primary }]}>JUEGOS · CLASIFICAR</Text><Text style={[typography.title, { color: colors.text }]}>Encontrá su grupo</Text></View>
        {!loading && !finished && <Text style={[typography.label, { color: colors.textSecondary }]}>{Math.min(position + 1, questions.length)} / {questions.length}</Text>}
      </View>

      <View style={[styles.levels, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
        {(Object.keys(LEVEL_LABELS) as ClassificationLevel[]).map((item) => {
          const selected = item === level;
          return <Pressable key={item} onPress={() => restart(item)} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.level, { borderRadius: radius.pill, backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }]}><Text style={[typography.label, { color: selected ? colors.onPrimary : colors.text }]}>{LEVEL_LABELS[item]}</Text></Pressable>;
        })}
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>Preparando especies…</Text></View>
        : questions.length === 0 ? <View style={[styles.center, { padding: spacing.xl }]}><ClassifyIcon color={colors.outline} size={52} /><Text style={[typography.title, { color: colors.text, textAlign: 'center', marginTop: 14 }]}>No hay suficientes grupos con foto</Text><Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 7 }]}>Probá otro nivel mientras se completa el catálogo.</Text></View>
        : finished ? <View style={[styles.center, { padding: spacing.xl }]}><MotiView from={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} style={[styles.resultIcon, { borderRadius: radius.pill, backgroundColor: colors.primaryContainer }]}><ClassifyIcon color={colors.primary} size={42} /></MotiView><Text style={[typography.display, { color: colors.text, textAlign: 'center', marginTop: 18 }]}>¡Ronda completa!</Text><Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>Acertaste {score} de {questions.length}. Acá importa aprender el parentesco, no guardar récords.</Text><Pressable onPress={() => restart()} style={[styles.primaryButton, { backgroundColor: colors.primary, borderRadius: radius.pill, marginTop: 22 }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Jugar otra ronda</Text></Pressable></View>
        : question && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
          <MotiView key={`${level}-${position}`} from={{ opacity: 0, translateX: 24 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <Text style={[typography.eyebrow, { color: colors.primary, marginTop: spacing.sm }]}>{CLASSIFICATION_LEVELS[level].prompt.toUpperCase()}</Text>
            <Pressable onPress={() => setLightboxOpen(true)} accessibilityLabel={`Ampliar foto de ${question.species.displayName}`} style={[styles.photo, elevation.low, { borderRadius: radius.xl, marginTop: spacing.md }]}>
              <SpeciesImage species={question.species} full height={240} borderRadius={radius.xl} bordered={false} />
              <View style={[styles.zoomHint, { backgroundColor: 'rgba(24,42,34,.78)', borderRadius: radius.pill }]}><Text style={[typography.caption, { color: '#FFFFFF' }]}>Tocá para ampliar · pellizcá para zoom</Text></View>
            </Pressable>
            <Text style={[typography.title, { color: colors.text, marginTop: spacing.md }]}>{question.species.displayName}</Text>
            <Text style={[typography.body, styles.scientific, { color: colors.textSecondary }]}>{question.species.scientificName}</Text>
            <View style={[styles.options, { marginTop: spacing.lg }]}>
              {question.options.map((option, index) => {
                const correct = answer !== null && option === question.correctAnswer;
                const wrong = answer === option && !correct;
                return <Pressable key={option} onPress={() => choose(option)} disabled={answer !== null} style={[styles.option, { borderRadius: radius.lg, borderColor: correct ? colors.success : wrong ? colors.danger : colors.border, backgroundColor: correct ? colors.primaryContainer : colors.surface }]}><View style={[styles.optionMark, { borderRadius: radius.pill, backgroundColor: correct ? colors.success : wrong ? colors.danger : colors.surfaceVariant }]}>{correct ? <CheckIcon color="#FFFFFF" size={17} /> : wrong ? <CloseIcon color="#FFFFFF" size={17} /> : <Text style={[typography.label, { color: colors.text }]}>{String.fromCharCode(65 + index)}</Text>}</View><Text style={[typography.body, styles.flex, { color: colors.text }]}>{option}</Text></Pressable>;
              })}
            </View>
            {answer !== null && <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} style={[styles.feedback, { backgroundColor: colors.surfaceContainer, borderRadius: radius.lg, marginTop: spacing.md }]}><Text style={[typography.label, { color: answer === question.correctAnswer ? colors.success : colors.danger }]}>{answer === question.correctAnswer ? '¡Correcto!' : 'Casi: mirá la respuesta.'}</Text><Text style={[typography.body, { color: colors.text, marginTop: 3 }]}>{question.species.displayName} pertenece a la {question.rankLabel} <Text style={styles.scientific}>{question.correctAnswer}</Text>.</Text><Pressable onPress={advance} style={[styles.nextButton, { backgroundColor: colors.primary, borderRadius: radius.pill }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Siguiente</Text><ChevronRightIcon color={colors.onPrimary} /></Pressable></MotiView>}
          </MotiView>
        </ScrollView>}
      {question && <PhotoLightbox visible={lightboxOpen} uri={question.species.photo?.fullUrl} label={question.species.displayName} onClose={() => setLightboxOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  roundButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  levels: { flexDirection: 'row', gap: 8 }, level: { flex: 1, minHeight: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { overflow: 'hidden' }, zoomHint: { position: 'absolute', bottom: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  scientific: { fontStyle: 'italic' }, options: { gap: 9 }, option: { minHeight: 58, padding: 12, borderWidth: 1, flexDirection: 'row', gap: 11, alignItems: 'center' }, optionMark: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  feedback: { padding: 15 }, nextButton: { minHeight: 44, marginTop: 12, alignSelf: 'flex-end', paddingHorizontal: 17, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  resultIcon: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }, primaryButton: { minHeight: 48, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
});
