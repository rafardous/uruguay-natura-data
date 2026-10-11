import React, { act, useEffect, useEffect as mockUseEffect } from 'react';
import { Asset } from 'expo-asset';
import { AudioProvider, useAudioPlayerContext, type PlayableSpeciesAudio } from '../../audio/AudioProvider';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: React.ReactElement) => { unmount: () => void } };
let mockReleased = false;
const mockPlayer = {
  pause: jest.fn(() => { if (mockReleased) throw new Error('Player released'); }),
  play: jest.fn(), replace: jest.fn(), seekTo: jest.fn().mockResolvedValue(undefined),
};
jest.mock('expo-audio', () => ({
  useAudioPlayer: function useAudioPlayer() {
    mockUseEffect(() => () => { mockReleased = true; }, []);
    return mockPlayer;
  },
  useAudioPlayerStatus: () => ({ playing: false, duration: 15, currentTime: 0, didJustFinish: false }),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  setIsAudioActiveAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: { cache: 'cache' } }));
let audio: ReturnType<typeof useAudioPlayerContext>;
let root: ReturnType<typeof renderer.create> | undefined;
function Probe() {
  const value = useAudioPlayerContext();
  useEffect(() => { audio = value; }, [value]);
  return null;
}
const clip = (id: string, assetModule: number): PlayableSpeciesAudio => ({ id, assetModule, url: 'https://example.test/' + id, attribution: 'Autor', source: 'Fuente', page: null, license: 'CC0' });
function asset(uri: string, pending: Promise<void>): Asset {
  return { localUri: uri, uri, downloadAsync: () => pending } as unknown as Asset;
}
function download() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(async () => {
  jest.clearAllMocks(); mockReleased = false;
  await act(async () => { root = renderer.create(<AudioProvider><Probe /></AudioProvider>); });
});
afterEach(async () => { await act(async () => { root?.unmount(); root = undefined; }); });

test('no toca el reproductor después de que el hook lo libera', async () => {
  await act(async () => { root!.unmount(); root = undefined; });
  expect(mockReleased).toBe(true);
  expect(mockPlayer.pause).not.toHaveBeenCalled();
});

test('una descarga anterior no reemplaza el audio elegido después', async () => {
  const old = download();
  jest.mocked(Asset.fromModule).mockReturnValueOnce(asset('file:old', old.promise)).mockReturnValueOnce(asset('file:new', Promise.resolve()));
  let pending!: Promise<void>;
  await act(async () => { pending = audio.toggle(clip('old', 1)); });
  await act(async () => { await audio.toggle(clip('new', 2)); });
  await act(async () => { old.resolve(); await pending; });
  expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
  expect(mockPlayer.replace).toHaveBeenCalledWith('file:new');
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
});

test('cerrar la app cancela una descarga pendiente', async () => {
  const old = download();
  jest.mocked(Asset.fromModule).mockReturnValueOnce(asset('file:old', old.promise));
  let pending!: Promise<void>;
  await act(async () => { pending = audio.toggle(clip('old', 1)); });
  await act(async () => { root!.unmount(); root = undefined; });
  await act(async () => { old.resolve(); await pending; });
  expect(mockPlayer.replace).not.toHaveBeenCalled();
  expect(mockPlayer.play).not.toHaveBeenCalled();
});
