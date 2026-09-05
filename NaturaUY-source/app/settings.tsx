import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { AppHeader } from '../src/presentation/components/AppHeader';
import { ChevronRightIcon, CloseIcon } from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

const MODES = [
  { id: 'light', label: 'Claro', hint: 'Siempre en tonos claros', disabled: false },
  { id: 'dark', label: 'Oscuro', hint: 'Próximamente', disabled: true },
];

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader eyebrow="PREFERENCIAS" title="Configuración">
        <View style={styles.row}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver" style={{ marginLeft: 'auto' }}>
            <CloseIcon color={colors.text} />
          </Pressable>
        </View>
      </AppHeader>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={[typography.eyebrow, { color: colors.textMuted }]}>APARIENCIA</Text>

        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}>
          {MODES.map((option, index) => {
            const selected = option.id === 'light';

            return (
              <Pressable
                key={option.id}
                onPress={() => haptics.tick()}
                disabled={option.disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.option,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
                <View style={styles.flex}>
                  <Text style={[typography.label, { color: option.disabled ? colors.textMuted : colors.text }]}>{option.label}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{option.hint}</Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    { borderColor: selected ? colors.primary : colors.outline },
                  ]}
                >
                  {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[typography.eyebrow, { color: colors.textMuted, marginTop: spacing.xl }]}>ACERCA DE</Text>

        <Pressable
          onPress={() => router.push({ pathname: '/report', params: { kind: 'bug' } } as unknown as Href)}
          style={[styles.group, styles.linkRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}
        >
          <View style={styles.flex}>
            <Text style={[typography.label, { color: colors.text }]}>Reportar un problema</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Requiere iniciar sesión para evitar spam</Text>
          </View>
          <ChevronRightIcon color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: '/report', params: { kind: 'suggestion' } } as unknown as Href)}
          style={[styles.group, styles.linkRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}
        >
          <View style={styles.flex}>
            <Text style={[typography.label, { color: colors.text }]}>Enviar una sugerencia</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Ideas breves para mejorar la aplicación o el catálogo</Text>
          </View>
          <ChevronRightIcon color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/credits')}
          style={[styles.group, styles.linkRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}
        >
          <View style={styles.flex}>
            <Text style={[typography.label, { color: colors.text }]}>Créditos y licencias</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Fuentes de datos y autoría de las fotografías
            </Text>
          </View>
          <ChevronRightIcon color={colors.textMuted} />
        </Pressable>

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, textAlign: 'center' }]}>
          Natura UY · versión 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  group: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
