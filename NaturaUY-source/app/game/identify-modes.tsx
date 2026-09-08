import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QUIZ_MODES, type QuizMode } from '../../src/domain/entities/quiz';
import { BackIcon, ChevronRightIcon, ClockIcon, HeartIcon, NamingIcon, TrophyIcon } from '../../src/presentation/components/TabIcons';
import { haptics } from '../../src/presentation/haptics';
import { useTheme } from '../../src/presentation/theme/ThemeProvider';

const MODES: { id: QuizMode; icon: typeof TrophyIcon }[] = [
  { id: 'classic', icon: TrophyIcon },
  { id: 'timed', icon: ClockIcon },
  { id: 'survival', icon: HeartIcon },
  { id: 'naming', icon: NamingIcon },
];

export default function IdentifyModesScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, typography, elevation } = useTheme();
  return <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + spacing.sm }]}>
    <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
      <Pressable onPress={() => { haptics.tap(); router.back(); }} style={[styles.back, elevation.low, { backgroundColor: colors.surface, borderRadius: radius.pill }]} accessibilityLabel="Volver"><BackIcon color={colors.text} /></Pressable>
      <View style={styles.flex}><Text style={[typography.eyebrow, { color: colors.play }]}>IDENTIFICÁ LA ESPECIE</Text><Text style={[typography.title, { color: colors.text }]}>Elegí un modo</Text></View>
    </View>
    <Text style={[typography.body, { color: colors.textMuted, paddingHorizontal: spacing.lg, marginTop: spacing.md }]}>Cada modo propone una forma distinta de mirar y reconocer la fauna uruguaya.</Text>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
      {MODES.map(({ id, icon: Icon }) => {
        const config = QUIZ_MODES[id];
        return <Pressable key={id} onPress={() => { haptics.press(); router.push(`/game/categories?mode=${id}`); }} style={({ pressed }) => [styles.card, elevation.low, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, opacity: pressed ? .88 : 1 }]} accessibilityRole="button" accessibilityLabel={`Jugar ${config.title}`}>
          <View style={[styles.icon, { backgroundColor: colors.play, borderRadius: radius.md }]}><Icon color={colors.onPlay} size={23} /></View>
          <View style={styles.flex}><Text style={[typography.cardTitle, { color: colors.text }]}>{config.title}</Text><Text style={[typography.body, { color: colors.textMuted, marginTop: 3 }]}>{config.description}</Text>{id === 'naming' && <Text style={[typography.caption, { color: colors.play, marginTop: 5 }]}>Foto disponible · Sonido próximamente</Text>}</View>
          <ChevronRightIcon color={colors.textMuted} />
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, card: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth }, icon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
