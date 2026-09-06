import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { AppDrawer } from '../../src/presentation/components/AppDrawer';
import { CollapsibleGradientHeader } from '../../src/presentation/components/CollapsibleGradientHeader';
import { BookIcon, ChevronRightIcon, GameIcon, LeafIcon, MenuIcon, TrophyIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';
import { COLLAPSIBLE_HEADER_EXPANDED, NAV_ISLAND_HEIGHT, NAV_ISLAND_MARGIN } from '../../src/presentation/theme/tokens';

const GAME_TYPES = [
  { id: 'identify', title: 'Identificá la especie', description: 'Elegí distintos modos para poner a prueba cuántas especies conocés.', icon: GameIcon, active: true },
  { id: 'trivia', title: 'Trivia', description: 'Preguntas y curiosidades de la naturaleza uruguaya. Próximamente.', icon: BookIcon, active: false },
  { id: 'puzzle', title: 'Puzzle', description: 'Armá la imagen de una especie, pieza por pieza. Próximamente.', icon: LeafIcon, active: false },
  { id: 'classify', title: 'Clasificar', description: 'Agrupá especies por clasificación y género. Próximamente.', icon: LeafIcon, active: false },
] as const;

export default function GamesScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors, radius, spacing, typography, elevation } = theme;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => { scrollY.value = event.contentOffset.y; });

  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <CollapsibleGradientHeader
        scrollY={scrollY}
        gradient={['#7A5CAD', '#6E4E9E', '#4C356F']}
        compactTitle="Juegos"
        controls={
          <>
            <Pressable onPress={() => { haptics.tap(); setMenuOpen(true); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Abrir menú" style={[styles.menuButton, { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill }]}>
              <MenuIcon color={colors.canvasText} />
            </Pressable>
            <View style={styles.flex} />
            <Pressable onPress={() => router.push('/game/records')} accessibilityRole="button" accessibilityLabel="Ver récords" style={[styles.recordsButton, { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.pill }]}>
              <TrophyIcon color={colors.canvasText} size={18} /><Text style={[typography.label, { color: colors.canvasText }]}>Récords</Text>
            </Pressable>
          </>
        }
        expandedContent={<View><Text style={[typography.eyebrow, { color: colors.canvasTextMuted }]}>APRENDÉ JUGANDO</Text><Text style={[typography.title, { color: colors.canvasText, marginTop: 4 }]}>Juegos</Text></View>}
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: COLLAPSIBLE_HEADER_EXPANDED, paddingBottom: NAV_ISLAND_HEIGHT + NAV_ISLAND_MARGIN + insets.bottom + spacing.xl }}
      >
        <Text style={[typography.eyebrow, { color: colors.textMuted, paddingHorizontal: spacing.lg, marginTop: spacing.xl }]}>
          ELEGÍ UN JUEGO
        </Text>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
          {GAME_TYPES.map((game, index) => {
            const Icon = game.icon;

            return (
              <MotiView
                key={game.id}
                from={{ opacity: 0, translateY: 7 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 240, delay: index * 35 }}
              >
                <Pressable
                  onPress={() => { if (!game.active) return; haptics.press(); router.push('/game/identify-modes' as never); }}
                  disabled={!game.active}
                  accessibilityRole="button"
                  accessibilityLabel={game.active ? `Abrir ${game.title}` : `${game.title}, próximamente`}
                  style={({ pressed }) => [
                    styles.mode,
                    elevation.low,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: radius.lg,
                      padding: spacing.lg,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}
                >
                  <View style={styles.modeTop}>
                    <Icon color={colors.text} size={20} />
                    <Text style={[typography.cardTitle, styles.flex, { color: colors.text }]}>{game.title}</Text>

                    {game.active ? <ChevronRightIcon color={colors.textMuted} size={18} /> : <Text style={[typography.caption, { color: colors.textMuted }]}>PRÓXIMAMENTE</Text>}
                  </View>

                  <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>
                    {game.description}
                  </Text>
                </Pressable>
              </MotiView>
            );
          })}
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
  mode: {},
  modeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
