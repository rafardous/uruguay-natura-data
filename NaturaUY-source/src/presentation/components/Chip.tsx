import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';

import { haptics } from '../haptics';
import { useTheme } from '../theme/ThemeProvider';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Overrides the selected fill — used for species-accented chips. */
  accent?: string;
  onAccent?: string;
  style?: ViewStyle;
}

/** Selectable pill used for taxonomic ranks and filters. */
export function Chip({ label, selected = false, onPress, accent, onAccent, style }: ChipProps): React.JSX.Element {
  const { colors, radius, typography } = useTheme();

  const background = selected ? (accent ?? colors.primary) : colors.surfaceVariant;
  const foreground = selected ? (onAccent ?? colors.onPrimary) : colors.textSecondary;

  return (
    <Pressable
      // Every rank, taxon and filter chip runs through here, so the selection
      // tick is defined once instead of at each call site.
      onPress={
        onPress &&
        (() => {
          haptics.tick();
          onPress();
        })
      }
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <MotiView
        animate={{ backgroundColor: background, scale: selected ? 1 : 0.98 }}
        transition={{ type: 'timing', duration: 180 }}
        style={[styles.chip, { borderRadius: radius.pill }, style]}
      >
        <Text style={[typography.label, { color: foreground }]} numberOfLines={1}>
          {label}
        </Text>
      </MotiView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 9 },
});
