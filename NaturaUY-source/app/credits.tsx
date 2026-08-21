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
    title: 'Datos de especies',
    body: 'Sistema Nacional de Áreas Protegidas (SNAP), Ministerio de Ambiente del Uruguay. Listado de especies y estado de conservación.',
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
              {stats.total} especies del SNAP, {stats.withPhoto} con fotografía de licencia libre.
            </Text>
          </View>
        )}

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
