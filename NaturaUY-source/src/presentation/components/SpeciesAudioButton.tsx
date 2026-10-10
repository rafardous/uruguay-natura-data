import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Volume2, Pause, Play } from 'lucide-react-native';

import type { Species } from '../../domain/entities/species';
import { useAudioPlayerContext, type PlayableSpeciesAudio } from '../audio/AudioProvider';
import { useTheme } from '../theme/ThemeProvider';
import { bundledAudioAsset } from '../../data/assets/audioMap';

function audioForSpecies(species: Species): PlayableSpeciesAudio | null {
  const media = species.media.find((item) => item.type === 'audio');
  if (media) return {
    id: media.id,
    url: media.url,
    assetModule: bundledAudioAsset(media.url, media.externalId),
    durationSeconds: media.durationSeconds,
    attribution: media.attribution,
    source: media.source,
    page: media.page,
    license: media.license,
    originalLicense: media.originalLicense,
  };
  // The local media table contains only approved catalogue media. Do not
  // expose the legacy audio_url fallback because it has no approval or rights
  // metadata and the first audio release is intentionally Pedro Rinaldi-only.
  return null;
}

export function SpeciesAudioButton({ species }: { species: Species }): React.JSX.Element | null {
  const audio = audioForSpecies(species);
  const { colors, radius, typography, spacing } = useTheme();
  const { activeId, loadingId, playing, progress, positionSeconds, durationSeconds, error, toggle } = useAudioPlayerContext();
  if (!audio) return null;
  const active = activeId === audio.id;
  const preparing = loadingId === audio.id;
  const label = active && playing ? `Pausar audio de ${species.displayName}` : `Escuchar audio de ${species.displayName}`;
  const formatTime = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const duration = active && durationSeconds > 0 ? durationSeconds : audio.durationSeconds ?? 0;
  return <View style={[styles.card, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}>
    <View style={styles.row}>
      <Pressable
        onPress={() => void toggle(audio)}
        disabled={preparing}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: preparing }}
        style={({ pressed }) => [styles.playButton, { backgroundColor: pressed ? colors.onPrimaryContainer : colors.primary, borderRadius: radius.pill }]}
      >
        {preparing ? <ActivityIndicator size="small" color={colors.onPrimary} /> : active && playing ? <Pause size={22} color={colors.onPrimary} fill={colors.onPrimary} /> : <Play size={22} color={colors.onPrimary} fill={colors.onPrimary} />}
      </Pressable>
      <View style={styles.details}>
        <View style={styles.heading}><Volume2 size={16} color={colors.primary} /><Text style={[typography.label, { color: colors.text }]}>Audio de la especie</Text></View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{preparing ? 'Preparando audio…' : active && playing ? 'Reproduciendo' : active && progress >= 0.99 ? 'Reproducido' : active ? 'En pausa' : 'Tocá para escuchar'}</Text>
      </View>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{formatTime(active ? positionSeconds : 0)} / {formatTime(duration)}</Text>
    </View>
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: active ? Math.round(progress * 100) : 0 }} style={[styles.progressTrack, { backgroundColor: colors.border, borderRadius: radius.pill }]}>
      <View style={[styles.progress, { backgroundColor: colors.primary, borderRadius: radius.pill, width: `${active ? Math.round(progress * 100) : 0}%` }]} />
    </View>
    {error && <Text style={[typography.caption, { color: colors.danger, marginTop: 8 }]}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', marginTop: 14, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, gap: 2 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressTrack: { height: 5, overflow: 'hidden' },
  progress: { height: 5 },
});
