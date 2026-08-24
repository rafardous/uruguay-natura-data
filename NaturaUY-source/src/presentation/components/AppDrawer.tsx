import { useEffect } from 'react';
import { BackHandler, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { haptics } from '../haptics';
import { useFavorites } from '../hooks/FavoritesProvider';
import { useTheme } from '../theme/ThemeProvider';
import {
  ChevronRightIcon,
  CollaborateIcon,
  CloseIcon,
  HeartIcon,
  InfoIcon,
  InterestSitesIcon,
  LeafIcon,
  SettingsIcon,
  ShieldIcon,
} from './TabIcons';

const WIDTH = Math.min(Dimensions.get('window').width * 0.86, 380);

interface DrawerLinkProps {
  icon: React.JSX.Element;
  label: string;
  onPress: () => void;
  trailing?: string;
}

function DrawerLink({ icon, label, onPress, trailing }: DrawerLinkProps): React.JSX.Element {
  const { colors, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.link,
        { borderRadius: radius.md, backgroundColor: pressed ? colors.canvasActive : 'transparent' },
      ]}
    >
      {icon}
      <Text style={[typography.body, styles.linkLabel, { color: colors.canvasText }]}>{label}</Text>
      {trailing ? (
        <Text style={[typography.label, { color: colors.canvasTextMuted }]}>{trailing}</Text>
      ) : (
        <ChevronRightIcon color={colors.canvasTextMuted} size={16} />
      )}
    </Pressable>
  );
}

export interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The navigation drawer.
 *
 * The prototype's drawer was a bright #abc58d panel whose muted text measured
 * 2.65:1 — the single worst pair in the design. It is now a deep forest surface
 * in both themes, which reads as a distinct plane and clears AA comfortably.
 */
export function AppDrawer({ open, onClose }: AppDrawerProps): React.JSX.Element | null {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { count } = useFavorites();

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: 260 });
  }, [open, progress]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  // Dragging left past a third of the panel dismisses it.
  const drag = useSharedValue(0);
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      drag.value = Math.min(0, event.translationX);
    })
    .onEnd((event) => {
      if (event.translationX < -WIDTH / 3 || event.velocityX < -600) {
        drag.value = withTiming(-WIDTH, { duration: 180 }, () => {
          runOnJS(onClose)();
          drag.value = 0;
        });
      } else {
        drag.value = withTiming(0, { duration: 180 });
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * interpolate(drag.value, [-WIDTH, 0], [0, 1], 'clamp'),
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-WIDTH, 0]) + drag.value }],
  }));

  if (!open) return null;

  // Every drawer destination goes through here, links and the favourites row alike.
  const go = (path: string) => {
    haptics.tap();
    onClose();
    router.push(path as never);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar menú" />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.panel,
            { width: WIDTH, backgroundColor: colors.canvas, paddingTop: insets.top + spacing.lg },
            panelStyle,
          ]}
        >
          <View style={styles.header}>
            <View style={styles.brand}>
              <LeafIcon color={colors.canvasText} size={26} />
              <View>
                <Text style={[typography.title, { color: colors.canvasText }]}>Natura UY</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar menú">
              <CloseIcon color={colors.canvasText} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            <Pressable
              onPress={() => go('/favorites')}
              accessibilityRole="button"
              style={[styles.favorites, { backgroundColor: colors.canvasActive, borderRadius: radius.lg }]}
            >
              <HeartIcon color={count > 0 ? colors.favorite : colors.canvasText} size={22} filled={count > 0} />
              <Text style={[typography.cardTitle, styles.linkLabel, { color: colors.canvasText }]}>Favoritos</Text>
              <Text style={[typography.cardTitle, { color: colors.canvasText }]}>{count}</Text>
            </Pressable>

            <Text style={[typography.eyebrow, styles.section, { color: colors.canvasTextMuted }]}>EXPLORAR</Text>
            <DrawerLink
              icon={<ShieldIcon color={colors.canvasText} />}
              label="Especies prioritarias"
              onPress={() => go('/explore?priority=1')}
            />
            <DrawerLink
              icon={<LeafIcon color={colors.canvasText} />}
              label="Especies nativas"
              onPress={() => go('/explore?native=1')}
            />

            <View style={[styles.divider, { backgroundColor: colors.canvasBorder }]} />

            <Text style={[typography.eyebrow, styles.section, { color: colors.canvasTextMuted }]}>APP</Text>
            <DrawerLink
              icon={<CollaborateIcon color={colors.canvasText} />}
              label="Colaborar"
              onPress={() => go('/collaborate')}
            />
            <DrawerLink
              icon={<InterestSitesIcon color={colors.canvasText} />}
              label="Sitios de interés"
              onPress={() => go('/interest-sites')}
            />
            <DrawerLink
              icon={<InfoIcon color={colors.canvasText} />}
              label="Acerca de"
              onPress={() => go('/about')}
            />
            <DrawerLink
              icon={<SettingsIcon color={colors.canvasText} />}
              label="Configuración"
              onPress={() => go('/settings')}
            />
            <DrawerLink
              icon={<InfoIcon color={colors.canvasText} />}
              label="Créditos y licencias"
              onPress={() => go('/credits')}
            />
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 0, top: 0, bottom: 0, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  favorites: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  section: { marginTop: 26, marginBottom: 8, paddingHorizontal: 4 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingVertical: 14 },
  linkLabel: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 22 },
});
