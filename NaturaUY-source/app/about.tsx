import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MAIN_HEADER_GRADIENT } from '../src/presentation/theme/tokens';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { ChevronRightIcon, CollaborateIcon, OfflineIcon } from '../src/presentation/components/TabIcons';
import { navigationBottomInset } from '../src/presentation/navigationPolicy';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

export default function AboutScreen(): React.JSX.Element {
  const { colors, spacing, typography, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="Acerca de" onClose={() => router.back()} />
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: navigationBottomInset(insets.bottom, spacing.xl) }}>
      <LinearGradient colors={MAIN_HEADER_GRADIENT} style={[styles.brand, { padding: spacing.lg, borderRadius: radius.lg }]}>
        <View style={[styles.logoFrame, { borderRadius: radius.lg }]}>
          <Image source={require('../assets/images/arapy-logo.png')} accessibilityLabel="Logo de Arapy" contentFit="contain" style={styles.logo} />
        </View>
        <View style={styles.flex}><Text style={[typography.display, { color: '#FFFFFF' }]}>Arapy</Text><Text style={[typography.body, { color: '#FFFFFF', marginTop: 4 }]}>Nuestra naturaleza en un solo lugar</Text></View>
      </LinearGradient>
      {[
        { title: 'Un catálogo vivo', paragraphs: ['Arapy es un catálogo vivo de la naturaleza en Uruguay. Aspiramos a construir una base de datos de acceso público que se enriquezca continuamente con información sobre nuestras especies y ambientes.'] },
        { title: 'Aprender y compartir', paragraphs: ['Queremos acercarte a nuestras especies a través de juegos, lecturas y distintas formas de explorar el catálogo. Cada descubrimiento es una oportunidad para conocer mejor la naturaleza que nos rodea.'], future: true },
        { title: 'Sin conexión', offline: true, paragraphs: ['El catálogo, los juegos y tu progreso están disponibles sin internet. Tus favoritos y récords también se guardan en el dispositivo.', 'Necesitás conexión para descargar imágenes y audios que aún no estén en el teléfono, actualizar el catálogo y sincronizar tu cuenta. Los medios incluidos o ya descargados se pueden consultar offline.'] },
        { title: 'Información con respaldo', paragraphs: ['Cada ficha conserva las fuentes de sus datos y el crédito de sus fotos y sonidos. Si encontrás un error, abrí el menú de tres puntitos en la parte superior de la ficha para reportarlo.'], credits: true },
      ].map((section) => <View key={section.title} style={[styles.section, { borderTopColor: colors.border }]}>
        <View style={styles.heading}>{section.offline && <OfflineIcon color={colors.primary} size={24} />}<Text accessibilityRole="header" style={[typography.title, styles.flex, { color: colors.text }]}>{section.title}</Text></View>
        {section.paragraphs.map((paragraph) => <Text key={paragraph} style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>{paragraph}</Text>)}
        {section.future && <View style={[styles.future, { borderLeftColor: colors.primary, backgroundColor: colors.surfaceContainer, borderRadius: radius.sm }]}><Text style={[typography.label, { color: colors.primary }]}>Lo que viene</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>En el futuro, también podrás compartir tus avistamientos de especies y aportar a este conocimiento colectivo.</Text></View>}
        {section.credits && <Pressable accessibilityRole="link" onPress={() => router.push('/credits')} style={styles.textLink}><Text style={[typography.label, { color: colors.primary }]}>Créditos y licencias</Text><ChevronRightIcon color={colors.primary} size={18} /></Pressable>}
      </View>)}
      <View style={[styles.invitation, { backgroundColor: colors.primaryContainer, borderRadius: radius.lg, padding: spacing.lg }]}>
        <View style={styles.heading}><CollaborateIcon color={colors.primary} size={24} /><Text style={[typography.title, styles.flex, { color: colors.onPrimaryContainer }]}>Sumate a Arapy</Text></View>
        <Text style={[typography.body, { color: colors.onPrimaryContainer, marginTop: spacing.sm }]}>Podés contribuir desde distintos roles: datos, fotos, sonidos, juegos, ambientes, historias, tecnología y diseño. La ayuda siempre es bienvenida.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/collaborate')} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, borderRadius: radius.pill, opacity: pressed ? 0.85 : 1 }]}><Text style={[typography.label, { color: colors.onPrimary }]}>Colaborar</Text><ChevronRightIcon color={colors.onPrimary} size={18} /></Pressable>
      </View>
      <Text style={[typography.caption, styles.version, { color: colors.textMuted }]}>Arapy · versión {Constants.expoConfig?.version ?? '—'}</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 12, marginBottom: 24 },
  logoFrame: { width: 84, height: 84, padding: 8, backgroundColor: '#D6E0D2', borderWidth: StyleSheet.hairlineWidth, borderColor: '#B8C8B3', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 68, height: 68 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 24 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  future: { marginTop: 16, padding: 16, borderLeftWidth: 3 },
  textLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginTop: 8, alignSelf: 'flex-start' },
  invitation: { marginTop: 8 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, marginTop: 18 },
  version: { textAlign: 'center', marginTop: 28 },
});
