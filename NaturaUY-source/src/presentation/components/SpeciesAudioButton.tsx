import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Volume2, Pause } from 'lucide-react-native';

import type { Species } from '../../domain/entities/species';
import { useAudioPlayerContext, type PlayableSpeciesAudio } from '../audio/AudioProvider';
import { useTheme } from '../theme/ThemeProvider';

function audioForSpecies(species: Species): PlayableSpeciesAudio | null {
  const media = species.media.find((item) => item.type === 'audio');
  if (media) return {
    id: media.id,
    url: media.url,
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
  const { colors, radius, typography } = useTheme();
  const { activeId, loading, playing, progress, error, toggle } = useAudioPlayerContext();
  if (!audio) return null;
  const active = activeId === audio.id;
  const label = active && playing ? `Pausar audio de ${species.displayName}` : `Escuchar audio de ${species.displayName}`;
  return <View style={styles.wrap}>
    <Pressable
      onPress={() => void toggle(audio)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: active && loading }}
      style={({ pressed }) => [styles.button, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceContainer : colors.surfaceVariant, borderRadius: radius.pill }]}
    >
      {active && loading ? <ActivityIndicator size="small" color={colors.primary} /> : active && playing ? <Pause size={17} color={colors.primary} /> : <Volume2 size={18} color={colors.primary} />}
      <Text style={[typography.label, { color: colors.primary }]}>{active && playing ? 'Pausar audio' : 'Escuchar audio'}</Text>
      {active && <View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progress, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} /></View>}
    </Pressable>
    {error && <Text style={[typography.caption, styles.error, { color: colors.danger }]}>{error}</Text>}
    {(audio.attribution || audio.source) && <Pressable disabled={!audio.page} onPress={() => audio.page && void Linking.openURL(audio.page)} accessibilityRole={audio.page ? 'link' : undefined}><Text style={[typography.caption, { color: colors.textMuted, marginTop: 5 }]}>Audio: {audio.attribution || audio.source}{audio.license ? ` · Natura UY: ${audio.license}` : ''}{audio.originalLicense ? ` · Original: ${audio.originalLicense}` : ''}</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', marginTop: 10 },
  button: { minHeight: 42, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: StyleSheet.hairlineWidth },
  progressTrack: { width: 48, height: 3, overflow: 'hidden', borderRadius: 99, marginLeft: 2 },
  progress: { height: 3, borderRadius: 99 },
  error: { marginTop: 5 },
});
