import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Species } from '../../src/domain/entities/species';
import { CompactSpeciesRow, CompactSpeciesRowSkeleton, COMPACT_ROW_HEIGHT } from '../../src/presentation/components/CompactSpeciesRow';
import { SpeciesFilterSheet, blankSpeciesSelection, friendlyFilterValue, speciesSelectionCount, type SpeciesSelection } from '../../src/presentation/components/SpeciesFilterSheet';
import { BackIcon, SlidersIcon } from '../../src/presentation/components/TabIcons';
import { SearchBar } from '../../src/presentation/components/SearchBar';
import { EmptyState } from '../../src/presentation/components/EmptyState';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useSpeciesList } from '../../src/presentation/hooks/useSpeciesList';
import { useScrollDetentHaptics } from '../../src/presentation/hooks/useScrollDetentHaptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { navigationBottomInset } from '../../src/presentation/navigationPolicy';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { useDebouncedValue } from '../../src/shared/hooks/useDebouncedValue';
import { useTaxonomyChildren } from '../../src/presentation/hooks/useTaxonomyChildren';
import { Chip } from '../../src/presentation/components/Chip';

export default function SpeciesIndexScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const params = useLocalSearchParams<{ native?: string; priority?: string; q?: string }>();
  const { isFavorite, toggle } = useFavorites();
  const seeded = useMemo<SpeciesSelection>(() => ({ ...blankSpeciesSelection(), onlyNative: params.native === '1', onlyPriority: params.priority === '1' }), [params.native, params.priority]);
  const [query, setQuery] = useState(params.q ?? '');
  useEffect(() => setQuery(params.q ?? ''), [params.q]);
  const search = useDebouncedValue(query, 220);
  const [applied, setApplied] = useState<SpeciesSelection>(seeded);
  const [draft, setDraft] = useState<SpeciesSelection>(seeded);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [options, setOptions] = useState({ habitats: [] as string[], diets: [] as string[], seasonalities: [] as string[] });
  const { items: classes } = useTaxonomyChildren('clase', {});

  useEffect(() => {
    void Promise.all([
      speciesRepository.listFilterValues(db, 'habitat'),
      speciesRepository.listFilterValues(db, 'diet'),
      speciesRepository.listFilterValues(db, 'seasonality'),
    ]).then(([habitats, diets, seasonalities]) => setOptions({ habitats, diets, seasonalities }));
  }, [db]);

  const filters = useMemo(() => ({
    search: search.trim() || undefined,
    onlyNative: applied.onlyNative || undefined,
    onlyPriority: applied.onlyPriority || undefined,
    classes: applied.classes.length ? applied.classes : undefined,
    habitats: applied.habitats.length ? applied.habitats : undefined,
    diets: applied.diets.length ? applied.diets : undefined,
    seasonalities: applied.seasonalities.length ? applied.seasonalities : undefined,
  }), [applied, search]);
  const list = useSpeciesList(filters);
  const onScroll = useScrollDetentHaptics(COMPACT_ROW_HEIGHT + spacing.sm);
  const openSpecies = useCallback((codigo: string) => router.push(`/species/${codigo}`), [router]);
  const renderItem = useCallback(({ item }: { item: Species }) => (
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
      <CompactSpeciesRow species={item} favorite={isFavorite(item.codigo)} onPress={openSpecies} onToggleFavorite={toggle} />
    </View>
  ), [isFavorite, openSpecies, spacing.lg, spacing.sm, toggle]);
  const bottom = navigationBottomInset(insets.bottom, spacing.lg);
  const remove = (key: keyof SpeciesSelection, value?: string): void => setApplied((selection) => ({ ...selection, [key]: typeof selection[key] === 'boolean' ? false : (selection[key] as string[]).filter((item) => item !== value) }));
  const filterCount = speciesSelectionCount(applied);
  const showingCount = filterCount > 0 || search.trim().length >= 2;
  const headerHeight = insets.top + (filterCount > 0 ? 190 : showingCount ? 142 : 124);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { height: headerHeight, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => { haptics.tap(); if (router.canGoBack()) router.back(); else router.replace('/explore'); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Volver a Descubrir" style={[styles.iconButton, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.pill }]}><BackIcon color={colors.text} /></Pressable>
          <View style={styles.titleWrap}><Text style={[typography.eyebrow, { color: colors.textMuted }]}>CATÁLOGO</Text><Text style={[typography.headerTitle, { color: colors.text, marginTop: 1 }]}>Todas las especies</Text>{showingCount && <Text style={[typography.caption, { color: colors.primary, marginTop: 1 }]}>{list.loading ? 'Actualizando resultados…' : `${list.total} ${list.total === 1 ? 'resultado' : 'resultados'}`}</Text>}</View>
          <Pressable onPress={() => { haptics.tap(); setDraft(applied); setSheetOpen(true); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Filtrar especies" style={[styles.filterButton, { backgroundColor: colors.surfaceVariant, borderRadius: radius.pill }]}><SlidersIcon color={colors.textSecondary} /><Text style={[typography.caption, { color: colors.textSecondary }]}>{filterCount || ''}</Text></Pressable>
        </View>
        <View style={[styles.searchRow, { marginTop: spacing.sm }]}><SearchBar value={query} onChange={setQuery} variant="surface" /></View>
        {filterCount > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilters}>{applied.onlyNative && <Chip label="Nativas ×" selected onPress={() => remove('onlyNative')} />}{applied.onlyPriority && <Chip label="Prioritarias ×" selected onPress={() => remove('onlyPriority')} />}{(['classes', 'habitats', 'diets', 'seasonalities'] as const).flatMap((key) => applied[key].map((value) => <Chip key={`${key}-${value}`} label={`${friendlyFilterValue(value)} ×`} selected onPress={() => remove(key, value)} />))}</ScrollView>}
      </View>

      {list.loading && list.items.length === 0 ? <View style={{ flex: 1, paddingTop: headerHeight + spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.sm }}>{[0, 1, 2, 3, 4].map((i) => <CompactSpeciesRowSkeleton key={i} />)}</View> : list.items.length === 0 ? <View style={{ flex: 1, paddingTop: headerHeight }}><EmptyState title="Sin resultados" message="Probá con otro nombre o filtro." /></View> : <View style={styles.listArea}><FlashList data={list.items} renderItem={renderItem} keyExtractor={(item) => item.codigo} onScroll={onScroll} scrollEventThrottle={32} onEndReached={list.loadMore} onEndReachedThreshold={0.4} drawDistance={280} maxItemsInRecyclePool={12} contentContainerStyle={{ paddingTop: headerHeight }} ListHeaderComponent={<View style={{ height: spacing.sm }} />} ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.primary} style={{ paddingBottom: bottom }} /> : <View style={{ height: bottom }} />} showsVerticalScrollIndicator={false} /></View>}

      <SpeciesFilterSheet
        visible={sheetOpen}
        draft={draft}
        classes={classes.map((item) => item.value)}
        options={options}
        onChange={setDraft}
        onClose={() => setSheetOpen(false)}
        onClear={() => setDraft(blankSpeciesSelection())}
        onApply={() => { setApplied(draft); setSheetOpen(false); haptics.press(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleWrap: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterButton: { minWidth: 44, height: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  listArea: { flex: 1 },
  activeFilters: { gap: 8, paddingTop: 10, paddingBottom: 4 },
});
