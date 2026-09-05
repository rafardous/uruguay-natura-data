import type { AudioClipSelection } from '../components/AudioClipEditor';

const SAMPLE_RATE = 48_000;
const MAX_SECONDS = 15;

function wavFromMono(samples: Float32Array): Blob {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true));
  return new Blob([bytes], { type: 'audio/wav' });
}

/** Decodes the selected region locally; only a mono 48 kHz WAV reaches Storage. */
export async function prepareAudioForUpload(file: File, selection: AudioClipSelection): Promise<File> {
  const context = new AudioContext();
  try {
    const source = await context.decodeAudioData(await file.arrayBuffer());
    const start = Math.max(0, Math.min(selection.start, source.duration));
    const duration = Math.max(0.05, Math.min(MAX_SECONDS, selection.duration, source.duration - start));
    const frames = Math.ceil(duration * SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, frames, SAMPLE_RATE);
    const node = offline.createBufferSource();
    node.buffer = source; node.connect(offline.destination); node.start(0, start, duration);
    const rendered = await offline.startRendering();
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'audio';
    return new File([wavFromMono(rendered.getChannelData(0))], `${baseName}-recorte.wav`, { type: 'audio/wav' });
  } finally {
    await context.close();
  }
}
