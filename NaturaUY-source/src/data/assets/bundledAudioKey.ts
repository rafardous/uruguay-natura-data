/** Approved editorial media retain their external ID when public URLs change. */
export function bundledAudioKey(url: string, externalId?: string | null): string | null {
  const legacy = /^bundled:\/\/(xc-\d+\.mp3)$/.exec(url);
  if (legacy) return legacy[1]!;
  const recording = /^XC(\d+)$/i.exec(externalId ?? '');
  return recording ? `xc-${recording[1]}.mp3` : null;
}
