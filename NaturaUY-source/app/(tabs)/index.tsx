import { Alert, AppState, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import { Carousel } from 'react-native-reanimated-carousel';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { cancelAnimation, runOnJS, useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated';

import type { Species } from '../../src/domain/entities/species';
import { rankNameMatches } from '../../src/domain/services/naming';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { CollapsibleGradientHeader } from '../../src/presentation/components/CollapsibleGradientHeader';
import { AccountButton } from '../../src/presentation/components/AccountButton';
import { SearchBar } from '../../src/presentation/components/SearchBar';
import { Skeleton } from '../../src/presentation/components/Skeleton';
import { useStartup } from '../../src/presentation/components/StartupExperience';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import {
  GameIcon,
  ExternalLinkIcon,
  HeartIcon,
  MenuIcon,
  NewsIcon,
} from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useMobileSync } from '../../src/sync/MobileSyncProvider';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';
import { settingsRepository } from '../../src/data/repositories/settingsRepository';
import { getHomeNews, getMostFavoritedSpecies, type MobileHomeNews } from '../../src/lib/mobileApi';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { COLLAPSIBLE_HEADER_EXPANDED } from '../../src/presentation/theme/tokens';
import { navigationBottomInset } from '../../src/presentation/navigationPolicy';

const ON_PHOTO = '#FFFFFF';
const ON_PHOTO_MUTED = 'rgba(255,255,255,0.78)';
const CARD_HEIGHT = 230;
const POPULAR_CODE_CACHE_KEY = 'home.most_favorited_code';
const CAROUSEL_AUTOPLAY_INTERVAL = 7200;
const CAROUSEL_AUTOPLAY_DURATION = 1440;
let hasPlayedHomeIntro = false;

const NEWS_LINKS: MobileHomeNews[] = [
  { id: 'fallback-ministerio', source: 'Ministerio de Ambiente', title: 'Noticias de biodiversidad', articleUrl: 'https://www.gub.uy/ministerio-ambiente/comunicacion/noticias?field_fecha_by_month=All&field_fecha_by_year=All&field_publico_gubuy=All&field_publico_target_id=All&field_tematica_gubuy=All&field_tematica_target_id=1112&month=all&page=1&year=all', imageUrl: null, publishedAt: null },
  { id: 'fallback-ambienta', source: 'Ambienta Uruguay', title: 'Naturaleza y ambiente en Uruguay', articleUrl: 'https://ambienta.uy/category/uruguay/', imageUrl: null, publishedAt: null },
  { id: 'fallback-ciencias', source: 'Ciencias.uy', title: 'Clima, ambiente y ciencia', articleUrl: 'https://ciencias.uy/categorias/tierra-ambiente-y-espacio/clima-y-ambiente/', imageUrl: null, publishedAt: null },
] as const;

function NewsThumbnail({ item, color, backgroundColor }: { item: MobileHomeNews; color: string; backgroundColor: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return item.imageUrl && !failed ? (
    <Image source={{ uri: item.imageUrl }} contentFit="cover" onError={() => setFailed(true)} style={styles.newsThumb} accessibilityLabel={`Imagen de ${item.title}`} />
  ) : <View style={[styles.newsIcon, { backgroundColor, borderRadius: 12 }]}><NewsIcon color={color} size={21} /></View>;
}

type CarouselSlide =
  | { kind: 'metric'; value: number | null }
  | { kind: 'species'; species: Species; kicker: string; variant: 'threatened' | 'favorite' | 'curiosity' | 'native' };

const SLIDE_ACCENTS = {
  threatened: '#E79A57',
  favorite: '#F0A7B9',
  curiosity: '#E7C767',
  native: '#9FD0A8',
  daily: '#B7D7A8',
} as const;

function LargeSpeciesCard({
  species,
  width,
  onPress,
  kicker,
  active,
  rounded = false,
  variant = 'daily',
}: {
  species: Species;
  width: number;
  onPress: (codigo: string) => void;
  kicker?: string;
  active: boolean;
  rounded?: boolean;
  variant?: keyof typeof SLIDE_ACCENTS;
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
          borderRadius: rounded ? radius.xl : 0,
          transform: [{ scale: pressed ? 0.995 : 1 }],
        },
      ]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MotiView
          from={{ scale: 1 }}
          animate={{ scale: active ? 1.055 : 1 }}
          transition={{ type: 'timing', duration: active ? 3600 : 280 }}
          style={StyleSheet.absoluteFill}
        >
          <SpeciesImage species={species} height={CARD_HEIGHT} glyphSize={70} bordered={false} style={StyleSheet.absoluteFill} />
        </MotiView>
      </View>
      <LinearGradient pointerEvents="none" colors={['rgba(9,18,12,0)', 'rgba(9,18,12,.32)', 'rgba(9,18,12,.9)']} locations={[0.2, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.speciesCopy, { padding: spacing.lg }]}>
        {kicker && <View style={[styles.kickerPill, { backgroundColor: SLIDE_ACCENTS[variant], borderRadius: radius.pill }]}><Text style={[typography.eyebrow, { color: '#233129' }]}>{kicker}</Text></View>}
        <Text style={[typography.cardTitle, { color: ON_PHOTO, marginTop: 8 }]} numberOfLines={1}>{species.displayName}</Text>
        <Text style={[typography.caption, { color: ON_PHOTO_MUTED, marginTop: 2 }]} numberOfLines={1}>{species.taxonomy.clase} · {species.conservation.label}</Text>
      </View>
    </Pressable>
  );
}

function MetricCard({ value, width, backgroundSpecies }: { value: number | null; width: number; backgroundSpecies?: Species | null }): React.JSX.Element {
  const { radius, spacing, typography, elevation } = useTheme();
  return (
    <View style={[styles.metricCard, elevation.low, { width, height: CARD_HEIGHT, borderRadius: radius.xl, backgroundColor: '#53664F', padding: spacing.xl }]} accessibilityLabel={value === null ? 'Especies registradas, cargando' : `${value} especies registradas`}>
      {backgroundSpecies?.photo?.url && <Image source={{ uri: backgroundSpecies.photo.url }} contentFit="cover" blurRadius={5} style={StyleSheet.absoluteFill} />}
      <LinearGradient pointerEvents="none" colors={['rgba(18,31,20,.38)', 'rgba(18,31,20,.84)']} start={{ x: .8, y: 0 }} end={{ x: .15, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={[typography.eyebrow, { color: '#FFF9EA' }]}>EL CATÁLOGO CRECE</Text>
      <Text style={[typography.hero, { color: '#FFF9EA', marginTop: spacing.sm }]}>{value ?? '—'}</Text>
      <Text style={[typography.body, { color: '#FFF9EA', maxWidth: 280 }]}>especies registradas de nuestra naturaleza</Text>
      <View style={[styles.metricRule, { backgroundColor: 'rgba(255,249,234,0.30)', marginTop: spacing.md }]} />
      <Text style={[typography.caption, { color: '#FFF9EA', marginTop: spacing.sm }]}>Accedé al catálogo incluso si no tenés conexión</Text>
    </View>
  );
}

function SpeciesCarousel({
  slides,
  width,
  onPress,
  backgroundSpecies,
}: {
  slides: CarouselSlide[];
  width: number;
  onPress: (codigo: string) => void;
  backgroundSpecies?: Species | null;
}): React.JSX.Element {
  const { colors, radius, spacing } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollOffset = useSharedValue(0);
  const autoplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAutoplay = useCallback(() => {
    if (autoplayTimer.current) {
      clearTimeout(autoplayTimer.current);
      autoplayTimer.current = null;
    }
  }, []);

  const scheduleAutoplay = useCallback(() => {
    stopAutoplay();
    if (slides.length < 2) return;
    autoplayTimer.current = setTimeout(() => {
      const currentPage = Math.round(-scrollOffset.value / Math.max(width, 1));
      const nextPage = currentPage + 1;
      const nextIndex = ((nextPage % slides.length) + slides.length) % slides.length;
      scrollOffset.value = withTiming(-nextPage * width, { duration: CAROUSEL_AUTOPLAY_DURATION }, (finished) => {
        if (finished) runOnJS(setActiveIndex)(nextIndex);
      });
    }, CAROUSEL_AUTOPLAY_INTERVAL);
  }, [slides.length, stopAutoplay, width, scrollOffset]);

  useEffect(() => {
    scheduleAutoplay();
    return stopAutoplay;
  }, [scheduleAutoplay, stopAutoplay]);

  return (
    <View>
      <Carousel
        itemSize={width}
        style={{ width, height: CARD_HEIGHT }}
        data={slides}
        loop
        autoplay={false}
        scrollOffsetValue={scrollOffset}
        // The library uses this config for the gesture snap. Autoplay is
        // driven separately above so a quick finger never inherits 1440ms.
        animation={{ type: 'spring', damping: 18, stiffness: 220, mass: 0.72 }}
        snapMode="page"
        layout={{ type: 'parallax', offset: 24, scale: 0.94, adjacentScale: 0.86 }}
        onScrollStart={() => {
          stopAutoplay();
          cancelAnimation(scrollOffset);
        }}
        onSnapToItem={(index) => {
          setActiveIndex(index);
          scheduleAutoplay();
        }}
        renderItem={({ item, index }) => item.kind === 'metric' ? <MetricCard value={item.value} width={width} backgroundSpecies={backgroundSpecies} /> : <LargeSpeciesCard species={item.species} width={width} onPress={onPress} kicker={item.kicker} variant={item.variant} active={index === activeIndex} rounded />}
      />
      {slides.length > 1 && (
        <View style={[styles.dots, { marginTop: spacing.md, paddingHorizontal: spacing.lg }]} accessibilityLabel={`Diapositiva ${activeIndex + 1} de ${slides.length}`}>
          {slides.map((item, index) => (
            <View
              key={item.kind === 'metric' ? 'metric' : `${item.variant}-${item.species.codigo}`}
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
  const { ready: startupReady, visible: startupVisible } = useStartup();
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
  const [playHomeIntro, setPlayHomeIntro] = useState(false);
  useEffect(() => {
    if (!startupVisible && !hasPlayedHomeIntro) {
      hasPlayedHomeIntro = true;
      setPlayHomeIntro(true);
    }
  }, [startupVisible]);
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [dailySpecies, setDailySpecies] = useState<Species | null>(null);
  const [threatenedSpecies, setThreatenedSpecies] = useState<Species | null>(null);
  const [favoriteSpecies, setFavoriteSpecies] = useState<Species | null>(null);
  const [curiositySpecies, setCuriositySpecies] = useState<Species | null>(null);
  const [nativeSpecies, setNativeSpecies] = useState<Species | null>(null);
  const [metricBackgroundSpecies, setMetricBackgroundSpecies] = useState<Species | null>(null);
  const [newsItems, setNewsItems] = useState<MobileHomeNews[]>(NEWS_LINKS);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchMatches, setSearchMatches] = useState<Species[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchWidth, setSearchWidth] = useState<number | null>(null);
  const searchBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const NEWS_CACHE_KEY = 'home.news.v1';
  const carouselPadding = 12;
  const cardWidth = Math.max(280, windowWidth - carouselPadding * 2);

  const carouselSlides = useMemo<CarouselSlide[]>(() => [
    { kind: 'metric', value: total },
    ...(threatenedSpecies ? [{ kind: 'species' as const, species: threatenedSpecies, kicker: 'NUESTRAS ESPECIES AMENAZADAS', variant: 'threatened' as const }] : []),
    ...(favoriteSpecies ? [{ kind: 'species' as const, species: favoriteSpecies, kicker: 'MÁS GUSTADA', variant: 'favorite' as const }] : []),
    ...(curiositySpecies ? [{ kind: 'species' as const, species: curiositySpecies, kicker: 'UN DATO PARA DESCUBRIR', variant: 'curiosity' as const }] : []),
    ...(nativeSpecies ? [{ kind: 'species' as const, species: nativeSpecies, kicker: 'NATIVA DE URUGUAY', variant: 'native' as const }] : []),
  ], [curiositySpecies, favoriteSpecies, nativeSpecies, threatenedSpecies, total]);

  const openSpecies = useCallback((codigo: string) => router.push(`/species/${codigo}`), [router]);
  const openExternal = useCallback(async (url: string) => {
    try {
      if (!await Linking.canOpenURL(url)) throw new Error('unsupported_url');
      await Linking.openURL(url);
    } catch {
      Alert.alert('No pudimos abrir el enlace', 'Revisá tu conexión e intentá nuevamente.');
    }
  }, []);
  const submitSearch = useCallback(() => {
    const search = query.trim();
    setSearchFocused(false);
    if (search) router.push({ pathname: '/species', params: { q: search } });
    else router.push('/species');
  }, [query, router]);

  const handleSearchFocusChange = useCallback((focused: boolean) => {
    if (searchBlurTimer.current) clearTimeout(searchBlurTimer.current);
    if (focused) {
      setSearchFocused(true);
      return;
    }
    // Give a row Pressable time to receive its tap after TextInput blur.
    searchBlurTimer.current = setTimeout(() => setSearchFocused(false), 180);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (!searchFocused || term.length < 2) {
      setSearchMatches([]);
      setSearchLoading(false);
      return;
    }
    let active = true;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      void speciesRepository.findPaged(db, { search: term }, 24, 0).then((page) => {
        if (!active) return;
        setSearchMatches(rankNameMatches(page.items, term, 5));
        setSearchLoading(false);
      }).catch(() => {
        if (!active) return;
        setSearchMatches([]);
        setSearchLoading(false);
      });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [db, query, searchFocused]);

  useEffect(() => {
    let active = true;
    void settingsRepository.get(userDb, NEWS_CACHE_KEY).then((cached) => {
      if (!active || !cached) return;
      try {
        const parsed = JSON.parse(cached) as MobileHomeNews[];
        if (Array.isArray(parsed) && parsed.length > 0) setNewsItems(parsed.slice(0, 3));
      } catch { /* A stale cache should never hide the static fallback. */ }
    });
    void getHomeNews(3).then(async (remote) => {
      if (!active || remote.length === 0) return;
      setNewsItems(remote);
      await settingsRepository.set(userDb, NEWS_CACHE_KEY, JSON.stringify(remote));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [userDb]);

  const loadHome = useCallback(async () => {
    const [stats, withPhoto, popularCode, threatenedCount, curiosityCount, nativeCount] = await Promise.all([
      speciesRepository.stats(db),
      speciesRepository.count(db, { onlyWithPhoto: true }),
      settingsRepository.get(userDb, POPULAR_CODE_CACHE_KEY),
      speciesRepository.count(db, { onlyWithPhoto: true, conservationRank: 3 }),
      speciesRepository.count(db, { onlyWithPhoto: true, onlyWithRelevantNote: true }),
      speciesRepository.count(db, { onlyWithPhoto: true, onlyNative: true }),
    ]);
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
    const day = Number(dateKey);
    const pick = async (filters: Parameters<typeof speciesRepository.findPaged>[1], count: number, salt: number): Promise<Species | null> => {
      if (!count) return null;
      const page = await speciesRepository.findPaged(db, filters, 1, (day + salt) % count);
      return page.items[0] ?? null;
    };
    const [daily, threatened, curiosity, native] = await Promise.all([
      pick({ onlyWithPhoto: true }, withPhoto, 0),
      pick({ onlyWithPhoto: true, conservationRank: 3 }, threatenedCount, 17),
      pick({ onlyWithPhoto: true, onlyWithRelevantNote: true }, curiosityCount, 31),
      pick({ onlyWithPhoto: true, onlyNative: true }, nativeCount, 47),
    ]);
    setTotal(stats.total);
    setDailySpecies(daily);
    const popular = popularCode ? await speciesRepository.findByCodigo(db, popularCode) : null;
    const fallbackFavorite = await pick({ onlyWithPhoto: true }, withPhoto, 73);
    setFavoriteSpecies(popular?.photo ? popular : fallbackFavorite);
    setThreatenedSpecies(threatened);
    setCuriositySpecies(curiosity);
    setNativeSpecies(native);
    setMetricBackgroundSpecies(await pick({ onlyWithPhoto: true }, withPhoto, 91));
  }, [db, userDb]);

  useEffect(() => {
    // Refresh the ranking independently; local content never waits on the network.
    let active = true;
    void getMostFavoritedSpecies(1).then(async (remote) => {
      if (!active || !remote[0]) return;
      const cached = await settingsRepository.get(userDb, POPULAR_CODE_CACHE_KEY);
      if (!active || cached === remote[0]) return;
      await settingsRepository.set(userDb, POPULAR_CODE_CACHE_KEY, remote[0]);
      // The updated ranking is used on the next refresh, avoiding a carousel jump.
    }).catch(() => {});
    return () => { active = false; };
  }, [userDb]);

  useEffect(() => {
    if (total === null) return;
    let active = true;
    const urls = [...new Set([dailySpecies, threatenedSpecies, favoriteSpecies, curiositySpecies, nativeSpecies].flatMap((species) => species?.photo?.url ? [species.photo.url] : []))];
    let frame: number | undefined;
    const finish = () => {
      if (active) frame = requestAnimationFrame(startupReady);
    };
    const timer = setTimeout(finish, 1800);
    void (urls.length ? Image.prefetch(urls, 'memory-disk') : Promise.resolve(true))
      .catch(() => false).finally(finish);
    return () => {
      active = false;
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [curiositySpecies, dailySpecies, favoriteSpecies, nativeSpecies, startupReady, threatenedSpecies, total]);

  const loadedHome = useRef(false);
  useEffect(() => {
    if (!loadedHome.current) {
      loadedHome.current = true;
      void loadHome().catch((error: unknown) => { console.warn('Home loading failed.', error); startupReady(); });
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadHome().catch((error: unknown) => console.warn('Home refresh failed.', error));
    });
    return () => {
      subscription.remove();
    };
  }, [loadHome, startupReady]);

  useEffect(() => {
    if (revision > 0) void loadHome().catch((error: unknown) => console.warn('Home refresh failed.', error));
  }, [loadHome, revision]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <CollapsibleGradientHeader
        scrollY={scrollY}
        gradient={['#7C9277', '#677E61', '#465B47']}
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
              <SearchBar
                value={query}
                onChange={setQuery}
                onSubmit={submitSearch}
                placeholder="Buscar una especie"
                collapseOffset={scrollY}
                onFocusChange={handleSearchFocusChange}
                onLayout={(event) => setSearchWidth(event.nativeEvent.layout.width)}
              />
            </View>
            <AccountButton onPress={() => { haptics.tap(); router.push('/login'); }} color={colors.canvasText} backgroundColor="rgba(255,255,255,0.10)" />
          </View>
        }
        expandedContent={
          <MotiView from={playHomeIntro ? { opacity: 0, translateY: 12 } : { opacity: 1, translateY: 0 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: playHomeIntro ? 480 : 0, delay: playHomeIntro ? 210 : 0 }}>
            <Text style={[typography.headerTitle, { color: colors.canvasText, maxWidth: 320 }]}>Nuestra naturaleza en un solo lugar</Text>
          </MotiView>
        }
      />
      {searchFocused && query.trim().length >= 2 && (
        <View
          style={[styles.searchResults, elevation.high, { top: insets.top + spacing.sm + 48 + spacing.sm, left: spacing.lg + 48 + spacing.sm, width: searchWidth ?? Math.max(160, windowWidth - spacing.lg * 2 - 48 * 2 - spacing.sm * 2), backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}
          accessibilityLabel="Resultados de búsqueda"
        >
          {searchLoading ? <Text style={[typography.caption, styles.searchEmpty, { color: colors.textMuted }]}>Buscando especies…</Text> : searchMatches.length > 0 ? <>
            {searchMatches.map((item) => (
              <Pressable
                key={item.codigo}
                onPress={() => { haptics.tap(); setSearchFocused(false); router.push(`/species/${item.codigo}`); }}
                style={({ pressed }) => [styles.searchResult, { borderBottomColor: colors.border, backgroundColor: pressed ? colors.surfaceContainer : colors.surface }]}
              >
                <SpeciesImage species={item} height={42} borderRadius={12} glyphSize={22} style={styles.searchThumb} />
                <View style={styles.flex}>
                  <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>{item.displayName}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{item.scientificName}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable onPress={submitSearch} style={({ pressed }) => [styles.searchAll, { backgroundColor: pressed ? colors.primaryContainer : colors.surface }] }>
              <Text style={[typography.label, { color: colors.primary }]}>Ver todos los resultados</Text>
            </Pressable>
          </> : <Text style={[typography.caption, styles.searchEmpty, { color: colors.textMuted }]}>No encontramos especies con ese nombre.</Text>}
        </View>
      )}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: COLLAPSIBLE_HEADER_EXPANDED + insets.top, paddingBottom: navigationBottomInset(insets.bottom, spacing.xl) }}
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

        <View style={{ marginTop: spacing.xl }}>
          <Text style={[typography.eyebrow, { color: colors.textMuted, paddingHorizontal: spacing.lg }]}>EXPLORÁ NATURA UY</Text>
          <View style={{ paddingHorizontal: carouselPadding, marginTop: spacing.md }}>
            {carouselSlides.length > 1 && total !== null ? (
            <SpeciesCarousel slides={carouselSlides} width={cardWidth} onPress={openSpecies} backgroundSpecies={metricBackgroundSpecies} />
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
              <LargeSpeciesCard species={dailySpecies} width={cardWidth} onPress={openSpecies} active={false} rounded />
            ) : <Skeleton width="100%" height={CARD_HEIGHT} radius={radius.xl} />}
          </View>
        </MotiView>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={[typography.title, { color: colors.text }]}>Noticias</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Selección de fuentes externas sobre naturaleza uruguaya.</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {newsItems.map((item, index) => (
              <Pressable key={item.id} onPress={() => void openExternal(item.articleUrl)} accessibilityRole="link" accessibilityLabel={`${item.title}, contenido externo`} style={({ pressed }) => [styles.newsCard, elevation.low, { backgroundColor: pressed ? colors.surfaceContainer : colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
                <NewsThumbnail item={item} color={index === 0 ? colors.onPrimaryContainer : colors.primary} backgroundColor={index === 0 ? colors.primaryContainer : colors.surfaceVariant} />
                <View style={styles.flex}><Text style={[typography.eyebrow, { color: colors.primary }]}>{item.source.toLocaleUpperCase('es')}</Text><Text style={[typography.label, { color: colors.text, marginTop: 3 }]}>{item.title}</Text>{item.publishedAt && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 3 }]}>{new Date(item.publishedAt).toLocaleDateString('es-UY')}</Text>}</View>
                <ExternalLinkIcon color={colors.textMuted} />
              </Pressable>
            ))}
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
  searchResults: { position: 'absolute', zIndex: 40, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  searchResult: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchThumb: { width: 42, flexShrink: 0 },
  searchAll: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 12 },
  searchEmpty: { paddingHorizontal: 14, paddingVertical: 16 },
  heroAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  metricCard: { justifyContent: 'center', overflow: 'hidden' },
  metricRule: { height: StyleSheet.hairlineWidth, width: '100%' },
  quickWrap: {},
  quickCard: { flexDirection: 'row', alignItems: 'center' },
  quick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  quickIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  quickDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 12 },
  speciesCard: { overflow: 'hidden', justifyContent: 'flex-end' },
  speciesCopy: { justifyContent: 'flex-end' },
  kickerPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  newsCard: { flexDirection: 'row', gap: 14, borderWidth: StyleSheet.hairlineWidth },
  newsThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#E8EEE6' },
  newsIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
