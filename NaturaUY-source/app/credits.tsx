import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MAIN_HEADER_GRADIENT } from '../src/presentation/theme/tokens';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { useTheme } from '../src/presentation/theme/ThemeProvider';
import { navigationBottomInset } from '../src/presentation/navigationPolicy';

const CONTRIBUTORS = [
  { name: 'Rafael Rinaldi', detail: 'Desarrollo y mantenimiento de Arapy.' },
  { name: 'Pedro Rinaldi', detail: 'Colaborador de Arapy y autor de fotografías y registros de sonidos de aves.' },
  { name: 'Agustín Morelle', detail: 'Anguila.' },
];

const REFERENCES = [
  { title: 'Catálogo y conservación', detail: 'Ministerio de Ambiente y SNAP: listados de especies, clasificación y evaluaciones de conservación. Biodiversidata y la colección de arañas de Facultad de Ciencias, UdelaR, a través de GBIF: registros y base taxonómica de la fauna uruguaya.' },
  { title: 'Plantas', detail: 'Flora Uruguaya Online: referencia para las plantas seleccionadas, sus nombres, descripción, origen y presencia en Uruguay.' },
  { title: 'Medidas de las especies', detail: 'AVONET, TetrapodTraits 3, AmphiBIO y FISHMORPH: medidas técnicas de aves, mamíferos, anfibios y peces.' },
  { title: 'Notas e historia natural', detail: 'Animal Diversity Web, Mammalian Species, Global Ecology and Conservation, Journal of Avian Biology, The Auk, USGS y Colibrí de UdelaR: bibliografía para datos relevantes y notas específicas de las especies. Los vínculos completos están en cada ficha.' },
  { title: 'Ambientes del Uruguay', detail: 'Ministerio de Ambiente, MGAP/PPR–CIEDUR, la Estrategia Nacional de Bosque Nativo, el Inventario Nacional de Humedales y los trabajos de Alonso-Paz y Bassagoda: clasificación, vegetación, reconocimiento y características de nuestros ambientes.' },
  { title: 'Revisión editorial', detail: 'La síntesis editorial de Arapy organiza la información y los aportes revisados. Cada dato conserva su referencia cuando está disponible.' },
];

export default function CreditsScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, typography, radius } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title="Créditos y licencias" onClose={() => router.back()} />
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: navigationBottomInset(insets.bottom, spacing.lg), gap: spacing.md }}>
      <LinearGradient colors={MAIN_HEADER_GRADIENT} style={[styles.intro, { borderRadius: radius.xl, padding: spacing.lg }]}>
        <Text style={[typography.title, { color: '#FFFFFF' }]}>Un catálogo hecho en colaboración</Text>
        <Text style={[typography.body, { color: 'rgba(255,255,255,0.9)', marginTop: spacing.sm }]}>Arapy crece con aportes, conocimiento y trabajo compartido.</Text>
      </LinearGradient>
      <Text style={[typography.eyebrow, { color: colors.textMuted, marginTop: spacing.md }]}>PERSONAS COLABORADORAS</Text>
      {CONTRIBUTORS.map(({ name, detail }, index) => <View key={name}>
        {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
        <View style={styles.person}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceVariant, borderRadius: radius.pill }]}><Text style={[typography.cardTitle, { color: colors.primary }]}>{name.slice(0, 1)}</Text></View>
          <View style={styles.personCopy}><Text style={[typography.cardTitle, { color: colors.text }]}>{name}</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 3 }]}>{detail}</Text></View>
        </View>
      </View>)}
      <View style={[styles.dataSection, { borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.lg }]}>
        <Text style={[typography.eyebrow, { color: colors.textMuted }]}>DATOS Y REFERENCIAS</Text>
        <View style={[styles.reference, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm }]}>
          <Text style={[typography.cardTitle, { color: colors.text }]}>Adrián B. Azpiroz · Aves del Uruguay (2003)</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>Su trabajo fue de gran ayuda para el armado y la organización de la sección de aves.</Text>
        </View>
        {REFERENCES.map(({ title, detail }) => <View key={title} style={[styles.sourceRow, { borderBottomColor: colors.border }]}><Text style={[typography.label, { color: colors.text }]}>{title}</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>{detail}</Text></View>)}
        <Text style={[typography.eyebrow, { color: colors.textMuted, marginTop: spacing.xl }]}>FOTOS, SONIDOS Y LICENCIAS</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>Wikimedia Commons e iNaturalist aportan fotografías con licencias compatibles; xeno-canto aporta grabaciones de aves. También contamos con imágenes cedidas por sus autores. Cada medio conserva su autoría, procedencia y condiciones de uso.</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>Las fuentes de cada dato están en el menú de tres puntos de cada ficha. Las fotos y los sonidos muestran su autoría y condiciones de uso.</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>Antes de reutilizar un medio, consultá su licencia. Una autorización para mostrarlo en Arapy no equivale a una licencia abierta.</Text>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  sourceRow: { paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  intro: { gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 56, marginVertical: 14 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  personCopy: { flex: 1 },
  dataSection: { borderTopWidth: StyleSheet.hairlineWidth },
  reference: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(70,91,71,0.18)' },
});
