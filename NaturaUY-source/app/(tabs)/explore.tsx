import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { MotiView } from 'moti';

import type { Species } from '../../src/domain/entities/species';
import type { SpeciesFilters } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { AppHeader } from '../../src/presentation/components/AppHeader';
import { Chip } from '../../src/presentation/components/Chip';
import { EmptyState } from '../../src/presentation/components/EmptyState';
import { SearchBar } from '../../src/presentation/components/SearchBar';
import { CARD_HEIGHT, SpeciesCard, SpeciesCardSkeleton } from '../../src/presentation/components/SpeciesCard';
import { ChevronRightIcon, SlidersIcon, TaxonomyIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useSpeciesList } from '../../src/presentation/hooks/useSpeciesList';
import { useScrollDetentHaptics } from '../../src/presentation/hooks/useScrollDetentHaptics';
import { useTaxonomyChildren } from '../../src/presentation/hooks/useTaxonomyChildren';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN, spacing as space } from '../../src/presentation/theme/tokens';
import { useDebouncedValue } from '../../src/shared/hooks/useDebouncedValue';

/** Card plus the gap under it — the distance between one row and the next. */
const ROW_HEIGHT = CARD_HEIGHT + space.lg;

export default function ExploreScreen(): React.JSX.Element {
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ native?: string; priority?: string; clase?: string; q?: string }>();
  const { isFavorite, toggle } = useFavorites();

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState(params.q ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const [onlyNative, setOnlyNative] = useState(params.native === '1');
  const [onlyPriority, setOnlyPriority] = useState(params.priority === '1');
  const [selectedClass, setSelectedClass] = useState(params.clase ?? '');
  const { items: taxonomicClasses, loading: classesLoading } = useTaxonomyChildren('clase', {});

  const debouncedQuery = useDebouncedValue(query, 220);

  const filters = useMemo<SpeciesFilters>(
    () => ({
      search: debouncedQuery.trim() || undefined,
      onlyNative: onlyNative || undefined,
      onlyPriority: onlyPriority || undefined,
      taxonomy: selectedClass ? { clase: selectedClass } : undefined,
    }),
    [debouncedQuery, onlyNative, onlyPriority, selectedClass],
  );

  const { items, total, loading, loadingMore, hasMore, loadMore } = useSpeciesList(filters);

  const openSpecies = useCallback(
    (codigo: string) => router.push(`/species/${codigo}`),
    [router],
  );

  // Both handlers are stable, so `SpeciesCard`'s memo actually holds and a
  // scroll doesn't re-render every visible row.
  const renderItem = useCallback(
    ({ item, index }: { item: Species; index: number }) => (
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        <SpeciesCard
          species={item}
          index={index}
          favorite={isFavorite(item.codigo)}
          onPress={openSpecies}
          onToggleFavorite={toggle}
        />
      </View>
    ),
    [isFavorite, openSpecies, toggle, spacing.lg],
  );

  /*
   * A detent per row as the list travels under the thumb — the knock an alarm
   * picker makes on each digit.
   *
   * Rows are a fixed height, so the row under the top edge is just a division;
   * the handler fires a tick only when that number actually changes. Scroll
   * events are throttled to ~30/s, which is far more than detents need and
   * keeps this off the frame budget — the scroll itself stays native either way.
   */
  const onScroll = useScrollDetentHaptics(ROW_HEIGHT);

  const activeFilterCount = (onlyNative ? 1 : 0) + (onlyPriority ? 1 : 0) + (selectedClass ? 1 : 0);
  // The navigation island floats over the list, so the last card needs to clear it.
  const bottomInset = NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        onOpenMenu={() => setMenuOpen(true)}
      >
        <SearchBar value={query} onChange={setQuery} />
      </AppHeader>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push('/taxonomy' as Href);
          }}
          accessibilityRole="button"
          accessibilityLabel="Abrir búsqueda taxonómica"
          style={({ pressed }) => [
            styles.taxonomyButton,
            elevation.low,
            {
              backgroundColor: pressed ? colors.surfaceContainer : colors.primaryContainer,
              borderColor: colors.border,
              borderRadius: radius.lg,
            },
          ]}
        >
          <View style={[styles.taxonomyIcon, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
            <TaxonomyIcon color={colors.primary} size={23} />
          </View>
          <View style={styles.flex}>
            <Text style={[typography.eyebrow, { color: colors.primary }]}>EXPLORAR EL ÁRBOL DE LA VIDA</Text>
            <Text style={[typography.label, { color: colors.onPrimaryContainer }]}>Búsqueda taxonómica</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Navegá de filo a género</Text>
          </View>
          <ChevronRightIcon color={colors.onPrimaryContainer} />
        </Pressable>
      </View>

      <View style={[styles.filterRow, { paddingHorizontal: spacing.lg, marginTop: spacing.xl }]}>
        <View>
          <Text style={[typography.label, { color: colors.text }]}>Catálogo completo</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{total} {total === 1 ? 'especie' : 'especies'}</Text>
        </View>
        <Pressable
          onPress={() => {
            haptics.tap();
            setShowFilters((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel="Filtros"
          style={[styles.filterButton, { backgroundColor: colors.surfaceVariant }]}
        >
          <SlidersIcon color={colors.textSecondary} />
          <Text style={[typography.label, { color: colors.textSecondary }]}>
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {showFilters && (
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={[styles.filterPanel, elevation.low, { backgroundColor: colors.surface, marginHorizontal: spacing.lg }]}
        >
          <Text style={[typography.eyebrow, { color: colors.textMuted }]}>CLASE TAXONÓMICA</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChips}>
            <Chip label="Todas" selected={!selectedClass} onPress={() => setSelectedClass('')} />
            {taxonomicClasses.map(({ value }) => (
              <Chip key={value} label={value} selected={selectedClass === value} onPress={() => setSelectedClass(value)} />
            ))}
          </ScrollView>
          {classesLoading && <ActivityIndicator size="small" color={colors.primary} />}
          <View style={styles.booleanFilters}>
            <Chip label="Solo nativas" selected={onlyNative} onPress={() => setOnlyNative((v) => !v)} />
            <Chip label="Prioridad de conservación" selected={onlyPriority} onPress={() => setOnlyPriority((v) => !v)} />
          </View>
        </MotiView>
      )}

      <View style={styles.flex}>
        {loading ? (
          <ScrollView
            contentContainerStyle={{
              padding: spacing.lg,
              paddingTop: spacing.xl,
              paddingBottom: bottomInset,
              gap: spacing.lg,
            }}
          >
            {Array.from({ length: 4 }, (_, i) => (
              <SpeciesCardSkeleton key={i} />
            ))}
          </ScrollView>
        ) : items.length === 0 ? (
          <View style={{ padding: spacing.lg, paddingTop: spacing.xl }}>
            <EmptyState
              title="Sin resultados"
              message="Probá con otro nombre, o quitá algún filtro para ampliar la búsqueda."
            />
          </View>
        ) : (
          <FlashList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.codigo}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            // FlashList doesn't reliably honour contentContainerStyle's
            // paddingTop, so the gap before the first card is a header instead.
            // It has to clear the filter row above with room to spare, or the
            // first card reads as colliding with the controls.
            ListHeaderComponent={<View style={{ height: spacing.xxl }} />}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingBottom: bottomInset }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : hasMore ? (
                <View style={{ height: bottomInset }} />
              ) : (
                <Text
                  style={[typography.caption, styles.end, { color: colors.textMuted, paddingBottom: bottomInset }]}
                >
                  Llegaste al final · {total} especies
                </Text>
              )
            }
          />
        )}
      </View>

      <AppDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  taxonomyButton: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth },
  taxonomyIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  filterPanel: { gap: 10, padding: 12, borderRadius: 16, marginTop: 12 },
  classChips: { gap: 8, paddingRight: 12 },
  booleanFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  end: { textAlign: 'center', paddingVertical: 28 },
});
