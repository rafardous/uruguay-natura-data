import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import Svg, { Path } from 'react-native-svg';

import type { Species } from '../../domain/entities/species';
import { haptics } from '../haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Skeleton } from './Skeleton';
import { SpeciesImage } from './SpeciesImage';

/** Exported so a list can derive its row pitch instead of hard-coding one. */
export const CARD_HEIGHT = 268;

/**
 * Text over a photograph sits on solid panels, not a gradient fade.
 * A fade has no edge, so it reads as an effect applied to the image; a panel
 * with a real boundary reads as a deliberate piece of the layout.
 */
const ON_PHOTO = '#FFFFFF';
const ON_PHOTO_MUTED = 'rgba(255,255,255,0.72)';
const PANEL = 'rgba(14,24,17,0.82)';

function HeartIcon({ filled, color }: { filled: boolean; color: string }): React.JSX.Element {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Path
        d="M12 20.5 3.8 12.3a5.2 5.2 0 0 1 7.4-7.3l.8.8.8-.8a5.2 5.2 0 1 1 7.4 7.3z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export interface SpeciesCardProps {
  species: Species;
  favorite: boolean;
  /**
   * Take the código rather than a pre-bound closure: a parent that builds
   * `() => open(item.codigo)` inside `renderItem` hands every card a new
   * function on each render, which silently defeats the `memo` below.
   */
  onPress: (codigo: string) => void;
  onToggleFavorite: (codigo: string) => void;
  /** Staggers entry so a freshly loaded page cascades instead of popping. */
  index?: number;
}

/**
 * Past this many rows the entry animation is pure cost: the cards are offscreen
 * when they mount, so nobody sees the fade, and on a fast scroll it competes
 * with the list for frame budget.
 */
const ANIMATED_ROWS = 8;

/**
 * The photograph is the card — it fills the whole surface and the text rides on
 * a gradient veil over it.
 *
 * Previously the image was a banner with a separate white text block bolted
 * underneath, which is the anatomy of an article teaser on a web page. Letting
 * the photo bleed to every edge is what makes a browsing list feel like a
 * gallery instead of a feed.
 */
export const SpeciesCard = memo(function SpeciesCard({
  species,
  favorite,
  onPress,
  onToggleFavorite,
  index = 0,
}: SpeciesCardProps): React.JSX.Element {
  const { colors, radius, spacing, typography, elevation } = useTheme();

  const threatened = species.conservation.rank >= 3;
  // `displayName` falls back to the binomial when a species has no vernacular
  // name, and most plants don't — printing both then repeats the same words.
  const showScientific = species.scientificName !== species.displayName;

  const animated = index < ANIMATED_ROWS;
  const Wrapper = animated ? MotiView : View;
  const motion = animated
    ? {
        from: { opacity: 0, translateY: 7 },
        animate: { opacity: 1, translateY: 0 },
        transition: { type: 'timing' as const, duration: 240, delay: Math.min(index, 5) * 30 },
      }
    : {};

  return (
    <Wrapper {...motion}>
      <View style={[styles.shadow, elevation.low, { borderRadius: radius.xl, backgroundColor: colors.surface }]}>
        <View style={[styles.card, { borderRadius: radius.xl, backgroundColor: colors.surface }]}>
          <Pressable
            onPress={() => {
              haptics.tap();
              onPress(species.codigo);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${species.displayName}, ${species.scientificName}`}
            style={({ pressed }) => [styles.cardAction, { opacity: pressed ? 0.94 : 1 }]}
          >
            <SpeciesImage species={species} height={CARD_HEIGHT} borderRadius={radius.xl} glyphSize={78} bordered={false} style={styles.photo} />

            <View style={[styles.topRow, { padding: spacing.md }]}>
              <View style={[styles.chip, { borderRadius: radius.sm }]}>
                <Text style={[typography.caption, { color: ON_PHOTO }]}>{species.taxonomy.clase}</Text>
              </View>
            </View>

            <View style={[styles.panel, { margin: spacing.md, borderRadius: radius.lg, padding: spacing.md }]}>
              <Text style={[typography.cardTitle, { color: ON_PHOTO }]} numberOfLines={1}>{species.displayName}</Text>
              {showScientific && (
                <Text style={[typography.body, styles.scientific, { color: ON_PHOTO_MUTED }]} numberOfLines={1}>{species.scientificName}</Text>
              )}
              <View style={[styles.meta, { marginTop: spacing.sm }]}>
                {threatened ? (
                  <View style={[styles.status, { borderRadius: radius.sm, backgroundColor: colors.danger }]}>
                    <Text style={[typography.caption, { color: colors.onDanger }]} numberOfLines={1}>{species.conservation.label}</Text>
                  </View>
                ) : (
                  <Text style={[typography.caption, { color: ON_PHOTO_MUTED }]} numberOfLines={1}>{species.conservation.label}</Text>
                )}
                <Text style={[typography.caption, styles.family, { color: ON_PHOTO_MUTED }]} numberOfLines={1}>{species.taxonomy.familia}</Text>
              </View>
            </View>
          </Pressable>
          <Pressable
            onPress={() => { haptics.press(); onToggleFavorite(species.codigo); }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={favorite ? `Quitar ${species.displayName} de favoritos` : `Guardar ${species.displayName} en favoritos`}
            style={[styles.heart, { borderRadius: radius.sm }]}
          >
            <MotiView animate={{ scale: favorite ? 1.12 : 1 }} transition={{ type: 'spring', damping: 12 }}>
              <HeartIcon filled={favorite} color={favorite ? colors.favorite : ON_PHOTO} />
            </MotiView>
          </Pressable>
        </View>
      </View>
    </Wrapper>
  );
});

/** Matches SpeciesCard's geometry so the list does not reflow when data lands. */
export function SpeciesCardSkeleton(): React.JSX.Element {
  const { colors, radius } = useTheme();

  return (
    <View style={{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface }}>
      <Skeleton height={CARD_HEIGHT} radius={radius.xl} />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { height: CARD_HEIGHT },
  card: { height: CARD_HEIGHT, overflow: 'hidden' },
  cardAction: { flex: 1 },
  photo: { ...StyleSheet.absoluteFill, height: CARD_HEIGHT },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  chip: { backgroundColor: PANEL, paddingHorizontal: 10, paddingVertical: 5 },
  heart: { position: 'absolute', top: 12, right: 12, backgroundColor: PANEL, padding: 9 },
  panel: { marginTop: 'auto', backgroundColor: PANEL },
  scientific: { fontStyle: 'italic', marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { paddingHorizontal: 9, paddingVertical: 3 },
  family: { marginLeft: 'auto', flexShrink: 1 },
});
