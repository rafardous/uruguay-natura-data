import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

export const STARTUP_BACKGROUND = '#CBD8C4';
const INK = '#202D25';
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const StartupContext = createContext({ ready: () => {}, mounted: () => {}, visible: false });
export const useStartup = () => useContext(StartupContext);

// Hand-drawn vector geometry following the approved cardinal silhouette.
const shapes = [
  { d: 'M280 958 C120 756 199 519 455 378 L493 270 Q451 223 452 190 L490 208 L414 40 Q574 100 650 200 Q700 257 664 332 L635 385 C655 553 590 666 480 709 C367 751 305 835 280 958 Z', fill: '#FFF5E3' },
  { d: 'M455 378 C540 367 551 472 490 589 C428 694 320 746 236 760 C224 623 296 468 455 378 Z', fill: '#484B47' },
  { d: 'M414 40 Q574 100 650 200 Q700 257 664 332 L635 385 L615 509 Q597 400 539 342 Q485 299 493 270 Q451 223 452 190 L490 208 Z', fill: '#D92728' },
  { d: 'M669 256 L750 318 L647 360 Z', fill: '#EAA536' },
  { d: 'M478 710 Q584 676 696 624', fill: 'none' },
  { d: 'M695 625 Q683 487 871 474 Q860 614 695 625 Z', fill: '#748D63' },
  { d: 'M479 710 Q560 691 614 725', fill: 'none' },
  { d: 'M614 725 Q750 683 777 871 Q629 875 614 725 Z', fill: '#748D63' },
];
// Measured curve lengths keep short leaf strokes as fluid as the body outline.
const outlineLengths = [2355, 1049, 1214, 322, 237, 526, 142, 509];

// Single-line lettering, so the name is genuinely traced rather than typed.
const letters = [
  'M52 1118 L52 1046 L98 1118 L98 1046',
  'M155 1082 C124 1058 114 1118 142 1118 Q153 1118 156 1102 M156 1080 L156 1118',
  'M184 1054 L184 1106 Q184 1125 201 1114 M173 1080 L204 1080',
  'M222 1080 L222 1103 Q222 1131 249 1111 L252 1080 L252 1118',
  'M277 1118 L277 1080 M277 1094 Q287 1073 301 1081',
  'M353 1082 C322 1058 312 1118 340 1118 Q351 1118 354 1102 M354 1080 L354 1118',
  'M403 1046 L403 1094 C403 1131 452 1131 452 1094 L452 1046',
  'M474 1046 L499 1083 L524 1046 M499 1083 L499 1118',
];
const letterLengths = [232, 138, 112, 136, 72, 138, 181, 127];

function TracedPath({ d, fill = 'none', delay, duration, reduced, length, lettering = false }: {
  d: string; fill?: string; delay: number; duration: number; reduced: boolean; length: number; lettering?: boolean;
}) {
  const trace = useSharedValue(0);
  const color = useSharedValue(0);
  useEffect(() => {
    trace.value = reduced ? 1 : withDelay(delay, withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }));
    color.value = reduced ? 1 : withDelay(1100 + delay * 0.15, withTiming(1, { duration: 480 }));
  }, [color, delay, duration, reduced, trace]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - trace.value), opacity: trace.value > 0 ? 1 : 0 }));
  const fillProps = useAnimatedProps(() => ({ opacity: color.value }));
  return <>
    {fill !== 'none' && <AnimatedG animatedProps={fillProps}><Path d={d} fill={fill} /></AnimatedG>}
    <AnimatedPath d={d} fill="none" stroke={INK} strokeWidth={lettering ? 5 : 22} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[length, length]} animatedProps={props} />
  </>;
}

export function StartupExperience({ children }: { children: ReactNode }) {
  const [contentReady, setContentReady] = useState(false);
  const [navigationMounted, setNavigationMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [laidOut, setLaidOut] = useState(false);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [elapsed, setElapsed] = useState(false);
  const opacity = useSharedValue(1);
  const eye = useSharedValue(0);
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
    eye.value = reduced ? 1 : withDelay(1100, withTiming(1, { duration: 350 }));
    const timer = setTimeout(() => setElapsed(true), reduced ? 0 : 1800);
    return () => clearTimeout(timer);
  }, [eye, laidOut, reduced]);
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
  const eyeProps = useAnimatedProps(() => ({ opacity: eye.value }));
  return <StartupContext.Provider value={{ ready, mounted, visible }}>
    <View style={styles.root}>
      <View style={styles.root} accessibilityElementsHidden={Platform.OS === 'web' ? undefined : visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {visible && <Animated.View style={[styles.cover, style]} onLayout={() => setLaidOut(true)} accessibilityViewIsModal accessibilityLabel="Natura UY. Preparando tu encuentro con la naturaleza." accessibilityRole="progressbar">
        {laidOut && reduced !== null && <Svg width="82%" height="64%" viewBox="0 0 1000 1320" accessible={Platform.OS === 'web' ? undefined : false}>
          <G transform="translate(90 40) scale(0.82)">
            {shapes.map((shape, i) => <TracedPath key={i} {...shape} length={outlineLengths[i] ?? 3400} delay={i * 85} duration={1100} reduced={reduced} />)}
            <AnimatedG animatedProps={eyeProps}><Circle cx={582} cy={268} r={24} fill={INK} /></AnimatedG>
          </G>
          <G transform="translate(72 40) scale(1.5 1)">
            {letters.map((d, i) => <TracedPath key={i} d={d} length={letterLengths[i] ?? 280} delay={650 + i * 90} duration={350} reduced={reduced} lettering />)}
          </G>
        </Svg>}
        <Text style={styles.caption}>Nuestra naturaleza en un solo lugar</Text>
      </Animated.View>}
    </View>
  </StartupContext.Provider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STARTUP_BACKGROUND },
  cover: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: STARTUP_BACKGROUND, alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', bottom: '12%', fontSize: 10, letterSpacing: 2.2, color: '#465B47', textAlign: 'center' },
});
