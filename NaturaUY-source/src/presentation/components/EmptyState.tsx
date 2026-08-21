import { StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';

import { useTheme } from '../theme/ThemeProvider';
import { FamilyGlyph } from './FamilyGlyph';

export interface EmptyStateProps {
  title: string;
  message: string;
  /** Drives which silhouette appears; defaults to the generic mark. */
  clase?: string;
}

export function EmptyState({ title, message, clase = '' }: EmptyStateProps): React.JSX.Element {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      style={[
        styles.wrapper,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.surfaceVariant, borderRadius: radius.pill }]}>
        <FamilyGlyph clase={clase} color={colors.outline} size={40} opacity={0.7} />
      </View>
      <Text style={[typography.title, styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[typography.body, styles.message, { color: colors.textMuted }]}>{message}</Text>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  icon: { padding: 18, marginBottom: 16 },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', marginTop: 6 },
});
