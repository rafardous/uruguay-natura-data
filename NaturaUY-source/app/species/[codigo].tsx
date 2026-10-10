import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import Animated, {
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Species } from '../../src/domain/entities/species';
import { abundanceLabel, dietLabel, habitatLabel, seasonalityLabel } from '../../src/domain/catalogLabels';
import { formatSpeciesMeasurement } from '../../src/domain/services/measurementFormatting';
import {
  speciesRepository,
  type TaxonRank,
} from '../../src/data/repositories/speciesRepository';
import { ConservationBadge } from '../../src/presentation/components/ConservationBadge';
import { PhotoLightbox } from '../../src/presentation/components/PhotoLightbox';
import { BirdFieldGuide } from '../../src/presentation/components/BirdFieldGuide';
import { SpeciesSourcesSheet } from '../../src/presentation/components/SpeciesSourcesSheet';
import { SpeciesPhotoCarousel } from '../../src/presentation/components/SpeciesPhotoCarousel';
import { MeasurementHelp } from '../../src/presentation/components/MeasurementHelp';
import { SpeciesNames, SpeciesTaxonomy } from '../../src/presentation/components/SpeciesIdentity';
import { BirdConservation, BirdSpeciesDescription } from '../../src/presentation/components/BirdSpeciesDetails';
import { speciesGallery } from '../../src/domain/services/speciesGallery';
import { SpeciesAudioButton } from '../../src/presentation/components/SpeciesAudioButton';
import { SpeciesEcologyTags } from '../../src/presentation/components/SpeciesEcologyTags';
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

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const plantMonths = (months: number[] | undefined): string => [...new Set(months ?? [])]
  .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
  .sort((a, b) => a - b).map((month) => MONTHS[month - 1]).join(' · ');
const plantHeight = (height: { min: number | null; max: number | null } | undefined): string | null => {
  if (!height) return null;
  const format = (cm: number) => cm >= 100 ? `${Number((cm / 100).toFixed(2))} m` : `${cm} cm`;
  if (height.min && height.max) return `${format(height.min)}–${format(height.max)}`;
  if (height.min) return `desde ${format(height.min)}`;
  if (height.max) return `hasta ${format(height.max)}`;
  return null;
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
  const [photoIndex, setPhotoIndex] = useState(0);
  const [relevantInfoOpen, setRelevantInfoOpen] = useState(false);
  const [sizeDetailsOpen, setSizeDetailsOpen] = useState(false);
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
    if (router.canGoBack()) router.back();
    else router.replace('/');
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

  const bodyLength = species?.measurements.find((item) => item.kind === 'body_length') ?? species?.measurements.find((item) => item.kind === 'max_length');
  const bodyMass = species?.measurements.find((item) => item.kind === 'body_mass');
  const detailedMeasurements = species?.measurements.filter((item) => !['body_length', 'max_length', 'body_mass'].includes(item.kind)) ?? [];
  const facts = species?.seasonality && !['unknown', 'uncertain'].includes(species.seasonality)
    ? [{ label: 'Estacionalidad', value: seasonalityLabel(species.seasonality) }] : [];

  const classification: { label: string; rank: TaxonRank; value: string }[] = species
    ? [
        { label: 'Filo', rank: 'phylum', value: species.taxonomy.phylum },
        ...(species.taxonomy.subfilo ? [{ label: 'Subfilo', rank: 'subfilo' as const, value: species.taxonomy.subfilo }] : []),
        { label: 'Clase', rank: 'clase', value: species.taxonomy.clase },
        ...(species.taxonomy.orden ? [{ label: 'Orden', rank: 'orden' as const, value: species.taxonomy.orden }] : []),
        { label: 'Familia', rank: 'familia', value: species.taxonomy.familia },
        { label: 'Género', rank: 'genero', value: species.taxonomy.genero },
      ]
    : [];

  const hasMeasurements = Boolean(species?.measurements.length);
  const ecology = species?.ecology;
  const hasEcology = Boolean(ecology && Object.entries(ecology).some(([key, value]) => key.startsWith('depth') ? value !== null : Array.isArray(value) && value.length));
  const conservationHeadline = species?.conservation.nationalDesignations.includes('threatened') ? 'Amenazada en Uruguay'
    : species?.conservation.nationalDesignations.includes('priority') ? 'Prioritaria para la conservación' : null;
  const hasRelevantInfo = Boolean(species?.relevantNote || species?.facts.length);
  const galleryItems = species ? speciesGallery(species) : [];
  const selectedPhoto = galleryItems[Math.min(photoIndex, galleryItems.length - 1)];
  const isBird = species?.taxonomy.clase === 'Aves';
  const arthropodHistory = species?.naturalHistory?.arthropod;
  const plantHistory = species?.naturalHistory?.plant;
  const birdHistory = species?.naturalHistory?.bird;
  const observabilityBand = species?.observability?.band === 'high' ? 'Alta'
    : species?.observability?.band === 'medium' ? 'Media'
      : species?.observability?.band === 'low' ? 'Baja' : 'Datos insuficientes';

  const openTaxonomyAt = (rank: TaxonRank): void => {
    if (!species) return;
    haptics.tap();
    const values: Record<TaxonRank, string> = { phylum:species.taxonomy.phylum,subfilo:species.taxonomy.subfilo??'',clase:species.taxonomy.clase,orden:species.taxonomy.orden,familia:species.taxonomy.familia,genero:species.taxonomy.genero };
    void speciesRepository.resolveLegacyTaxon(db,rank,values[rank]).then((taxonId)=>router.push({pathname:'/taxonomy',params:{...(taxonId?{taxonId}:{[rank]:values[rank]}),returnToSpecies:species.codigo}}));
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
          entering={FadeIn.duration(180)}
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
            {galleryItems.length > 0 ? <SpeciesPhotoCarousel key={species.codigo} items={galleryItems} index={photoIndex} onIndexChange={setPhotoIndex} onPress={() => setLightboxOpen(true)} label={species.displayName} radius={radius.lg} foreground="#FFFFFF" background={colors.surfaceVariant} /> : <SpeciesImage species={species} height={184} full borderRadius={radius.lg} glyphSize={78} />}
            {selectedPhoto && <Pressable accessibilityRole="button" accessibilityLabel="Ver autoría y licencia de esta imagen" hitSlop={7} style={[styles.photoCredit, { minHeight: 30, justifyContent: 'center' }]} onPress={() => Alert.alert('Autoría y derechos', `${selectedPhoto.attribution || 'Autoría no registrada'}\n${selectedPhoto.license === 'permission' ? 'Autorización del autor' : selectedPhoto.license || 'Licencia no registrada'}`, [...(selectedPhoto.page ? [{ text: 'Ver fuente', onPress: () => { void Linking.openURL(selectedPhoto.page!); } }] : []), { text: 'Cerrar' }])}>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11 }]} numberOfLines={1}>{selectedPhoto.attribution || 'Autoría y derechos'} · ⓘ</Text>
            </Pressable>}
            <SpeciesAudioButton species={species} />
          </View>

          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm }}>
            <Staggered index={0}>
              <View style={styles.nameRow}>
                <SpeciesNames species={species} accent={palette.accent} />
                {hasRelevantInfo && <Pressable onPress={() => { haptics.tap(); setRelevantInfoOpen((open) => !open); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={relevantInfoOpen ? 'Ocultar información relevante' : 'Mostrar información relevante'} accessibilityState={{ expanded: relevantInfoOpen }} style={[styles.infoAction, { backgroundColor: palette.accent, borderRadius: radius.pill }]}><InfoIcon color="#FFFFFF" size={23} /></Pressable>}
              </View>
              {/* Only when it adds something: `displayName` is the binomial itself
                  whenever a species has no vernacular name. */}
              {species.scientificName !== species.displayName && (
                <Text style={[typography.body, styles.scientific, { color: colors.textSecondary }]}>
                  {species.scientificName}
                </Text>
              )}
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

            <SpeciesTaxonomy items={classification.filter((item) => Boolean(item.value))} onNavigate={openTaxonomyAt} accent={palette.accent} />

            <Staggered index={1}>
              <View style={[styles.badgeRow, { marginTop: spacing.md }]}>
                {conservationHeadline && <ConservationBadge label={conservationHeadline} rank={species.conservation.nationalDesignations.includes('threatened') ? 3 : 2} accent={palette.accent} container={palette.container} onContainer={palette.onContainer} />}
                {species.conservation.nationalDesignations.includes('snap') && <ConservationBadge label="Vinculada al SNAP" rank={2} accent={palette.accent} container={palette.container} onContainer={palette.onContainer} />}
                <View style={[styles.pill, { backgroundColor: palette.container, borderRadius: radius.sm }]}>
                  <Text style={[typography.caption, { color: palette.onContainer }]}>
                    {species.origin === 'native'
                      ? 'Nativa'
                      : species.origin === 'introduced'
                        ? 'Exótica'
                        : 'Origen sin determinar'}
                  </Text>
                </View>
                {!isBird && species.abundanceStatus && <View style={[styles.pill, { backgroundColor: palette.container, borderRadius: radius.sm }]}><Text style={[typography.caption, { color: palette.onContainer }]}>Abundancia: {abundanceLabel(species.abundanceStatus)}</Text></View>}
              </View>
              {isBird && <BirdConservation key={`conservation-${species.codigo}`} species={species} />}
            </Staggered>



            {isBird && <BirdFieldGuide key={`guide-${species.codigo}`} bird={birdHistory} species={species} accent={palette.accent} container={palette.container} foreground={palette.onContainer} />}
            {!isBird && facts.length > 0 && (
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

            {!isBird && <>
            {hasMeasurements && (
              <Staggered index={3}>
                <View style={[styles.traits, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.lg }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={[typography.label, { color: palette.accent }]}>Tamaño</Text><MeasurementHelp accent={palette.accent} /></View>
                  {[bodyLength, bodyMass].filter((item): item is NonNullable<typeof item> => Boolean(item)).map((measurement) => <View key={measurement.kind} style={styles.traitRow}><Text style={[typography.caption, { color: colors.textMuted }]}>{TRAIT_LABELS[measurement.kind]}</Text><Text style={[typography.label, { color: colors.text }]}>{formatSpeciesMeasurement(measurement)}{measurement.provenance === 'legacy_unverified' ? ' · aproximado' : ''}</Text></View>)}
                  {detailedMeasurements.length > 0 && <><Pressable onPress={() => setSizeDetailsOpen((open) => !open)} accessibilityRole="button" accessibilityLabel="Medidas detalladas" accessibilityState={{ expanded: sizeDetailsOpen }} style={styles.traitsHeader}><Text style={[typography.label, { color: colors.text }]}>Medidas detalladas</Text><Text style={[typography.label, { color: palette.accent }]}>{sizeDetailsOpen ? '−' : '+'}</Text></Pressable>{sizeDetailsOpen && detailedMeasurements.map((measurement) => <View key={measurement.kind} style={styles.traitRow}><Text style={[typography.caption, { color: colors.textMuted }]}>{TRAIT_LABELS[measurement.kind]}</Text><Text style={[typography.label, { color: colors.text }]}>{formatSpeciesMeasurement(measurement)}</Text></View>)}</>}
                </View>
              </Staggered>
            )}

            {hasEcology && ecology && (
              <Staggered index={3}>
                <View style={[styles.traits, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.lg }]}>
                  <Text style={[typography.label, { color: palette.accent }]}>Ecología</Text>
                  <SpeciesEcologyTags title="Dónde vive" values={[...ecology.habitats.map(habitatLabel), ...ecology.vegetationFormations]} accent={palette.accent} />
                  <SpeciesEcologyTags title="Qué come" values={ecology.diet.map(dietLabel)} accent={palette.accent} />
                  {ecology.lifeModes.length > 0 && <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>Modo de vida: {ecology.lifeModes.map((item) => TRAIT_LABELS[item] ?? item).join(' · ')}</Text>}
                  {ecology.activity.length > 0 && <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>Actividad: {ecology.activity.map((item) => TRAIT_LABELS[item] ?? item).join(' · ')}</Text>}
                  <View style={{ gap: 6, marginTop: 6 }}>
                    {ecology.aquaticEnvironments.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Ambiente acuático: {ecology.aquaticEnvironments.map((item) => TRAIT_LABELS[item] ?? item).join(' · ')}</Text>}
                    {(ecology.depthMinM !== null || ecology.depthMaxM !== null) && <Text style={[typography.body, { color: colors.textSecondary }]}>Profundidad: {ecology.depthMinM ?? 0}–{ecology.depthMaxM ?? '?'} m</Text>}
                    {ecology.waterZones.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Zona: {ecology.waterZones.map((item) => TRAIT_LABELS[item] ?? item).join(' · ')}</Text>}
                    {ecology.microhabitats.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Microhábitat: {ecology.microhabitats.join(' · ')}</Text>}
                    {ecology.trophicRoles.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Rol trófico: {ecology.trophicRoles.join(' · ')}</Text>}
                    {ecology.hosts.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Hospedadores: {ecology.hosts.join(' · ')}</Text>}
                    {ecology.plantAssociations.length > 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Asociaciones: {ecology.plantAssociations.join(' · ')}</Text>}
                  </View>
                </View>
              </Staggered>
            )}

            {arthropodHistory && (
              <Staggered index={7}>
                <View style={[styles.naturalHistory, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.xl }]}>
                  <Text style={[typography.label, { color: palette.accent }]}>Historia natural</Text>
                  {arthropodHistory.morphology && <>
                    {arthropodHistory.morphology.bodyRegions?.length ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 7 }]}>Regiones corporales: {arthropodHistory.morphology.bodyRegions.join(' · ')}</Text> : null}
                    {arthropodHistory.morphology.legs ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Patas: {arthropodHistory.morphology.legs}</Text> : null}
                    {arthropodHistory.morphology.exoskeleton ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Exoesqueleto: {arthropodHistory.morphology.exoskeleton}</Text> : null}
                    {arthropodHistory.morphology.antennae ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Antenas: {arthropodHistory.morphology.antennae}</Text> : null}
                    {arthropodHistory.morphology.wings ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Alas: {arthropodHistory.morphology.wings}</Text> : null}
                    {arthropodHistory.morphology.cheliceraePedipalps ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Quelíceros y pedipalpos: {arthropodHistory.morphology.cheliceraePedipalps}</Text> : null}
                  </>}
                  {arthropodHistory.identification?.diagnosticCharacters?.length ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 7 }]}>Para reconocerlo: {arthropodHistory.identification.diagnosticCharacters.join(' · ')}</Text> : null}
                  {arthropodHistory.identification?.similarSpecies?.length ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Especies similares: {arthropodHistory.identification.similarSpecies.join(' · ')}</Text> : null}
                  {arthropodHistory.lifeCycle?.stages?.length ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Ciclo de vida: {arthropodHistory.lifeCycle.stages.join(' · ')}</Text> : null}
                  {arthropodHistory.lifeCycle?.metamorphosis ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Metamorfosis: {arthropodHistory.lifeCycle.metamorphosis === 'complete' ? 'completa' : arthropodHistory.lifeCycle.metamorphosis === 'incomplete' ? 'incompleta' : arthropodHistory.lifeCycle.metamorphosis === 'none' ? 'sin metamorfosis' : 'variable'}</Text> : null}
                  {arthropodHistory.humanRelevance && (arthropodHistory.humanRelevance.vector || arthropodHistory.humanRelevance.pest || arthropodHistory.humanRelevance.venomous || arthropodHistory.humanRelevance.veterinaryImportance) ? <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>Indicadores documentados: {[arthropodHistory.humanRelevance.vector && 'vector', arthropodHistory.humanRelevance.pest && 'plaga', arthropodHistory.humanRelevance.venomous && 'veneno', arthropodHistory.humanRelevance.veterinaryImportance && 'importancia veterinaria'].filter(Boolean).join(' · ')}</Text> : null}
                  {arthropodHistory.humanRelevance?.note ? <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>Relevancia humana: {arthropodHistory.humanRelevance.note}</Text> : null}
                </View>
              </Staggered>
            )}

            {plantHistory && (
              <Staggered index={7}>
                <View style={[styles.naturalHistory, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.xl }]}>
                  <Text style={[typography.label, { color: palette.accent }]}>Perfil botánico</Text>
                  {plantHistory.habit ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 7 }]}>Tipo: {plantHistory.habit}</Text> : null}
                  {plantHistory.lifeForm ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Forma de vida: {plantHistory.lifeForm}</Text> : null}
                  {plantHeight(plantHistory.heightCm) ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Altura: {plantHeight(plantHistory.heightCm)}</Text> : null}
                  {plantMonths(plantHistory.phenology?.floweringMonths) ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Floración: {plantMonths(plantHistory.phenology?.floweringMonths)}</Text> : null}
                  {plantMonths(plantHistory.phenology?.fruitingMonths) ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>Fructificación: {plantMonths(plantHistory.phenology?.fruitingMonths)}</Text> : null}
                  {plantHistory.nomenclature?.familyAliases?.length ? <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Familia también conocida como: {plantHistory.nomenclature.familyAliases.join(' · ')}</Text> : null}
                </View>
              </Staggered>
            )}

            {(species.conservation.nationalRedList || species.conservation.iucnGlobal) && (
              <Staggered index={8}>
                <View style={[styles.note, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.lg }]}>
                  <Text style={[typography.label, { color: colors.text }]}>Evaluaciones de conservación</Text>
                  {species.conservation.nationalRedList && <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>Lista Roja Uruguay: {species.conservation.nationalRedList.category}</Text>}
                  {species.conservation.iucnGlobal && <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>UICN global: {species.conservation.iucnGlobal.category}</Text>}
                </View>
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

            </>}
            <BirdSpeciesDescription key={`description-${species.codigo}`} species={species} />
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
        items={galleryItems}
        initialIndex={photoIndex}
        onIndexChange={setPhotoIndex}
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
  traitsHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  traitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  photoCredit: { alignSelf: 'flex-start', paddingTop: 1, paddingHorizontal: 3 },
  naturalHistory: { padding: 14 },
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
