import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export interface ConservationBadgeProps {
  label: string;
  rank: number;
  /** Species accent, so the badge sits inside the card's colour story. */
  accent: string;
  container: string;
  onContainer: string;
}

/**
 * Threatened species (rank 3) get the alert colour; everything else stays in
 * the species' own accent so the card does not shout without reason.
 */
export function ConservationBadge({
  label,
  rank,
  accent,
  container,
  onContainer,
}: ConservationBadgeProps): React.JSX.Element {
  const { colors, radius, typography } = useTheme();

  const threatened = rank >= 3;
  const background = threatened ? colors.danger : container;
  const foreground = threatened ? colors.onDanger : onContainer;

  return (
    <View style={[styles.badge, { backgroundColor: background, borderRadius: radius.sm }]}>
      {!threatened && <View style={[styles.dot, { backgroundColor: accent }]} />}
      <Text style={[typography.caption, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
