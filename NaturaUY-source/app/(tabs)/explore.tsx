import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue } from 'react-native-reanimated';
import type { Species } from '../../src/domain/entities/species';
import { speciesRepository, type SpeciesFilters } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { AccountButton } from '../../src/presentation/components/AccountButton';
import { CollapsibleGradientHeader } from '../../src/presentation/components/CollapsibleGradientHeader';
import { Chip } from '../../src/presentation/components/Chip';
import { SpeciesFilterSheet, blankSpeciesSelection, friendlyFilterValue, speciesSelectionCount, type SpeciesSelection } from '../../src/presentation/components/SpeciesFilterSheet';
import { EmptyState } from '../../src/presentation/components/EmptyState';
import { SearchBar } from '../../src/presentation/components/SearchBar';
import { CARD_HEIGHT, SpeciesCard, SpeciesCardSkeleton } from '../../src/presentation/components/SpeciesCard';
import { BiomesIcon, BookIcon, ChevronRightIcon, MenuIcon, SearchIcon, SlidersIcon, TaxonomyIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useSpeciesList } from '../../src/presentation/hooks/useSpeciesList';
import { useScrollDetentHaptics } from '../../src/presentation/hooks/useScrollDetentHaptics';
import { useTaxonomyChildren } from '../../src/presentation/hooks/useTaxonomyChildren';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { COLLAPSIBLE_HEADER_EXPANDED, spacing as space } from '../../src/presentation/theme/tokens';
import { navigationBottomInset } from '../../src/presentation/navigationPolicy';
import { useDebouncedValue } from '../../src/shared/hooks/useDebouncedValue';

const ROW_HEIGHT = CARD_HEIGHT + space.lg;

export default function ExploreScreen(): React.JSX.Element {
  const db = useSQLiteContext(); const router = useRouter(); const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography, elevation } = useTheme(); const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const params = useLocalSearchParams<{ native?: string; priority?: string; clase?: string; q?: string; all?: string }>();
  const seeded = useMemo<SpeciesSelection>(() => ({ ...blankSpeciesSelection(), classes: params.clase ? [params.clase] : [], onlyNative: params.native === '1', onlyPriority: params.priority === '1' }), [params.clase, params.native, params.priority]);
  const [menuOpen, setMenuOpen] = useState(false); const [sheetOpen, setSheetOpen] = useState(false); const [query, setQuery] = useState(params.q ?? '');
  const [applied, setApplied] = useState<SpeciesSelection>(seeded); const [draft, setDraft] = useState<SpeciesSelection>(seeded);
  const [options, setOptions] = useState({ habitats: [] as string[], diets: [] as string[], seasonalities: [] as string[] });
  const { items: classes } = useTaxonomyChildren('clase', {});
  useEffect(() => { void Promise.all([speciesRepository.listFilterValues(db, 'habitat'), speciesRepository.listFilterValues(db, 'diet'), speciesRepository.listFilterValues(db, 'seasonality')]).then(([habitats, diets, seasonalities]) => setOptions({ habitats, diets, seasonalities })); }, [db]);
  const search = useDebouncedValue(query, 220);
  const filters = useMemo<SpeciesFilters>(() => ({ search: search.trim() || undefined, onlyNative: applied.onlyNative || undefined, onlyPriority: applied.onlyPriority || undefined, classes: applied.classes.length ? applied.classes : undefined, habitats: applied.habitats.length ? applied.habitats : undefined, diets: applied.diets.length ? applied.diets : undefined, seasonalities: applied.seasonalities.length ? applied.seasonalities : undefined }), [applied, search]);
  const canShowResults = search.trim().length >= 2 || speciesSelectionCount(applied) > 0 || params.all === '1';
  const scrollY = useSharedValue(0);
  const list = useSpeciesList(filters, canShowResults); const bottom = navigationBottomInset(insets.bottom);
  const onScroll = useScrollDetentHaptics(ROW_HEIGHT);
  const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    scrollY.value = event.nativeEvent.contentOffset.y;
    onScroll(event);
  }, [onScroll, scrollY]);
  const openSpecies = useCallback((codigo: string) => router.push(`/species/${codigo}`), [router]);
  const renderItem = useCallback(({ item, index }: { item: Species; index: number }) => <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}><SpeciesCard species={item} index={index} favorite={isFavorite(item.codigo)} onPress={openSpecies} onToggleFavorite={toggleFavorite} /></View>, [isFavorite, openSpecies, spacing.lg, toggleFavorite]);
  const remove = (key: keyof SpeciesSelection, value?: string): void => setApplied((s) => ({ ...s, [key]: typeof s[key] === 'boolean' ? false : (s[key] as string[]).filter((v) => v !== value) }));

  const taxonomyCard = <View style={{ marginTop: spacing.md }}><Pressable onPress={() => { haptics.tap(); router.push('/taxonomy'); }}>{({ pressed }) => <LinearGradient colors={['#77672F', '#53603A', '#355043']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.taxonomy, elevation.low, { borderRadius: radius.lg, opacity: pressed ? 0.92 : 1 }]}><View style={[styles.taxIcon, { borderRadius: radius.md }]}><TaxonomyIcon color="#FFF9EA" size={25} /></View><View style={styles.flex}><Text style={[typography.cardTitle, { color: '#FFF9EA' }]}>Exploración taxonómica <Text style={styles.taxDash}>— CLASIFICACIÓN DE LA VIDA</Text></Text><Text style={[typography.caption, { color: '#E8E5C9', marginTop: 5 }]}>Recorré cómo se clasifican los seres vivos, de filo a género.</Text></View><ChevronRightIcon color="#FFF9EA" /></LinearGradient>}</Pressable></View>;

  const resultsHeader = <>
    <View style={{ paddingHorizontal: spacing.lg }}>{taxonomyCard}</View>
    <View style={[styles.filterRow, { paddingHorizontal: spacing.lg, marginTop: spacing.xl }]}><View><Text style={[typography.label, { color: colors.text }]}>Resultados</Text><Text style={[typography.caption, { color: colors.textMuted }]}>{list.total} especies</Text></View><Pressable onPress={() => { setDraft(applied); setSheetOpen(true); }} style={[styles.filterButton, { backgroundColor: colors.surfaceVariant }]}><SlidersIcon color={colors.textSecondary} /><Text style={[typography.label, { color: colors.textSecondary }]}>Filtros{speciesSelectionCount(applied) ? ` (${speciesSelectionCount(applied)})` : ''}</Text></Pressable></View>
    {speciesSelectionCount(applied) > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.active, { paddingHorizontal: spacing.lg }]}>{applied.onlyNative && <Chip label="Nativas ×" selected onPress={() => remove('onlyNative')} />}{applied.onlyPriority && <Chip label="Prioritarias ×" selected onPress={() => remove('onlyPriority')} />}{(['classes', 'habitats', 'diets', 'seasonalities'] as const).flatMap((key) => applied[key].map((v) => <Chip key={`${key}-${v}`} label={`${friendlyFilterValue(v)} ×`} selected onPress={() => remove(key, v)} />))}</ScrollView>}
    <View style={{ height: spacing.xxl }} />
  </>;

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <CollapsibleGradientHeader
      scrollY={scrollY}
      gradient={['#A67A25', '#8A641B', '#5D4515']}
      controls={<><Pressable onPress={() => { haptics.tap(); setMenuOpen(true); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Abrir menú" style={[styles.menuButton, { backgroundColor: 'rgba(255,249,234,0.18)', borderRadius: radius.pill }]}><MenuIcon color="#FFF9EA" /></Pressable><View style={styles.headerTools}><SearchBar value={query} onChange={setQuery} collapseOffset={scrollY} /><AccountButton onPress={() => router.push('/login')} color="#FFF9EA" backgroundColor="rgba(255,249,234,0.16)" /></View></>}
      expandedContent={<Text style={[typography.headerTitle, { color: '#FFF9EA', maxWidth: 330 }]}>Explorá nuestra flora y fauna</Text>}
    />
    {!canShowResults ? <Animated.ScrollView onScroll={(event) => { scrollY.value = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: COLLAPSIBLE_HEADER_EXPANDED + insets.top, paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: bottom }} showsVerticalScrollIndicator={false}>
      {taxonomyCard}
      <Pressable onPress={() => { haptics.tap(); router.push('/species' as never); }} style={[styles.featureCard, elevation.low, { backgroundColor: '#E3ECD9', borderColor: '#AEC29F', borderRadius: radius.lg }]}>
        <View style={[styles.featureAccent, { backgroundColor: '#52705A' }]} /><View style={[styles.featureIcon, { backgroundColor: '#C7DABE', borderRadius: radius.md }]}><SearchIcon color="#365442" size={23} /></View><View style={styles.flex}><Text style={[typography.cardTitle, { color: '#304C3A' }]}>Ver todas las especies</Text><Text style={[typography.caption, { color: '#526559', marginTop: 3 }]}>Catálogo completo con filtros y búsqueda</Text></View><ChevronRightIcon color="#41634B" />
      </Pressable>
      <Pressable onPress={() => { haptics.tap(); router.push('/learn' as never); }} style={[styles.featureCard, elevation.low, { backgroundColor: '#F3E4BE', borderColor: '#D8BC76', borderRadius: radius.lg }]} accessibilityRole="button" accessibilityLabel="Aprender sobre taxonomía">
        <View style={[styles.featureAccent, { backgroundColor: '#A17528' }]} /><View style={[styles.featureIcon, { backgroundColor: '#E9D298', borderRadius: radius.md }]}><BookIcon color="#6F531A" size={23} /></View><View style={styles.flex}><Text style={[typography.cardTitle, { color: '#604815' }]}>Aprender</Text><Text style={[typography.caption, { color: '#705F38', marginTop: 3 }]}>Guía paso a paso de taxonomía y clasificación</Text></View><ChevronRightIcon color="#765819" />
      </Pressable>
      <Pressable onPress={() => { haptics.tap(); router.push('/biomes' as never); }} style={[styles.featureCard, elevation.low, { backgroundColor: '#DCEBE7', borderColor: '#9DBFB6', borderRadius: radius.lg }]}>
        <View style={[styles.featureAccent, { backgroundColor: '#47776C' }]} /><View style={[styles.featureIcon, { backgroundColor: '#BFDAD3', borderRadius: radius.md }]}><BiomesIcon color="#315E55" size={23} /></View><View style={styles.flex}><Text style={[typography.cardTitle, { color: '#294F48' }]}>Explorar ambientes</Text><Text style={[typography.caption, { color: '#4E6761', marginTop: 3 }]}>Pastizales, humedales, montes y costas de Uruguay</Text></View><ChevronRightIcon color="#35675C" />
      </Pressable>
    </Animated.ScrollView> : <>
    {list.loading && list.items.length === 0 ? <Animated.ScrollView onScroll={(event) => { scrollY.value = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: COLLAPSIBLE_HEADER_EXPANDED + insets.top, paddingBottom: bottom }}>{resultsHeader}<View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>{[0,1,2,3].map((i) => <SpeciesCardSkeleton key={i} />)}</View></Animated.ScrollView> : list.items.length === 0 ? <Animated.ScrollView onScroll={(event) => { scrollY.value = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: COLLAPSIBLE_HEADER_EXPANDED + insets.top, paddingBottom: bottom }}>{resultsHeader}<View style={{ padding: spacing.lg }}><EmptyState title="Sin resultados" message="Probá con otro nombre, o quitá algún filtro." /></View></Animated.ScrollView> : <View style={styles.listWrap}><FlashList data={list.items} renderItem={renderItem} keyExtractor={(i) => i.codigo} onScroll={handleListScroll} scrollEventThrottle={32} onEndReached={list.loadMore} onEndReachedThreshold={0.6} contentContainerStyle={{ paddingTop: COLLAPSIBLE_HEADER_EXPANDED + insets.top }} ListHeaderComponent={resultsHeader} showsVerticalScrollIndicator={false} ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.primary} style={{ paddingBottom: bottom }} /> : <View style={{ height: bottom }} />} />{list.loading && <ActivityIndicator color={colors.primary} style={styles.refreshIndicator} />}</View>}</>}
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
    <AppDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, flex: { flex: 1 }, listWrap: { flex: 1 }, refreshIndicator: { position: 'absolute', top: 12, right: 18 }, menuButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, headerTools: { flex: 1, maxWidth: 760, flexDirection: 'row', alignItems: 'center', gap: 10 }, taxonomy: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }, taxIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,249,234,.16)' }, taxDash: { fontSize: 12, fontWeight: '700' }, featureCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' }, featureAccent: { position: 'absolute', left: 0, top: 13, bottom: 13, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 }, featureIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, filterButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 }, active: { gap: 8, paddingTop: 10 } });
