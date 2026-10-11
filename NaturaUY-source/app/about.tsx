import { Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { BackIcon, ChevronRightIcon } from '../src/presentation/components/TabIcons';
import { navigationBottomInset } from '../src/presentation/navigationPolicy';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function AboutScreen(): React.JSX.Element {
  const { colors, spacing, typography, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="Acerca de Arapy">
      <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><BackIcon color={colors.text} /></Pressable>
    </AppHeader>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: navigationBottomInset(insets.bottom, spacing.lg), gap: spacing.lg }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>Arapy es una guía de animales y plantas de Uruguay. Podés buscar especies, guardar tus favoritas y aprender con recorridos y juegos.</Text>
      <Text style={[typography.body, { color: colors.textSecondary }]}>El catálogo y tu progreso están disponibles sin conexión. Con internet podés descargar actualizaciones y, si iniciás sesión, sincronizar tus favoritos y récords.</Text>
      <Text style={[typography.body, { color: colors.textSecondary }]}>Cada ficha conserva las fuentes de sus datos y el crédito de sus fotos y sonidos. Si encontrás un error, podés reportarlo desde la ficha.</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push('/credits')} style={{ minHeight: 56, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={[typography.label, { color: colors.primary, flex: 1 }]}>Créditos y licencias</Text><ChevronRightIcon color={colors.primary} />
      </Pressable>
      <Text style={[typography.caption, { color: colors.textMuted }]}>Versión {Constants.expoConfig?.version ?? '—'}</Text>
    </ScrollView>
  </View>;
}
