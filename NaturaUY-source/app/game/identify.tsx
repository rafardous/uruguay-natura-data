import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';

import { QUIZ_MODES, type QuizMode, type QuizOption } from '../../src/domain/entities/quiz';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import {
  CheckIcon,
  ClockIcon,
  CloseIcon,
  FlameIcon,
  TrophyIcon,
  ZapIcon,
} from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useQuizRun } from '../../src/presentation/hooks/useQuizRun';
import { useTheme, type Theme } from '../../src/presentation/theme/ThemeProvider';

const isQuizMode = (value: string | undefined): value is QuizMode =>
  value === 'classic' || value === 'timed' || value === 'survival';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Counts up to a target number over `duration`ms — cheap "juice" for the results screen. */
function useCountUp(target: number, active: boolean, duration = 700): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf: ReturnType<typeof requestAnimationFrame>;
    const start = Date.now();

    const tick = (): void => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);

  return active ? value : 0;
}

function HudChip({ icon, value, onAccent }: { icon: React.ReactNode; value: string; onAccent: string }): React.JSX.Element {
  return (
    <View style={styles.hudChip}>
      {icon}
      <Text style={[styles.hudChipText, { color: onAccent }]}>{value}</Text>
    </View>
  );
}

/** 10 dots for Classic mode — filled behind, current one enlarged. */
function ProgressDots({ total, current, onAccent }: { total: number; current: number; onAccent: string }): React.JSX.Element {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }, (_, i) => (
        <MotiView
          key={i}
          animate={{
            opacity: i <= current ? 1 : 0.35,
            scale: i === current ? 1.35 : 1,
          }}
          transition={{ type: 'timing', duration: 220 }}
          style={[styles.dot, { backgroundColor: onAccent }]}
        />
      ))}
    </View>
  );
}

/** Linear countdown for Contrarreloj — drains smoothly, flashes danger under 10s. */
function CountdownBar({ secondsLeft, total, onAccent }: { secondsLeft: number; total: number; onAccent: string }): React.JSX.Element {
  const ratio = Math.max(0, Math.min(1, secondsLeft / total));

  return (
    <View style={[styles.countdownTrack, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
      <MotiView
        animate={{ width: `${ratio * 100}%` }}
        transition={{ type: 'timing', duration: 950 }}
        style={[styles.countdownFill, { backgroundColor: onAccent }]}
      />
    </View>
  );
}

/** 3 hearts for Eliminación — lost ones pop down to a faded outline. */
function LivesRow({ lives, total, onAccent }: { lives: number; total: number; onAccent: string }): React.JSX.Element {
  return (
    <View style={styles.livesRow}>
      {Array.from({ length: total }, (_, i) => {
        const alive = i < lives;
        return (
          <MotiView
            key={i}
            animate={{ scale: alive ? 1 : 0.8, opacity: alive ? 1 : 0.35 }}
            transition={{ type: 'spring', damping: 9 }}
          >
            <Text style={[styles.heartGlyph, { color: onAccent }]}>{alive ? '♥' : '♡'}</Text>
          </MotiView>
        );
      })}
    </View>
  );
}

/** A small burst of dots on a correct answer — remounts (and replays) whenever `trigger` changes. */
function CelebrationBurst({ trigger, palette }: { trigger: number; palette: string[] }): React.JSX.Element | null {
  if (trigger === 0) return null;

  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <View pointerEvents="none" style={styles.burstLayer}>
      <View style={styles.burstOrigin}>
        {angles.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <MotiView
              key={`${trigger}-${i}`}
              from={{ opacity: 1, scale: 1, translateX: 0, translateY: 0 }}
              animate={{
                opacity: 0,
                scale: 0.3,
                translateX: Math.cos(rad) * 70,
                translateY: Math.sin(rad) * 70,
              }}
              transition={{ type: 'timing', duration: 560 }}
              style={[styles.burstDot, { backgroundColor: palette[i % palette.length] }]}
            />
          );
        })}
      </View>
    </View>
  );
}

interface AnswerTileProps {
  option: QuizOption;
  letter: string;
  index: number;
  revealed: boolean;
  isPicked: boolean;
  onPress: () => void;
  theme: Theme;
}

function AnswerTile({ option, letter, index, revealed, isPicked, onPress, theme }: AnswerTileProps): React.JSX.Element {
  const { colors, radius, typography } = theme;

  const badgeBg = !revealed
    ? colors.surfaceVariant
    : option.correct
      ? colors.success
      : isPicked
        ? colors.danger
        : colors.surfaceVariant;
  const badgeFg = !revealed ? colors.textSecondary : option.correct || isPicked ? colors.onDanger : colors.textMuted;
  const rowBg = !revealed ? colors.surface : option.correct ? colors.success : isPicked ? colors.danger : colors.surface;
  const rowFg = !revealed ? colors.text : option.correct || isPicked ? colors.onDanger : colors.textMuted;
  const dim = revealed && !option.correct && !isPicked;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: dim ? 0.55 : 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 240, delay: index * 45 }}
    >
      <Pressable
        onPress={onPress}
        disabled={revealed}
        accessibilityRole="button"
        accessibilityLabel={option.label}
        style={({ pressed }) => [
          styles.option,
          {
            backgroundColor: rowBg,
            borderColor: revealed ? 'transparent' : colors.border,
            borderRadius: radius.lg,
            transform: [{ scale: pressed && !revealed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={[styles.optionBadge, { backgroundColor: badgeBg }]}>
          {revealed && option.correct ? (
            <CheckIcon color={colors.onDanger} size={16} />
          ) : revealed && isPicked ? (
            <CloseIcon color={colors.onDanger} size={16} />
          ) : (
            <Text style={[typography.label, { color: badgeFg }]}>{letter}</Text>
          )}
        </View>
        <Text style={[typography.label, styles.optionLabel, { color: rowFg }]} numberOfLines={2}>
          {option.label}
        </Text>
      </Pressable>
    </MotiView>
  );
}

export default function IdentifyGameScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: QuizMode = isQuizMode(params.mode) ? params.mode : 'classic';

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors, radius, spacing, typography } = theme;
  const { loading, state, question, secondsLeft, answeredCodigo, answer, next, restart } = useQuizRun(mode);

  /*
   * The HUD sits on the app's deep plane in every mode. Each mode used to own a
   * colour — green, amber, pink — which turned the three modes into a palette
   * demo and spent the accent on decoration. The mode is already named on
   * screen; the accent is better saved for the one thing worth looking at.
   */
  const hudBg = colors.canvas;
  const hudFg = colors.canvasText;

  const [burstTrigger, setBurstTrigger] = useState(0);
  const shake = useSharedValue(0);
  const pulse = useSharedValue(1);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: pulse.value }],
  }));

  useEffect(() => {
    if (!answeredCodigo || state.finished) return;
    const timer = setTimeout(next, 1150);
    return () => clearTimeout(timer);
  }, [answeredCodigo, state.finished, next]);

  const onAnswer = (codigo: string): void => {
    if (answeredCodigo) return;

    const correct = answer(codigo);

    if (correct) {
      pulse.value = withSequence(withSpring(1.04), withSpring(1));
      setBurstTrigger((t) => t + 1);
      haptics.success();
    } else {
      shake.value = withSequence(
        withTiming(-9, { duration: 55 }),
        withTiming(9, { duration: 55 }),
        withTiming(-6, { duration: 55 }),
        withTiming(0, { duration: 55 }),
      );
      haptics.error();
    }
  };

  const config = QUIZ_MODES[mode];
  const total = config.questionCount;
  const scoreCount = useCountUp(state.score, state.finished);

  const tierMessage = (): string => {
    if (total !== null) {
      const ratio = state.score / total;
      if (ratio >= 0.8) return '¡Excelente ojo naturalista!';
      if (ratio >= 0.5) return '¡Nada mal! Seguí así.';
      return 'Vas a mejorar la próxima.';
    }
    if (state.bestStreakThisRun >= 8) return '¡Racha impresionante!';
    if (state.bestStreakThisRun >= 4) return '¡Buena racha!';
    return 'Segui practicando, ya casi.';
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.hud,
          {
            backgroundColor: hudBg,
            borderColor: colors.canvasBorder,
            paddingTop: insets.top + spacing.sm,
            borderBottomLeftRadius: radius.xl,
            borderBottomRightRadius: radius.xl,
          },
        ]}
      >
        <View style={styles.hudTop}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Salir del juego">
            <CloseIcon color={hudFg} />
          </Pressable>
          <Text style={[typography.label, { color: hudFg }]}>{config.title}</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={[styles.hudRow, { paddingHorizontal: spacing.lg }]}>
          <HudChip icon={<ZapIcon color={hudFg} size={15} />} value={String(state.score)} onAccent={hudFg} />
          <HudChip icon={<FlameIcon color={hudFg} size={15} />} value={String(state.streak)} onAccent={hudFg} />

          <View style={styles.hudSpacer} />

          {mode === 'classic' && total !== null && (
            <ProgressDots total={total} current={state.questionIndex} onAccent={hudFg} />
          )}
          {mode === 'timed' && secondsLeft !== null && config.durationSeconds !== null && (
            <View style={styles.timedTail}>
              <ClockIcon color={hudFg} size={14} />
              <Text style={[typography.caption, { color: hudFg }]}>{secondsLeft}s</Text>
            </View>
          )}
          {mode === 'survival' && state.livesLeft !== null && (
            <LivesRow lives={state.livesLeft} total={config.lives ?? 3} onAccent={hudFg} />
          )}
        </View>

        {mode === 'timed' && secondsLeft !== null && config.durationSeconds !== null && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
            <CountdownBar secondsLeft={secondsLeft} total={config.durationSeconds} onAccent={colors.play} />
          </View>
        )}
      </View>

      {state.finished ? (
        <MotiView
          from={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 340 }}
          style={[styles.result, { padding: spacing.xl }]}
        >
          <View style={[styles.trophyHalo, { backgroundColor: colors.surfaceVariant }]}>
            <MotiView
              from={{ scale: 0, rotate: '-20deg' }}
              animate={{ scale: 1, rotate: '0deg' }}
              transition={{ type: 'spring', damping: 8, delay: 120 }}
              style={[styles.trophy, { backgroundColor: colors.play }]}
            >
              <TrophyIcon color={colors.onPlay} size={38} />
            </MotiView>
          </View>

          <Text style={[typography.display, { color: colors.text, marginTop: spacing.xl }]}>{scoreCount}</Text>
          <Text style={[typography.label, { color: colors.textMuted, marginTop: 2 }]}>
            {state.score === 1 ? 'acierto' : 'aciertos'}
          </Text>
          {/* Lime is a background colour only — as text on a pale ground it fails contrast. */}
          <Text style={[typography.body, styles.tierMessage, { color: colors.text }]}>{tierMessage()}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>
            Mejor racha: {state.bestStreakThisRun}
          </Text>

          <Pressable
            onPress={() => {
              haptics.press();
              restart();
            }}
            style={[
              styles.primaryButton,
              { backgroundColor: colors.play, borderRadius: radius.md, marginTop: spacing.xl },
            ]}
          >
            <Text style={[typography.label, { color: colors.onPlay }]}>Jugar de nuevo</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={[styles.secondaryButton, { marginTop: spacing.sm }]}>
            <Text style={[typography.label, { color: colors.textSecondary }]}>Volver a los modos</Text>
          </Pressable>
        </MotiView>
      ) : loading || !question ? (
        <View style={{ padding: spacing.lg }}>
          <MotiView
            from={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 700, loop: true, repeatReverse: true }}
            style={[styles.loadingBlock, { backgroundColor: colors.surfaceVariant, borderRadius: radius.lg }]}
          />
        </View>
      ) : (
        <View style={[styles.flex, { padding: spacing.lg }]}>
          <Animated.View style={photoStyle}>
            <View style={[styles.photoFrame, { borderRadius: radius.xl }]}>
              <SpeciesImage species={question.target} height={250} full borderRadius={radius.xl - 3} glyphSize={84} />
            </View>
          </Animated.View>

          <Text style={[typography.label, { color: colors.textMuted, marginTop: spacing.lg, textAlign: 'center' }]}>
            ¿Qué especie es?
          </Text>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {question.options.map((option, index) => (
              <AnswerTile
                key={option.codigo}
                option={option}
                letter={LETTERS[index] ?? '?'}
                index={index}
                revealed={answeredCodigo !== null}
                isPicked={answeredCodigo === option.codigo}
                onPress={() => onAnswer(option.codigo)}
                theme={theme}
              />
            ))}
          </View>

          {answeredCodigo && (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: spacing.md }}>
              <Text style={[typography.body, styles.scientific, { color: colors.textMuted }]}>
                {question.target.scientificName}
              </Text>
            </MotiView>
          )}

          <CelebrationBurst trigger={burstTrigger} palette={[colors.success, colors.play, colors.primary]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  hud: { paddingBottom: 14, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth },
  hudTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hudSpacer: { flex: 1 },
  hudChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  hudChipText: { fontSize: 13, fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  countdownTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  countdownFill: { height: '100%', borderRadius: 3 },
  timedTail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  livesRow: { flexDirection: 'row', gap: 4 },
  heartGlyph: { fontSize: 18, lineHeight: 20 },
  photoFrame: { overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  optionBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1 },
  scientific: { fontStyle: 'italic', textAlign: 'center' },
  result: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  trophyHalo: { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center' },
  trophy: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  tierMessage: { marginTop: 10, fontWeight: '700', textAlign: 'center' },
  primaryButton: { paddingHorizontal: 28, paddingVertical: 15 },
  secondaryButton: { padding: 12 },
  loadingBlock: { height: 420 },
  burstLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'flex-start' },
  burstOrigin: { position: 'absolute', top: 120, width: 1, height: 1 },
  burstDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, left: -4, top: -4 },
});
