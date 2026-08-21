import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';

import type { Species } from '../../src/domain/entities/species';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { Skeleton } from '../../src/presentation/components/Skeleton';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { GameIcon, HeartIcon, MenuIcon, ShieldIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN } from '../../src/presentation/theme/tokens';

interface Stats {
  total: number;
  withPhoto: number;
  families: number;
}

const ON_PHOTO = '#FFFFFF';
const ON_PHOTO_MUTED = 'rgba(255,255,255,0.72)';
const PANEL = 'rgba(14,24,17,0.82)';

const FEATURED_WIDTH = 184;
const FEATURED_HEIGHT = 236;

/** A featured species in the horizontal shelf. */
function FeaturedCard({
  species,
  onPress,
}: {
  species: Species;
  onPress: (codigo: string) => void;
}): React.JSX.Element {
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const width = FEATURED_WIDTH;
  const height = FEATURED_HEIGHT;

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress(species.codigo);
      }}
      accessibilityRole="button"
      accessibilityLabel={species.displayName}
      style={({ pressed }) => [
        styles.featured,
        elevation.low,
        {
          width,
          height,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <SpeciesImage species={species} height={height} glyphSize={52} bordered={false} style={StyleSheet.absoluteFill} />
      <View style={[styles.featuredCaption, { margin: spacing.sm, borderRadius: radius.md, padding: spacing.md }]}>
        <Text style={[typography.label, { color: ON_PHOTO }]} numberOfLines={2}>
          {species.displayName}
        </Text>
        <Text style={[typography.caption, { color: ON_PHOTO_MUTED, marginTop: 2 }]} numberOfLines={1}>
          {species.taxonomy.clase}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The species this day belongs to.
 *
 * Picked from the day number rather than at random, so it's the same species
 * all day and a different one tomorrow — a reason to open the app again that
 * costs one query.
 */
function useSpeciesOfTheDay(): Species | null {
  const db = useSQLiteContext();
  const [species, setSpecies] = useState<Species | null>(null);

  useEffect(() => {
    void (async () => {
      const filters = { onlyWithPhoto: true, onlyPriority: true };
      const pool = await speciesRepository.count(db, filters);
      if (pool === 0) return;

      const day = Math.floor(Date.now() / 86_400_000);
      const page = await speciesRepository.findPaged(db, filters, 1, day % pool);
      setSpecies(page.items[0] ?? null);
    })();
  }, [db]);

  return species;
}

export default function HomeScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const { count } = useFavorites();

  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [featured, setFeatured] = useState<Species[]>([]);

  const openSpecies = useCallback((codigo: string) => router.push(`/species/${codigo}`), [router]);

  const daily = useSpeciesOfTheDay();

  useEffect(() => {
    void speciesRepository.stats(db).then(setStats);
    // Threatened species with a photograph make the most compelling shelf.
    void speciesRepository
      .findPaged(db, { onlyPriority: true, onlyWithPhoto: true }, 10, 0)
      .then((page) => setFeatured(page.items));
  }, [db]);

  const statChips: { value: number; label: string }[] = stats
    ? [
        { value: stats.total, label: 'especies' },
        { value: stats.families, label: 'familias' },
        { value: stats.withPhoto, label: 'con foto' },
      ]
    : [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom + spacing.xl }}
      >
        {/*
          The header lives inside the hero rather than above it — a separate
          title bar stacked on a coloured block is the web pattern this screen
          was stuck in. Extra bottom padding leaves room for the card that
          overlaps the hero's lower edge.
        */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: colors.canvas,
              borderBottomLeftRadius: radius.hero,
              borderBottomRightRadius: radius.hero,
            },
          ]}
        >
          <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 56 }}>
            <Pressable
              onPress={() => {
                haptics.tap();
                setMenuOpen(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Abrir menú"
              style={({ pressed }) => [
                styles.heroMenu,
                {
                  borderRadius: radius.pill,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
                },
              ]}
            >
              <MenuIcon color={colors.canvasText} />
            </Pressable>

            <MotiView
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 380 }}
              style={{ marginTop: spacing.xl }}
            >
              <Text style={[typography.hero, { color: colors.canvasText }]}>
                Conocé la vida{'\n'}que habita{'\n'}nuestro suelo
              </Text>

              {/*
                One figure carries the accent; the rest stay quiet. Three
                equally bright chips would just be three chips.
              */}
              <View style={[styles.chipRow, { marginTop: spacing.xl }]}>
                {stats ? (
                  statChips.map((chip, i) => (
                    <View
                      key={chip.label}
                      style={[
                        styles.statChip,
                        {
                          borderRadius: radius.sm,
                          backgroundColor: i === 0 ? colors.accent : 'transparent',
                          borderColor: i === 0 ? 'transparent' : 'rgba(255,255,255,0.18)',
                        },
                      ]}
                    >
                      <Text style={[typography.label, { color: i === 0 ? colors.onAccent : colors.canvasText }]}>
                        {chip.value}
                      </Text>
                      <Text
                        style={[
                          typography.caption,
                          { color: i === 0 ? colors.onAccent : colors.canvasTextMuted },
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Skeleton width="72%" height={32} radius={radius.sm} />
                )}
              </View>
            </MotiView>
          </View>
        </View>

        {/* Lifted over the hero's edge — the overlap is what creates the depth. */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 380, delay: 90 }}
          style={[styles.quickWrap, { marginHorizontal: spacing.lg }]}
        >
          <View
            style={[
              styles.quickCard,
              elevation.medium,
              { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
            ]}
          >
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push('/games');
              }}
              accessibilityRole="button"
              accessibilityLabel="Jugar"
              style={styles.quick}
            >
              <GameIcon color={colors.text} size={20} />
              <View style={styles.flex}>
                <Text style={[typography.label, { color: colors.text }]}>Jugar</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                  Poné a prueba tu ojo
                </Text>
              </View>
            </Pressable>

            <View style={[styles.quickDivider, { backgroundColor: colors.border }]} />

            <Pressable
              onPress={() => {
                haptics.tap();
                router.push('/favorites');
              }}
              accessibilityRole="button"
              accessibilityLabel="Favoritos"
              style={styles.quick}
            >
              <HeartIcon color={count > 0 ? colors.favorite : colors.text} size={20} filled={count > 0} />
              <View style={styles.flex}>
                <Text style={[typography.label, { color: colors.text }]}>Favoritos</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                  {count === 0 ? 'Nada guardado aún' : `${count} guardada${count === 1 ? '' : 's'}`}
                </Text>
              </View>
            </Pressable>
          </View>
        </MotiView>

        {/*
          One species, chosen by the date. The screen had no focal point between
          the hero and a row of small tiles; this gives it one, and it changes
          on its own overnight.
        */}
        {daily && (
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 380, delay: 140 }}
            style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}
          >
            <Text style={[typography.eyebrow, { color: colors.textMuted }]}>ESPECIE DEL DÍA</Text>
            <Pressable
              onPress={() => {
                haptics.tap();
                openSpecies(daily.codigo);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Especie del día: ${daily.displayName}`}
              style={({ pressed }) => [
                styles.daily,
                elevation.low,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  marginTop: spacing.md,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              <SpeciesImage species={daily} height={230} glyphSize={70} bordered={false} style={StyleSheet.absoluteFill} />
              <View style={[styles.dailyPanel, { margin: spacing.md, borderRadius: radius.lg, padding: spacing.md }]}>
                <Text style={[typography.cardTitle, { color: ON_PHOTO }]} numberOfLines={1}>
                  {daily.displayName}
                </Text>
                <Text style={[typography.caption, { color: ON_PHOTO_MUTED, marginTop: 2 }]} numberOfLines={1}>
                  {daily.taxonomy.clase} · {daily.conservation.label}
                </Text>
              </View>
            </Pressable>
          </MotiView>
        )}

        <View style={[styles.sectionHeader, { paddingHorizontal: spacing.lg, marginTop: spacing.xl }]}>
          <ShieldIcon color={colors.primary} size={20} />
          <Text style={[typography.title, { color: colors.text, flex: 1 }]}>Prioridad de conservación</Text>
        </View>
        <Text style={[typography.body, { color: colors.textMuted, paddingHorizontal: spacing.lg, marginTop: 4 }]}>
          Especies que el SNAP señala como prioritarias.
        </Text>

        {featured.length === 0 ? (
          <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <Skeleton width={FEATURED_WIDTH} height={FEATURED_HEIGHT} radius={radius.xl} />
            <Skeleton width={FEATURED_WIDTH} height={FEATURED_HEIGHT} radius={radius.xl} />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              marginTop: spacing.lg,
              alignItems: 'flex-start',
            }}
          >
            {featured.map((species) => (
              <FeaturedCard key={species.codigo} species={species} onPress={openSpecies} />
            ))}
          </ScrollView>
        )}
      </ScrollView>

      <AppDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  hero: { overflow: 'hidden' },
  heroMenu: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickWrap: { marginTop: -34 },
  quickCard: { flexDirection: 'row', alignItems: 'center' },
  quick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  quickDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featured: { overflow: 'hidden' },
  featuredCaption: { marginTop: 'auto', backgroundColor: PANEL },
  daily: { height: 230, overflow: 'hidden', justifyContent: 'flex-end' },
  dailyPanel: { backgroundColor: PANEL },
});
