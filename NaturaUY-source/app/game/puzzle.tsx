import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { puzzleRepository } from '../../src/data/repositories/puzzleRepository';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { thumbnailFor } from '../../src/data/assets/thumbMap';
import type { KnowledgeLevel, Species } from '../../src/domain/entities/species';
import { PUZZLE_SCOPES, type PuzzleDifficulty, type PuzzleScope, type PuzzleRunState } from '../../src/domain/entities/puzzle';
import { isPuzzleSolved, movePuzzlePiece, shuffledSolvablePuzzle } from '../../src/domain/services/slidingPuzzle';
import { PhotoLightbox } from '../../src/presentation/components/PhotoLightbox';
import { SlidingPicturePuzzle } from '../../src/presentation/components/SlidingPicturePuzzle';
import { BackIcon, ZoomInIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useNetwork } from '../../src/presentation/network/NetworkProvider';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { useMobileSync } from '../../src/sync/MobileSyncProvider';

const clampGrid = (value: string | undefined): PuzzleDifficulty => value === '4' ? 4 : 3;

export default function PuzzleScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ scope?: string; grid?: string; level?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, spacing, radius, typography } = useTheme();
  const { requestSync } = useMobileSync();
  const { isOffline } = useNetwork();
  const offlineRef = useRef(isOffline);
  useEffect(() => {
    offlineRef.current = isOffline;
  }, [isOffline]);

  const grid = clampGrid(params.grid);
  const rawScope = params.scope;
  const scope = (typeof rawScope === 'string' && rawScope in PUZZLE_SCOPES ? rawScope : 'animals_all') as PuzzleScope;
  const knowledgeLevel: KnowledgeLevel = params.level === 'easy' || params.level === 'medium' ? params.level : 'hard';
  const boardSize = Math.min(width - spacing.lg * 2, 380);
  const hiddenPiece = grid * grid - 1;

  const [species, setSpecies] = useState<Species | null>(null);
  const [imageSource, setImageSource] = useState<ImageSourcePropType | null>(null);
  const [pieces, setPieces] = useState<number[]>([]);
  const [state, setState] = useState<PuzzleRunState>('ready');
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const startedAt = useRef(0);
  const pausedAt = useRef(0);
  const previousCode = useRef<string | null>(null);

  const loadPuzzle = useCallback(async () => {
    setSpecies(null);
    setImageSource(null);
    setLightboxOpen(false);
    const pool = await speciesRepository.findQuizPool(db, PUZZLE_SCOPES[scope].classes, knowledgeLevel, 'puzzle');
    const available = pool.filter((item) => item.codigo !== previousCode.current && (item.photo || thumbnailFor(item.codigo)));
    const choices = available.length > 0 ? available : pool.filter((item) => item.photo || thumbnailFor(item.codigo));
    const pick = choices[Math.floor(Math.random() * choices.length)];
    if (!pick) return;

    previousCode.current = pick.codigo;
    const bundled = thumbnailFor(pick.codigo);
    let frozenSource: ImageSourcePropType | null = bundled;
    const remote = pick.photo?.url;
    if (remote && offlineRef.current !== true) {
      const prefetched = await Image.prefetch(remote, 'disk').catch(() => false);
      if (prefetched) frozenSource = { uri: remote };
    }
    if (!frozenSource && remote) frozenSource = { uri: remote };

    setSpecies(pick);
    setImageSource(frozenSource);
    setPieces(shuffledSolvablePuzzle(grid, Math.random));
    setState('ready');
    setMoves(0);
    setElapsed(0);
  }, [db, grid, knowledgeLevel, scope]);

  useEffect(() => {
    void loadPuzzle();
  }, [loadPuzzle]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && state === 'running') {
        pausedAt.current = Date.now();
        setState('paused');
      } else if (next === 'active' && state === 'paused') {
        startedAt.current += Date.now() - pausedAt.current;
        setState('running');
      }
    });
    return () => subscription.remove();
  }, [state]);

  useEffect(() => {
    if (state !== 'running') return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => clearInterval(timer);
  }, [state]);

  const finish = useCallback(async (nextMoves: number) => {
    const finalElapsed = Math.max(1, Date.now() - startedAt.current);
    setElapsed(finalElapsed);
    setState('completed');
    const now = Date.now();
    await puzzleRepository.submit(db, {
      scope,
      knowledgeLevel,
      gridSize: grid,
      bestTimeMs: finalElapsed,
      fewestMoves: nextMoves,
      playedAt: now,
      updatedAt: now,
    });
    await requestSync();
    haptics.success();
  }, [db, grid, knowledgeLevel, requestSync, scope]);

  const move = useCallback((piece: number) => {
    if (state === 'completed') return;
    const next = movePuzzlePiece(pieces, piece, hiddenPiece, grid);
    if (!next) return;
    if (state === 'ready') {
      startedAt.current = Date.now();
      setState('running');
    } else if (state === 'paused') {
      startedAt.current += Date.now() - pausedAt.current;
      setState('running');
    }
    const nextMoves = moves + 1;
    setMoves(nextMoves);
    setPieces(next);
    haptics.tap();
    if (isPuzzleSolved(next)) void finish(nextMoves);
  }, [finish, grid, hiddenPiece, moves, pieces, state]);

  const fullPhoto = species?.photo?.fullUrl ?? species?.photo?.url;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
        <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface, borderRadius: radius.pill }]} accessibilityLabel="Volver">
          <BackIcon color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[typography.headerTitle, { color: colors.text }]}>Puzzle {grid} × {grid}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {PUZZLE_SCOPES[scope].label} · {Math.floor(elapsed / 1000)} s · {moves} movimientos
          </Text>
        </View>
      </View>

      {species && imageSource && pieces.length > 0 ? (
        <View style={[styles.boardFrame, { marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceVariant }]}>
          <SlidingPicturePuzzle
            key={`${species.codigo}-${grid}`}
            size={boardSize}
            gridSize={grid}
            pieces={pieces}
            hiddenPiece={hiddenPiece}
            source={imageSource}
            onMove={move}
            disabled={state === 'completed'}
            revealHidden={state === 'completed'}
            label={state === 'completed' ? species.displayName : 'una especie por descubrir'}
          />
        </View>
      ) : (
        <View style={[styles.loading, { width: boardSize, height: boardSize, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceVariant }]}>
          <Text style={[typography.body, { color: colors.textMuted }]}>Preparando puzzle…</Text>
        </View>
      )}

      {state === 'completed' && species ? (
        <View style={[styles.complete, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
          <Text style={[typography.cardTitle, { color: colors.text }]}>{species.displayName}</Text>
          <Text style={[typography.body, styles.scientific, { color: colors.textSecondary }]}>{species.scientificName}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Completaste en {Math.round(elapsed / 1000)} s · {moves} movimientos</Text>
          <View style={styles.actions}>
            <Pressable onPress={() => void loadPuzzle()} style={[styles.action, { backgroundColor: colors.play, borderRadius: radius.pill }]}>
              <Text style={[typography.label, { color: colors.onPlay }]}>Otro puzzle</Text>
            </Pressable>
            {fullPhoto ? <Pressable onPress={() => setLightboxOpen(true)} style={styles.link}><ZoomInIcon color={colors.play} size={18} /><Text style={[typography.label, { color: colors.play }]}>Ampliar</Text></Pressable> : null}
            <Pressable onPress={() => router.push(`/species/${species.codigo}`)} style={styles.link}>
              <Text style={[typography.label, { color: colors.play }]}>Ver especie</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={[typography.body, styles.instructions, { color: colors.textMuted, marginTop: spacing.lg }]}>Tocá una ficha junto al espacio vacío para deslizarla. Ordená la imagen completa; todas las partidas tienen solución.</Text>
      )}

      <PhotoLightbox visible={lightboxOpen} uri={fullPhoto} label={species?.displayName ?? ''} onClose={() => setLightboxOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  boardFrame: { overflow: 'hidden' },
  loading: { alignItems: 'center', justifyContent: 'center' },
  instructions: { textAlign: 'center', paddingHorizontal: 28, maxWidth: 430 },
  complete: { width: '90%', maxWidth: 430, padding: 18, marginTop: 18, gap: 4 },
  scientific: { fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  action: { paddingHorizontal: 16, paddingVertical: 11 },
  link: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5 },
});
