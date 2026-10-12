import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import mark from '../../../assets/images/arapy-brand.json';

export const STARTUP_BACKGROUND = mark.background;
const INK = mark.ink;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const StartupContext = createContext({ ready: () => {}, mounted: () => {}, visible: false });
export const useStartup = () => useContext(StartupContext);

function TracedPath({ d, fill = 'none', stroke = INK, strokeWidth = 2.5, fillRule = 'nonzero', delay, duration, reduced, length }: {
  d: string; fill?: string; stroke?: string; strokeWidth?: number; fillRule?: string; delay: number; duration: number; reduced: boolean; length: number;
}) {
  const trace = useSharedValue(0);
  const color = useSharedValue(0);
  useEffect(() => {
    trace.value = reduced ? 1 : withDelay(delay, withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }));
    color.value = reduced ? 1 : withDelay(delay + duration * 0.72, withTiming(1, { duration: duration * 0.55 }));
  }, [color, delay, duration, reduced, trace]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - trace.value), opacity: trace.value > 0 ? (fill === 'none' ? 1 : 1 - color.value) : 0 }));
  const fillProps = useAnimatedProps(() => ({ opacity: color.value }));
  return <>
    {fill !== 'none' && <AnimatedG animatedProps={fillProps}><Path d={d} fill={fill} fillRule={fillRule === 'evenodd' ? 'evenodd' : 'nonzero'} /></AnimatedG>}
    {strokeWidth > 0 && <AnimatedPath d={d} fill="none" stroke={fill === 'none' ? stroke : fill} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[length, length]} animatedProps={props} />}
  </>;
}

export function StartupExperience({ children }: { children: ReactNode }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const artworkWidth = Math.min(windowWidth * 0.86, windowHeight * 0.62 * 502 / 500, 430);
  const [contentReady, setContentReady] = useState(false);
  const [navigationMounted, setNavigationMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [laidOut, setLaidOut] = useState(false);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [elapsed, setElapsed] = useState(false);
  const opacity = useSharedValue(1);
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
    const timer = setTimeout(() => setElapsed(true), reduced ? 0 : 1850);
    return () => clearTimeout(timer);
  }, [laidOut, reduced]);
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
  return <StartupContext.Provider value={{ ready, mounted, visible }}>
    <View style={styles.root}>
      <View style={styles.root} accessibilityElementsHidden={Platform.OS === 'web' ? undefined : visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {visible && <Animated.View style={[styles.cover, style]} onLayout={() => setLaidOut(true)} accessibilityViewIsModal accessibilityLabel="Arapy. Preparando tu encuentro con la naturaleza." accessibilityRole="progressbar">
        {laidOut && reduced !== null && <View style={{ width: artworkWidth, height: artworkWidth * 500 / 502 }}>
          <Svg width="100%" height="100%" viewBox="0 0 502 500" accessible={Platform.OS === 'web' ? undefined : false}>
            <G>
              {mark.paths.map((shape, i) => <TracedPath key={i} {...shape} delay={i * 38} duration={720} reduced={reduced} />)}
            </G>
            <G transform="translate(-50 0)">
              {mark.letters.map((letter, i) => <TracedPath key={i} {...letter} strokeWidth={3.5} delay={780 + i * 85} duration={430} reduced={reduced} />)}
            </G>
          </Svg>
        </View>}
        <Text style={styles.caption}>Nuestra naturaleza en un solo lugar</Text>
      </Animated.View>}
    </View>
  </StartupContext.Provider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STARTUP_BACKGROUND },
  cover: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: STARTUP_BACKGROUND, alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', bottom: '12%', fontSize: 10, letterSpacing: 2.2, color: '#46584A', textAlign: 'center' },
});
