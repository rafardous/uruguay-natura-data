import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';

import type { Species } from '../../src/domain/entities/species';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { SearchBar } from '../../src/presentation/components/SearchBar';
import { Skeleton } from '../../src/presentation/components/Skeleton';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import {
  GameIcon,
  HeartIcon,
  LoginIcon,
  MenuIcon,
  NewsIcon,
} from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN } from '../../src/presentation/theme/tokens';

const ON_PHOTO = '#FFFFFF';
const ON_PHOTO_MUTED = 'rgba(255,255,255,0.78)';
const PHOTO_PANEL = 'rgba(14,24,17,0.82)';
const CARD_HEIGHT = 230;
const CAROUSEL_INTERVAL_MS = 5_000;

function LargeSpeciesCard({
  species,
  width,
  onPress,
}: {
  species: Species;
  width: number;
  onPress: (codigo: string) => void;
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
}: {
  species: Species[];
  width: number;
  onPress: (codigo: string) => void;
}): React.JSX.Element {
  const { colors, radius, spacing } = useTheme();
  const listRef = useRef<FlatList<Species>>(null);
  const indexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (species.length < 2) return undefined;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % species.length;
      indexRef.current = next;
      setActiveIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [species.length]);

  const syncIndex = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const next = Math.max(0, Math.min(species.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
    indexRef.current = next;
    setActiveIndex(next);
  };

  return (
    <View>
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        data={species}
        keyExtractor={(item) => item.codigo}
        renderItem={({ item }) => <LargeSpeciesCard species={item} width={width} onPress={onPress} />}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={syncIndex}
        showsHorizontalScrollIndicator={false}
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const { count } = useFavorites();

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [carouselSpecies, setCarouselSpecies] = useState<Species[]>([]);
  const [mostSearched, setMostSearched] = useState<Species | null>(null);
  const cardWidth = Math.max(280, windowWidth - spacing.lg * 2);

  const openSpecies = useCallback((codigo: string) => router.push(`/species/${codigo}`), [router]);
  const submitSearch = useCallback(() => {
    const search = query.trim();
    if (search) router.push({ pathname: '/explore', params: { q: search } });
    else router.push('/explore');
  }, [query, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stats = await speciesRepository.stats(db);
      const withPhoto = await speciesRepository.count(db, { onlyWithPhoto: true });
      const poolSize = Math.min(6, withPhoto);
      const maxOffset = Math.max(0, withPhoto - poolSize);
      const offset = maxOffset === 0 ? 0 : Math.floor(Math.random() * (maxOffset + 1));
      const page = await speciesRepository.findPaged(db, { onlyWithPhoto: true }, poolSize, offset);
      if (cancelled) return;
      setTotal(stats.total);
      setCarouselSpecies(page.items.slice(0, Math.min(5, page.items.length)));
      setMostSearched(page.items[5] ?? page.items[0] ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom + spacing.xl }}
      >
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
          <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 56 }}>
            <View style={[styles.topActions, { gap: spacing.sm }]}>
              <Pressable
                onPress={() => {
                  haptics.tap();
                  setMenuOpen(true);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Abrir menú"
                style={({ pressed }) => [
                  styles.heroAction,
                  {
                    borderRadius: radius.pill,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
                  },
                ]}
              >
                <MenuIcon color={colors.canvasText} />
              </Pressable>

              <View style={styles.searchWrap}>
                <SearchBar value={query} onChange={setQuery} onSubmit={submitSearch} placeholder="Buscar una especie" />
              </View>

              <Pressable
                onPress={() => {
                  haptics.tap();
                  router.push('/login');
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Iniciar sesión"
                style={({ pressed }) => [
                  styles.heroAction,
                  {
                    borderRadius: radius.pill,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
                  },
                ]}
              >
                <LoginIcon color={colors.canvasText} />
              </Pressable>
            </View>

            <MotiView
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 380 }}
              style={{ marginTop: spacing.xl }}
            >
              <Text style={[typography.hero, { color: colors.canvasText }]}>
                Conocé la vida{'\n'}de nuestro suelo
              </Text>

              <View style={[styles.chipRow, { marginTop: spacing.xl }]}>
                {total === null ? (
                  <Skeleton width="58%" height={36} radius={radius.sm} />
                ) : (
                  <View style={[styles.statChip, { borderRadius: radius.sm, backgroundColor: colors.accent }]}>
                    <Text style={[typography.label, { color: colors.onAccent }]}>{total}</Text>
                    <Text style={[typography.caption, { color: colors.onAccent }]}>especies registradas</Text>
                  </View>
                )}
              </View>
            </MotiView>
          </View>
        </View>

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

        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 380, delay: 140 }}
          style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}
        >
          <Text style={[typography.eyebrow, { color: colors.textMuted }]}>ESPECIES PARA DESCUBRIR</Text>
          <View style={{ marginTop: spacing.md }}>
            {carouselSpecies.length === 0 ? (
              <Skeleton width="100%" height={CARD_HEIGHT} radius={radius.xl} />
            ) : (
              <SpeciesCarousel species={carouselSpecies} width={cardWidth} onPress={openSpecies} />
            )}
          </View>
        </MotiView>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={[typography.title, { color: colors.text }]}>Especies más buscadas</Text>
          <View style={{ marginTop: spacing.md }}>
            {mostSearched ? (
              <LargeSpeciesCard species={mostSearched} width={cardWidth} onPress={openSpecies} />
            ) : (
              <Skeleton width="100%" height={CARD_HEIGHT} radius={radius.xl} />
            )}
          </View>
        </View>

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
      </ScrollView>

      <AppDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  hero: { overflow: 'hidden' },
  topActions: { flexDirection: 'row', alignItems: 'flex-start' },
  searchWrap: { flex: 1 },
  heroAction: {
    width: 42,
    height: 42,
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
  quickWrap: { marginTop: -34 },
  quickCard: { flexDirection: 'row', alignItems: 'center' },
  quick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  quickDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 12 },
  speciesCard: { overflow: 'hidden', justifyContent: 'flex-end' },
  speciesPanel: { backgroundColor: PHOTO_PANEL },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  newsCard: { flexDirection: 'row', gap: 14, borderWidth: StyleSheet.hairlineWidth },
  newsIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
