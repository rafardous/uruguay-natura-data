import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { BackIcon } from '../src/presentation/components/TabIcons';
import { useTheme } from '../src/presentation/theme/ThemeProvider';
import { navigationBottomInset } from '../src/presentation/navigationPolicy';

const CREDITS = [
  { name: 'Rafael Rinaldi', detail: 'Desarrollo de Arapy.' },
  { name: 'Agustín Morelle', detail: 'Estragón.' },
  { name: 'Pedro Rinaldi', detail: 'Fotografías de aves, utilizadas con autorización.' },
  { name: 'Adrián B. Azpiroz', detail: 'Aves del Uruguay (2003), referencia para las fichas de aves.' },
];

export default function CreditsScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="Créditos y licencias">
      <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><BackIcon color={colors.text} /></Pressable>
    </AppHeader>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: navigationBottomInset(insets.bottom, spacing.lg), gap: spacing.lg }}>
      {CREDITS.map(({ name, detail }) => <View key={name}>
        <Text style={[typography.cardTitle, { color: colors.text }]}>{name}</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>{detail}</Text>
      </View>)}
      <View style={{ borderTopWidth: 0.5, borderColor: colors.border, paddingTop: spacing.lg }}>
        <Text style={[typography.cardTitle, { color: colors.text }]}>Datos, fotografías y sonidos</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>Las fuentes de cada dato se consultan en el menú de tres puntos de la ficha, en Fuentes de datos. Las fotos y los sonidos conservan el nombre de su autor y sus condiciones de uso.</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>Antes de reutilizar un medio, consultá su licencia. Una autorización para mostrarlo en Arapy no equivale a una licencia abierta.</Text>
      </View>
    </ScrollView>
  </View>;
}
