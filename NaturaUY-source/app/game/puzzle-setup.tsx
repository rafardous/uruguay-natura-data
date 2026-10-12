import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../../src/presentation/components/TabIcons';
import { Chip } from '../../src/presentation/components/Chip';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { PUZZLE_SCOPES, type PuzzleDifficulty, type PuzzleScope } from '../../src/domain/entities/puzzle';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { settingsRepository } from '../../src/data/repositories/settingsRepository';
import { useUserDatabase } from '../../src/data/db/UserDatabaseProvider';

const SCOPE_KEY = 'puzzle.scope'; const GRID_KEY = 'puzzle.grid';
export default function PuzzleSetupScreen(): React.JSX.Element {
  const db = useSQLiteContext(); const router = useRouter(); const insets = useSafeAreaInsets(); const { colors, spacing, radius, typography } = useTheme();
  const userDb = useUserDatabase();
  const [mode, setMode] = useState<'sliding'|'jigsaw'>('sliding');
  const [scope, setScope] = useState<PuzzleScope>('animals_all'); const [grid, setGrid] = useState<PuzzleDifficulty>(3);
  const level = 'hard' as const;
  const [available, setAvailable] = useState<Partial<Record<PuzzleScope, number>> | null>(null);
  useEffect(() => { void Promise.all([settingsRepository.get(userDb, SCOPE_KEY), settingsRepository.get(userDb, GRID_KEY)]).then(([savedScope, savedGrid]) => { if (savedScope && savedScope in PUZZLE_SCOPES) setScope(savedScope as PuzzleScope); if (savedGrid === '4') setGrid(4); }); }, [userDb]);
  useEffect(() => { let active = true; void Promise.all(Object.entries(PUZZLE_SCOPES).map(async ([key, item]) => [key, (await speciesRepository.findQuizPool(db, item.classes, level, mode==='jigsaw'?'jigsaw':'puzzle', item.taxa)).length] as const)).then((rows) => { if (active) setAvailable(Object.fromEntries(rows) as Partial<Record<PuzzleScope, number>>); }); return () => { active = false; }; }, [db, level, mode]);
  useEffect(() => {
    if (!available) return;
    if ((available[scope] ?? 0) > 0) return;
    const fallback = (Object.keys(PUZZLE_SCOPES) as PuzzleScope[]).find((candidate) => (available[candidate] ?? 0) > 0);
    if (fallback) setScope(fallback);
  }, [available, scope]);
  const start = async () => { await settingsRepository.set(userDb, SCOPE_KEY, scope); if (mode === 'sliding') await settingsRepository.set(userDb, GRID_KEY, String(grid)); router.push({ pathname: '/game/puzzle', params: { scope, ...(mode === 'sliding' ? { grid: String(grid) } : {}), level, mode } } as never); };
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderRadius: radius.pill }]} accessibilityLabel="Volver"><BackIcon color={colors.text} /></Pressable><Text style={[typography.headerTitle, { color: colors.text }]}>Puzzle</Text></View>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>Reconstruí la foto de una especie. Elegí deslizar las fichas o encastrar piezas que podés arrastrar y rotar.</Text>
      <View><Text style={[typography.cardTitle, { color: colors.text }]}>Modalidad</Text><View style={styles.row}><Chip label="Deslizante" selected={mode==='sliding'} accent={colors.play} onAccent={colors.onPlay} onPress={()=>setMode('sliding')}/><Chip label="Encastrar" selected={mode==='jigsaw'} accent={colors.play} onAccent={colors.onPlay} onPress={()=>setMode('jigsaw')}/></View></View>
      {mode === 'sliding' && <View><Text style={[typography.cardTitle, { color: colors.text }]}>Elegí la dificultad</Text><View style={styles.row}><Chip label="3 × 3" selected={grid === 3} accent={colors.play} onAccent={colors.onPlay} onPress={() => setGrid(3)} /><Chip label="4 × 4" selected={grid === 4} accent={colors.play} onAccent={colors.onPlay} onPress={() => setGrid(4)} /></View></View>}
      <View><Text style={[typography.cardTitle, { color: colors.text }]}>Categoría</Text><View style={styles.wrap}>{Object.entries(PUZZLE_SCOPES).map(([key, item]) => available && (available[key as PuzzleScope] ?? 0) < 1 ? null : <Chip key={key} label={item.label} selected={scope === key} accent={colors.play} onAccent={colors.onPlay} onPress={() => setScope(key as PuzzleScope)} />)}</View>{available && Object.values(available).every((count) => (count ?? 0) < 1) && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>Todavía no hay imágenes suficientes para armar un puzzle.</Text>}</View>
      <Pressable disabled={!available || !(available[scope] ?? 0)} onPress={()=>void start()} style={[styles.start, { backgroundColor: colors.play, borderRadius: radius.pill }]}><Text style={[typography.label, { color: colors.onPlay }]}>Empezar puzzle</Text></Pressable>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, row: { flexDirection: 'row', gap: 8, marginTop: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, start: { minHeight: 52, alignItems: 'center', justifyContent: 'center' } });
