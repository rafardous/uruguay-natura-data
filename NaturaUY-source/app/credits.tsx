import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';

import { speciesRepository } from '../src/data/repositories/speciesRepository';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { CloseIcon, CreditsIcon, ExternalLinkIcon } from '../src/presentation/components/TabIcons';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

interface Source {
  title: string;
  body: string;
  url?: string;
}

const SOURCES: Source[] = [
  {
    title: 'Catálogo histórico SNAP',
    body: 'Exportación histórica del Sistema Nacional de Áreas Protegidas (SNAP), preservada como base de códigos, nombres comunes y campos del catálogo.',
    url: 'https://www.gub.uy/ministerio-ambiente/areas-protegidas',
  },
  {
    title: 'Tetrápodos de Uruguay',
    body: 'Datos de ocurrencia publicados por Biodiversidata en el portal GBIF Uruguay. Licencia CC BY 4.0.',
    url: 'https://cloud.gbif.org/uy/archive.do?r=tetrapodos_de_uruguay',
  },
  {
    title: 'Listas Rojas de fauna del Uruguay',
    body: 'Checklist de especies de fauna evaluadas y reportadas en Listas Rojas, publicado en el portal GBIF Uruguay por el Ministerio de Ambiente.',
    url: 'https://cloud.gbif.org/uy/archive.do?r=listas_rojas_fauna_uy',
  },
  {
    title: 'Nombres científicos',
    body: 'GBIF Backbone Taxonomy — usada para corregir grafías y resolver sinónimos.',
    url: 'https://www.gbif.org',
  },
  {
    title: 'Fotografías de iNaturalist',
    body: 'Imágenes con licencia compatible, conservando autoría, licencia y enlace a la observación original.',
    url: 'https://www.inaturalist.org',
  },
  {
    title: 'Wikimedia Commons',
    body: 'Archivo complementario de fotografías y recursos multimedia con licencias abiertas.',
    url: 'https://commons.wikimedia.org',
  },
];

export default function CreditsScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors, radius, spacing, typography } = useTheme();
  const [stats, setStats] = useState<{ total: number; withPhoto: number } | null>(null);

  useEffect(() => {
    void speciesRepository.stats(db).then(setStats);
  }, [db]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader eyebrow="PERSONAS, DATOS Y LICENCIAS" title="Créditos">
        <View style={styles.row}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver" style={{ marginLeft: 'auto' }}>
            <CloseIcon color={colors.text} />
          </Pressable>
        </View>
      </AppHeader>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {stats && <LinearGradient colors={['#5E8566', '#477052', '#315340']} style={[styles.summary, { borderRadius: radius.lg, padding: spacing.lg }]}><Text style={[typography.eyebrow, { color: colors.canvasTextMuted }]}>CATÁLOGO ACTUAL</Text><Text style={[typography.title, { color: colors.canvasText, marginTop: 5 }]}>{stats.total} especies</Text><Text style={[typography.body, { color: colors.canvasTextMuted, marginTop: 3 }]}>{stats.withPhoto} cuentan con fotografía de licencia libre.</Text></LinearGradient>}

        <Text style={[typography.eyebrow, styles.sectionTitle, { color: colors.textMuted }]}>EQUIPO</Text>
        <View style={[styles.teamCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          <View style={[styles.teamHeading, { borderBottomColor: colors.border }]}><View style={[styles.teamIcon, { backgroundColor: colors.primaryContainer, borderRadius: radius.md }]}><CreditsIcon color={colors.onPrimaryContainer} size={24} /></View><View style={styles.flex}><Text style={[typography.cardTitle, { color: colors.text }]}>Desarrollo de Natura UY</Text><Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Aplicación, catálogo e infraestructura editorial</Text></View></View>
          <View style={styles.people}>
            <View style={styles.person}><View style={[styles.avatar, { backgroundColor: colors.primary, borderRadius: radius.pill }]}><Text style={[typography.label, { color: colors.onPrimary }]}>RR</Text></View><View><Text style={[typography.label, { color: colors.text }]}>Rafael Rinaldi</Text><Text style={[typography.caption, { color: colors.textMuted }]}>Desarrollador</Text></View></View>
            <View style={styles.person}><View style={[styles.avatar, { backgroundColor: colors.play, borderRadius: radius.pill }]}><Text style={[typography.label, { color: colors.onPlay }]}>AM</Text></View><View><Text style={[typography.label, { color: colors.text }]}>Agustín Morelle</Text><Text style={[typography.caption, { color: colors.textMuted }]}>Desarrollador</Text></View></View>
          </View>
        </View>

        <Text style={[typography.eyebrow, styles.sectionTitle, { color: colors.textMuted }]}>DATOS Y CONTENIDO</Text>

        {SOURCES.map((source, index) => (
          <View
            key={source.title}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}
          >
            <View style={styles.sourceHeading}><View style={[styles.sourceNumber, { backgroundColor: colors.primaryContainer, borderRadius: radius.sm }]}><Text style={[typography.caption, { color: colors.onPrimaryContainer }]}>{String(index + 1).padStart(2, '0')}</Text></View><Text style={[typography.label, styles.flex, { color: colors.text }]}>{source.title}</Text></View>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>{source.body}</Text>
            {source.url && (
              <Pressable onPress={() => void Linking.openURL(source.url!)} accessibilityRole="link" style={styles.sourceLink}>
                <Text style={[typography.caption, { color: colors.primary }]}>Visitar fuente</Text><ExternalLinkIcon color={colors.primary} size={15} />
              </Pressable>
            )}
          </View>
        ))}

        <View style={[styles.license, { backgroundColor: colors.surfaceVariant, borderRadius: radius.lg, marginTop: spacing.xl }]}><Text style={[typography.eyebrow, { color: colors.primary }]}>LICENCIAS</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>Las licencias CC BY exigen atribución. Cada fotografía conserva el crédito de su autor, la licencia y el enlace a la publicación original.</Text></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  summary: { marginBottom: 4 },
  sectionTitle: { marginTop: 24, marginBottom: 10 },
  teamCard: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  teamHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  teamIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  people: { padding: 15, gap: 14 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
  sourceHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceNumber: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 11, paddingVertical: 4 },
  license: { padding: 17 },
});
