import { useEffect, useMemo, useState } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import type { KnowledgeLevel } from '../../src/domain/entities/quiz';
import { triviaRepository, type TriviaQuestion } from '../../src/data/repositories/triviaRepository';
import { BackIcon } from '../../src/presentation/components/TabIcons';
import { RecordCelebration } from '../../src/presentation/components/RecordCelebration';
import { haptics } from '../../src/presentation/haptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';

export default function TriviaScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const params = useLocalSearchParams<{ level?: string }>();
  const level: KnowledgeLevel = params.level === 'easy' || params.level === 'medium' ? params.level : 'hard';
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [burstTrigger, setBurstTrigger] = useState(0);
  const reducedMotion = useReducedMotion();
  const shake = useSharedValue(0);
  const pulse = useSharedValue(1);
  const answerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: pulse.value }],
  }));

  useEffect(() => {
    void triviaRepository.list(db, [], level).then((rows) => setQuestions([...rows].sort(() => Math.random() - 0.5).slice(0, 6)));
  }, [db, level]);

  const question = questions[index] ?? null;
  const finished = questions.length > 0 && index >= questions.length;
  const correct = useMemo(() => question?.options.find((option) => option.correct), [question]);

  const choose = (id: string): void => {
    if (selected) return;
    setSelected(id);
    if (question?.options.find((option) => option.id === id)?.correct) {
      setScore((value) => value + 1);
      if (!reducedMotion) {
        pulse.value = withSequence(withSpring(1.035), withSpring(1));
        setBurstTrigger((value) => value + 1);
      }
      haptics.success();
    } else {
      if (!reducedMotion) shake.value = withSequence(
        withTiming(-9, { duration: 55 }),
        withTiming(9, { duration: 55 }),
        withTiming(-6, { duration: 55 }),
        withTiming(0, { duration: 55 }),
      );
      haptics.error();
    }
  };

  const next = (): void => {
    setSelected(null);
    setIndex((value) => value + 1);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderRadius: radius.pill }]} accessibilityRole="button" accessibilityLabel="Volver">
          <BackIcon color={colors.text} />
        </Pressable>
        <View>
          <Text style={[typography.eyebrow, { color: colors.play }]}>TRIVIA · {level.toUpperCase()}</Text>
          <Text style={[typography.headerTitle, { color: colors.text }]}>{finished ? 'Partida terminada' : `${Math.min(index + 1, questions.length)} / ${questions.length}`}</Text>
        </View>
      </View>
      {questions.length === 0 ? (
        <View style={styles.center}>
          <Text style={[typography.title, { color: colors.text }]}>Todavía no hay preguntas publicadas</Text>
          <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>El juego se habilita automáticamente al publicar preguntas aprobadas para esta selección.</Text>
        </View>
      ) : finished ? (
        <View style={styles.center}>
          <Text style={[typography.display, { color: colors.play }]}>{score}/{questions.length}</Text>
          <Text style={[typography.title, { color: colors.text }]}>Respuestas correctas</Text>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>La trivia no guarda récords: este resultado corresponde sólo a la partida actual.</Text>
          <Pressable onPress={() => router.back()} style={[styles.next, { backgroundColor: colors.play, borderRadius: radius.pill }]}>
            <Text style={[typography.label, { color: colors.onPlay }]}>Volver a juegos</Text>
          </Pressable>
        </View>
      ) : question ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {question.imageUrl && <View>
            <Image source={{ uri: question.imageUrl }} contentFit="cover" style={[styles.questionImage, { borderRadius: radius.lg }]} />
            {question.imageAttribution && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Foto: {question.imageAttribution}{question.imageLicense ? ` · ${question.imageLicense}` : ''}</Text>}
          </View>}
          <Text style={[typography.title, { color: colors.text }]}>{question.prompt}</Text>
          <Animated.View style={answerStyle}>
            <View style={styles.options}>
              {question.options.map((option) => {
                const revealed = selected !== null;
                const good = revealed && option.correct;
                const wrong = revealed && selected === option.id && !option.correct;
                return <Pressable key={option.id} disabled={revealed} onPress={() => choose(option.id)} style={[styles.option, { borderRadius: radius.lg, backgroundColor: good ? '#D8ECDD' : wrong ? '#F5D5D1' : colors.surface, borderColor: good ? '#39704A' : wrong ? '#A5463C' : colors.border }]}>
                  <Text style={[typography.body, { color: colors.text }]}>{option.body}</Text>
                </Pressable>;
              })}
            </View>
            {selected !== null && <View style={[styles.explanation, { backgroundColor: colors.surfaceVariant, borderRadius: radius.lg }]}>
              <Text style={[typography.label, { color: colors.text }]}>Respuesta: {correct?.body}</Text>
              {question.explanation && <Text style={[typography.body, { color: colors.textSecondary }]}>{question.explanation}</Text>}
              <Pressable onPress={next} style={[styles.next, { backgroundColor: colors.play, borderRadius: radius.pill }]}>
                <Text style={[typography.label, { color: colors.onPlay }]}>Siguiente</Text>
              </Pressable>
            </View>}
          </Animated.View>
        </ScrollView>
      ) : null}
      <RecordCelebration key={burstTrigger} visible={selected !== null && correct?.id === selected} palette={[colors.play, colors.success, '#E7C65D', '#D97968']} reducedMotion={Boolean(reducedMotion)} message="¡Correcto!" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { paddingTop: 24, paddingBottom: 32, gap: 18 },
  questionImage: { width: '100%', height: 180 },
  options: { gap: 10 },
  option: { minHeight: 58, justifyContent: 'center', padding: 16, borderWidth: 1 },
  explanation: { padding: 16, gap: 10, marginTop: 12 },
  next: { minHeight: 48, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
});
