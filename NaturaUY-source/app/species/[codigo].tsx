import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';

import type { Species } from '../../src/domain/entities/species';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { ConservationBadge } from '../../src/presentation/components/ConservationBadge';
import { PhotoLightbox } from '../../src/presentation/components/PhotoLightbox';
import { Skeleton } from '../../src/presentation/components/Skeleton';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { CloseIcon, HeartIcon } from '../../src/presentation/components/TabIcons';
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
  const { radius, typography, colors } = useTheme();

  return (
    <View style={[styles.fact, { backgroundColor: container, borderRadius: radius.md }]}>
      <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[typography.label, { color: onContainer, marginTop: 3 }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Rendered inside a native `formSheet` (see app/_layout.tsx), so this screen owns
 * none of the sheet's own motion or backdrop — the OS drives the slide-up entry,
 * the dim behind it, and swipe-to-dismiss. This file only owns its content.
 */
export default function SpeciesDetailScreen(): React.JSX.Element {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography } = useTheme();
  const { isFavorite, toggle } = useFavorites();

  const [species, setSpecies] = useState<Species | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const palette = useSpeciesPalette(species);

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
        { label: 'Familia', value: species.taxonomy.familia },
        { label: 'Género', value: species.taxonomy.genero },
        { label: 'Orden', value: species.taxonomy.orden },
        { label: 'Tamaño', value: species.tamano },
        { label: 'Estado', value: species.conservation.label },
      ].filter((fact) => fact.value.length > 0)
    : [];

  return (
    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
      <View style={styles.grabberArea}>
        <View style={[styles.grabber, { backgroundColor: colors.outline }]} />
      </View>

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
        <ScrollView
          showsVerticalScrollIndicator={false}
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
          </View>

          <View style={{ padding: spacing.lg }}>
            <Staggered index={0}>
              <Text style={[typography.eyebrow, { color: palette.accent }]}>
                {species.taxonomy.clase.toUpperCase()} · {species.taxonomy.orden.toUpperCase()}
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
                    {species.nativa ? 'Nativa' : 'Exótica'}
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

            {species.descripcion.length > 0 && (
              <Staggered index={3}>
                <Text style={[typography.label, { color: palette.accent, marginTop: spacing.xl }]}>Descripción</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
                  {species.descripcion}
                </Text>
              </Staggered>
            )}

            {species.alimentacion.length > 0 && (
              <Staggered index={4}>
                <Text style={[typography.label, { color: palette.accent, marginTop: spacing.lg }]}>Alimentación</Text>
                <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
                  {species.alimentacion}
                </Text>
              </Staggered>
            )}

            {species.acceptedName && species.acceptedName !== species.scientificName && (
              <Staggered index={5}>
                <Text style={[typography.label, { color: palette.accent, marginTop: spacing.lg }]}>
                  Nombre aceptado
                </Text>
                <Text style={[typography.body, styles.scientific, { color: colors.textSecondary, marginTop: 6 }]}>
                  {species.acceptedName}
                </Text>
              </Staggered>
            )}

            {/* CC BY obliges us to credit the photographer wherever the photo appears. */}
            {species.photo && species.photo.attribution.length > 0 && (
              <Staggered index={6}>
                <Pressable
                  onPress={() => species.photo?.page && void Linking.openURL(species.photo.page)}
                  disabled={!species.photo.page}
                  style={[styles.credit, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, marginTop: spacing.xl }]}
                >
                  <Text style={[typography.caption, { color: colors.textMuted }]}>FOTOGRAFÍA</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                    {species.photo.attribution}
                  </Text>
                </Pressable>
              </Staggered>
            )}
          </View>
        </ScrollView>
      )}

      <PhotoLightbox
        visible={lightboxOpen}
        uri={species?.photo?.fullUrl}
        label={species?.displayName ?? ''}
        onClose={() => setLightboxOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  grabberArea: { alignItems: 'center', paddingVertical: 10 },
  grabber: { width: 44, height: 4, borderRadius: 2, opacity: 0.4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 18 },
  action: { padding: 9, borderRadius: 12 },
  scientific: { fontStyle: 'italic', marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 9, paddingVertical: 5 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: { flexGrow: 1, flexBasis: '46%', padding: 12 },
  credit: { padding: 12 },
});
