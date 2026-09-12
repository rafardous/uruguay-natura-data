import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

const CACHE_LIMIT_BYTES = 25 * 1024 * 1024;
const cacheDirectory = new Directory(Paths.cache, 'natura-audio');

export interface PlayableSpeciesAudio {
  id: string;
  url: string;
  durationSeconds?: number | null;
  attribution: string;
  source: string;
  page: string | null;
  license: string;
  originalLicense?: string | null;
}

interface AudioContextValue {
  activeId: string | null;
  loading: boolean;
  playing: boolean;
  progress: number;
  error: string | null;
  toggle(audio: PlayableSpeciesAudio): Promise<void>;
  stop(): void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function getCacheFile(audio: PlayableSpeciesAudio): File {
  return new File(cacheDirectory, `${shortHash(audio.id + audio.url)}.mp3`);
}

async function cachedUri(audio: PlayableSpeciesAudio): Promise<string> {
  cacheDirectory.create({ idempotent: true, intermediates: true });
  const file = getCacheFile(audio);
  if (!file.exists) await File.downloadFileAsync(audio.url, file, { idempotent: true });
  await trimCache(file.uri);
  return file.uri;
}

async function trimCache(keepUri: string): Promise<void> {
  try {
    const files = cacheDirectory.list().filter((entry): entry is File => entry instanceof File);
    const records = files.map((file) => ({ file, size: file.size, modified: file.lastModified ?? 0 }));
    let total = records.reduce((sum, record) => sum + record.size, 0);
    for (const record of records.sort((a, b) => a.modified - b.modified)) {
      if (total <= CACHE_LIMIT_BYTES || record.file.uri === keepUri) continue;
      record.file.delete();
      total -= record.size;
    }
  } catch {
    // Cache eviction is best effort. Playback must remain usable if a device
    // filesystem doesn't expose directory metadata.
  }
}

async function configureAudio(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: false,
  });
}

export function AudioProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const player = useAudioPlayer(null, { updateInterval: 250, keepAudioSessionActive: false });
  const status = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback((): void => {
    player.pause();
    setActiveId(null);
    setLoading(false);
    void setIsAudioActiveAsync(false).catch(() => undefined);
  }, [player]);

  useEffect(() => {
    void configureAudio().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => {
      subscription.remove();
      player.pause();
      void setIsAudioActiveAsync(false).catch(() => undefined);
    };
  }, [player, stop]);

  const value = useMemo<AudioContextValue>(() => ({
    activeId,
    loading,
    playing: Boolean(activeId && status.playing),
    progress: status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0,
    error,
    async toggle(audio) {
      setError(null);
      if (activeId === audio.id && status.playing) {
        player.pause();
        return;
      }
      setLoading(true);
      try {
        if (activeId !== audio.id) {
          player.pause();
          const uri = await cachedUri(audio);
          player.replace(uri);
          setActiveId(audio.id);
        } else if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.05)) {
          await player.seekTo(0);
        }
        await setIsAudioActiveAsync(true);
        player.play();
      } catch {
        setActiveId(null);
        setError('Este audio no está disponible sin conexión.');
      } finally {
        setLoading(false);
      }
    },
    stop,
  }), [activeId, error, loading, player, status, stop]);

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useAudioPlayerContext(): AudioContextValue {
  const value = useContext(AudioContext);
  if (!value) throw new Error('useAudioPlayerContext must be used inside <AudioProvider>');
  return value;
}

export type { AudioPlayer };
