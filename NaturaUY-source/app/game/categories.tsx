import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QUIZ_MODES, QUIZ_SCOPE_ORDER, type QuizMode, type QuizScope } from '../../src/domain/entities/quiz';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';
import { settingsRepository } from '../../src/data/repositories/settingsRepository';
import { FamilyGlyph } from '../../src/presentation/components/FamilyGlyph';
import { BackIcon, ChevronRightIcon, GameIcon, LeafIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { CLASS_VISUALS } from '../../src/presentation/taxonomy/classVisuals';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';

const isMode = (value?: string): value is QuizMode => value === 'classic' || value === 'timed' || value === 'survival';
const CONTENT: Record<QuizScope, { title: string; description: string; clase: string; colors: readonly [string, string] }> = {
  animals_all: { title: 'Todos los animales', description: 'Demostrá cuánto sabés de toda la fauna uruguaya.', clase: '', colors: ['#6E4E9E', '#503874'] },
  birds: { title: 'Aves', description: 'Reconocé plumas, picos y siluetas de nuestras aves.', clase: 'Aves', colors: CLASS_VISUALS.Aves.colors },
  mammals: { title: 'Mamíferos', description: 'Poné a prueba tu ojo para los mamíferos del país.', clase: 'Mammalia', colors: CLASS_VISUALS.Mammalia.colors },
  reptiles: { title: 'Reptiles', description: 'Distinguí lagartos, tortugas y serpientes nativas.', clase: 'Reptilia', colors: CLASS_VISUALS.Reptilia.colors },
  amphibians: { title: 'Anfibios', description: 'Descubrí cuánto conocés de ranas y sapos.', clase: 'Amphibia', colors: CLASS_VISUALS.Amphibia.colors },
  fish: { title: 'Peces', description: 'Navegá entre peces de agua dulce y marinos.', clase: 'Actinopterygii', colors: CLASS_VISUALS.Actinopterygii.colors },
};

export default function CategoriesScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ mode?: string }>(); const mode = isMode(params.mode) ? params.mode : 'classic';
  const router = useRouter(); const db = useUserDatabase(); const insets = useSafeAreaInsets(); const { colors, radius, spacing, typography, elevation } = useTheme();
  const play = (scope: QuizScope): void => { haptics.press(); void settingsRepository.set(db, 'quiz_scope', scope); router.push(`/game/identify?mode=${mode}&scope=${scope}`); };
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
    <View style={[styles.header, { paddingHorizontal: spacing.lg }]}><Pressable onPress={() => router.back()} style={[styles.back, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.pill }]} accessibilityLabel="Volver"><BackIcon color={colors.text} /></Pressable><View><Text style={[typography.eyebrow, { color: colors.play }]}>{QUIZ_MODES[mode].title.toLocaleUpperCase('es')}</Text><Text style={[typography.title, { color: colors.text }]}>¿Con qué querés jugar?</Text></View></View>
    <Text style={[typography.body, { color: colors.textMuted, paddingHorizontal: spacing.lg, marginTop: spacing.md }]}>Elegí un grupo. Cada partida y cada récord quedan separados por categoría.</Text>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
      {QUIZ_SCOPE_ORDER.map((scope) => { const item = CONTENT[scope]; return <Pressable key={scope} onPress={() => play(scope)} accessibilityRole="button" accessibilityLabel={`Jugar con ${item.title}`}>{({ pressed }) => <LinearGradient colors={[...item.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, elevation.low, { borderRadius: radius.lg, opacity: pressed ? .91 : 1 }]}><View style={[styles.glyph, { borderRadius: radius.md }]}>{scope === 'animals_all' ? <GameIcon color="#FFF9EA" size={38} /> : <FamilyGlyph clase={item.clase} color="#FFF9EA" size={48} />}</View><View style={styles.flex}><Text style={[typography.cardTitle, { color: '#FFF9EA' }]}>{item.title}</Text><Text style={[typography.body, { color: 'rgba(255,249,234,.82)', marginTop: 3 }]}>{item.description}</Text></View><ChevronRightIcon color="#FFF9EA" /></LinearGradient>}</Pressable>; })}
      <View style={[styles.card, { backgroundColor: colors.surfaceVariant, borderRadius: radius.lg, opacity: .62 }]}><View style={[styles.glyph, { backgroundColor: colors.surface, borderRadius: radius.md }]}><LeafIcon color={colors.primary} size={38} /></View><View style={styles.flex}><Text style={[typography.cardTitle, { color: colors.text }]}>Plantas</Text><Text style={[typography.body, { color: colors.textMuted }]}>Flores, árboles y pastizales. Próximamente.</Text></View></View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, card: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }, glyph: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.13)' } });
