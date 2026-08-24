import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { speciesRepository } from '../src/data/repositories/speciesRepository';
import { AppHeader } from '../src/presentation/components/AppHeader';
import { CloseIcon } from '../src/presentation/components/TabIcons';
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
    title: 'Fotografías',
    body: 'iNaturalist y Wikimedia Commons. La app solo incluye imágenes con licencia CC0 o CC BY; cada ficha acredita a su autor.',
    url: 'https://www.inaturalist.org',
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
      <AppHeader eyebrow="DE DÓNDE SALE TODO" title="Créditos">
        <View style={styles.row}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver" style={{ marginLeft: 'auto' }}>
            <CloseIcon color={colors.text} />
          </Pressable>
        </View>
      </AppHeader>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {stats && (
          <View style={[styles.summary, { backgroundColor: colors.canvas, borderRadius: radius.lg, padding: spacing.lg }]}>
            <Text style={[typography.body, { color: colors.canvasText }]}>
              {stats.total} especies en el catálogo, {stats.withPhoto} con fotografía de licencia libre.
            </Text>
          </View>
        )}

        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}
        >
          <Text style={[typography.label, { color: colors.text }]}>Desarrollo de la aplicación</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>Rafael Rinaldi · Agustín Morelle</Text>
        </View>

        {SOURCES.map((source) => (
          <View
            key={source.title}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.md }]}
          >
            <Text style={[typography.label, { color: colors.text }]}>{source.title}</Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>{source.body}</Text>
            {source.url && (
              <Pressable onPress={() => void Linking.openURL(source.url!)} style={{ marginTop: 10 }}>
                <Text style={[typography.caption, { color: colors.primary }]}>{source.url}</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, lineHeight: 19 }]}>
          Las licencias CC BY exigen atribución al autor. Cada fotografía muestra su crédito en la ficha de la
          especie, con enlace a la publicación original.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  summary: { marginBottom: 4 },
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
});
