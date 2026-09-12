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
import { formatLegacyMeasurementText, formatSpeciesMeasurement } from '../../src/domain/services/measurementFormatting';
import {
  speciesRepository,
  TAXON_RANKS,
  UNASSIGNED_TAXON,
  type TaxonRank,
  type TaxonomyPath,
} from '../../src/data/repositories/speciesRepository';
import { ConservationBadge } from '../../src/presentation/components/ConservationBadge';
import { PhotoLightbox } from '../../src/presentation/components/PhotoLightbox';
import { SpeciesSourcesSheet } from '../../src/presentation/components/SpeciesSourcesSheet';
import { TransientZoomView } from '../../src/presentation/components/TransientZoomView';
import { SpeciesAudioButton } from '../../src/presentation/components/SpeciesAudioButton';
import { Skeleton } from '../../src/presentation/components/Skeleton';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { FamilyGlyph } from '../../src/presentation/components/FamilyGlyph';
import { FavoriteSparkles } from '../../src/presentation/components/FavoriteSparkles';
import { BugIcon, ChevronRightIcon, CloseIcon, DatabaseIcon, HeartIcon, InfoIcon, MoreIcon } from '../../src/presentation/components/TabIcons';
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
      transition={{ type: 'timing', duration: 220, delay: 40 + Math.min(index, 4) * 28 }}
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

const TRAIT_LABELS: Record<string, string> = {
  body_length: 'Longitud corporal', max_length: 'Longitud máxima', body_mass: 'Masa', wing_length: 'Ala',
  tail_length: 'Cola', tarsus_length: 'Tarso', terrestrial: 'Terrestre', arboreal: 'Arborícola', aquatic: 'Acuático',
  aerial: 'Aéreo', fossorial: 'Fosorial', perching: 'Posador', generalist: 'Generalista', diurnal: 'Diurno',
  nocturnal: 'Nocturno', both: 'Diurno y nocturno', freshwater: 'Agua dulce', brackish: 'Salobre', marine: 'Marino',
  benthic: 'Bentónico', demersal: 'Demersal', pelagic: 'Pelágico',
};

/** A custom sheet keeps Android scrolling predictable and owns its dismiss gesture. */
export default function SpeciesDetailScreen(): React.JSX.Element {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const { isFavorite, toggle } = useFavorites();

  const [species, setSpecies] = useState<Species | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [relevantInfoOpen, setRelevantInfoOpen] = useState(false);
  const [traitsOpen, setTraitsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const palette = useSpeciesPalette(species);

  const scrollY = useSharedValue(0);
  const sheetY = useSharedValue(0);
  const sheetDragOrigin = useSharedValue(0);
  const draggingSheet = useSharedValue(false);
  const dismissing = useSharedValue(false);

  const dismiss = (): void => {
    haptics.tap();
    router.back();
  };

  const scrollGesture = Gesture.Native();
  const dismissGesture = Gesture.Pan()
    .enabled(!lightboxOpen)
    .maxPointers(1)
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

  // The fixed grabber owns its own gesture, so pulling from the very top of
  // the sheet never depends on the ScrollView having already reached offset 0.
  const grabberGesture = Gesture.Pan()
    .enabled(!lightboxOpen)
    .activeOffsetY(8)
    .failOffsetX([-28, 28])
    .simultaneousWithExternalGesture(dismissGesture)
    .onStart(() => {
      draggingSheet.value = true;
      sheetDragOrigin.value = 0;
    })
    .onUpdate((event) => {
      if (!dismissing.value) sheetY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
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
  const [sparkleTrigger, setSparkleTrigger] = useState(0);

  const facts = species
    ? [
        ...(species.traits.measurements.length === 0 ? [{ label: 'Tamaño', value: formatLegacyMeasurementText(species.tamano) }] : []),
        { label: 'Estacionalidad', value: species.seasonality ? seasonalityLabel(species.seasonality) : '' },
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
  const alternateNames = species ? species.commonNames.filter((name) => name.toLocaleLowerCase('es') !== species.displayName.toLocaleLowerCase('es')) : [];
  const traitSources = species ? species.traits.sources.map(sourceLabel) : [];
  const hasTraits = Boolean(species && (species.traits.measurements.length || species.traits.lifeModes.length || species.traits.activity.length || species.traits.aquaticEnvironments.length || species.traits.waterZones.length || species.traits.depthMinM !== null || species.traits.depthMaxM !== null));
  const hasRelevantInfo = Boolean(species?.relevantNote || species?.facts.length);
  const observabilityBand = species?.observability?.band === 'high' ? 'Alta'
    : species?.observability?.band === 'medium' ? 'Media'
      : species?.observability?.band === 'low' ? 'Baja' : 'Datos insuficientes';

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

      <GestureDetector gesture={grabberGesture}>
        <View style={styles.grabberHitArea} accessibilityRole="button" accessibilityLabel="Arrastrar para cerrar la ficha">
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        </View>
      </GestureDetector>

      {/* In-flow row, above the photo — not overlapping it. */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        {species ? <View style={styles.classIdentity}><View style={[styles.classGlyph, { backgroundColor: palette.container, borderRadius: radius.md }]}><FamilyGlyph clase={species.taxonomy.clase} color={palette.accent} size={22} /></View><Text style={[typography.label, { color: colors.text }]}>{species.taxonomy.clase}</Text></View> : null}
        <View style={styles.flex} />
        {species && (
          <Pressable
            onPress={() => { haptics.tap(); setOptionsOpen((open) => !open); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ver opciones de la especie"
            accessibilityState={{ expanded: optionsOpen }}
            style={[styles.action, { backgroundColor: colors.surfaceVariant, marginRight: spacing.sm }]}
          >
            <MoreIcon color={colors.text} size={20} />
          </Pressable>
        )}
        {species && (
          <Pressable
            onPress={() => {
              haptics.press();
              if (!favorite) setSparkleTrigger((value) => value + 1);
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
            <FavoriteSparkles trigger={sparkleTrigger} color={colors.favorite} />
          </Pressable>
        )}
        <Pressable
          onPress={dismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.action, { backgroundColor: colors.surfaceVariant, marginLeft: spacing.sm }]}
        >
          <CloseIcon color={colors.text} size={20} />
        </Pressable>
      </View>
      {species && optionsOpen && (
        <View style={[styles.optionsMenu, elevation.high, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, right: spacing.lg + 94 }]}>
          <Pressable onPress={() => { haptics.tap(); setOptionsOpen(false); setSourcesOpen(true); }} accessibilityRole="menuitem" style={styles.optionItem}>
            <DatabaseIcon color={colors.primary} size={19} />
            <Text style={[typography.label, { color: colors.text }]}>Fuentes de datos</Text>
          </Pressable>
        </View>
      )}

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
            <View style={{ height: 230 }}>
              <TransientZoomView onPress={species.photo ? () => setLightboxOpen(true) : undefined} accessibilityLabel={species.photo ? `Ver ${species.displayName} en tamaño completo` : `Ilustración de ${species.displayName}`} borderRadius={radius.lg}>
              <SpeciesImage species={species} height={230} full borderRadius={radius.lg} glyphSize={78} />
              </TransientZoomView>
            </View>
            {species.photo && species.photo.attribution.length > 0 && (
              <Pressable
                onPress={() => species.photo?.page && void Linking.openURL(species.photo.page)}
                disabled={!species.photo.page}
                accessibilityRole={species.photo.page ? 'link' : undefined}
                style={styles.photoCredit}
              >
                <Text style={[typography.caption, { color: colors.textMuted, fontSize: 9, lineHeight: 12 }]} numberOfLines={2}>
                  Foto: {species.photo.attribution}
                  {species.photo.license ? ` · ${species.photo.license}` : ''}
                </Text>
              </Pressable>
            )}
            <SpeciesAudioButton species={species} />
          </View>

          <View style={{ padding: spacing.lg }}>
            <Staggered index={0}>
              <View style={styles.nameRow}>
                <Text style={[typography.display, styles.name, { color: colors.text }]}>{species.displayName}</Text>
                {hasRelevantInfo && <Pressable onPress={() => { haptics.tap(); setRelevantInfoOpen((open) => !open); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={relevantInfoOpen ? 'Ocultar información relevante' : 'Mostrar información relevante'} accessibilityState={{ expanded: relevantInfoOpen }} style={[styles.infoAction, { backgroundColor: relevantInfoOpen ? palette.container : colors.surfaceVariant, borderRadius: radius.pill }]}><InfoIcon color={relevantInfoOpen ? palette.onContainer : palette.accent} size={20} /></Pressable>}
              </View>
              {/* Only when it adds something: `displayName` is the binomial itself
                  whenever a species has no vernacular name. */}
              {species.scientificName !== species.displayName && (
                <Text style={[typography.body, styles.scientific, { color: colors.textSecondary }]}>
                  {species.scientificName}
                </Text>
              )}
              {alternateNames.length > 0 && (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>Otros nombres: {alternateNames.join(' · ')}</Text>
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
                {species.abundanceStatus && <View style={[styles.pill, { backgroundColor: palette.container, borderRadius: radius.sm }]}><Text style={[typography.caption, { color: palette.onContainer }]}>Abundancia: {abundanceLabel(species.abundanceStatus)}</Text></View>}
              </View>
            </Staggered>

            {hasRelevantInfo && relevantInfoOpen && (
              <MotiView
                from={{ opacity: 0, translateY: -6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 180 }}
              >
                <View style={[styles.note, { backgroundColor: palette.container, borderRadius: radius.md, marginTop: spacing.lg }]}>
                  <View style={styles.noteHeading}>
                    <InfoIcon color={palette.onContainer} size={18} />
                    <Text style={[typography.label, { color: palette.onContainer }]}>Información relevante</Text>
                  </View>
                  {species.relevantNote && <Text style={[typography.body, { color: palette.onContainer, marginTop: 7 }]}>{species.relevantNote}</Text>}
                  {species.facts.map((fact) => (
                    <Text key={fact.id} style={[typography.body, { color: palette.onContainer, marginTop: 7 }]}>• {fact.body}</Text>
                  ))}
                </View>
              </MotiView>
            )}

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

            {hasTraits && (
              <Staggered index={3}>
                <View style={[styles.traits, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.lg }]}>
                  <Pressable onPress={() => setTraitsOpen((open) => !open)} accessibilityRole="button" accessibilityState={{ expanded: traitsOpen }} style={styles.traitsHeader}>
                    <Text style={[typography.label, { color: colors.text }]}>Tamaño y ecología</Text>
                    <Text style={[typography.label, { color: palette.accent }]}>{traitsOpen ? '−' : '+'}</Text>
                  </Pressable>
                  {traitsOpen && <View style={{ gap: 8 }}>
                    {species.traits.measurements.map((measurement) => <View key={measurement.kind} style={styles.traitRow}><Text style={[typography.caption, { color: colors.textMuted }]}>{TRAIT_LABELS[measurement.kind] ?? measurement.kind}</Text><Text style={[typography.label, { color: colors.text }]}>{formatSpeciesMeasurement(measurement)}</Text></View>)}
                    {species.traits.lifeModes.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Modo de vida: {species.traits.lifeModes.map((item) => TRAIT_LABELS[item] ?? item).join(' · ')}</Text>}
                    {species.traits.activity.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Actividad: {species.traits.activity.map((item) => TRAIT_LABELS[item] ?? item).join(' · ')}</Text>}
                    {species.traits.aquaticEnvironments.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Ambiente: {species.traits.aquaticEnvironments.map((item) => TRAIT_LABELS[item] ?? item).join(' · ')}</Text>}
                    {species.traits.waterZones.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Zona de agua: {species.traits.waterZones.map((item) => TRAIT_LABELS[item] ?? item).join(' · ')}</Text>}
                    {(species.traits.depthMinM !== null || species.traits.depthMaxM !== null) && <Text style={[typography.body, { color: colors.textSecondary }]}>Profundidad: {species.traits.depthMinM ?? 0}–{species.traits.depthMaxM ?? '?'} m</Text>}
                    {traitSources.length > 0 && <Text style={[typography.caption, { color: colors.textMuted }]}>Fuente: {[...new Set(traitSources)].join(' · ')}</Text>}
                  </View>}
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

            {species.observability && (
              <Staggered index={9}>
                <View style={[styles.note, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.lg }]}>
                  <Text style={[typography.label, { color: colors.text }]}>Observabilidad pública: {observabilityBand}</Text>
                  <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Índice {Math.round(species.observability.score)}/100 · {species.observability.occurrenceCount} registros · {species.observability.occupiedCells} celdas de 10 km · {species.observability.periodStart.slice(0, 4)}–{species.observability.periodEnd.slice(0, 4)}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 5 }]}>Es una medida automática de registros públicos, no una categoría de conservación ni una estimación poblacional.</Text>
                </View>
              </Staggered>
            )}

            <Staggered index={10}>
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

            <Staggered index={11}>
              <Pressable
                onPress={() => router.push({ pathname: '/report', params: { kind: 'review', area: 'species', codigo: species.codigo } } as unknown as Href)}
                style={[styles.reportButton, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.xxl }]}
              >
                <View style={styles.reportCopy}><BugIcon color={colors.textMuted} size={17} /><Text style={[typography.caption, { color: colors.textSecondary }]}>¿Encontraste un dato incorrecto?</Text></View>
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
      {species && <SpeciesSourcesSheet visible={sourcesOpen} species={species} onClose={() => setSourcesOpen(false)} />}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { flex: 1, overflow: 'hidden' },
  grabberHitArea: { height: 44, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 42, height: 4, borderRadius: 2 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 18 },
  action: { padding: 9, borderRadius: 12 },
  classIdentity: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  classGlyph: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  optionsMenu: { position: 'absolute', top: 84, zIndex: 40, minWidth: 188, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  optionItem: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1 },
  infoAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scientific: { fontStyle: 'italic', marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 9, paddingVertical: 5 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { flexGrow: 1, flexBasis: '46%', padding: 12 },
  traits: { padding: 14 },
  traitsHeader: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  traitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  photoCredit: { alignSelf: 'flex-start', paddingTop: 7, paddingHorizontal: 3 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dataTag: { paddingHorizontal: 11, paddingVertical: 7 },
  note: { padding: 14 },
  noteHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  classification: { overflow: 'hidden', paddingHorizontal: 14 },
  classificationRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  classificationValue: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  reportButton: { minHeight: 52, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportCopy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
