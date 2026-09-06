import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Species } from '../../src/domain/entities/species';
import { SpeciesCard, SpeciesCardSkeleton, CARD_HEIGHT } from '../../src/presentation/components/SpeciesCard';
import { AccountButton } from '../../src/presentation/components/AccountButton';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { BackIcon, MenuIcon } from '../../src/presentation/components/TabIcons';
import { SearchBar } from '../../src/presentation/components/SearchBar';
import { EmptyState } from '../../src/presentation/components/EmptyState';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useSpeciesList } from '../../src/presentation/hooks/useSpeciesList';
import { useScrollDetentHaptics } from '../../src/presentation/hooks/useScrollDetentHaptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN, spacing } from '../../src/presentation/theme/tokens';
import { useDebouncedValue } from '../../src/shared/hooks/useDebouncedValue';

export default function SpeciesIndexScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing: space, typography, elevation } = useTheme();
  const params = useLocalSearchParams<{ native?: string; priority?: string }>();
  const { isFavorite, toggle } = useFavorites();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query, 220);
  const filters = useMemo(() => ({
    search: search.trim() || undefined,
    onlyNative: params.native === '1' || undefined,
    onlyPriority: params.priority === '1' || undefined,
  }), [params.native, params.priority, search]);
  const list = useSpeciesList(filters);
  const onScroll = useScrollDetentHaptics(CARD_HEIGHT + spacing.lg);
  const openSpecies = useCallback((codigo: string) => router.push(`/species/${codigo}`), [router]);
  const renderItem = useCallback(({ item, index }: { item: Species; index: number }) => (
    <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
      <SpeciesCard species={item} index={index} favorite={isFavorite(item.codigo)} onPress={openSpecies} onToggleFavorite={toggle} />
    </View>
  ), [isFavorite, openSpecies, space.lg, toggle]);
  const bottom = NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom + space.lg;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => { haptics.tap(); router.back(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Volver a Descubrir" style={[styles.iconButton, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.pill }]}><BackIcon color={colors.text} /></Pressable>
          <View style={styles.titleWrap}><Text style={[typography.eyebrow, { color: colors.textMuted }]}>CATÁLOGO</Text><Text style={[typography.title, { color: colors.text, marginTop: 2 }]}>Todas las especies</Text></View>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Abrir menú" style={[styles.iconButton, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.pill }]}><MenuIcon color={colors.text} /></Pressable>
        </View>
        <View style={[styles.searchRow, { marginTop: space.md }]}><SearchBar value={query} onChange={setQuery} placeholder="Buscar una especie" /><AccountButton onPress={() => router.push('/login')} color={colors.text} backgroundColor={colors.surface} /></View>
      </View>

      {list.loading ? <View style={{ flex: 1, padding: space.lg, gap: space.lg }}>{[0, 1, 2, 3].map((i) => <SpeciesCardSkeleton key={i} />)}</View> : list.items.length === 0 ? <EmptyState title="Sin resultados" message="Probá con otro nombre o filtro." /> : <FlashList data={list.items} renderItem={renderItem} keyExtractor={(item) => item.codigo} onScroll={onScroll} scrollEventThrottle={32} onEndReached={list.loadMore} onEndReachedThreshold={0.6} ListHeaderComponent={<View style={{ height: space.lg }} />} ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.primary} style={{ paddingBottom: bottom }} /> : <View style={{ height: bottom }} />} showsVerticalScrollIndicator={false} />}
      <AppDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleWrap: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
