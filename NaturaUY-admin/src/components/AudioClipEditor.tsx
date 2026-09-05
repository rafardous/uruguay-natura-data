import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';

const MAX_CLIP_SECONDS = 15;

export interface AudioClipSelection { start: number; duration: number; }

export function AudioClipEditor({ file, onChange }: { file: File; onChange(selection: AudioClipSelection): void }): React.JSX.Element {
  const container = useRef<HTMLDivElement | null>(null);
  const wave = useRef<WaveSurfer | null>(null);
  const region = useRef<Region | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const url = URL.createObjectURL(file);
    const regions = RegionsPlugin.create();
    const instance = WaveSurfer.create({
      container: container.current,
      url,
      height: 96,
      waveColor: '#A6B5A8',
      progressColor: '#315B45',
      cursorColor: '#9A6B20',
      plugins: [regions],
    });
    wave.current = instance;
    const stopReady = instance.on('ready', (seconds) => {
      setDuration(seconds);
      const clipDuration = Math.min(MAX_CLIP_SECONDS, seconds);
      region.current = regions.addRegion({ start: 0, end: clipDuration, color: 'rgba(154,107,32,.24)', drag: true, resize: seconds <= MAX_CLIP_SECONDS });
      onChange({ start: 0, duration: clipDuration });
    });
    const stopUpdate = regions.on('region-updated', (next) => {
      let nextStart = Math.max(0, next.start);
      let nextDuration = Math.min(MAX_CLIP_SECONDS, next.end - next.start);
      if (nextStart + nextDuration > instance.getDuration()) nextStart = Math.max(0, instance.getDuration() - nextDuration);
      next.setOptions({ start: nextStart, end: nextStart + nextDuration });
      setStart(nextStart); onChange({ start: nextStart, duration: nextDuration });
    });
    const stopFinish = instance.on('finish', () => setPlaying(false));
    return () => {
      stopReady(); stopUpdate(); stopFinish(); instance.destroy(); URL.revokeObjectURL(url);
      wave.current = null; region.current = null;
    };
  }, [file, onChange]);

  function move(next: number): void {
    const clipDuration = Math.min(MAX_CLIP_SECONDS, duration);
    const bounded = Math.min(Math.max(0, next), Math.max(0, duration - clipDuration));
    region.current?.setOptions({ start: bounded, end: bounded + clipDuration });
    setStart(bounded); onChange({ start: bounded, duration: clipDuration });
  }

  function toggle(): void {
    if (!wave.current || !region.current) return;
    if (playing) wave.current.pause(); else region.current.play();
    setPlaying(!playing);
  }

  const maxStart = Math.max(0, duration - Math.min(MAX_CLIP_SECONDS, duration));
  return <div className="audio-clip-editor"><div ref={container} /><div className="audio-controls"><button type="button" className="secondary" onClick={toggle}>{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? 'Pausar' : 'Escuchar fragmento'}</button><label className="audio-start"><span>Inicio: {start.toFixed(1)} s</span><input aria-label="Desplazar fragmento" type="range" min={0} max={maxStart || 0} step={0.1} value={Math.min(start, maxStart)} onChange={(event) => move(Number(event.target.value))} disabled={maxStart === 0} /></label></div><small>Arrastrá la zona resaltada o usá el control para elegir el fragmento. Se conservarán como máximo 15 segundos.</small></div>;
}
