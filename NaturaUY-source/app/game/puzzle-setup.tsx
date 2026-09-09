import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../../src/presentation/components/TabIcons';
import { Chip } from '../../src/presentation/components/Chip';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { PUZZLE_SCOPES, type PuzzleDifficulty, type PuzzleScope } from '../../src/domain/entities/puzzle';
import { settingsRepository } from '../../src/data/repositories/settingsRepository';

const SCOPE_KEY = 'puzzle.scope'; const GRID_KEY = 'puzzle.grid';
export default function PuzzleSetupScreen(): React.JSX.Element {
  const db = useSQLiteContext(); const router = useRouter(); const insets = useSafeAreaInsets(); const { colors, spacing, radius, typography } = useTheme();
  const [scope, setScope] = useState<PuzzleScope>('animals_all'); const [grid, setGrid] = useState<PuzzleDifficulty>(3);
  useEffect(() => { void Promise.all([settingsRepository.get(db, SCOPE_KEY), settingsRepository.get(db, GRID_KEY)]).then(([savedScope, savedGrid]) => { if (savedScope && savedScope in PUZZLE_SCOPES) setScope(savedScope as PuzzleScope); if (savedGrid === '4') setGrid(4); }); }, [db]);
  const start = async () => { await settingsRepository.set(db, SCOPE_KEY, scope); await settingsRepository.set(db, GRID_KEY, String(grid)); router.push({ pathname: '/game/puzzle', params: { scope, grid: String(grid) } } as never); };
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderRadius: radius.pill }]} accessibilityLabel="Volver"><BackIcon color={colors.text} /></Pressable><Text style={[typography.headerTitle, { color: colors.text }]}>Puzzle</Text></View>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
      <View><Text style={[typography.cardTitle, { color: colors.text }]}>Elegí la dificultad</Text><View style={styles.row}><Chip label="3 × 3" selected={grid === 3} accent={colors.play} onAccent={colors.onPlay} onPress={() => setGrid(3)} /><Chip label="4 × 4" selected={grid === 4} accent={colors.play} onAccent={colors.onPlay} onPress={() => setGrid(4)} /></View></View>
      <View><Text style={[typography.cardTitle, { color: colors.text }]}>Categoría</Text><View style={styles.wrap}>{Object.entries(PUZZLE_SCOPES).map(([key, item]) => <Chip key={key} label={item.label} selected={scope === key} accent={colors.play} onAccent={colors.onPlay} onPress={() => setScope(key as PuzzleScope)} />)}</View></View>
      <Pressable onPress={start} style={[styles.start, { backgroundColor: colors.play, borderRadius: radius.pill }]}><Text style={[typography.label, { color: colors.onPlay }]}>Empezar puzzle</Text></Pressable>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, row: { flexDirection: 'row', gap: 8, marginTop: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, start: { minHeight: 52, alignItems: 'center', justifyContent: 'center' } });
