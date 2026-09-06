import { AppState, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import { Carousel } from 'react-native-reanimated-carousel';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import type { Species } from '../../src/domain/entities/species';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { CollapsibleGradientHeader } from '../../src/presentation/components/CollapsibleGradientHeader';
import { AccountButton } from '../../src/presentation/components/AccountButton';
import { SearchBar } from '../../src/presentation/components/SearchBar';
import { Skeleton } from '../../src/presentation/components/Skeleton';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import {
  GameIcon,
  HeartIcon,
  MenuIcon,
  NewsIcon,
} from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useMobileSync } from '../../src/sync/MobileSyncProvider';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';
import { settingsRepository } from '../../src/data/repositories/settingsRepository';
import { getMostFavoritedSpecies } from '../../src/lib/mobileApi';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { COLLAPSIBLE_HEADER_EXPANDED, NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN } from '../../src/presentation/theme/tokens';

const ON_PHOTO = '#FFFFFF';
const ON_PHOTO_MUTED = 'rgba(255,255,255,0.78)';
const PHOTO_PANEL = 'rgba(14,24,17,0.82)';
const CARD_HEIGHT = 230;
const POPULAR_CODE_CACHE_KEY = 'home.most_favorited_code';

function LargeSpeciesCard({
  species,
  width,
  onPress,
  kicker,
}: {
  species: Species;
  width: number;
  onPress: (codigo: string) => void;
  kicker?: string;
}): React.JSX.Element {
  const { radius, spacing, typography, elevation, colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress(species.codigo);
      }}
      accessibilityRole="button"
      accessibilityLabel={species.displayName}
      style={({ pressed }) => [
        styles.speciesCard,
        elevation.low,
        {
          width,
          height: CARD_HEIGHT,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <SpeciesImage
        species={species}
        height={CARD_HEIGHT}
        glyphSize={70}
        bordered={false}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.speciesPanel, { margin: spacing.md, borderRadius: radius.lg, padding: spacing.md }]}>
        {kicker && (
          <Text style={[typography.eyebrow, { color: '#DDEFCF', marginBottom: 4 }]}>
            {kicker}
          </Text>
        )}
        <Text style={[typography.cardTitle, { color: ON_PHOTO }]} numberOfLines={1}>
          {species.displayName}
        </Text>
        <Text style={[typography.caption, { color: ON_PHOTO_MUTED, marginTop: 2 }]} numberOfLines={1}>
          {species.taxonomy.clase} · {species.conservation.label}
        </Text>
      </View>
    </Pressable>
  );
}

function SpeciesCarousel({
  species,
  width,
  onPress,
  labels,
}: {
  species: Species[];
  width: number;
  onPress: (codigo: string) => void;
  labels?: readonly (string | undefined)[];
}): React.JSX.Element {
  const { colors, radius, spacing } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <View>
      <Carousel
        itemSize={width}
        style={{ width, height: CARD_HEIGHT }}
        data={species}
        loop
        autoplay={species.length > 1}
        autoplayInterval={7000}
        layout={{ type: 'parallax', scale: 0.92, offset: 48 }}
        onSnapToItem={setActiveIndex}
        renderItem={({ item, index }: { item: Species; index: number }) => <LargeSpeciesCard species={item} width={width} onPress={onPress} kicker={labels?.[index]} />}
      />
      {species.length > 1 && (
        <View style={[styles.dots, { marginTop: spacing.md }]} accessibilityLabel={`Diapositiva ${activeIndex + 1} de ${species.length}`}>
          {species.map((item, index) => (
            <View
              key={item.codigo}
              style={{
                width: index === activeIndex ? 22 : 7,
                height: 7,
                borderRadius: radius.pill,
                backgroundColor: index === activeIndex ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const userDb = useUserDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const { count } = useFavorites();
  const { revision } = useMobileSync();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [dailySpecies, setDailySpecies] = useState<Species | null>(null);
  const [spotlightSpecies, setSpotlightSpecies] = useState<Species[]>([]);
  const [hasPopularSpecies, setHasPopularSpecies] = useState(false);
  const cardWidth = Math.max(280, windowWidth - spacing.lg * 2);

  const openSpecies = useCallback((codigo: string) => router.push(`/species/${codigo}`), [router]);
  const submitSearch = useCallback(() => {
    const search = query.trim();
    if (search) router.push({ pathname: '/explore', params: { q: search } });
    else router.push('/explore');
  }, [query, router]);

  const loadHome = useCallback(async () => {
    const stats = await speciesRepository.stats(db);
    const withPhoto = await speciesRepository.count(db, { onlyWithPhoto: true });
    const cachedPopular = await settingsRepository.get(userDb, POPULAR_CODE_CACHE_KEY);
    let popularCode = cachedPopular;
    try {
      const remote = await getMostFavoritedSpecies(1);
      if (remote[0]) {
        popularCode = remote[0];
        await settingsRepository.set(userDb, POPULAR_CODE_CACHE_KEY, remote[0]);
      }
    } catch {
      // The catalogue remains useful before the migration is deployed or offline.
    }
    const poolSize = Math.min(10, withPhoto);
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
    const maxOffset = Math.max(0, withPhoto - poolSize);
    const offset = maxOffset === 0 ? 0 : Number(dateKey) % (maxOffset + 1);
    const page = await speciesRepository.findPaged(db, { onlyWithPhoto: true }, poolSize, offset);
    setTotal(stats.total);
    setDailySpecies(page.items[0] ?? null);
    const popular = popularCode ? await speciesRepository.findByCodigo(db, popularCode) : null;
    const candidates = page.items.filter((item) => item.codigo !== page.items[0]?.codigo && item.codigo !== popular?.codigo);
    const spotlight = [popular, ...candidates].filter((item): item is Species => Boolean(item)).slice(0, 3);
    if (spotlight.length < 3) {
      for (const item of page.items) {
        if (spotlight.some((current) => current.codigo === item.codigo)) continue;
        spotlight.push(item);
        if (spotlight.length === 3) break;
      }
    }
    setHasPopularSpecies(Boolean(popular));
    setSpotlightSpecies(spotlight);
  }, [db, userDb]);

  useFocusEffect(useCallback(() => {
    void loadHome();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadHome();
    });
    return () => {
      subscription.remove();
    };
  }, [loadHome]));

  useEffect(() => {
    if (revision > 0) void loadHome();
  }, [loadHome, revision]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <CollapsibleGradientHeader
        scrollY={scrollY}
        gradient={['#5E8566', '#477052', '#294A3A']}
        compactTitle="Inicio"
        controls={
          <View style={[styles.topActions, { gap: spacing.sm }]}>
            <Pressable
              onPress={() => { haptics.tap(); setMenuOpen(true); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Abrir menú"
              style={({ pressed }) => [styles.heroAction, { borderRadius: radius.pill, backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)' }]}
            >
              <MenuIcon color={colors.canvasText} />
            </Pressable>
            <View style={styles.searchWrap}>
              <SearchBar value={query} onChange={setQuery} onSubmit={submitSearch} placeholder="Buscar una especie" />
            </View>
            <AccountButton onPress={() => { haptics.tap(); router.push('/login'); }} color={colors.canvasText} backgroundColor="rgba(255,255,255,0.10)" />
          </View>
        }
        expandedContent={
          <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 380 }}>
            <Text style={[typography.title, { color: colors.canvasText, maxWidth: 320 }]}>La naturaleza de Uruguay, especie por especie</Text>
            <View style={[styles.chipRow, { marginTop: spacing.xl }]}>
              {total === null ? <Skeleton width="58%" height={36} radius={radius.sm} /> : <View style={[styles.statChip, { borderRadius: radius.sm, backgroundColor: colors.accent }]}><Text style={[typography.label, { color: colors.onAccent }]}>{total}</Text><Text style={[typography.caption, { color: colors.onAccent }]}>especies registradas</Text></View>}
            </View>
          </MotiView>
        }
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: COLLAPSIBLE_HEADER_EXPANDED, paddingBottom: NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom + spacing.xl }}
      >
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 380, delay: 90 }}
          style={[styles.quickWrap, { marginHorizontal: spacing.lg, marginTop: spacing.md }]}
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
              <View style={[styles.quickIcon, { backgroundColor: '#EEE4F6', borderRadius: radius.md }]}>
                <GameIcon color={colors.play} size={21} />
              </View>
              <View style={styles.flex}>
                <Text style={[typography.label, { color: colors.play }]}>Jugar</Text>
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

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={[typography.eyebrow, { color: colors.textMuted }]}>DESTACADAS</Text>
          <View>
            {spotlightSpecies.length > 0 ? (
              <SpeciesCarousel species={spotlightSpecies} width={cardWidth} onPress={openSpecies} labels={hasPopularSpecies ? ['MÁS GUSTADA', undefined, undefined] : undefined} />
            ) : (
              <Skeleton width="100%" height={CARD_HEIGHT} radius={radius.xl} />
            )}
          </View>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 380, delay: 140 }}
          style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}
        >
          <Text style={[typography.eyebrow, { color: colors.textMuted }]}>ESPECIE DEL DÍA</Text>
          <View style={{ marginTop: spacing.md }}>
            {dailySpecies ? (
              <LargeSpeciesCard species={dailySpecies} width={cardWidth} onPress={openSpecies} />
            ) : <Skeleton width="100%" height={CARD_HEIGHT} radius={radius.xl} />}
          </View>
        </MotiView>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={[typography.title, { color: colors.text }]}>Noticias</Text>
          <View
            style={[
              styles.newsCard,
              elevation.low,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginTop: spacing.md,
              },
            ]}
          >
            <View style={[styles.newsIcon, { backgroundColor: colors.primaryContainer, borderRadius: radius.md }]}>
              <NewsIcon color={colors.onPrimaryContainer} size={24} />
            </View>
            <View style={styles.flex}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>PRÓXIMAMENTE</Text>
              <Text style={[typography.cardTitle, { color: colors.text, marginTop: 5 }]}>Noticias de la naturaleza uruguaya</Text>
              <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>Este espacio reunirá novedades, hallazgos y proyectos de conservación.</Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      <AppDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  hero: { overflow: 'hidden' },
  topActions: { flexDirection: 'row', alignItems: 'center' },
  searchWrap: { flex: 1 },
  heroAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  statChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  quickWrap: {},
  quickCard: { flexDirection: 'row', alignItems: 'center' },
  quick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  quickIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  quickDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 12 },
  speciesCard: { overflow: 'hidden', justifyContent: 'flex-end' },
  speciesPanel: { backgroundColor: PHOTO_PANEL },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  newsCard: { flexDirection: 'row', gap: 14, borderWidth: StyleSheet.hairlineWidth },
  newsIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
