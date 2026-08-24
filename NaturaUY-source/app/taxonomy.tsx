import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MotiView } from 'moti';

import type { Species } from '../src/domain/entities/species';
import {
  TAXON_RANKS,
  UNASSIGNED_TAXON,
  type SpeciesFilters,
  type TaxonRank,
  type TaxonomyPath,
} from '../src/data/repositories/speciesRepository';
import { CARD_HEIGHT, SpeciesCard, SpeciesCardSkeleton } from '../src/presentation/components/SpeciesCard';
import { FamilyGlyph } from '../src/presentation/components/FamilyGlyph';
import { NavigationIsland, type MainTab } from '../src/presentation/components/NavigationIsland';
import { BackIcon, ChevronRightIcon, TaxonomyIcon } from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useFavorites } from '../src/presentation/hooks/FavoritesProvider';
import { useScrollDetentHaptics } from '../src/presentation/hooks/useScrollDetentHaptics';
import { useSpeciesList } from '../src/presentation/hooks/useSpeciesList';
import { useTaxonomyChildren } from '../src/presentation/hooks/useTaxonomyChildren';
import { useTheme } from '../src/presentation/theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN, spacing as space } from '../src/presentation/theme/tokens';

const ROW_HEIGHT = CARD_HEIGHT + space.lg;

const RANK_LABELS: Record<TaxonRank, { singular: string; plural: string; prompt: string }> = {
  phylum: { singular: 'Filo', plural: 'filos', prompt: 'Elegí un filo' },
  clase: { singular: 'Clase', plural: 'clases', prompt: 'Elegí una clase' },
  orden: { singular: 'Orden', plural: 'órdenes', prompt: 'Elegí un orden' },
  familia: { singular: 'Familia', plural: 'familias', prompt: 'Elegí una familia' },
  genero: { singular: 'Género', plural: 'géneros', prompt: 'Elegí un género' },
};

const CHORDATA_DESCRIPTION =
  'Animales con notocorda en alguna etapa de su desarrollo. Incluye a todos los vertebrados: peces, anfibios, reptiles, aves y mamíferos.';

const CLASS_DESCRIPTIONS: Record<string, string> = {
  Aves: 'Vertebrados de sangre caliente con plumas, pico y huevos con cáscara.',
  Actinopterygii: 'Peces óseos cuyas aletas están sostenidas por radios finos y flexibles.',
  Chondrichthyes: 'Peces de esqueleto cartilaginoso, como tiburones, rayas y quimeras.',
  Mammalia: 'Vertebrados con pelo; las madres alimentan a sus crías con leche.',
  Reptilia: 'Vertebrados de piel seca y escamosa que regulan su temperatura con el ambiente.',
  Amphibia: 'Vertebrados de piel húmeda ligados al agua y a la tierra durante su ciclo de vida.',
};

const taxonName = (rank: TaxonRank, value: string): string =>
  value === UNASSIGNED_TAXON ? `Sin ${RANK_LABELS[rank].singular.toLocaleLowerCase('es')} asignado` : value;

function pathFromParams(params: Partial<Record<TaxonRank, string | undefined>>): TaxonomyPath {
  const path: TaxonomyPath = {};
  for (const rank of TAXON_RANKS) {
    if (params[rank]) path[rank] = params[rank];
  }
  return path;
}

function SpeciesResults({ path }: { path: TaxonomyPath }): React.JSX.Element {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isFavorite, toggle } = useFavorites();
  const filters = useMemo<SpeciesFilters>(() => ({ taxonomy: path }), [path]);
  const { items, total, loading, loadingMore, hasMore, loadMore } = useSpeciesList(filters);
  const genus = path.genero ?? '';
  const onScroll = useScrollDetentHaptics(ROW_HEIGHT, genus);
  const bottomInset = NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom + spacing.lg;

  const renderItem = useCallback(
    ({ item, index }: { item: Species; index: number }) => (
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        <SpeciesCard
          species={item}
          index={index}
          favorite={isFavorite(item.codigo)}
          onPress={(codigo) => router.push(`/species/${codigo}`)}
          onToggleFavorite={toggle}
        />
      </View>
    ),
    [isFavorite, router, spacing.lg, toggle],
  );

  if (loading) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomInset, gap: spacing.lg }}>
        {Array.from({ length: 3 }, (_, index) => <SpeciesCardSkeleton key={index} />)}
      </ScrollView>
    );
  }

  return (
    <FlashList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.codigo}
      onScroll={onScroll}
      scrollEventThrottle={32}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>GÉNERO {taxonName('genero', genus).toLocaleUpperCase('es')}</Text>
          <Text style={[typography.title, { color: colors.text, marginTop: 5 }]}>
            {total} {total === 1 ? 'especie' : 'especies'}
          </Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator color={colors.primary} style={{ paddingBottom: bottomInset }} />
        ) : hasMore ? (
          <View style={{ height: bottomInset }} />
        ) : (
          <Text style={[typography.caption, styles.end, { color: colors.textMuted, paddingBottom: bottomInset }]}>
            Fin del género · {total} {total === 1 ? 'especie' : 'especies'}
          </Text>
        )
      }
    />
  );
}

export default function TaxonomyScreen(): React.JSX.Element {
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    phylum?: string;
    clase?: string;
    orden?: string;
    familia?: string;
    genero?: string;
    returnToSpecies?: string;
  }>();
  const paramsKey = TAXON_RANKS.map((rank) => params[rank] ?? '').join('|');
  const [path, setPath] = useState<TaxonomyPath>(() => pathFromParams(params));
  const currentRank = TAXON_RANKS.find((rank) => path[rank] === undefined) ?? null;
  const { items, loading } = useTaxonomyChildren(currentRank, path);
  const selectedRanks = TAXON_RANKS.filter((rank) => path[rank] !== undefined);
  const bottomInset = NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom + spacing.lg;

  useEffect(() => {
    setPath(pathFromParams(params));
    // The serialized URL path changes only when another screen deep-links here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const goBack = useCallback(() => {
    if (params.returnToSpecies) {
      router.back();
      return;
    }
    const last = selectedRanks.at(-1);
    if (!last) {
      router.replace('/explore');
      return;
    }
    setPath((current) => {
      const next = { ...current };
      delete next[last];
      return next;
    });
  }, [params.returnToSpecies, router, selectedRanks]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]));

  const select = useCallback((rank: TaxonRank, value: string) => {
    haptics.tick();
    setPath((current) => {
      const next: TaxonomyPath = {};
      for (const candidate of TAXON_RANKS) {
        if (candidate === rank) {
          next[candidate] = value;
          break;
        }
        if (current[candidate] !== undefined) next[candidate] = current[candidate];
      }
      return next;
    });
  }, []);

  const returnTo = useCallback((rank: TaxonRank) => {
    haptics.tick();
    setPath((current) => {
      const next: TaxonomyPath = {};
      for (const candidate of TAXON_RANKS) {
        if (current[candidate] !== undefined) next[candidate] = current[candidate];
        if (candidate === rank) break;
      }
      return next;
    });
  }, []);

  const navigateMain = useCallback((tab: MainTab) => {
    haptics.tick();
    if (tab === 'index') router.replace('/');
    if (tab === 'explore') router.replace('/explore');
    if (tab === 'games') router.replace('/games');
  }, [router]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg }}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={selectedRanks.length > 0 ? 'Volver un nivel' : 'Volver a Descubrir'}
            style={({ pressed }) => [
              styles.backButton,
              elevation.low,
              { backgroundColor: pressed ? colors.surfaceVariant : colors.surface, borderRadius: radius.pill },
            ]}
          >
            <BackIcon color={colors.text} />
          </Pressable>
          <View style={[styles.iconTile, { backgroundColor: colors.primaryContainer, borderRadius: radius.md }]}>
            <TaxonomyIcon color={colors.onPrimaryContainer} size={23} />
          </View>
          <View style={styles.flex}>
            <Text style={[typography.eyebrow, { color: colors.textMuted }]}>BÚSQUEDA TAXONÓMICA</Text>
            <Text style={[typography.title, { color: colors.text, marginTop: 2 }]}>
              {currentRank ? RANK_LABELS[currentRank].prompt : 'Especies del género'}
            </Text>
          </View>
        </View>

        {selectedRanks.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.breadcrumb, { paddingTop: spacing.lg, paddingBottom: spacing.sm }]}
          >
            {selectedRanks.map((rank, index) => (
              <View key={rank} style={styles.crumbGroup}>
                {index > 0 && <ChevronRightIcon color={colors.textMuted} size={15} />}
                <Pressable
                  onPress={() => returnTo(rank)}
                  style={[styles.crumb, { backgroundColor: colors.surfaceVariant, borderRadius: radius.pill }]}
                >
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{RANK_LABELS[rank].singular}</Text>
                  <Text style={[typography.label, { color: colors.text }]}>{taxonName(rank, path[rank]!)}</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border, marginTop: spacing.md }]} />

      <View style={styles.flex}>
        {currentRank === null ? (
          <SpeciesResults path={path} />
        ) : loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.value}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomInset, gap: spacing.sm }}
            ListHeaderComponent={
              <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                {items.length} {items.length === 1 ? RANK_LABELS[currentRank].singular.toLocaleLowerCase('es') : RANK_LABELS[currentRank].plural} en este nivel
              </Text>
            }
            renderItem={({ item, index }) => {
              const isPhylum = currentRank === 'phylum';
              const isClass = currentRank === 'clase';
              const description = isPhylum && item.value === 'Chordata'
                ? CHORDATA_DESCRIPTION
                : isClass
                  ? CLASS_DESCRIPTIONS[item.value]
                  : undefined;

              return (
                <MotiView
                  from={{ opacity: 0, translateY: 8 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 240, delay: Math.min(index, 10) * 28 }}
                >
                  <Pressable
                    onPress={() => select(currentRank, item.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`${taxonName(currentRank, item.value)}, ${item.count} especies`}
                    style={({ pressed }) => [
                      styles.taxonRow,
                      isPhylum && styles.phylumRow,
                      isClass && styles.classRow,
                      elevation.low,
                      {
                        backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
                        borderColor: colors.border,
                        borderRadius: radius.lg,
                      },
                    ]}
                  >
                    {isClass && (
                      <View style={[styles.classIcon, { backgroundColor: colors.primaryContainer, borderRadius: radius.md }]}>
                        <FamilyGlyph clase={item.value} color={colors.onPrimaryContainer} size={48} opacity={0.92} />
                      </View>
                    )}
                    <View style={styles.flex}>
                      <Text style={[typography.eyebrow, { color: colors.textMuted }]}>{RANK_LABELS[currentRank].singular.toLocaleUpperCase('es')}</Text>
                      <Text style={[typography.cardTitle, styles.scientific, { color: colors.text, marginTop: 4 }]}>
                        {taxonName(currentRank, item.value)}
                      </Text>
                      {description && (
                        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]} numberOfLines={isPhylum ? 4 : 3}>
                          {description}
                        </Text>
                      )}
                    </View>
                    {isPhylum && item.value === 'Chordata' ? (
                      <View style={styles.phylumVisual}>
                        <Image
                          source={require('../assets/images/taxonomy/chordata-vertebrates.png')}
                          contentFit="contain"
                          style={styles.phylumImage}
                          accessibilityLabel="Pez, ave, anfibio, reptil y mamífero representando a los vertebrados"
                        />
                        <View style={styles.rowEnd}>
                          <View style={[styles.count, { backgroundColor: colors.primaryContainer, borderRadius: radius.pill }]}>
                            <Text style={[typography.caption, { color: colors.onPrimaryContainer }]}>{item.count}</Text>
                          </View>
                          <ChevronRightIcon color={colors.textMuted} />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.rowEnd}>
                        <View style={[styles.count, { backgroundColor: colors.primaryContainer, borderRadius: radius.pill }]}>
                          <Text style={[typography.caption, { color: colors.onPrimaryContainer }]}>{item.count}</Text>
                        </View>
                        <ChevronRightIcon color={colors.textMuted} />
                      </View>
                    )}
                  </Pressable>
                </MotiView>
              );
            }}
          />
        )}
      </View>

      <NavigationIsland active="explore" onNavigate={navigateMain} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconTile: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  breadcrumb: { alignItems: 'center' },
  crumbGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  crumb: { paddingHorizontal: 11, paddingVertical: 7, marginHorizontal: 3 },
  divider: { height: StyleSheet.hairlineWidth },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  taxonRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  phylumRow: { minHeight: 154, paddingVertical: 18 },
  classRow: { minHeight: 116 },
  phylumVisual: { width: 108, alignItems: 'center', gap: 2 },
  phylumImage: { width: 96, height: 88 },
  classIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { minWidth: 36, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6 },
  scientific: { fontStyle: 'italic' },
  end: { textAlign: 'center', paddingTop: 24 },
});
