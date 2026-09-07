import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import Svg, { Path } from 'react-native-svg';

import type { Species } from '../../domain/entities/species';
import { haptics } from '../haptics';
import { useTheme } from '../theme/ThemeProvider';
import { SpeciesImage } from './SpeciesImage';
import { FavoriteSparkles } from './FavoriteSparkles';

export const COMPACT_ROW_HEIGHT = 112;

function Heart({ filled, color }: { filled: boolean; color: string }): React.JSX.Element {
  return <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M12 20.5 3.8 12.3a5.2 5.2 0 0 1 7.4-7.3l.8.8.8-.8a5.2 5.2 0 1 1 7.4 7.3z" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinejoin="round" /></Svg>;
}

export const CompactSpeciesRow = memo(function CompactSpeciesRow({
  species,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  species: Species;
  favorite: boolean;
  onPress: (codigo: string) => void;
  onToggleFavorite: (codigo: string) => void;
}): React.JSX.Element {
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const [sparkleTrigger, setSparkleTrigger] = useState(0);
  const threatened = species.conservation.rank >= 3;
  const showScientific = species.scientificName !== species.displayName;
  return (
    <View>
      <View style={[styles.shadow, elevation.low, { borderRadius: radius.lg, backgroundColor: colors.surface }]}>
        <Pressable
          onPress={() => { haptics.tap(); onPress(species.codigo); }}
          accessibilityRole="button"
          accessibilityLabel={`${species.displayName}, ${species.scientificName}`}
          style={({ pressed }) => [styles.row, { borderRadius: radius.lg, backgroundColor: colors.surface, opacity: pressed ? 0.94 : 1 }]}
        >
          <SpeciesImage species={species} height={104} borderRadius={radius.md} glyphSize={38} bordered={false} style={styles.image} />
          <View style={[styles.copy, { paddingVertical: spacing.sm, paddingLeft: spacing.sm }]}>
            <Text style={[typography.cardTitle, { color: colors.text }]} numberOfLines={1}>{species.displayName}</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>{species.taxonomy.clase}</Text>
            <View style={styles.meta}>
              {showScientific && <Text style={[typography.caption, styles.scientific, { color: colors.textSecondary }]} numberOfLines={1}>{species.scientificName}</Text>}
              <View style={[styles.status, { backgroundColor: threatened ? colors.danger : colors.surfaceVariant, borderRadius: radius.sm }]}>
                <Text style={[typography.caption, { color: threatened ? colors.onDanger : colors.textSecondary }]} numberOfLines={1}>{species.conservation.label}</Text>
              </View>
            </View>
          </View>
        </Pressable>
        <Pressable
          onPress={() => { haptics.press(); if (!favorite) setSparkleTrigger((value) => value + 1); onToggleFavorite(species.codigo); }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={favorite ? `Quitar ${species.displayName} de favoritos` : `Guardar ${species.displayName} en favoritos`}
          style={[styles.heart, { borderRadius: radius.sm }]}
        >
          <MotiView animate={{ scale: favorite ? 1.12 : 1 }} transition={{ type: 'spring', damping: 12 }}><Heart filled={favorite} color={favorite ? colors.favorite : colors.textSecondary} /></MotiView>
          <FavoriteSparkles trigger={sparkleTrigger} color={colors.favorite} />
        </Pressable>
      </View>
    </View>
  );
});

export function CompactSpeciesRowSkeleton(): React.JSX.Element {
  const { colors, radius } = useTheme();
  return <View style={[styles.skeleton, { backgroundColor: colors.surface, borderRadius: radius.lg }]}><View style={[styles.skeletonImage, { backgroundColor: colors.surfaceVariant, borderRadius: radius.md }]} /><View style={[styles.skeletonLine, { backgroundColor: colors.surfaceVariant }]} /><View style={[styles.skeletonSmall, { backgroundColor: colors.surfaceVariant }]} /></View>;
}

const styles = StyleSheet.create({
  shadow: { height: COMPACT_ROW_HEIGHT },
  row: { height: COMPACT_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', padding: 4 },
  image: { width: 104, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 6, marginTop: 6 },
  scientific: { fontStyle: 'italic', flex: 1, minWidth: 0 },
  status: { maxWidth: 122, paddingHorizontal: 6, paddingVertical: 2 },
  heart: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  skeleton: { height: COMPACT_ROW_HEIGHT, padding: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
  skeletonImage: { width: 104, height: 104 },
  skeletonLine: { width: '42%', height: 16, borderRadius: 8 },
  skeletonSmall: { width: '24%', height: 11, borderRadius: 6 },
});
