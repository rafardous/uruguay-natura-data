import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import type { Species } from '../../src/domain/entities/species';
import { speciesRepository, type SpeciesFilters } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { AppHeader } from '../../src/presentation/components/AppHeader';
import { Chip } from '../../src/presentation/components/Chip';
import { EmptyState } from '../../src/presentation/components/EmptyState';
import { SearchBar } from '../../src/presentation/components/SearchBar';
import { CARD_HEIGHT, SpeciesCard, SpeciesCardSkeleton } from '../../src/presentation/components/SpeciesCard';
import { ChevronRightIcon, CloseIcon, LoginIcon, SlidersIcon, TaxonomyIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useSpeciesList } from '../../src/presentation/hooks/useSpeciesList';
import { useScrollDetentHaptics } from '../../src/presentation/hooks/useScrollDetentHaptics';
import { useTaxonomyChildren } from '../../src/presentation/hooks/useTaxonomyChildren';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN, spacing as space } from '../../src/presentation/theme/tokens';
import { useDebouncedValue } from '../../src/shared/hooks/useDebouncedValue';

const ROW_HEIGHT = CARD_HEIGHT + space.lg;
interface Selection { classes: string[]; habitats: string[]; diets: string[]; seasonalities: string[]; onlyNative: boolean; onlyPriority: boolean }
const blank = (): Selection => ({ classes: [], habitats: [], diets: [], seasonalities: [], onlyNative: false, onlyPriority: false });
const toggle = (items: string[], value: string): string[] => items.includes(value) ? items.filter((v) => v !== value) : [...items, value];
const count = (s: Selection): number => s.classes.length + s.habitats.length + s.diets.length + s.seasonalities.length + Number(s.onlyNative) + Number(s.onlyPriority);
const friendly = (value: string): string => ({ migratory: 'Migratoria', resident: 'Residente', summer_visitor: 'Visitante estival' }[value] ?? value.replaceAll('_', ' '));

function Group({ title, values, selected, change }: { title: string; values: string[]; selected: string[]; change: (v: string) => void }): React.JSX.Element | null {
  const { colors, typography } = useTheme();
  if (!values.length) return null;
  return <View style={styles.group}><Text style={[typography.eyebrow, { color: colors.textMuted }]}>{title}</Text><View style={styles.chips}>{values.map((v) => <Chip key={v} label={friendly(v)} selected={selected.includes(v)} onPress={() => change(v)} />)}</View></View>;
}

export default function ExploreScreen(): React.JSX.Element {
  const db = useSQLiteContext(); const router = useRouter(); const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography, elevation } = useTheme(); const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const params = useLocalSearchParams<{ native?: string; priority?: string; clase?: string; q?: string }>();
  const seeded = useMemo<Selection>(() => ({ ...blank(), classes: params.clase ? [params.clase] : [], onlyNative: params.native === '1', onlyPriority: params.priority === '1' }), [params.clase, params.native, params.priority]);
  const [menuOpen, setMenuOpen] = useState(false); const [sheetOpen, setSheetOpen] = useState(false); const [query, setQuery] = useState(params.q ?? '');
  const [applied, setApplied] = useState(seeded); const [draft, setDraft] = useState(seeded);
  const [options, setOptions] = useState({ habitats: [] as string[], diets: [] as string[], seasonalities: [] as string[] });
  const { items: classes } = useTaxonomyChildren('clase', {});
  useEffect(() => { void Promise.all([speciesRepository.listFilterValues(db, 'habitat'), speciesRepository.listFilterValues(db, 'diet'), speciesRepository.listFilterValues(db, 'seasonality')]).then(([habitats, diets, seasonalities]) => setOptions({ habitats, diets, seasonalities })); }, [db]);
  const search = useDebouncedValue(query, 220);
  const filters = useMemo<SpeciesFilters>(() => ({ search: search.trim() || undefined, onlyNative: applied.onlyNative || undefined, onlyPriority: applied.onlyPriority || undefined, classes: applied.classes.length ? applied.classes : undefined, habitats: applied.habitats.length ? applied.habitats : undefined, diets: applied.diets.length ? applied.diets : undefined, seasonalities: applied.seasonalities.length ? applied.seasonalities : undefined }), [applied, search]);
  const list = useSpeciesList(filters); const bottom = NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom;
  const onScroll = useScrollDetentHaptics(ROW_HEIGHT);
  const openSpecies = useCallback((codigo: string) => router.push(`/species/${codigo}`), [router]);
  const renderItem = useCallback(({ item, index }: { item: Species; index: number }) => <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}><SpeciesCard species={item} index={index} favorite={isFavorite(item.codigo)} onPress={openSpecies} onToggleFavorite={toggleFavorite} /></View>, [isFavorite, openSpecies, spacing.lg, toggleFavorite]);
  const remove = (key: keyof Selection, value?: string): void => setApplied((s) => ({ ...s, [key]: typeof s[key] === 'boolean' ? false : (s[key] as string[]).filter((v) => v !== value) }));

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader onOpenMenu={() => setMenuOpen(true)}><View style={styles.headerTools}><SearchBar value={query} onChange={setQuery} /><Pressable onPress={() => router.push('/login')} accessibilityRole="button" accessibilityLabel="Iniciar sesión" style={[styles.action, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.pill }]}><LoginIcon color={colors.text} /></Pressable></View></AppHeader>
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}><Pressable onPress={() => { haptics.tap(); router.push('/taxonomy'); }}>{({ pressed }) => <LinearGradient colors={['#8A641B', '#6F531A']} style={[styles.taxonomy, elevation.low, { borderRadius: radius.lg, opacity: pressed ? 0.92 : 1 }]}><View style={[styles.taxIcon, { borderRadius: radius.md }]}><TaxonomyIcon color="#FFF9EA" size={25} /></View><View style={styles.flex}><Text style={[typography.eyebrow, { color: '#F5E8C4' }]}>CLASIFICACIÓN DE LA VIDA</Text><Text style={[typography.cardTitle, { color: '#FFF9EA', marginTop: 3 }]}>Exploración taxonómica</Text><Text style={[typography.caption, { color: '#F5E8C4', marginTop: 3 }]}>Recorré cómo se clasifican los seres vivos, de filo a género.</Text></View><ChevronRightIcon color="#FFF9EA" /></LinearGradient>}</Pressable></View>
    <View style={[styles.filterRow, { paddingHorizontal: spacing.lg, marginTop: spacing.xl }]}><View><Text style={[typography.label, { color: colors.text }]}>Catálogo completo</Text><Text style={[typography.caption, { color: colors.textMuted }]}>{list.total} especies</Text></View><Pressable onPress={() => { setDraft(applied); setSheetOpen(true); }} style={[styles.filterButton, { backgroundColor: colors.surfaceVariant }]}><SlidersIcon color={colors.textSecondary} /><Text style={[typography.label, { color: colors.textSecondary }]}>Filtros{count(applied) ? ` (${count(applied)})` : ''}</Text></Pressable></View>
    {count(applied) > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.active, { paddingHorizontal: spacing.lg }]}>{applied.onlyNative && <Chip label="Nativas ×" selected onPress={() => remove('onlyNative')} />}{applied.onlyPriority && <Chip label="Prioritarias ×" selected onPress={() => remove('onlyPriority')} />}{(['classes', 'habitats', 'diets', 'seasonalities'] as const).flatMap((key) => applied[key].map((v) => <Chip key={`${key}-${v}`} label={`${friendly(v)} ×`} selected onPress={() => remove(key, v)} />))}</ScrollView>}
    <View style={styles.flex}>{list.loading ? <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottom, gap: spacing.lg }}>{[0,1,2,3].map((i) => <SpeciesCardSkeleton key={i} />)}</ScrollView> : list.items.length === 0 ? <View style={{ padding: spacing.lg }}><EmptyState title="Sin resultados" message="Probá con otro nombre, o quitá algún filtro." /></View> : <FlashList data={list.items} renderItem={renderItem} keyExtractor={(i) => i.codigo} onScroll={onScroll} scrollEventThrottle={32} onEndReached={list.loadMore} onEndReachedThreshold={0.6} ListHeaderComponent={<View style={{ height: spacing.xxl }} />} showsVerticalScrollIndicator={false} ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.primary} style={{ paddingBottom: bottom }} /> : <View style={{ height: bottom }} />} />}</View>
    <Modal visible={sheetOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSheetOpen(false)}><View style={styles.layer}><Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={() => setSheetOpen(false)} /><MotiView from={{ translateY: 80 }} animate={{ translateY: 0 }} transition={{ type: 'timing', duration: 260 }} style={[styles.sheet, { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom }]}><View style={[styles.sheetHeader, { padding: spacing.lg }]}><View><Text style={[typography.title, { color: colors.text }]}>Filtrar especies</Text><Text style={[typography.caption, { color: colors.textMuted }]}>Podés combinar varios criterios.</Text></View><Pressable onPress={() => setSheetOpen(false)}><CloseIcon color={colors.text} /></Pressable></View><ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}><Group title="CLASE" values={classes.map((c) => c.value)} selected={draft.classes} change={(v) => setDraft((s) => ({ ...s, classes: toggle(s.classes, v) }))} /><Group title="HÁBITAT" values={options.habitats} selected={draft.habitats} change={(v) => setDraft((s) => ({ ...s, habitats: toggle(s.habitats, v) }))} /><Group title="ALIMENTACIÓN" values={options.diets} selected={draft.diets} change={(v) => setDraft((s) => ({ ...s, diets: toggle(s.diets, v) }))} /><Group title="ESTACIONALIDAD" values={options.seasonalities} selected={draft.seasonalities} change={(v) => setDraft((s) => ({ ...s, seasonalities: toggle(s.seasonalities, v) }))} /><View style={styles.chips}><Chip label="Solo nativas" selected={draft.onlyNative} onPress={() => setDraft((s) => ({ ...s, onlyNative: !s.onlyNative }))} /><Chip label="Prioridad de conservación" selected={draft.onlyPriority} onPress={() => setDraft((s) => ({ ...s, onlyPriority: !s.onlyPriority }))} /></View></ScrollView><View style={[styles.sheetActions, { borderTopColor: colors.border, padding: spacing.lg }]}><Pressable onPress={() => setDraft(blank())} style={styles.clear}><Text style={[typography.label, { color: colors.textSecondary }]}>Limpiar</Text></Pressable><Pressable onPress={() => { setApplied(draft); setSheetOpen(false); haptics.press(); }} style={[styles.apply, { backgroundColor: colors.primary, borderRadius: radius.md }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Aplicar{count(draft) ? ` (${count(draft)})` : ''}</Text></Pressable></View></MotiView></View></Modal>
    <AppDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, flex: { flex: 1 }, headerTools: { flex: 1, maxWidth: 760, flexDirection: 'row', alignItems: 'center', gap: 10 }, action: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, taxonomy: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }, taxIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,249,234,.16)' }, filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, filterButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 }, active: { gap: 8, paddingTop: 10 }, group: { gap: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, layer: { flex: 1, justifyContent: 'flex-end' }, sheet: { maxHeight: '88%', overflow: 'hidden' }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sheetActions: { flexDirection: 'row', gap: 12, borderTopWidth: StyleSheet.hairlineWidth }, clear: { padding: 14 }, apply: { flex: 1, alignItems: 'center', padding: 15 } });
