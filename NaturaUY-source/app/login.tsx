import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { BackIcon, LoginIcon } from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography, elevation } = useTheme();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg },
      ]}
    >
      <Pressable
        onPress={() => {
          haptics.tap();
          router.back();
        }}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={({ pressed }) => [
          styles.back,
          {
            backgroundColor: pressed ? colors.surfaceContainer : colors.surface,
            borderColor: colors.border,
            borderRadius: radius.pill,
          },
        ]}
      >
        <BackIcon color={colors.text} />
      </Pressable>

      <View
        style={[
          styles.card,
          elevation.medium,
          { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: colors.primaryContainer, borderRadius: radius.lg }]}>
          <LoginIcon color={colors.onPrimaryContainer} size={30} />
        </View>
        <Text style={[typography.title, { color: colors.text, marginTop: spacing.lg, textAlign: 'center' }]}>Inicio de sesión</Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>A ser implementado próximamente.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: { marginTop: 'auto', marginBottom: 'auto', alignItems: 'center' },
  icon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
});
