import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../haptics';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, MenuIcon } from './TabIcons';

export interface AppHeaderProps {
  eyebrow?: string;
  title?: string;
  /** Right-hand pill, e.g. "2021 especies". */
  badge?: string;
  onOpenMenu?: () => void;
  onClose?: () => void;
  children?: React.ReactNode;
}

/** Shared top area, so every tab starts with the same rhythm. */
export function AppHeader({ eyebrow, title, badge, onOpenMenu, onClose, children }: AppHeaderProps): React.JSX.Element {
  const { colors, radius, spacing, typography, elevation } = useTheme();
  const insets = useSafeAreaInsets();

  if (onClose) return <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
    <View style={styles.sectionRow}>
      <View style={styles.flex}>
        {eyebrow && <Text style={[typography.eyebrow, { color: colors.textMuted, marginBottom: 5 }]}>{eyebrow}</Text>}
        {title && <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>{title}</Text>}
        {badge && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 5 }]}>{badge}</Text>}
      </View>
      <Pressable onPress={() => { haptics.tap(); onClose(); }} accessibilityRole="button" accessibilityLabel="Cerrar" style={({ pressed }) => [styles.closeButton, { backgroundColor: pressed ? colors.surfaceVariant : colors.surface }]}><CloseIcon color={colors.text} size={22} /></Pressable>
    </View>
  </View>;

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
        <View style={styles.actions}>{children}</View>
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56 },
  closeButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // A suspended circle rather than a bare glyph pinned to the layout grid.
  menuButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  flex: { flex: 1 },
  actions: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  badge: { paddingHorizontal: 12, paddingVertical: 7 },
});
