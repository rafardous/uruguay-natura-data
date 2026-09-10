import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image as NativeImage,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import { Image as ExpoImage } from 'expo-image';

import type { Species } from '../src/domain/entities/species';
import {
  speciesRepository,
  TAXON_RANKS,
  UNASSIGNED_TAXON,
  type SpeciesFilters,
  type TaxonRank,
  type TaxonomyPath,
} from '../src/data/repositories/speciesRepository';
import { CARD_HEIGHT, SpeciesCard, SpeciesCardSkeleton } from '../src/presentation/components/SpeciesCard';
import { Skeleton } from '../src/presentation/components/Skeleton';
import { FamilyGlyph } from '../src/presentation/components/FamilyGlyph';
import { BackIcon, ChevronRightIcon, TaxonomyIcon } from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useFavorites } from '../src/presentation/hooks/FavoritesProvider';
import { useScrollDetentHaptics, useViewableItemHaptics } from '../src/presentation/hooks/useScrollDetentHaptics';
import { useSpeciesList } from '../src/presentation/hooks/useSpeciesList';
import { useTaxonomyChildren } from '../src/presentation/hooks/useTaxonomyChildren';
import { useTheme } from '../src/presentation/theme/ThemeProvider';
import { CHORDATA_CLASS_ORDER, classVisual, type ClassVisual } from '../src/presentation/taxonomy/classVisuals';
import { spacing as space } from '../src/presentation/theme/tokens';
import { navigationBottomInset } from '../src/presentation/navigationPolicy';

const ROW_HEIGHT = CARD_HEIGHT + space.lg;
const TAXONOMY = { main: '#8A641B', pale: '#F1E3B9', text: '#293832' };
const loadedOrderImages = new Set<string>();

const RANK_LABELS: Record<TaxonRank, { singular: string; plural: string; prompt: string }> = {
  phylum: { singular: 'Filo', plural: 'filos', prompt: 'Elegí un filo' },
  clase: { singular: 'Clase', plural: 'clases', prompt: 'Elegí una clase' },
  orden: { singular: 'Orden', plural: 'órdenes', prompt: 'Elegí un orden' },
  familia: { singular: 'Familia', plural: 'familias', prompt: 'Elegí una familia' },
  genero: { singular: 'Género', plural: 'géneros', prompt: 'Elegí un género' },
};

const CHORDATA_DESCRIPTION =
  'Animales con notocorda en alguna etapa de su desarrollo. Incluye a todos los vertebrados: peces, anfibios, reptiles, aves y mamíferos.';

const taxonName = (rank: TaxonRank, value: string): string =>
  value === UNASSIGNED_TAXON ? `Sin ${RANK_LABELS[rank].singular.toLocaleLowerCase('es')} asignado` : value;

function ChordataIllustration(): React.JSX.Element {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  if (failed) return <View style={[styles.phylumImage, styles.illustrationFallback]}><TaxonomyIcon color={colors.primary} size={38} /></View>;
  return <NativeImage source={require('../assets/images/taxonomy/chordata-vertebrates.png')} resizeMode="contain" style={styles.phylumImage} onError={() => setFailed(true)} accessibilityLabel="Pez, ave, anfibio, reptil y mamífero representando a los vertebrados" />;
}

function ClassIllustration({ clase, visual }: { clase: string; visual: ClassVisual }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[styles.classImage, styles.illustrationFallback]}>
        <FamilyGlyph clase={clase} color={visual.foreground} size={48} opacity={0.82} />
      </View>
    );
  }
  return (
    <NativeImage
      source={visual.image}
      resizeMode="contain"
      style={styles.classImage}
      onError={() => setFailed(true)}
      accessibilityLabel={visual.imageAccessibilityLabel}
    />
  );
}

function OrderIllustration({ uri, name, clase }: { uri: string | null; name: string; clase: string }): React.JSX.Element {
  const { colors, radius } = useTheme();
  const [loading, setLoading] = useState(Boolean(uri) && !loadedOrderImages.has(uri!));
  const [failed, setFailed] = useState(false);
  useEffect(() => { setLoading(Boolean(uri) && !loadedOrderImages.has(uri!)); setFailed(false); }, [uri]);
  if (!uri || failed) return <View style={[styles.orderImage, styles.illustrationFallback, { backgroundColor: colors.primaryContainer, borderRadius: radius.md }]}><FamilyGlyph clase={clase} color={colors.onPrimaryContainer} size={38} opacity={.9} /></View>;
  return (
    <View style={[styles.orderImage, { borderRadius: radius.md, backgroundColor: colors.surfaceVariant }]}>
      {loading && <View style={StyleSheet.absoluteFill}><Skeleton height={118} radius={radius.md} /></View>}
      <ExpoImage source={{ uri }} contentFit="cover" cachePolicy="memory-disk" onLoad={() => { loadedOrderImages.add(uri); setLoading(false); }} onError={() => setFailed(true)} style={StyleSheet.absoluteFill} accessibilityLabel={`Imagen ilustrativa: ${name}`} />
    </View>
  );
}

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
  const bottomInset = navigationBottomInset(insets.bottom, spacing.lg);

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
  const db = useSQLiteContext();
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
  const [selectedOrderDescription, setSelectedOrderDescription] = useState<string | null>(null);
  const orderedItems = useMemo(() => {
    if (currentRank !== 'clase' || path.phylum?.trim().toLocaleLowerCase() !== 'chordata') return items;
    return [...items].sort((left, right) => {
      const leftOrder = CHORDATA_CLASS_ORDER[left.value] ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = CHORDATA_CLASS_ORDER[right.value] ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.value.localeCompare(right.value, 'es');
    });
  }, [currentRank, items, path.phylum]);
  const selectedRanks = TAXON_RANKS.filter((rank) => path[rank] !== undefined);
  const breadcrumbRef = useRef<ScrollView>(null);
  const bottomInset = navigationBottomInset(insets.bottom, spacing.lg);
  const visibleHaptics = useViewableItemHaptics(`${currentRank ?? 'species'}:${TAXON_RANKS.map((rank) => path[rank] ?? '').join('|')}`);

  useEffect(() => {
    setPath(pathFromParams(params));
    // The serialized URL path changes only when another screen deep-links here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    if (currentRank !== 'familia' || !path.clase || !path.orden || path.orden === UNASSIGNED_TAXON) {
      setSelectedOrderDescription(null);
      return;
    }
    let active = true;
    void speciesRepository.getTaxonDescription(db, 'order', path.clase, path.orden).then((description) => {
      if (active) setSelectedOrderDescription(description);
    });
    return () => { active = false; };
  }, [currentRank, db, path.clase, path.orden]);

  const goBack = useCallback(() => {
    haptics.tap();
    if (params.returnToSpecies) {
      router.back();
      return;
    }
    const last = selectedRanks.at(-1);
    if (!last) {
      router.back();
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
            ref={breadcrumbRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() => breadcrumbRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={[styles.breadcrumb, { paddingTop: spacing.lg, paddingBottom: spacing.sm }]}
          >
            {selectedRanks.map((rank, index) => (
              <View key={rank} style={styles.crumbGroup}>
                {index > 0 && <View style={[styles.crumbConnector, { backgroundColor: TAXONOMY.main }]}><ChevronRightIcon color={TAXONOMY.main} size={14} /></View>}
                <Pressable
                  onPress={() => returnTo(rank)}
                  accessibilityRole="link"
                  accessibilityLabel={`${RANK_LABELS[rank].singular}: ${taxonName(rank, path[rank]!)}`}
                  style={[styles.crumb, { backgroundColor: index === selectedRanks.length - 1 ? TAXONOMY.main : TAXONOMY.pale, borderRadius: radius.md }]}
                >
                  <Text style={[typography.caption, { color: index === selectedRanks.length - 1 ? '#F5E8C4' : colors.textMuted }]}>{RANK_LABELS[rank].singular}</Text>
                  <Text style={[typography.label, { color: index === selectedRanks.length - 1 ? '#FFF9EA' : TAXONOMY.text }]}>{taxonName(rank, path[rank]!)}</Text>
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
          currentRank === 'orden' ? <View style={{ padding: spacing.lg, gap: spacing.sm }}>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={154} radius={radius.lg} />)}</View> : <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            data={orderedItems}
            keyExtractor={(item) => item.value}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={visibleHaptics.onViewableItemsChanged}
            viewabilityConfig={visibleHaptics.viewabilityConfig}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomInset, gap: spacing.sm }}
            ListHeaderComponent={
              <View style={{ marginBottom: spacing.sm, gap: spacing.md }}>
                {selectedOrderDescription && (
                  <View style={[styles.orderDescription, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderRadius: radius.lg }]}>
                    <Text style={[typography.eyebrow, { color: TAXONOMY.main }]}>ACERCA DEL ORDEN</Text>
                    <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>{selectedOrderDescription}</Text>
                  </View>
                )}
                <Text style={[typography.body, { color: colors.textSecondary }]}>
                  {items.length} {items.length === 1 ? RANK_LABELS[currentRank].singular.toLocaleLowerCase('es') : RANK_LABELS[currentRank].plural} en este nivel
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isPhylum = currentRank === 'phylum';
              const isClass = currentRank === 'clase';
              const isOrder = currentRank === 'orden';
              const visual = isClass ? classVisual(item.value) : undefined;
              const foreground = visual?.foreground ?? colors.text;
              const mutedForeground = visual?.mutedForeground ?? colors.textSecondary;
              const isChordata = isPhylum && item.value.trim().toLocaleLowerCase() === 'chordata';
              const description = isChordata
                ? CHORDATA_DESCRIPTION
                : item.description ?? visual?.description;

              return (
                <MotiView
                  from={{ opacity: isOrder ? 1 : 0, translateY: isOrder ? 0 : isClass ? 18 : 8, scale: isClass ? 0.96 : 1 }}
                  animate={{ opacity: 1, translateY: 0, scale: 1 }}
                  transition={{ type: 'timing', duration: isOrder ? 0 : isClass ? 220 : 180, delay: isOrder ? 0 : Math.min(index, isClass ? 4 : 6) * (isClass ? 28 : 18) }}
                >
                  <Pressable
                    onPress={() => select(currentRank, item.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`${taxonName(currentRank, item.value)}, ${item.count} especies`}
                    style={({ pressed }) => [
                      styles.taxonRow,
                      isPhylum && styles.phylumRow,
                      isClass && styles.classRow,
                      isOrder && styles.orderRow,
                      elevation.low,
                      {
                        backgroundColor: visual ? visual.colors[0] : pressed ? colors.surfaceVariant : colors.surface,
                        borderColor: visual ? 'rgba(41,56,50,.14)' : colors.border,
                        borderRadius: radius.lg,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    {visual && (
                      <LinearGradient
                        pointerEvents="none"
                        colors={[...visual.colors]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]}
                      />
                    )}
                    {isClass && (visual ? (
                      <View style={[styles.classImageFrame, { borderRadius: radius.md }]}>
                        <ClassIllustration clase={item.value} visual={visual} />
                      </View>
                    ) : (
                      <View style={[styles.classIcon, { backgroundColor: colors.primaryContainer, borderRadius: radius.md }]}>
                        <FamilyGlyph clase={item.value} color={colors.onPrimaryContainer} size={48} opacity={0.95} />
                      </View>
                    ))}
                    {isOrder && <OrderIllustration uri={item.representativeImageUrl ?? null} name={item.representativeName ?? item.value} clase={path.clase ?? ''} />}
                    <View style={styles.flex}>
                      {!isOrder && <Text style={[typography.eyebrow, { color: visual?.mutedForeground ?? colors.textMuted }]}>{RANK_LABELS[currentRank].singular.toLocaleUpperCase('es')}</Text>}
                      <Text style={[typography.cardTitle, styles.scientific, { color: foreground, marginTop: 4 }]}>
                        {taxonName(currentRank, item.value)}
                      </Text>
                      {description && (
                        <Text style={[typography.body, { color: mutedForeground, marginTop: 5 }]} numberOfLines={isOrder ? 4 : isClass ? 3 : isPhylum ? 4 : undefined}>
                          {description}
                        </Text>
                      )}
                    </View>
                    {isChordata ? (
                      <View style={styles.phylumVisual}>
                        <ChordataIllustration />
                        <View style={styles.rowEnd}>
                          <View style={[styles.count, { backgroundColor: colors.primaryContainer, borderRadius: radius.pill }]}>
                            <Text style={[typography.caption, { color: colors.onPrimaryContainer }]}>{item.count}</Text>
                          </View>
                          <ChevronRightIcon color={colors.textMuted} />
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.rowEnd, (isClass||isOrder) && styles.classRowEnd]}>
                        <View style={[styles.count, isClass && styles.classCount, { backgroundColor: visual ? 'rgba(255,255,255,.52)' : colors.primaryContainer, borderRadius: radius.pill }]}>
                          <Text style={[typography.caption, { color: visual?.foreground ?? colors.onPrimaryContainer }]}>{item.count}</Text>
                        </View>
                        <ChevronRightIcon color={visual?.foreground ?? colors.textMuted} size={isClass ? 18 : undefined} />
                      </View>
                    )}
                  </Pressable>
                </MotiView>
              );
            }}
          />
        )}
      </View>

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
  crumbGroup: { flexDirection: 'row', alignItems: 'center' },
  crumbConnector: { width: 24, height: 2, alignItems: 'center', justifyContent: 'center' },
  crumb: { minWidth: 92, paddingHorizontal: 12, paddingVertical: 8 },
  divider: { height: StyleSheet.hairlineWidth },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  taxonRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  phylumRow: { minHeight: 154, paddingVertical: 18 },
  classRow: { minHeight: 136, gap: 10, padding: 12 },
  orderRow: { minHeight: 154, alignItems: 'stretch', gap: 12, padding: 12 },
  orderImage: { width: 88, height: 118, alignSelf: 'center', overflow: 'hidden', position: 'relative' },
  orderDescription: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
  phylumVisual: { width: 108, alignItems: 'center', gap: 2 },
  phylumImage: { width: 96, height: 88 },
  illustrationFallback: { alignItems: 'center', justifyContent: 'center' },
  classImageFrame: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDF7E7', overflow: 'hidden' },
  classImage: { width: 96, height: 96 },
  classIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  classRowEnd: { flexDirection: 'column', justifyContent: 'center', flexShrink: 0, gap: 6 },
  count: { minWidth: 36, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6 },
  classCount: { minWidth: 30, paddingHorizontal: 6, paddingVertical: 4 },
  scientific: { fontStyle: 'italic' },
  end: { textAlign: 'center', paddingTop: 24 },
});
