import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';

import { QUIZ_MODES, type QuizMode, type QuizModeConfig } from '../../src/domain/entities/quiz';
import type { Species } from '../../src/domain/entities/species';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';
import { quizRepository, type QuizRecord } from '../../src/data/repositories/quizRepository';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { AppHeader } from '../../src/presentation/components/AppHeader';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { ChevronRightIcon, ClockIcon, HeartIcon, TrophyIcon, type IconProps } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useTheme, type Theme } from '../../src/presentation/theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN } from '../../src/presentation/theme/tokens';

const MODE_ORDER: QuizMode[] = ['classic', 'timed', 'survival'];

const MODE_ICON: Record<QuizMode, (props: IconProps) => React.JSX.Element> = {
  classic: TrophyIcon,
  timed: ClockIcon,
  survival: HeartIcon,
};

/** How many photographs the fanned deck shows. */
const DECK_SIZE = 3;

/**
 * The deck of photographs the game deals from.
 *
 * This screen is about recognising species *from a photograph* and used to show
 * none — which is why it read as empty. Real thumbnails, fanned like a hand of
 * cards, say what the game is before a word is read.
 */
function PhotoDeck({ deck }: { deck: Species[] }): React.JSX.Element {
  const { colors, radius, elevation } = useTheme();

  return (
    <View style={styles.deck}>
      {deck.map((species, i) => {
        const offset = i - (deck.length - 1) / 2;

        return (
          <MotiView
            key={species.codigo}
            from={{ opacity: 0, translateY: 10, rotate: '0deg' }}
            animate={{ opacity: 1, translateY: Math.abs(offset) * 7, rotate: `${offset * 9}deg` }}
            transition={{ type: 'timing', duration: 420, delay: 120 + i * 80 }}
            style={[
              styles.deckCard,
              elevation.medium,
              // A canvas-coloured border reads as the gap between stacked cards.
              { borderRadius: radius.md, borderColor: colors.canvas, zIndex: deck.length - Math.abs(offset) },
            ]}
          >
            <SpeciesImage species={species} height={124} glyphSize={34} bordered={false} />
          </MotiView>
        );
      })}
    </View>
  );
}

/**
 * A preview of the gauge this mode runs on — ten dots, a full timer track, or
 * three lives.
 *
 * It's the same shape the HUD shows once the run starts, so the card is a
 * picture of the rules rather than a coloured tile. The modes carried a colour
 * each before, which turned the list into a swatch chart and said nothing the
 * title didn't already say.
 */
function ModeMeter({ config, theme }: { config: QuizModeConfig; theme: Theme }): React.JSX.Element {
  const { colors, radius } = theme;

  // The whole meter runs in the Juegos domain colour — violet reads as "this
  // screen" the same way the deep hero does, regardless of which mode it's on.
  if (config.questionCount !== null) {
    return (
      <View style={styles.meterRow}>
        {Array.from({ length: config.questionCount }, (_, i) => (
          <View key={i} style={[styles.meterDot, { backgroundColor: colors.play }]} />
        ))}
      </View>
    );
  }

  if (config.durationSeconds !== null) {
    return (
      <View style={[styles.meterTrack, { backgroundColor: colors.surfaceVariant, borderRadius: radius.pill }]}>
        <View style={[styles.meterFill, { backgroundColor: colors.play, borderRadius: radius.pill }]} />
      </View>
    );
  }

  return (
    <View style={styles.meterRow}>
      {Array.from({ length: config.lives ?? 0 }, (_, i) => (
        <HeartIcon key={i} color={colors.play} size={13} filled />
      ))}
    </View>
  );
}

export default function GamesScreen(): React.JSX.Element {
  const db = useUserDatabase();
  const catalog = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors, radius, spacing, typography, elevation } = theme;

  const [menuOpen, setMenuOpen] = useState(false);
  const [records, setRecords] = useState<Record<string, QuizRecord>>({});
  const [deck, setDeck] = useState<Species[]>([]);
  const [poolSize, setPoolSize] = useState(0);

  // Refresh on focus so a new record shows the moment a run ends.
  useFocusEffect(
    useCallback(() => {
      void quizRepository.listRecords(db).then(setRecords);
    }, [db]),
  );

  useEffect(() => {
    void (async () => {
      // The stated pool is every photograph the quiz can draw from…
      setPoolSize(await speciesRepository.count(catalog, { onlyWithPhoto: true }));

      // …but the deck itself draws from priority species, which skew towards
      // the fauna the app foregrounds elsewhere. Sampling all 1668 photos meant
      // the hero was usually three pictures of grass.
      const deckFilters = { onlyWithPhoto: true, onlyPriority: true };
      const pool = await speciesRepository.count(catalog, deckFilters);

      // A different hand on each visit, so the screen isn't the same picture twice.
      const offset = pool > DECK_SIZE ? Math.floor(Math.random() * (pool - DECK_SIZE)) : 0;
      const page = await speciesRepository.findPaged(catalog, deckFilters, DECK_SIZE, offset);
      setDeck(page.items);
    })();
  }, [catalog]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom + spacing.xl }}
      >
        <AppHeader eyebrow="APRENDÉ JUGANDO" title="Juegos" onOpenMenu={() => setMenuOpen(true)} />

        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 380 }}
          style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}
        >
          <View
            style={[
              styles.hero,
              elevation.medium,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.canvasBorder,
                borderRadius: radius.xl,
                paddingVertical: spacing.xl,
              },
            ]}
          >
            {deck.length > 0 && <PhotoDeck deck={deck} />}

            <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
              <Text style={[typography.display, { color: colors.canvasText }]}>Identificá{'\n'}la especie</Text>
              <Text style={[typography.body, { color: colors.canvasTextMuted, marginTop: spacing.sm }]}>
                Mirá la foto y elegí el nombre correcto. Las opciones equivocadas vienen de la misma familia,
                así que hay que mirar con atención.
              </Text>

              {poolSize > 0 && (
                <View style={[styles.poolRow, { borderTopColor: colors.canvasBorder, marginTop: spacing.lg }]}>
                  <Text style={[typography.label, { color: colors.play }]}>{poolSize}</Text>
                  <Text style={[typography.caption, { color: colors.canvasTextMuted }]}>fotos en el mazo</Text>
                </View>
              )}
            </View>
          </View>
        </MotiView>

        <Text style={[typography.eyebrow, { color: colors.textMuted, paddingHorizontal: spacing.lg, marginTop: spacing.xl }]}>
          ELEGÍ UN MODO
        </Text>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
          {MODE_ORDER.map((mode, index) => {
            const config = QUIZ_MODES[mode];
            const record = records[mode];
            const Icon = MODE_ICON[mode];
            const played = record && record.bestScore > 0;

            return (
              <MotiView
                key={mode}
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 320, delay: index * 70 }}
              >
                <Pressable
                  onPress={() => {
                    // Starting a run is the weightiest action on this screen.
                    haptics.press();
                    router.push(`/game/identify?mode=${mode}`);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Jugar modo ${config.title}`}
                  style={({ pressed }) => [
                    styles.mode,
                    elevation.low,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: radius.lg,
                      padding: spacing.lg,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}
                >
                  <View style={styles.modeTop}>
                    <Icon color={colors.text} size={20} />
                    <Text style={[typography.cardTitle, styles.flex, { color: colors.text }]}>{config.title}</Text>

                    {played ? (
                      <View style={[styles.record, { backgroundColor: colors.play, borderRadius: radius.sm }]}>
                        <Text style={[typography.caption, { color: colors.onPlay }]}>{record.bestScore}</Text>
                      </View>
                    ) : (
                      <ChevronRightIcon color={colors.textMuted} size={18} />
                    )}
                  </View>

                  <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>
                    {config.description}
                  </Text>

                  <View style={{ marginTop: spacing.md }}>
                    <ModeMeter config={config} theme={theme} />
                  </View>

                  {played && (
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
                      Mejor racha {record.bestStreak}
                    </Text>
                  )}
                </Pressable>
              </MotiView>
            );
          })}
        </View>
      </ScrollView>

      <AppDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  hero: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  deck: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deckCard: { width: 92, height: 124, overflow: 'hidden', borderWidth: 3, marginHorizontal: -12 },
  poolRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  mode: {},
  modeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  record: { paddingHorizontal: 9, paddingVertical: 3 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meterDot: { width: 7, height: 7, borderRadius: 3.5 },
  meterTrack: { height: 7, overflow: 'hidden' },
  meterFill: { height: '100%', width: '100%' },
});
