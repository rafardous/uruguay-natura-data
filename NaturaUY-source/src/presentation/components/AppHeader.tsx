import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../haptics';
import { useTheme } from '../theme/ThemeProvider';
import { MenuIcon } from './TabIcons';

export interface AppHeaderProps {
  eyebrow?: string;
  title?: string;
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

      {(eyebrow || title || badge) && (
        <View
          style={[styles.titleRow, { marginTop: spacing.lg }]}
        >
          <View style={styles.flex}>
            {eyebrow && <Text style={[typography.eyebrow, { color: colors.textMuted }]}>{eyebrow}</Text>}
            {title && <Text style={[typography.headerTitle, { color: colors.text, marginTop: eyebrow ? 4 : 0 }]}>{title}</Text>}
          </View>

          {badge && (
            <View style={[styles.badge, { backgroundColor: colors.primaryContainer, borderRadius: radius.pill }]}>
              <Text style={[typography.caption, { color: colors.onPrimaryContainer }]}>{badge}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // A suspended circle rather than a bare glyph pinned to the layout grid.
  menuButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  flex: { flex: 1 },
  badge: { paddingHorizontal: 12, paddingVertical: 7 },
});
