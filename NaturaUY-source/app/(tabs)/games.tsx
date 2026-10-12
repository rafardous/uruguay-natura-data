import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import type { Species } from '../../src/domain/entities/species';
import type { Habitat } from '../../src/domain/entities/habitat';
import { habitatThumbMap } from '../../src/data/assets/habitatThumbMap';
import { useHabitatCatalog } from '../../src/presentation/hooks/useHabitatCatalog';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { CollapsibleGradientHeader } from '../../src/presentation/components/CollapsibleGradientHeader';
import { FamilyGlyph } from '../../src/presentation/components/FamilyGlyph';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { BiomesIcon, ClassifyIcon, MenuIcon, PuzzleIcon, TriviaIcon, TrophyIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { COLLAPSIBLE_HEADER_EXPANDED, MAIN_HEADER_GRADIENT } from '../../src/presentation/theme/tokens';
import { navigationBottomInset } from '../../src/presentation/navigationPolicy';

const COVER_SPECIES_CODES = ['O_bezoarti', 'S_magellan', 'P_coronata'] as const;
const PUZZLE_COVER_CODE = 'C_glaucoca';
const GUESS_COVER_CODE = 'C_duris_te';
const GAMES = [
  { id: 'identify', route: '/game/identify-modes', title: 'Identificá', colors: ['#A95670', '#813F5E', '#5B334E'] as const },
  { id: 'guess', route: '/game/guess', title: 'Adiviná', colors: ['#84659E', '#644A82', '#48365E'] as const },
  { id: 'trivia', route: '/game/trivia-setup', title: 'Trivia', colors: ['#2F7280', '#214F65', '#283E62'] as const },
  { id: 'puzzle', route: '/game/puzzle-setup', title: 'Puzzle', colors: ['#B56B3E', '#8D4D3A', '#633847'] as const },
  { id: 'classify', route: '/game/classify', title: 'Clasificar', colors: ['#66805B', '#4D684D', '#344F48'] as const },
  { id: 'habitat', route: '/game/habitat', title: '¿Dónde vive?', colors: ['#4F8A78', '#35675C', '#284F4A'] as const },
] as const;

const PUZZLE_TILES = [
  { left: 0, top: 0, fromX: -25, fromY: -17, rotate: '-8deg' },
  { left: 46, top: 0, fromX: 24, fromY: -22, rotate: '7deg' },
  { left: 0, top: 46, fromX: -24, fromY: 21, rotate: '6deg' },
  { left: 46, top: 46, fromX: 28, fromY: 18, rotate: '-7deg' },
] as const;

function IdentifyArt({ species }: { species: Species[] }): React.JSX.Element {
  const photoPositions = [styles.photoLeft, styles.photoRight, styles.photoCenter];
  return <View style={styles.photoFan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {species.slice(0, 3).map((item, index) => (
              <View key={item.codigo} style={[styles.photoFrame, photoPositions[index]]}>
                <SpeciesImage species={item} height={64} borderRadius={12} bordered={false} glyphSize={28} />
                <View style={[StyleSheet.absoluteFill, styles.photoBorder, { borderRadius: 12 }]} pointerEvents="none" />
              </View>
            ))}
    {!species.length && <View style={styles.artFallback}><FamilyGlyph clase="Aves" color="#FFFFFF" size={48} /></View>}
  </View>;
}

function GuessArt({ species }: { species?: Species }): React.JSX.Element {
  return <View style={styles.guessArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {species && <SpeciesImage species={species} height={74} borderRadius={22} bordered={false} glyphSize={38} style={{ width: 74 }} />}
    <View style={styles.guessOverlay}><Text style={styles.guessQuestion} allowFontScaling={false}>?</Text></View>
    <View style={styles.clueTabs}>{[0, 1, 2].map((index) => <View key={index} style={[styles.clueTab, { width: 22 - index * 4 }]} />)}</View>
  </View>;
}

function TriviaArt({ species }: { species?: Species }): React.JSX.Element {
  return (
    <View style={styles.triviaArt} accessibilityElementsHidden>
      {species ? <SpeciesImage species={species} height={102} borderRadius={51} bordered={false} glyphSize={42} style={styles.triviaPhoto} /> : <View style={styles.artFallback}><TriviaIcon color="#FFFFFF" size={46} /></View>}
      <MotiView from={{ opacity: 0, scale: 0.65, translateY: 8 }} animate={{ opacity: 1, scale: 1, translateY: 0 }} transition={{ type: 'spring', damping: 10, delay: 180 }} style={styles.questionBubble}>
        <TriviaIcon color="#214F65" size={30} />
      </MotiView>
      <MotiView from={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 0.86, scale: 1 }} transition={{ type: 'spring', damping: 9, delay: 310 }} style={styles.smallQuestion}><Text style={styles.questionText}>?</Text></MotiView>
    </View>
  );
}

function PuzzleArt({ species }: { species?: Species }): React.JSX.Element {
  const uri = species?.photo?.url;
  return (
    <View style={styles.puzzleBoard} accessibilityElementsHidden>
      {uri ? PUZZLE_TILES.map((tile, index) => (
        <MotiView
          key={`${uri}-${index}`}
          from={{ opacity: 0, translateX: tile.fromX, translateY: tile.fromY, rotate: tile.rotate, scale: 0.9 }}
          animate={{ opacity: 1, translateX: 0, translateY: 0, rotate: '0deg', scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 135, delay: 130 + index * 105 }}
          style={[styles.puzzleTile, { left: tile.left, top: tile.top }]}
        >
          <Image source={{ uri }} contentFit="cover" style={[styles.puzzleImage, { left: -tile.left, top: -tile.top }]} />
        </MotiView>
      )) : <View style={styles.artFallback}><PuzzleIcon color="#FFFFFF" size={48} /></View>}
    </View>
  );
}

function ClassifyArt(): React.JSX.Element {
  const groups = [
    { clase: 'Aves', color: '#F1D6D2', foreground: '#5D302D' },
    { clase: 'Mammalia', color: '#EADCB8', foreground: '#554118' },
    { clase: 'Amphibia', color: '#D8E5DD', foreground: '#385547' },
  ];
  return (
    <View style={styles.classifyArt} accessibilityElementsHidden>
      <View style={styles.classifyIcon}><ClassifyIcon color="#FFFFFF" size={28} /></View>
      {groups.map((group, index) => (
        <MotiView key={group.clase} from={{ opacity: 0, translateX: 18 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 300, delay: 130 + index * 70 }} style={[styles.classChip, { top: 3 + index * 25, backgroundColor: group.color }]}>
          <FamilyGlyph clase={group.clase} color={group.foreground} size={25} opacity={0.95} />
          <Text style={[styles.classLetter, { color: group.foreground }]}>{group.clase.slice(0, 1)}</Text>
        </MotiView>
      ))}
    </View>
  );
}

function HabitatArt({ habitat }: { habitat?: Habitat }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const photo = habitat?.photo;
  useEffect(() => { setFailed(false); }, [photo?.id]);
  if (photo && !failed) return <View style={styles.habitatArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Image source={habitatThumbMap[photo.id] ?? { uri: photo.thumbnailUrl }} contentFit="cover" cachePolicy="memory-disk" style={styles.habitatPhoto} onError={() => setFailed(true)} /><View style={styles.habitatPhotoBadge}><BiomesIcon color="#285349" size={22} /></View></View>;
  return <View style={styles.habitatArt} accessibilityElementsHidden><View style={styles.habitatCircle}><BiomesIcon color="#285349" size={46} /></View><View style={[styles.habitatDot, styles.habitatDotOne]} /><View style={[styles.habitatDot, styles.habitatDotTwo]} /><View style={[styles.habitatDot, styles.habitatDotThree]} /></View>;
}

function GameCover({ game, species, coverSpecies, habitat, titleHeight, onTitleHeight, onPress, animationCycle }: { game: (typeof GAMES)[number]; species?: Species; coverSpecies: Species[]; habitat?: Habitat; titleHeight: number; onTitleHeight: (height: number) => void; onPress: () => void; animationCycle: number }): React.JSX.Element {
  const { radius, spacing, typography, elevation } = useTheme();
  return (
    <View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Abrir ${game.title}`}>
        <LinearGradient colors={[...game.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gameCover, elevation.low, { height: 94 + titleHeight, borderRadius: radius.xl, padding: spacing.md }]}>
          <View style={styles.gameArt}>
            <MotiView key={animationCycle} from={{ opacity: 0.82, translateY: 6, scale: 0.94 }} animate={{ opacity: 1, translateY: 0, scale: 1 }} transition={{ type: 'spring', damping: 11, stiffness: 150 }} style={styles.artScale}>{game.id === 'identify' ? <IdentifyArt species={coverSpecies} /> : game.id === 'guess' ? <GuessArt species={species} /> : game.id === 'trivia' ? <TriviaArt species={species} /> : game.id === 'puzzle' ? <PuzzleArt species={species} /> : game.id === 'classify' ? <ClassifyArt /> : <HabitatArt habitat={habitat} />}</MotiView>
          </View>
          <View style={[styles.gameCopy, { minHeight: titleHeight }]}><Text onLayout={(event) => onTitleHeight(event.nativeEvent.layout.height)} style={[typography.cardTitle, styles.gameTitle]}>{game.title}</Text></View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function GamesScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const { items: habitats } = useHabitatCatalog();
  const habitat = habitats.find((item) => item.code === 'pastizales' && item.photo)
    ?? habitats.find((item) => item.code === 'pastizal_campo_natural' && item.photo)
    ?? habitats.find((item) => item.photo);
  const [measuredTitleHeight, setMeasuredTitleHeight] = useState(0);
  const titleHeight = Math.max(46 * fontScale, measuredTitleHeight);
  const measureTitle = (height: number): void => setMeasuredTitleHeight((current) => Math.max(current, Math.ceil(height)));
  useEffect(() => { setMeasuredTitleHeight(0); }, [width, fontScale]);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });
  const [menuOpen, setMenuOpen] = useState(false);
  const [coverSpecies, setCoverSpecies] = useState<Species[]>([]);
  const [puzzleSpecies, setPuzzleSpecies] = useState<Species>();
  const [guessSpecies, setGuessSpecies] = useState<Species>();
  const [animationCycle, setAnimationCycle] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setAnimationCycle((cycle) => cycle + 1), 6500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all(COVER_SPECIES_CODES.map((codigo) => speciesRepository.findByCodigo(db, codigo))).then(async (featured) => {
      let resolved = featured.filter((item): item is Species => Boolean(item?.photo));
      if (resolved.length < 3) {
        const fallback = await speciesRepository.findPaged(db, { onlyWithPhoto: true }, 6, 30);
        resolved = [...resolved, ...fallback.items.filter((item) => !resolved.some((current) => current.codigo === item.codigo))].slice(0, 3);
      }
      if (active) setCoverSpecies(resolved);
    }).catch(() => { if (active) setCoverSpecies([]); });
    return () => { active = false; };
  }, [db]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      speciesRepository.findByCodigo(db, PUZZLE_COVER_CODE),
      speciesRepository.findByCodigo(db, GUESS_COVER_CODE),
    ]).then(([puzzle, guess]) => {
      if (!active) return;
      setPuzzleSpecies(puzzle ?? undefined);
      setGuessSpecies(guess ?? undefined);
    }).catch(() => {
      if (active) { setPuzzleSpecies(undefined); setGuessSpecies(undefined); }
    });
    return () => { active = false; };
  }, [db]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <CollapsibleGradientHeader
        scrollY={scrollY}
        gradient={MAIN_HEADER_GRADIENT}
        controls={<><Pressable onPress={() => { haptics.tap(); setMenuOpen(true); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Abrir menú" style={[styles.menuButton, { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill }]}><MenuIcon color={colors.canvasText} /></Pressable><View style={styles.flex} /><Pressable onPress={() => { haptics.tap(); router.push('/game/records'); }} accessibilityRole="button" accessibilityLabel="Ver récords" style={[styles.recordsButton, { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.pill }]}><TrophyIcon color="#E8C35A" size={18} /><Text style={[typography.label, { color: colors.canvasText }]}>Récords</Text></Pressable></>}
        expandedContent={<Text style={[typography.headerTitle, { color: colors.canvasText, maxWidth: 345 }]}>Demostrá tu conocimiento de nuestra flora y fauna</Text>}
      />

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: COLLAPSIBLE_HEADER_EXPANDED + insets.top, paddingBottom: navigationBottomInset(insets.bottom, spacing.xl) }}>
        <View style={[styles.gameGrid, { paddingHorizontal: spacing.lg, marginTop: spacing.lg }]}>
          {GAMES.map((game, index) => <View key={game.id} style={styles.gameCell}><GameCover game={game} coverSpecies={coverSpecies} habitat={habitat} titleHeight={titleHeight} onTitleHeight={measureTitle} animationCycle={animationCycle} species={game.id === 'puzzle' ? puzzleSpecies : game.id === 'guess' ? guessSpecies : coverSpecies[(index + 1) % Math.max(coverSpecies.length, 1)]} onPress={() => { haptics.press(); router.push(game.route as never); }} /></View>)}
        </View>
      </Animated.ScrollView>
      <AppDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  menuButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  recordsButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, height: 42 },
  photoFan: { height: 82, width: 104, position: 'relative' },
  photoFrame: { position: 'absolute', top: 8, width: 48, height: 64, overflow: 'hidden', backgroundColor: '#EEE8D5' },
  photoLeft: { left: 0, transform: [{ rotate: '-8deg' }], zIndex: 1, borderRadius: 12 },
  photoRight: { right: 0, transform: [{ rotate: '8deg' }], zIndex: 1, borderRadius: 12 },
  photoCenter: { left: 28, top: 2, zIndex: 3, borderRadius: 12 },
  photoBorder: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.78)' },
  gameGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  gameCell: { width: '48%' },
  gameCover: { overflow: 'hidden', alignItems: 'stretch', justifyContent: 'space-between' },
  gameArt: { height: 70, alignItems: 'center', justifyContent: 'center' },
  artScale: { transform: [{ scale: 0.8 }] },
  gameCopy: { justifyContent: 'center', zIndex: 2 },
  gameTitle: { color: '#FFFFFF', fontSize: 19, lineHeight: 23, textAlign: 'center' },
  guessArt: { width: 88, height: 82, alignItems: 'center', justifyContent: 'center' },
  guessOverlay: { position: 'absolute', width: 74, height: 74, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(52,29,79,0.45)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.65)' },
  guessQuestion: { color: '#FFFFFF', fontSize: 52, lineHeight: 65, fontWeight: '800' },
  clueTabs: { position: 'absolute', right: -4, bottom: 0, gap: 3, padding: 5, borderRadius: 8, backgroundColor: '#F5D77D' },
  clueTab: { height: 3, borderRadius: 2, backgroundColor: '#644A82' },
  triviaArt: { width: 88, height: 82, alignItems: 'center', justifyContent: 'center' },
  triviaPhoto: { width: 68 },
  questionBubble: { position: 'absolute', right: 0, top: 0, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  smallQuestion: { position: 'absolute', left: 0, bottom: 3, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5D77D' },
  questionText: { color: '#214F65', fontSize: 18, fontWeight: '900' },
  puzzleBoard: { width: 88, height: 82, position: 'relative' },
  puzzleTile: { position: 'absolute', width: 42, height: 42, borderRadius: 8, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.82)', backgroundColor: 'rgba(255,255,255,0.14)' },
  puzzleImage: { position: 'absolute', width: 88, height: 82 },
  artFallback: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)' },
  classifyArt: { width: 88, height: 82, position: 'relative' },
  classifyIcon: { position: 'absolute', left: 0, top: 29, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  classChip: { position: 'absolute', right: 0, width: 54, height: 24, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.48)' },
  classLetter: { fontSize: 10, fontWeight: '800' },
  habitatArt: { width: 88, height: 82, alignItems: 'center', justifyContent: 'center' },
  habitatPhoto: { width: 88, height: 76, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  habitatPhotoBadge: { position: 'absolute', right: -3, bottom: -1, backgroundColor: '#D9EFE3', padding: 5, borderRadius: 18 },
  habitatCircle: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D9EFE3', borderWidth: 2, borderColor: 'rgba(255,255,255,.55)' },
  habitatDot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#F2D27B', borderWidth: 2, borderColor: 'rgba(255,255,255,.7)' },
  habitatDotOne: { left: 7, top: 28 }, habitatDotTwo: { right: 3, top: 20, backgroundColor: '#B9D5A8' }, habitatDotThree: { right: 12, bottom: 12, backgroundColor: '#E7A77E' },
});
