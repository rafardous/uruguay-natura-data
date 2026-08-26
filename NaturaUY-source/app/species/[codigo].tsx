import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import Animated, {
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Species } from '../../src/domain/entities/species';
import { abundanceLabel, dietLabel, habitatLabel, seasonalityLabel, sourceLabel } from '../../src/domain/catalogLabels';
import {
  speciesRepository,
  TAXON_RANKS,
  UNASSIGNED_TAXON,
  type TaxonRank,
  type TaxonomyPath,
} from '../../src/data/repositories/speciesRepository';
import { ConservationBadge } from '../../src/presentation/components/ConservationBadge';
import { PhotoLightbox } from '../../src/presentation/components/PhotoLightbox';
import { Skeleton } from '../../src/presentation/components/Skeleton';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { ChevronRightIcon, CloseIcon, HeartIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useFavorites } from '../../src/presentation/hooks/FavoritesProvider';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { useSpeciesPalette } from '../../src/presentation/theme/useSpeciesPalette';

/** Content blocks fade up one after another, 55ms apart. */
function Staggered({ index, children }: { index: number; children: React.ReactNode }): React.JSX.Element {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 340, delay: 80 + index * 55 }}
    >
      {children}
    </MotiView>
  );
}

function Fact({ label, value, container, onContainer }: { label: string; value: string; container: string; onContainer: string }): React.JSX.Element {
  const { radius, typography } = useTheme();

  return (
    <View style={[styles.fact, { backgroundColor: container, borderRadius: radius.md }]}>
      <Text style={[typography.caption, { color: onContainer }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[typography.label, { color: onContainer, marginTop: 3 }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/** A custom sheet keeps Android scrolling predictable and owns its dismiss gesture. */
export default function SpeciesDetailScreen(): React.JSX.Element {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors, radius, spacing, typography } = useTheme();
  const { isFavorite, toggle } = useFavorites();

  const [species, setSpecies] = useState<Species | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const palette = useSpeciesPalette(species);

  const scrollY = useSharedValue(0);
  const sheetY = useSharedValue(0);
  const sheetDragOrigin = useSharedValue(0);
  const draggingSheet = useSharedValue(false);
  const dismissing = useSharedValue(false);

  const dismiss = (): void => {
    router.back();
  };

  const scrollGesture = Gesture.Native();
  const dismissGesture = Gesture.Pan()
    .enabled(!lightboxOpen)
    .activeOffsetY(8)
    .failOffsetX([-28, 28])
    .simultaneousWithExternalGesture(scrollGesture)
    .onStart((event) => {
      draggingSheet.value = scrollY.value <= 0.5;
      sheetDragOrigin.value = draggingSheet.value ? 0 : event.translationY;
    })
    .onUpdate((event) => {
      if (dismissing.value) return;

      // If the gesture began farther down, the ScrollView consumes the first
      // part. Once it reaches its top, only the remaining drag moves the sheet.
      if (!draggingSheet.value && scrollY.value <= 0.5) {
        draggingSheet.value = true;
        sheetDragOrigin.value = event.translationY;
      }
      if (!draggingSheet.value) return;

      sheetY.value = Math.max(0, event.translationY - sheetDragOrigin.value);
    })
    .onEnd((event) => {
      if (!draggingSheet.value) return;

      const dragged = sheetY.value;
      const shouldDismiss = dragged > Math.min(150, windowHeight * 0.18)
        || (dragged > 24 && event.velocityY > 950);

      if (shouldDismiss) {
        dismissing.value = true;
        sheetY.value = withTiming(windowHeight, { duration: 190 }, (finished) => {
          if (finished) runOnJS(dismiss)();
        });
      } else {
        sheetY.value = withSpring(0, { damping: 22, stiffness: 240 });
      }
    })
    .onFinalize(() => {
      draggingSheet.value = false;
      sheetDragOrigin.value = 0;
      if (!dismissing.value && sheetY.value > 0) {
        sheetY.value = withSpring(0, { damping: 22, stiffness: 240 });
      }
    });

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = Math.max(0, event.contentOffset.y);
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetY.value, [0, windowHeight * 0.65], [1, 0], 'clamp'),
  }));

  useEffect(() => {
    if (!codigo) return;
    void speciesRepository.findByCodigo(db, codigo).then((found) => {
      if (found) setSpecies(found);
      else setNotFound(true);
    });
  }, [db, codigo]);

  const favorite = species ? isFavorite(species.codigo) : false;

  const facts = species
    ? [
        { label: 'Tamaño', value: species.tamano },
        { label: 'Estacionalidad', value: species.seasonality ? seasonalityLabel(species.seasonality) : '' },
        { label: 'Abundancia', value: species.abundanceStatus ? abundanceLabel(species.abundanceStatus) : '' },
      ].filter((fact) => fact.value.length > 0)
    : [];

  const classification: { label: string; rank: TaxonRank; value: string }[] = species
    ? [
        { label: 'Filo', rank: 'phylum', value: species.taxonomy.phylum },
        { label: 'Clase', rank: 'clase', value: species.taxonomy.clase },
        { label: 'Orden', rank: 'orden', value: species.taxonomy.orden || 'Sin determinar' },
        { label: 'Familia', rank: 'familia', value: species.taxonomy.familia },
        { label: 'Género', rank: 'genero', value: species.taxonomy.genero },
      ]
    : [];
  const dataSources = species
    ? [...new Set(species.sources.map((source) => sourceLabel(source.source)))]
    : [];

  const openTaxonomyAt = (rank: TaxonRank): void => {
    if (!species) return;
    haptics.tap();
    const values: Record<TaxonRank, string> = {
      phylum: species.taxonomy.phylum,
      clase: species.taxonomy.clase,
      orden: species.taxonomy.orden || UNASSIGNED_TAXON,
      familia: species.taxonomy.familia,
      genero: species.taxonomy.genero,
    };
    const params: TaxonomyPath = {};
    for (const candidate of TAXON_RANKS) {
      params[candidate] = values[candidate];
      if (candidate === rank) break;
    }
    // Keep this detail route on the navigation stack. The taxonomy screen knows
    // this came from a species card, so either Android's Back button or its
    // own back affordance returns to this exact, still-open detail.
    router.push({
      pathname: '/taxonomy',
      params: { ...params, returnToSpecies: species.codigo },
    });
  };

  return (
    <View style={styles.modalRoot}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityLabel="Cerrar ficha"
        />
      </Animated.View>
      <GestureDetector gesture={dismissGesture}>
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              marginTop: insets.top + spacing.lg,
            },
            sheetStyle,
          ]}
        >

      <View style={[styles.grabber, { backgroundColor: colors.border }]} />

      {/* In-flow row, above the photo — not overlapping it. */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        <View style={styles.flex} />
        {species && (
          <Pressable
            onPress={() => {
              haptics.press();
              toggle(species.codigo);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            style={[styles.action, { backgroundColor: colors.surfaceVariant }]}
          >
            <MotiView animate={{ scale: favorite ? 1.15 : 1 }} transition={{ type: 'spring', damping: 12 }}>
              {/* Neutral until saved, then favorite pink — the same on/off states
                  every other heart in the app uses, rather than the species'
                  own colour, which is reserved for the chrome below. */}
              <HeartIcon color={favorite ? colors.favorite : colors.text} size={20} filled={favorite} />
            </MotiView>
          </Pressable>
        )}
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.action, { backgroundColor: colors.surfaceVariant, marginLeft: spacing.sm }]}
        >
          <CloseIcon color={colors.text} size={20} />
        </Pressable>
      </View>

      {notFound ? (
        <View style={{ padding: spacing.xl }}>
          <Text style={[typography.title, { color: colors.text }]}>No encontramos esa especie</Text>
        </View>
      ) : !species ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={210} radius={radius.lg} />
          <Skeleton width="60%" height={26} />
          <Skeleton width="45%" height={16} />
          <Skeleton height={80} radius={radius.md} />
        </View>
      ) : (
        <GestureDetector gesture={scrollGesture}>
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            bounces={false}
            overScrollMode="never"
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={onScroll}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
          >
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Pressable
              onPress={() => species.photo && setLightboxOpen(true)}
              disabled={!species.photo}
              accessibilityRole={species.photo ? 'imagebutton' : undefined}
              accessibilityLabel={species.photo ? `Ver ${species.displayName} en tamaño completo` : undefined}
            >
              <SpeciesImage species={species} height={230} full borderRadius={radius.lg} glyphSize={78} />
            </Pressable>
            {species.photo && species.photo.attribution.length > 0 && (
              <Pressable
                onPress={() => species.photo?.page && void Linking.openURL(species.photo.page)}
                disabled={!species.photo.page}
                accessibilityRole={species.photo.page ? 'link' : undefined}
                style={styles.photoCredit}
              >
                <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10, lineHeight: 14 }]} numberOfLines={2}>
                  Foto: {species.photo.attribution}
                  {species.photo.license ? ` · ${species.photo.license}` : ''}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={{ padding: spacing.lg }}>
            <Staggered index={0}>
              <Text style={[typography.eyebrow, { color: palette.accent }]}>
                {species.taxonomy.clase.toUpperCase()} · FAUNA DEL URUGUAY
              </Text>
              <Text style={[typography.display, { color: colors.text, marginTop: 6 }]}>
                {species.displayName}
              </Text>
              {/* Only when it adds something: `displayName` is the binomial itself
                  whenever a species has no vernacular name. */}
              {species.scientificName !== species.displayName && (
                <Text style={[typography.body, styles.scientific, { color: colors.textSecondary }]}>
                  {species.scientificName}
                </Text>
              )}
            </Staggered>

            <Staggered index={1}>
              <View style={[styles.badgeRow, { marginTop: spacing.md }]}>
                <ConservationBadge
                  label={species.conservation.label}
                  rank={species.conservation.rank}
                  accent={palette.accent}
                  container={palette.container}
                  onContainer={palette.onContainer}
                />
                <View style={[styles.pill, { backgroundColor: palette.container, borderRadius: radius.sm }]}>
                  <Text style={[typography.caption, { color: palette.onContainer }]}>
                    {species.origin === 'native'
                      ? 'Nativa'
                      : species.origin === 'introduced'
                        ? 'Exótica'
                        : 'Origen sin determinar'}
                  </Text>
                </View>
              </View>
            </Staggered>

            {facts.length > 0 && (
              <Staggered index={2}>
                <View style={[styles.facts, { marginTop: spacing.lg }]}>
                  {facts.map((fact) => (
                    <Fact
                      key={fact.label}
                      label={fact.label}
                      value={fact.value}
                      container={palette.container}
                      onContainer={palette.onContainer}
                    />
                  ))}
                </View>
              </Staggered>
            )}

            {species.habitat.length > 0 && (
              <Staggered index={3}>
                <Text style={[typography.label, { color: palette.accent, marginTop: spacing.xl }]}>Hábitat</Text>
                <View style={[styles.tagRow, { marginTop: spacing.sm }]}>
                  {species.habitat.map((habitat) => (
                    <View key={habitat} style={[styles.dataTag, { backgroundColor: palette.container, borderRadius: radius.pill }]}>
                      <Text style={[typography.caption, { color: palette.onContainer }]}>{habitatLabel(habitat)}</Text>
                    </View>
                  ))}
                </View>
              </Staggered>
            )}

            {species.diet.length > 0 && (
              <Staggered index={4}>
                <Text style={[typography.label, { color: palette.accent, marginTop: spacing.lg }]}>Alimentación</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
                  {species.diet.map(dietLabel).join(' · ')}
                </Text>
              </Staggered>
            )}

            {species.descripcion.length > 0 && (
              <Staggered index={5}>
                <Text style={[typography.label, { color: palette.accent, marginTop: spacing.xl }]}>Descripción</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
                  {species.descripcion}
                </Text>
              </Staggered>
            )}

            {species.diet.length === 0 && species.alimentacion.length > 0 && (
              <Staggered index={6}>
                <Text style={[typography.label, { color: palette.accent, marginTop: spacing.lg }]}>Alimentación</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
                  {species.alimentacion}
                </Text>
              </Staggered>
            )}

            {species.relevantNote && (
              <Staggered index={7}>
                <View style={[styles.note, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.lg }]}>
                  <Text style={[typography.label, { color: colors.text }]}>Dato relevante</Text>
                  <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>{species.relevantNote}</Text>
                </View>
              </Staggered>
            )}

            <Staggered index={8}>
              <Text style={[typography.label, { color: palette.accent, marginTop: spacing.xl }]}>Clasificación</Text>
              <View style={[styles.classification, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.sm }]}>
                {classification.map(({ label, rank, value }, index) => (
                  <Pressable
                    key={rank}
                    onPress={() => openTaxonomyAt(rank)}
                    accessibilityRole="link"
                    accessibilityLabel={`Ver ${label.toLocaleLowerCase('es')} ${value} en búsqueda taxonómica`}
                    style={[
                      styles.classificationRow,
                      index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
                    <View style={styles.classificationValue}>
                      <Text style={[typography.label, rank === 'genero' && styles.scientific, { color: colors.text }]} numberOfLines={1}>{value}</Text>
                      <ChevronRightIcon color={colors.textMuted} size={16} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </Staggered>

            {species.acceptedName && species.acceptedName !== species.scientificName && (
              <Staggered index={9}>
                <Text style={[typography.label, { color: palette.accent, marginTop: spacing.lg }]}>
                  Nombre aceptado
                </Text>
                <Text style={[typography.body, styles.scientific, { color: colors.textSecondary, marginTop: 6 }]}>
                  {species.acceptedName}
                </Text>
              </Staggered>
            )}

            {dataSources.length > 0 && (
              <Staggered index={10}>
                <View style={{ marginTop: spacing.xl }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>FUENTES DEL REGISTRO</Text>
                  <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
                    {dataSources.join(' · ')}
                  </Text>
                  {species.reviewStatus === 'needs_review' && (
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 5 }]}>
                      Clasificación pendiente de revisión editorial
                    </Text>
                  )}
                </View>
              </Staggered>
            )}

            <Staggered index={11}>
              <Pressable
                onPress={() => router.push({ pathname: '/report', params: { kind: 'data_error', codigo: species.codigo } } as unknown as Href)}
                style={[styles.reportButton, { borderColor: colors.border, borderRadius: radius.pill, marginTop: spacing.xl }]}
              >
                <Text style={[typography.label, { color: colors.textSecondary }]}>¿Encontraste un dato incorrecto?</Text>
                <ChevronRightIcon color={colors.textMuted} size={16} />
              </Pressable>
            </Staggered>

          </View>
          </Animated.ScrollView>
        </GestureDetector>
      )}

      <PhotoLightbox
        visible={lightboxOpen}
        uri={species?.photo?.fullUrl}
        label={species?.displayName ?? ''}
        onClose={() => setLightboxOpen(false)}
      />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { flex: 1, overflow: 'hidden' },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 18 },
  action: { padding: 9, borderRadius: 12 },
  scientific: { fontStyle: 'italic', marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 9, paddingVertical: 5 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { flexGrow: 1, flexBasis: '46%', padding: 12 },
  photoCredit: { alignSelf: 'flex-start', paddingTop: 7, paddingHorizontal: 3 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dataTag: { paddingHorizontal: 11, paddingVertical: 7 },
  note: { padding: 14 },
  classification: { overflow: 'hidden', paddingHorizontal: 14 },
  classificationRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  classificationValue: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  reportButton: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
