import React, { act, useRef as mockUseRef } from 'react';
import { View } from 'react-native';
import { TransientZoomView } from '../../components/TransientZoomView';

const mockGestures: Record<'pinch' | 'pan' | 'tap', any> = { pinch: {}, pan: {}, tap: {} };
jest.mock('react-native-gesture-handler', () => {
  function gesture(kind: 'pinch' | 'pan' | 'tap') {
    const handlers: Record<string, any> = {}; mockGestures[kind] = handlers;
    const result: Record<string, any> = {};
    for (const name of ['enabled', 'maxPointers', 'minDistance', 'maxDuration', 'numberOfTaps', 'maxDelay', 'onStart', 'onUpdate', 'onFinalize', 'onTouchesDown', 'onEnd']) {
      result[name] = (value: any) => { if (name.startsWith('on')) handlers[name] = value; return result; };
    }
    return result;
  }
  return { Gesture: { Pinch: () => gesture('pinch'), Pan: () => gesture('pan'), Tap: () => gesture('tap'), Simultaneous: (...items: any[]) => items, Exclusive: (...items: any[]) => items }, GestureDetector: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: (value: unknown) => mockUseRef({ value }).current, useAnimatedStyle: (callback: () => unknown) => callback(), withTiming: (value: number) => value, runOnJS: (callback: (...args: any[]) => unknown) => callback }));
jest.mock('../../components/TabIcons', () => ({ ResetIcon: () => null, ZoomInIcon: () => null, ZoomOutIcon: () => null }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: React.ReactElement) => { root: any; update: (element: React.ReactElement) => void; unmount: () => void } };
let root: ReturnType<typeof renderer.create>;
const onZoom = jest.fn();
const viewer = (persistent = true) => <TransientZoomView persistent={persistent} showControls accessibilityLabel="Foto de prueba" imageAspectRatio={2} onZoomActiveChange={onZoom}><View /></TransientZoomView>;
const transform = () => root.root.findByType('AnimatedView').props.style[1].transform;
beforeEach(async () => {
  onZoom.mockClear();
  await act(async () => { root = renderer.create(viewer()); });
  root.root.find((node: any) => typeof node.props.onLayout === 'function').props.onLayout({ nativeEvent: { layout: { width: 300, height: 600 } } });
});
afterEach(async () => { await act(async () => root.unmount()); });

test('mantiene el pinch y limita el arrastre a los bordes de la foto', async () => {
  mockGestures.pinch.onStart({ focalX: 150, focalY: 300 });
  mockGestures.pinch.onUpdate({ scale: 2, focalX: 150, focalY: 300 });
  mockGestures.pinch.onFinalize();
  mockGestures.pan.onStart();
  mockGestures.pan.onUpdate({ translationX: 1000, translationY: 1000 });
  await act(async () => root.update(viewer()));
  expect(transform()).toEqual([{ translateX: 150 }, { translateY: 0 }, { scale: 2 }]);
  expect(onZoom).toHaveBeenLastCalledWith(true);
  mockGestures.pinch.onStart({ focalX: 150, focalY: 300 });
  mockGestures.pinch.onUpdate({ scale: 2, focalX: 150, focalY: 300 });
  mockGestures.pinch.onFinalize();
  await act(async () => root.update(viewer()));
  expect(transform()[2]).toEqual({ scale: 3 });
});
test('doble toque restablece escala/posición y libera la galería', async () => {
  root.root.findByProps({ accessibilityLabel: 'Acercar foto' }).props.onPress();
  mockGestures.pan.onStart(); mockGestures.pan.onUpdate({ translationX: 40, translationY: 0 });
  mockGestures.tap.onEnd({}, true);
  await act(async () => root.update(viewer()));
  expect(transform()).toEqual([{ translateX: 0 }, { translateY: 0 }, { scale: 1 }]);
  expect(onZoom).toHaveBeenLastCalledWith(false);
  const manager = { fail: jest.fn() }; mockGestures.pan.onTouchesDown({}, manager);
  expect(manager.fail).toHaveBeenCalled();
});
test('la foto inline vuelve a 1x al soltar; Restablecer también centra el visor', async () => {
  await act(async () => root.update(viewer(false)));
  mockGestures.pinch.onStart({ focalX: 150, focalY: 300 });
  mockGestures.pinch.onUpdate({ scale: 2, focalX: 150, focalY: 300 }); mockGestures.pinch.onFinalize();
  await act(async () => root.update(viewer(false)));
  expect(transform()[2]).toEqual({ scale: 1 });
  root.root.findByProps({ accessibilityLabel: 'Acercar foto' }).props.onPress();
  root.root.findByProps({ accessibilityLabel: 'Restablecer zoom' }).props.onPress();
  await act(async () => root.update(viewer(false)));
  expect(transform()).toEqual([{ translateX: 0 }, { translateY: 0 }, { scale: 1 }]);
});
