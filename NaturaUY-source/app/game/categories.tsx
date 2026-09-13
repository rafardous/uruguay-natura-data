import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { KNOWLEDGE_LEVELS, QUIZ_MODES, QUIZ_SCOPES, QUIZ_SCOPE_ORDER, type KnowledgeLevel, type QuizMode, type QuizScope } from '../../src/domain/entities/quiz';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';
import { settingsRepository } from '../../src/data/repositories/settingsRepository';
import { FamilyGlyph } from '../../src/presentation/components/FamilyGlyph';
import { BackIcon, ChevronRightIcon, GameIcon, LeafIcon, TaxonomyIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { CLASS_VISUALS } from '../../src/presentation/taxonomy/classVisuals';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { Chip } from '../../src/presentation/components/Chip';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';

const isMode = (value?: string): value is QuizMode => value === 'classic' || value === 'timed' || value === 'survival' || value === 'naming';
const ARTHROPOD_VISUALS = {
  arthropods: { colors: ['#D8C7E8', '#B79BCF'], foreground: '#38264D', mutedForeground: 'rgba(56,38,77,.8)' },
  arachnids: { colors: ['#E1CCD0', '#CBA7AF'], foreground: '#542F39', mutedForeground: 'rgba(84,47,57,.8)' },
  insects: { colors: ['#E2D9B0', '#CFC18B'], foreground: '#4C431B', mutedForeground: 'rgba(76,67,27,.8)' },
  crustaceans: { colors: ['#D5E0D2', '#B7CDB8'], foreground: '#294A35', mutedForeground: 'rgba(41,74,53,.8)' },
} as const;
const CONTENT: Record<QuizScope, { title: string; description: string; clase: string; colors: readonly [string, string]; foreground: string; mutedForeground: string }> = {
  animals_all: { title: 'Todos los animales', description: 'Demostrá cuánto sabés de toda la fauna uruguaya.', clase: '', colors: ['#6E4E9E', '#503874'], foreground: '#FFF9EA', mutedForeground: 'rgba(255,249,234,.82)' },
  birds: { title: 'Aves', description: 'Reconocé plumas, picos y siluetas de nuestras aves.', clase: 'Aves', colors: CLASS_VISUALS.Aves.colors, foreground: CLASS_VISUALS.Aves.foreground, mutedForeground: CLASS_VISUALS.Aves.mutedForeground },
  mammals: { title: 'Mamíferos', description: 'Poné a prueba tu ojo para los mamíferos del país.', clase: 'Mammalia', colors: CLASS_VISUALS.Mammalia.colors, foreground: CLASS_VISUALS.Mammalia.foreground, mutedForeground: CLASS_VISUALS.Mammalia.mutedForeground },
  reptiles: { title: 'Reptiles', description: 'Distinguí lagartos, tortugas y serpientes nativas.', clase: 'Reptilia', colors: CLASS_VISUALS.Reptilia.colors, foreground: CLASS_VISUALS.Reptilia.foreground, mutedForeground: CLASS_VISUALS.Reptilia.mutedForeground },
  amphibians: { title: 'Anfibios', description: 'Descubrí cuánto conocés de ranas y sapos.', clase: 'Amphibia', colors: CLASS_VISUALS.Amphibia.colors, foreground: CLASS_VISUALS.Amphibia.foreground, mutedForeground: CLASS_VISUALS.Amphibia.mutedForeground },
  fish: { title: 'Peces', description: 'Navegá entre peces de agua dulce y marinos.', clase: 'Actinopterygii', colors: CLASS_VISUALS.Actinopterygii.colors, foreground: CLASS_VISUALS.Actinopterygii.foreground, mutedForeground: CLASS_VISUALS.Actinopterygii.mutedForeground },
  arthropods: { title: 'Artrópodos', description: 'Reconocé la enorme diversidad de patas, alas y caparazones.', clase: '', ...ARTHROPOD_VISUALS.arthropods },
  arachnids: { title: 'Arácnidos', description: 'Arañas, escorpiones y otros cazadores de ocho patas.', clase: 'Arachnida', ...ARTHROPOD_VISUALS.arachnids },
  insects: { title: 'Insectos', description: 'Seis patas, alas y metamorfosis de la fauna uruguaya.', clase: 'Insecta', ...ARTHROPOD_VISUALS.insects },
  crustaceans: { title: 'Crustáceos', description: 'Conocé los crustáceos de nuestras costas y ambientes acuáticos.', clase: 'Malacostraca', ...ARTHROPOD_VISUALS.crustaceans },
  plants: { title: 'Plantas', description: 'Flores, árboles, pastizales, helechos y otras plantas vasculares del Uruguay.', clase: 'Angiospermae', colors: ['#DCEBD8', '#B8D1B5'], foreground: '#244C32', mutedForeground: 'rgba(36,76,50,.8)' },
};

export default function CategoriesScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ mode?: string }>(); const mode = isMode(params.mode) ? params.mode : 'classic';
  const [level, setLevel] = useState<KnowledgeLevel>('hard');
  const router = useRouter(); const userDb = useUserDatabase(); const catalogDb = useSQLiteContext(); const insets = useSafeAreaInsets(); const { colors, radius, spacing, typography, elevation } = useTheme();
  const [available, setAvailable] = useState<Partial<Record<QuizScope, number>> | null>(null);
  useEffect(() => { let active = true; void Promise.all(QUIZ_SCOPE_ORDER.map(async (scope) => [scope, (await speciesRepository.findQuizPool(catalogDb, QUIZ_SCOPES[scope].classes, level, mode === 'naming' ? 'naming' : 'quiz', QUIZ_SCOPES[scope].taxa)).length] as const)).then((rows) => { if (active) setAvailable(Object.fromEntries(rows)); }); return () => { active = false; }; }, [catalogDb, level, mode]);
  const play = (scope: QuizScope): void => { haptics.press(); void settingsRepository.set(userDb, 'quiz_scope', scope); void settingsRepository.set(userDb, 'knowledge_level', level); router.push(`/game/identify?mode=${mode}&scope=${scope}&level=${level}`); };
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
    <View style={[styles.header, { paddingHorizontal: spacing.lg }]}><Pressable onPress={() => { haptics.tap(); router.back(); }} style={[styles.back, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.pill }]} accessibilityLabel="Volver"><BackIcon color={colors.text} /></Pressable><View><Text style={[typography.eyebrow, { color: colors.play }]}>{QUIZ_MODES[mode].title.toLocaleUpperCase('es')}</Text><Text style={[typography.title, { color: colors.text }]}>¿Con qué querés jugar?</Text></View></View>
    <Text style={[typography.body, { color: colors.textMuted, paddingHorizontal: spacing.lg, marginTop: spacing.md }]}>Elegí un grupo. Cada partida y cada récord quedan separados por categoría.</Text>
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.sm }}><Text style={[typography.label, { color: colors.text }]}>Nivel de conocimiento</Text><View style={styles.levels}>{KNOWLEDGE_LEVELS.map((item) => <Chip key={item.id} label={item.label} selected={level === item.id} accent={colors.play} onAccent={colors.onPlay} onPress={() => setLevel(item.id)} />)}</View><Text style={[typography.caption, { color: colors.textMuted }]}>{KNOWLEDGE_LEVELS.find((item) => item.id === level)?.description}</Text></View>
    {mode === 'naming' && <View style={[styles.mediaNotice, { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surfaceVariant, borderRadius: radius.md }]}><Text style={[typography.label, { color: colors.text }]}>Imagen activa</Text><Text style={[typography.caption, { color: colors.textMuted }]}>Sonido · Próximamente</Text></View>}
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
      {QUIZ_SCOPE_ORDER.map((scope) => { const item = CONTENT[scope]; if (available && (available[scope] ?? 0) < 4) return null; return <Pressable key={scope} onPress={() => play(scope)} accessibilityRole="button" accessibilityLabel={`Jugar con ${item.title}`}>{({ pressed }) => <LinearGradient colors={[...item.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, elevation.low, { borderRadius: radius.lg, opacity: pressed ? .91 : 1 }]}><View style={[styles.glyph, { borderRadius: radius.md }]}>{scope === 'animals_all' ? <GameIcon color={item.foreground} size={38} /> : scope === 'arthropods' ? <TaxonomyIcon color={item.foreground} size={42} /> : scope === 'plants' ? <LeafIcon color={item.foreground} size={42} /> : <FamilyGlyph clase={item.clase} color={item.foreground} size={48} />}</View><View style={styles.flex}><Text style={[typography.cardTitle, { color: item.foreground }]}>{item.title}</Text><Text style={[typography.body, { color: item.mutedForeground, marginTop: 3 }]}>{item.description}</Text></View><ChevronRightIcon color={item.foreground} /></LinearGradient>}</Pressable>; })}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, flex: { flex: 1 }, levels: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, card: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }, glyph: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.13)' }, mediaNotice: { padding: 12, gap: 3 } });
