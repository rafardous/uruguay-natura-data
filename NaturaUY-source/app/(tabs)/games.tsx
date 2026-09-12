import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MotiView } from 'moti';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import type { Species } from '../../src/domain/entities/species';
import { speciesRepository } from '../../src/data/repositories/speciesRepository';
import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { CollapsibleGradientHeader } from '../../src/presentation/components/CollapsibleGradientHeader';
import { FamilyGlyph } from '../../src/presentation/components/FamilyGlyph';
import { SpeciesImage } from '../../src/presentation/components/SpeciesImage';
import { BiomesIcon, ClassifyIcon, MenuIcon, PuzzleIcon, TriviaIcon, TrophyIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { COLLAPSIBLE_HEADER_EXPANDED } from '../../src/presentation/theme/tokens';
import { navigationBottomInset } from '../../src/presentation/navigationPolicy';

const COVER_SPECIES_CODES = ['O_bezoarti', 'S_magellan', 'P_coronata'] as const;
const GAME_CARD_HEIGHT = 184;

const UPCOMING_GAMES = [
  { id: 'trivia', title: 'Trivia', description: 'Preguntas y curiosidades de nuestra naturaleza.', colors: ['#2F7280', '#214F65', '#283E62'] as const },
  { id: 'puzzle', title: 'Puzzle', description: 'Reconstruí una especie, pieza por pieza.', colors: ['#B56B3E', '#8D4D3A', '#633847'] as const },
  { id: 'classify', title: 'Clasificar', description: 'Ordená especies por sus grupos y características.', colors: ['#66805B', '#4D684D', '#344F48'] as const },
  { id: 'habitat', title: '¿Dónde vive?', description: 'Relacioná cada especie con su ambiente.', colors: ['#4F8A78', '#35675C', '#284F4A'] as const },
] as const;

const PUZZLE_TILES = [
  { left: 0, top: 0, fromX: -25, fromY: -17, rotate: '-8deg' },
  { left: 62, top: 0, fromX: 24, fromY: -22, rotate: '7deg' },
  { left: 0, top: 62, fromX: -24, fromY: 21, rotate: '6deg' },
  { left: 62, top: 62, fromX: 28, fromY: 18, rotate: '-7deg' },
] as const;

function IdentifyCover({ species, onPress }: { species: Species[]; onPress: () => void }): React.JSX.Element {
  const { radius, spacing, typography, elevation } = useTheme();
  const photoPositions = [styles.photoLeft, styles.photoRight, styles.photoCenter];

  return (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Abrir Identificá la especie" style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.99 : 1 }] }]}>
        <LinearGradient colors={['#A95670', '#813F5E', '#5B334E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.identifyCover, elevation.medium, { borderRadius: radius.xl, padding: spacing.lg }]}>
          <View style={styles.identifyCopy}>
            <Text style={[typography.eyebrow, styles.upcomingKicker]}>JUGÁ AHORA</Text>
            <Text style={[typography.display, { color: '#FFFFFF', marginTop: 4 }]}>Identificá</Text>
            <Text style={[typography.body, { color: 'rgba(255,255,255,0.84)', marginTop: 5 }]}>Reconocé especies uruguayas a partir de sus fotos.</Text>
          </View>
          <View style={styles.photoFan} accessibilityElementsHidden>
            {species.slice(0, 3).map((item, index) => (
              <View key={item.codigo} style={[styles.photoFrame, photoPositions[index]]}>
                <SpeciesImage species={item} height={92} borderRadius={17} bordered={false} glyphSize={40} />
                <View style={[StyleSheet.absoluteFill, styles.photoBorder, { borderRadius: 17 }]} pointerEvents="none" />
              </View>
            ))}
          </View>
        </LinearGradient>
      </Pressable>
    </MotiView>
  );
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
        <MotiView key={group.clase} from={{ opacity: 0, translateX: 22 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 300, delay: 130 + index * 90 }} style={[styles.classChip, { top: 5 + index * 38, backgroundColor: group.color }]}>
          <FamilyGlyph clase={group.clase} color={group.foreground} size={25} opacity={0.95} />
          <Text style={[styles.classLetter, { color: group.foreground }]}>{group.clase.slice(0, 1)}</Text>
        </MotiView>
      ))}
    </View>
  );
}

function HabitatArt(): React.JSX.Element {
  return <View style={styles.habitatArt} accessibilityElementsHidden><View style={styles.habitatCircle}><BiomesIcon color="#285349" size={46} /></View><View style={[styles.habitatDot, styles.habitatDotOne]} /><View style={[styles.habitatDot, styles.habitatDotTwo]} /><View style={[styles.habitatDot, styles.habitatDotThree]} /></View>;
}

function UpcomingCover({ game, species, index, onPress }: { game: (typeof UPCOMING_GAMES)[number]; species?: Species; index: number; onPress?: () => void }): React.JSX.Element {
  const { radius, spacing, typography, elevation } = useTheme();
  return (
    <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: 50 + index * 45 }}>
      <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityState={{ disabled: !onPress }} accessibilityLabel={onPress ? `Abrir ${game.title}` : `${game.title}, próximamente`}>
        <LinearGradient colors={[...game.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.upcomingCover, elevation.low, { borderRadius: radius.xl, padding: spacing.lg }]}>
          <View style={styles.upcomingCopy}>
            <Text style={[typography.eyebrow, styles.upcomingKicker]}>{onPress ? 'JUGÁ AHORA' : 'PRÓXIMAMENTE'}</Text>
            <Text style={[typography.display, styles.upcomingTitle]}>{game.title}</Text>
            <Text style={[typography.body, styles.upcomingDescription]}>{game.description}</Text>
          </View>
          {game.id === 'trivia' ? <TriviaArt species={species} /> : game.id === 'puzzle' ? <PuzzleArt species={species} /> : game.id === 'classify' ? <ClassifyArt /> : <HabitatArt />}
        </LinearGradient>
      </Pressable>
    </MotiView>
  );
}

export default function GamesScreen(): React.JSX.Element {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography } = useTheme();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });
  const [menuOpen, setMenuOpen] = useState(false);
  const [coverSpecies, setCoverSpecies] = useState<Species[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all(COVER_SPECIES_CODES.map((codigo) => speciesRepository.findByCodigo(db, codigo))).then(async (featured) => {
      let resolved = featured.filter((item): item is Species => Boolean(item?.photo));
      if (resolved.length < 3) {
        const fallback = await speciesRepository.findPaged(db, { onlyWithPhoto: true }, 6, 30);
        resolved = [...resolved, ...fallback.items.filter((item) => !resolved.some((current) => current.codigo === item.codigo))].slice(0, 3);
      }
      if (active) setCoverSpecies(resolved);
    });
    return () => { active = false; };
  }, [db]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <CollapsibleGradientHeader
        scrollY={scrollY}
        gradient={['#7A5CAD', '#6E4E9E', '#4C356F']}
        controls={<><Pressable onPress={() => { haptics.tap(); setMenuOpen(true); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Abrir menú" style={[styles.menuButton, { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill }]}><MenuIcon color={colors.canvasText} /></Pressable><View style={styles.flex} /><Pressable onPress={() => { haptics.tap(); router.push('/game/records'); }} accessibilityRole="button" accessibilityLabel="Ver récords" style={[styles.recordsButton, { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.pill }]}><TrophyIcon color="#E8C35A" size={18} /><Text style={[typography.label, { color: colors.canvasText }]}>Récords</Text></Pressable></>}
        expandedContent={<Text style={[typography.headerTitle, { color: colors.canvasText, maxWidth: 345 }]}>Demostrá tu conocimiento de nuestra flora y fauna</Text>}
      />

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: COLLAPSIBLE_HEADER_EXPANDED + insets.top, paddingBottom: navigationBottomInset(insets.bottom, spacing.xl) }}>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <IdentifyCover species={coverSpecies} onPress={() => { haptics.press(); router.push('/game/identify-modes' as never); }} />
        </View>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
          {UPCOMING_GAMES.map((game, index) => <UpcomingCover key={game.id} game={game} species={coverSpecies[(index + 1) % Math.max(coverSpecies.length, 1)]} index={index} onPress={game.id === 'puzzle' ? () => { haptics.press(); router.push('/game/puzzle-setup' as never); } : game.id === 'trivia' ? () => { haptics.press(); router.push('/game/trivia-setup' as never); } : game.id === 'classify' ? () => { haptics.press(); router.push('/game/classify' as never); } : () => { haptics.press(); router.push('/game/habitat' as never); }} />)}
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
  identifyCover: { height: GAME_CARD_HEIGHT, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  identifyCopy: { flex: 1, maxWidth: '58%', zIndex: 2 },
  photoFan: { height: 132, width: 130, position: 'relative' },
  photoFrame: { position: 'absolute', top: 12, width: 67, height: 92, overflow: 'hidden', backgroundColor: '#EEE8D5' },
  photoLeft: { left: 0, transform: [{ rotate: '-8deg' }, { translateY: 13 }], zIndex: 1, borderRadius: 15 },
  photoRight: { right: 0, transform: [{ rotate: '8deg' }, { translateY: 13 }], zIndex: 1, borderRadius: 15 },
  photoCenter: { left: 32, top: 2, zIndex: 3, borderRadius: 15 },
  photoBorder: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.78)' },
  upcomingCover: { height: GAME_CARD_HEIGHT, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  upcomingCopy: { flex: 1, maxWidth: '59%', zIndex: 2 },
  upcomingKicker: { color: 'rgba(255,255,255,0.72)' },
  upcomingTitle: { color: '#FFFFFF', marginTop: 4 },
  upcomingDescription: { color: 'rgba(255,255,255,0.82)', marginTop: 5 },
  triviaArt: { width: 128, height: 132, alignItems: 'center', justifyContent: 'center' },
  triviaPhoto: { width: 102 },
  questionBubble: { position: 'absolute', right: 3, top: 4, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 9, elevation: 5 },
  smallQuestion: { position: 'absolute', left: 3, bottom: 7, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5D77D' },
  questionText: { color: '#214F65', fontSize: 18, fontWeight: '900' },
  puzzleBoard: { width: 120, height: 120, position: 'relative' },
  puzzleTile: { position: 'absolute', width: 58, height: 58, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.82)', backgroundColor: 'rgba(255,255,255,0.14)' },
  puzzleImage: { position: 'absolute', width: 120, height: 120 },
  artFallback: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)' },
  classifyArt: { width: 128, height: 126, position: 'relative' },
  classifyIcon: { position: 'absolute', left: 1, top: 47, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  classChip: { position: 'absolute', right: 0, width: 72, height: 33, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.48)' },
  classLetter: { fontSize: 12, fontWeight: '800' },
  habitatArt: { width: 128, height: 126, alignItems: 'center', justifyContent: 'center' },
  habitatCircle: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D9EFE3', borderWidth: 2, borderColor: 'rgba(255,255,255,.55)' },
  habitatDot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#F2D27B', borderWidth: 2, borderColor: 'rgba(255,255,255,.7)' },
  habitatDotOne: { left: 7, top: 28 }, habitatDotTwo: { right: 3, top: 20, backgroundColor: '#B9D5A8' }, habitatDotThree: { right: 12, bottom: 12, backgroundColor: '#E7A77E' },
});
