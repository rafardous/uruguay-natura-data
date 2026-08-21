import { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { MotiView } from 'moti';

import type { Species } from '../../domain/entities/species';
import { thumbnailFor } from '../../data/assets/thumbMap';
import { useTheme } from '../theme/ThemeProvider';
import { FamilyGlyph } from './FamilyGlyph';
import { Skeleton } from './Skeleton';

export interface SpeciesImageProps {
  species: Species;
  height?: number;
  glyphSize?: number;
  style?: ViewStyle;
  /** Use the large variant — the detail sheet wants the sharper file. */
  full?: boolean;
  borderRadius?: number;
  /**
   * Off when the photo *is* the surface (the species card), where the hairline
   * would just trace a pale rectangle over the image instead of separating it
   * from anything.
   */
  bordered?: boolean;
}

/**
 * Every photo in the app renders through here, so the four states stay
 * consistent everywhere (cards, carousel, detail, quiz):
 *
 *  1. no photograph exists    -> family silhouette on a tinted ground (permanent)
 *  2. photograph is loading   -> skeleton shimmer with the same silhouette on top
 *  3. photograph loaded       -> fades in over the skeleton, replacing it outright
 *  4. photograph failed       -> the bundled offline thumbnail if there is one
 *                                 (shown plainly, not blended — no transient blur),
 *                                 otherwise the silhouette
 *
 * A blurred placeholder cross-fading into the sharp photo was tried first, but
 * it reads as "the image looks broken for a second" rather than a deliberate
 * loading state — a skeleton says "loading" unambiguously.
 */
export function SpeciesImage({
  species,
  height = 190,
  glyphSize = 56,
  style,
  full = false,
  borderRadius = 0,
  bordered = true,
}: SpeciesImageProps): React.JSX.Element {
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const thumb = thumbnailFor(species.photo?.thumbAsset ? species.codigo : null);
  const remote = full ? species.photo?.fullUrl : species.photo?.url;

  const noPhoto = !remote;
  const showSkeleton = !noPhoto && !loaded && !failed;
  const showOfflineFallback = !noPhoto && failed && thumb !== null;
  const showGlyph = noPhoto || (failed && thumb === null);

  return (
    <View
      style={[
        styles.container,
        /*
         * The placeholder ground is a theme neutral, not the species' own
         * accent. Per-species colour here meant a filtered list came back as a
         * grid of unrelated purples and teals, which read as noise — the accent
         * belongs on the detail sheet, where it marks one species at a time.
         */
        { height, borderRadius, backgroundColor: colors.surfaceVariant },
        style,
      ]}
    >
      {showSkeleton && <Skeleton width="100%" height="100%" radius={0} style={styles.fill} />}

      {(showGlyph || showSkeleton) && (
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 260 }}
          style={styles.center}
        >
          <FamilyGlyph clase={species.taxonomy.clase} color={colors.outline} size={glyphSize} opacity={0.5} />
        </MotiView>
      )}

      {showOfflineFallback && thumb !== null && (
        <Image
          source={thumb}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessibilityLabel={species.displayName}
        />
      )}

      {!noPhoto && !failed && (
        <Image
          source={{ uri: remote }}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
          recyclingKey={species.codigo}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={species.displayName}
        />
      )}

      {/* A hairline keeps pale photos from bleeding into a pale surface. */}
      {bordered && (
        <View
          pointerEvents="none"
          style={[styles.hairline, { borderRadius, borderColor: colors.border }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  hairline: { ...StyleSheet.absoluteFill, borderWidth: StyleSheet.hairlineWidth },
});
