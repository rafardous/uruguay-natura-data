import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '../src/presentation/components/AppHeader';
import {
  BirdIcon,
  CloseIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  GalleryIcon,
  InterestSitesIcon,
  LeafIcon,
  ShieldIcon,
} from '../src/presentation/components/TabIcons';
import { haptics } from '../src/presentation/haptics';
import { useTheme } from '../src/presentation/theme/ThemeProvider';

type SiteKind = 'protected' | 'data' | 'nature' | 'gallery' | 'birds';

interface InterestSite {
  title: string;
  category: string;
  description: string;
  url: string;
  kind: SiteKind;
  container: string;
  foreground: string;
  local?: boolean;
}

const SITES: InterestSite[] = [
  {
    title: 'Sistema Nacional de Áreas Protegidas',
    category: 'MINISTERIO DE AMBIENTE · URUGUAY',
    description: 'Áreas protegidas, especies prioritarias, documentos y materiales sobre conservación en Uruguay.',
    url: 'https://www.gub.uy/ministerio-ambiente/areas-protegidas',
    kind: 'protected',
    container: '#D8E7D3',
    foreground: '#294A3A',
  },
  {
    title: 'GBIF Uruguay',
    category: 'DATOS DE BIODIVERSIDAD',
    description: 'Registros abiertos de ocurrencia y conjuntos de datos utilizados para contrastar el catálogo.',
    url: 'https://cloud.gbif.org/uy/',
    kind: 'data',
    container: '#DDE9F0',
    foreground: '#315A68',
  },
  {
    title: 'iNaturalist',
    category: 'OBSERVACIONES Y FOTOGRAFÍAS',
    description: 'Observaciones comunitarias y fotografías con licencia compatible, acreditadas en cada ficha.',
    url: 'https://www.inaturalist.org/places/uruguay',
    kind: 'nature',
    container: '#E4EAC8',
    foreground: '#4C5E23',
  },
  {
    title: 'Wikimedia Commons',
    category: 'ARCHIVO MULTIMEDIA LIBRE',
    description: 'Imágenes y recursos abiertos que complementan las fotografías del catálogo.',
    url: 'https://commons.wikimedia.org/wiki/Category:Nature_of_Uruguay',
    kind: 'gallery',
    container: '#E7E4EF',
    foreground: '#54466C',
  },
  {
    title: 'Aves Uruguay',
    category: 'ORGANIZACIÓN URUGUAYA',
    description: 'Conservación, divulgación y actividades para conocer las aves silvestres y sus ambientes.',
    url: 'https://avesuruguay.org.uy/',
    kind: 'birds',
    container: '#F1DDD8',
    foreground: '#7C3F3A',
    local: true,
  },
];

function SiteIcon({ kind, color }: { kind: SiteKind; color: string }): React.JSX.Element {
  if (kind === 'protected') return <ShieldIcon color={color} size={24} />;
  if (kind === 'data') return <DatabaseIcon color={color} size={24} />;
  if (kind === 'gallery') return <GalleryIcon color={color} size={24} />;
  if (kind === 'birds') return <BirdIcon color={color} size={24} />;
  return <LeafIcon color={color} size={24} />;
}

export default function InterestSitesScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors, elevation, radius, spacing, typography } = useTheme();

  const open = (site: InterestSite): void => {
    haptics.tap();
    void Linking.openURL(site.url);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader eyebrow="PARA SEGUIR EXPLORANDO" title="Sitios de interés">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Volver" style={styles.close}>
          <CloseIcon color={colors.text} />
        </Pressable>
      </AppHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <View style={[styles.intro, { backgroundColor: colors.primaryContainer, borderRadius: radius.lg, padding: spacing.lg }]}>
          <InterestSitesIcon color={colors.onPrimaryContainer} size={28} />
          <Text style={[typography.body, styles.flex, { color: colors.onPrimaryContainer }]}>
            Fuentes utilizadas por Natura UY y proyectos recomendados para profundizar.
          </Text>
        </View>

        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          {SITES.map((site) => (
            <Pressable
              key={site.title}
              onPress={() => open(site)}
              accessibilityRole="link"
              accessibilityLabel={`Abrir ${site.title}`}
              style={({ pressed }) => [
                styles.card,
                elevation.low,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: site.container, borderRadius: radius.md }]}>
                <SiteIcon kind={site.kind} color={site.foreground} />
              </View>
              <View style={styles.flex}>
                <View style={styles.categoryRow}>
                  <Text style={[typography.eyebrow, styles.flex, { color: site.foreground }]}>{site.category}</Text>
                  {site.local && (
                    <View style={[styles.localTag, { backgroundColor: site.container, borderRadius: radius.pill }]}>
                      <Text style={[typography.caption, { color: site.foreground }]}>UY</Text>
                    </View>
                  )}
                </View>
                <Text style={[typography.cardTitle, { color: colors.text, marginTop: 4 }]}>{site.title}</Text>
                <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>{site.description}</Text>
              </View>
              <ExternalLinkIcon color={colors.textMuted} size={18} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  close: { marginLeft: 'auto', padding: 8 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  card: { minHeight: 128, flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15, borderWidth: StyleSheet.hairlineWidth },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  localTag: { paddingHorizontal: 8, paddingVertical: 3 },
});
