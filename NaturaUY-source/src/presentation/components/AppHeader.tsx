import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';

import { haptics } from '../haptics';
import { useTheme } from '../theme/ThemeProvider';
import { MenuIcon } from './TabIcons';

export interface AppHeaderProps {
  eyebrow: string;
  title: string;
  /** Right-hand pill, e.g. "2021 especies". */
  badge?: string;
  onOpenMenu?: () => void;
  children?: React.ReactNode;
}

/** Shared top area, so every tab starts with the same rhythm. */
export function AppHeader({ eyebrow, title, badge, onOpenMenu, children }: AppHeaderProps): React.JSX.Element {
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg }}>
      <View style={styles.topRow}>
        {onOpenMenu && (
          <Pressable
            onPress={() => {
              haptics.tap();
              onOpenMenu();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú"
            style={({ pressed }) => [
              styles.menuButton,
              elevation.low,
              {
                borderRadius: radius.pill,
                backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
              },
            ]}
          >
            <MenuIcon color={colors.text} />
          </Pressable>
        )}
        <View style={styles.flex}>{children}</View>
      </View>

      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 320 }}
        style={[styles.titleRow, { marginTop: spacing.lg }]}
      >
        <View style={styles.flex}>
          <Text style={[typography.eyebrow, { color: colors.textMuted }]}>{eyebrow}</Text>
          <Text style={[typography.display, { color: colors.text, marginTop: 4 }]}>{title}</Text>
        </View>

        {badge && (
          <View style={[styles.badge, { backgroundColor: colors.primaryContainer, borderRadius: radius.pill }]}>
            <Text style={[typography.caption, { color: colors.onPrimaryContainer }]}>{badge}</Text>
          </View>
        )}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // A suspended circle rather than a bare glyph pinned to the layout grid.
  menuButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  flex: { flex: 1 },
  badge: { paddingHorizontal: 12, paddingVertical: 7 },
});
