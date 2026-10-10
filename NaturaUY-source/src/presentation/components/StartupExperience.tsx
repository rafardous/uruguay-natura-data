import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import mark from '../../../assets/images/arapy-mark.json';

export const STARTUP_BACKGROUND = mark.background;
const INK = mark.ink;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const StartupContext = createContext({ ready: () => {}, mounted: () => {}, visible: false });
export const useStartup = () => useContext(StartupContext);

// Single-line lettering keeps the wordmark drawn in the same style as the animal.
const letters = [
  'M292 1140 L326 1054 L360 1140 M302 1110 L350 1110',
  'M386 1140 L386 1054 L425 1054 C467 1054 466 1099 425 1101 L386 1101 M424 1101 L459 1140',
  'M478 1140 L512 1054 L546 1140 M488 1110 L536 1110',
  'M572 1140 L572 1054 L609 1054 C657 1054 657 1105 609 1105 L572 1105',
  'M667 1054 L706 1100 L745 1054 M706 1100 L706 1140',
];
const letterLengths = [221, 228, 221, 203, 186];

function TracedPath({ d, fill = 'none', stroke = INK, strokeWidth = 9, delay, duration, reduced, length, lettering = false }: {
  d: string; fill?: string; stroke?: string; strokeWidth?: number; delay: number; duration: number; reduced: boolean; length: number; lettering?: boolean;
}) {
  const trace = useSharedValue(0);
  const color = useSharedValue(0);
  useEffect(() => {
    trace.value = reduced ? 1 : withDelay(delay, withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }));
    color.value = reduced ? 1 : withDelay(760 + delay * 0.18, withTiming(1, { duration: 420 }));
  }, [color, delay, duration, reduced, trace]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - trace.value), opacity: trace.value > 0 ? 1 : 0 }));
  const fillProps = useAnimatedProps(() => ({ opacity: color.value }));
  return <>
    {fill !== 'none' && <AnimatedG animatedProps={fillProps}><Path d={d} fill={fill} /></AnimatedG>}
    {strokeWidth > 0 && <AnimatedPath d={d} fill="none" stroke={lettering ? INK : stroke} strokeWidth={lettering ? 10 : strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[length, length]} animatedProps={props} />}
  </>;
}

export function StartupExperience({ children }: { children: ReactNode }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const artworkWidth = Math.min(windowWidth * 0.86, windowHeight * 0.65 * 1024 / 1200, 450);
  const [contentReady, setContentReady] = useState(false);
  const [navigationMounted, setNavigationMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [laidOut, setLaidOut] = useState(false);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [elapsed, setElapsed] = useState(false);
  const opacity = useSharedValue(1);
  const artworkOpacity = useSharedValue(0);
  const ready = useCallback(() => setContentReady(true), []);
  const mounted = useCallback(() => setNavigationMounted(true), []);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => setReduced(false));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!laidOut || reduced === null) return;
    void SplashScreen.hideAsync().catch(() => {});
    artworkOpacity.value = reduced ? 1 : withDelay(1350, withTiming(1, { duration: 330 }));
    const timer = setTimeout(() => setElapsed(true), reduced ? 0 : 1800);
    return () => clearTimeout(timer);
  }, [artworkOpacity, laidOut, reduced]);
  useEffect(() => {
    if (!navigationMounted) return;
    // Remote images cannot hold an otherwise usable offline screen indefinitely.
    const timer = setTimeout(ready, 4500);
    return () => clearTimeout(timer);
  }, [navigationMounted, ready]);
  useEffect(() => {
    if (!elapsed || !contentReady || !navigationMounted) return;
    opacity.value = withTiming(0, { duration: reduced ? 0 : 280 });
    const timer = setTimeout(() => setVisible(false), reduced ? 0 : 300);
    return () => clearTimeout(timer);
  }, [contentReady, elapsed, navigationMounted, opacity, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const artworkStyle = useAnimatedStyle(() => ({ opacity: artworkOpacity.value }));
  return <StartupContext.Provider value={{ ready, mounted, visible }}>
    <View style={styles.root}>
      <View style={styles.root} accessibilityElementsHidden={Platform.OS === 'web' ? undefined : visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {visible && <Animated.View style={[styles.cover, style]} onLayout={() => setLaidOut(true)} accessibilityViewIsModal accessibilityLabel="Arapy. Preparando tu encuentro con la naturaleza." accessibilityRole="progressbar">
        {laidOut && reduced !== null && <View style={{ width: artworkWidth, height: artworkWidth * 1200 / 1024 }}>
          <Svg width="100%" height="100%" viewBox="0 0 1024 1200" accessible={Platform.OS === 'web' ? undefined : false}>
            <G>
              {mark.paths.map((shape, i) => <TracedPath key={i} {...shape} delay={i * 43} duration={1000} reduced={reduced} />)}
            </G>
            <G>
              {letters.map((d, i) => <TracedPath key={i} d={d} length={letterLengths[i] ?? 230} delay={660 + i * 90} duration={360} reduced={reduced} lettering />)}
            </G>
          </Svg>
          <Animated.Image source={require('../../../assets/images/arapy-logo-master.png')} resizeMode="stretch" style={[styles.finalArtwork, artworkStyle]} accessible={false} />
        </View>}
        <Text style={styles.caption}>Nuestra naturaleza en un solo lugar</Text>
      </Animated.View>}
    </View>
  </StartupContext.Provider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STARTUP_BACKGROUND },
  cover: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: STARTUP_BACKGROUND, alignItems: 'center', justifyContent: 'center' },
  finalArtwork: { position: 'absolute', top: 0, left: 0, width: '100%', height: '85.333%' },
  caption: { position: 'absolute', bottom: '12%', fontSize: 10, letterSpacing: 2.2, color: '#465B47', textAlign: 'center' },
});
