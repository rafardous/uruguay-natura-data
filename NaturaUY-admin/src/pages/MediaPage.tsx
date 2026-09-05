import { FileAudio, FileImage, LoaderCircle, Plus, RefreshCw, UploadCloud } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import type { AudioClipSelection } from '../components/AudioClipEditor';
import { Empty, Loading, Modal, Notice, PageHeader } from '../components/Ui';
import type { MediaAsset, SpeciesSummary } from '../domain';
import { listMedia, listSpecies, requestMediaProcessing, reserveMediaUpload } from '../lib/api';
import { uploadIncoming } from '../lib/mediaUpload';
import { prepareImageForUpload } from '../lib/prepareImage';
import { prepareAudioForUpload } from '../lib/prepareAudio';

const AudioClipEditor = lazy(() => import('../components/AudioClipEditor').then((module) => ({ default: module.AudioClipEditor })));

export function MediaPage(): React.JSX.Element {
  const initialSpeciesId = new URLSearchParams(window.location.search).get('species') ?? '';
  const [media, setMedia] = useState<MediaAsset[] | null>(null);
  const [species, setSpecies] = useState<SpeciesSummary[]>([]);
  const [open, setOpen] = useState(Boolean(initialSpeciesId));
  const [message, setMessage] = useState('');
  const reload = () => void listMedia().then(setMedia).catch((error: Error) => setMessage(error.message));
  useEffect(() => { reload(); void listSpecies({ pageSize: 1000 }).then((result) => setSpecies(result.rows)); }, []);
  return <><PageHeader eyebrow="BIBLIOTECA" title="Fotos y sonidos" subtitle="Los archivos se normalizan y verifican antes de publicar; los originales temporales se eliminan." action={<button className="primary" onClick={() => setOpen(true)}><Plus size={18} /> Subir medio</button>} />{message && <Notice kind="error">{message}</Notice>}
    {!media ? <Loading label="Consultando la cola de medios…" /> : media.length === 0 ? <Empty title="Todavía no hay aportes" detail="Subí una foto o un sonido para comenzar." /> : <section className="panel table-panel"><div className="data-table media-table"><div className="table-row table-head"><span>Archivo</span><span>Especie</span><span>Derechos</span><span>Estado</span><span></span></div>{media.map((item) => <div className="table-row" key={item.id}><span className="media-kind">{item.kind === 'image' ? <FileImage /> : <FileAudio />}<span><strong>{item.kind === 'image' ? 'Imagen' : 'Audio'}</strong><small>{new Date(item.createdAt).toLocaleString('es-UY')}</small></span></span><span><b>{item.speciesName}</b><small>Subido por {item.uploadedBy}</small></span><span><b>{item.license}</b><small>{item.author}</small></span><span><span className={`job-state ${item.state}`}>{item.state === 'ready' ? 'Aprobado' : item.state === 'pending' ? 'Listo para revisión' : item.state === 'processing' ? 'Procesando' : item.state === 'failed' ? 'Falló' : item.state === 'incoming' ? 'En cola técnica' : item.state === 'archived' ? 'Archivado' : item.state === 'rejected' ? 'Rechazado' : item.state}</span>{item.error && <small className="error-text">{item.error}</small>}</span>{item.state === 'failed' && item.jobId ? <button className="icon-button" title="Reintentar" onClick={() => void requestMediaProcessing(item.jobId!).then(reload)}><RefreshCw /></button> : item.state === 'processing' ? <LoaderCircle className="spin" /> : <span />}</div>)}</div></section>}
    {open && <MediaUploadModal species={species} initialSpeciesId={initialSpeciesId} onClose={() => setOpen(false)} onComplete={() => { setOpen(false); reload(); }} />}
  </>;
}

function MediaUploadModal({ species, initialSpeciesId = '', onClose, onComplete }: { species: SpeciesSummary[]; initialSpeciesId?: string; onClose(): void; onComplete(): void }): React.JSX.Element {
  const { profile } = useAuth();
  const [speciesId, setSpeciesId] = useState(initialSpeciesId);
  const [kind, setKind] = useState<'image' | 'audio'>('image');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [clip, setClip] = useState<AudioClipSelection | null>(null);
  const [author, setAuthor] = useState('');
  const [license, setLicense] = useState<MediaAsset['license']>('CC-BY-4.0');
  const [sourceUrl, setSourceUrl] = useState('');
  const [source, setSource] = useState('');
  const [ownPhoto, setOwnPhoto] = useState(false);
  const [makePrimary, setMakePrimary] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState<Awaited<ReturnType<typeof reserveMediaUpload>> | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const setAudioClip = useCallback((next: AudioClipSelection) => setClip(next), []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function chooseFile(next: File | null): Promise<void> {
    setSourceFile(next); setUploadFile(null); setClip(null); setError(''); setReservation(null); setUploaded(false); setProgress(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    if (!next) return;
    if (kind === 'image') {
      setPreparing(true);
      try {
        const prepared = await prepareImageForUpload(next);
        setUploadFile(prepared); setPreviewUrl(URL.createObjectURL(prepared));
      } catch {
        setError('El navegador no pudo preparar esta imagen. Probá con JPEG, PNG o WebP.');
      } finally { setPreparing(false); }
    } else {
      setUploadFile(next);
    }
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!uploadFile || !speciesId || !author || !source || !accepted) return;
    if (uploadFile.size > (kind === 'image' ? 20 : 45) * 1024 * 1024) { setError(`El archivo preparado supera el máximo de ${kind === 'image' ? 20 : 45} MB.`); return; }
    if (kind === 'audio' && !clip) { setError('Esperá a que cargue el audio y elegí el fragmento.'); return; }
    setBusy(true); setError('');
    try {
      const fileToUpload = kind === 'audio' && sourceFile && clip ? await prepareAudioForUpload(sourceFile, clip) : uploadFile;
      if (fileToUpload.size > (kind === 'image' ? 20 : 5) * 1024 * 1024) throw new Error('El archivo preparado supera el máximo permitido.');
      let currentReservation = reservation;
      if (!currentReservation) {
        currentReservation = await reserveMediaUpload({ speciesId, kind, author, license, source, sourceUrl, originalFilename: fileToUpload.name, makePrimary: kind === 'image' && makePrimary, confirmRights: accepted, clipStartSeconds: clip?.start, clipDurationSeconds: clip?.duration });
        setReservation(currentReservation);
      }
      if (!uploaded) {
        await uploadIncoming(fileToUpload, currentReservation.incomingPath, ({ percent }) => setProgress(percent));
        setUploaded(true);
      }
      await requestMediaProcessing(currentReservation.jobId); onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo completar la subida.'); setBusy(false);
    }
  }

  return <Modal title="Aportar foto o sonido" onClose={onClose}><form className="form-stack" onSubmit={(event) => void submit(event)}>{error && <Notice kind="error">{error}</Notice>}<div className="form-grid two"><label className="field"><span>Especie *</span><select value={speciesId} onChange={(event) => { setSpeciesId(event.target.value); setReservation(null); setUploaded(false); setProgress(0); }} required><option value="">Seleccionar…</option>{species.map((item) => <option value={item.id} key={item.id}>{item.payload.commonNames[0] ?? item.payload.scientificName} — {item.payload.scientificName}</option>)}</select></label><label className="field"><span>Tipo *</span><select value={kind} onChange={(event) => { setKind(event.target.value as 'image' | 'audio'); setSourceFile(null); setUploadFile(null); setClip(null); setPreviewUrl(''); setReservation(null); setUploaded(false); setProgress(0); }}><option value="image">Imagen</option><option value="audio">Audio</option></select></label></div>
    <label className="dropzone"><UploadCloud /><strong>{sourceFile ? sourceFile.name : `Elegir ${kind === 'image' ? 'imagen' : 'audio'}`}</strong><small>{kind === 'image' ? 'JPEG, PNG, WebP o HEIC · se reduce a 1600 px antes de subir' : 'WAV, FLAC, MP3, M4A u OGG · elegirás un fragmento de hasta 15 s'}</small><input type="file" accept={kind === 'image' ? 'image/jpeg,image/png,image/webp,image/heic,image/heif' : 'audio/*,.flac,.wav,.m4a,.ogg'} onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} required /></label>
    {preparing && <Loading label="Reduciendo la imagen a 1600 px…" />}
    {kind === 'image' && previewUrl && <figure className="media-preview"><img src={previewUrl} alt="Vista previa del archivo preparado" /><figcaption>{uploadFile?.name} · {Math.ceil((uploadFile?.size ?? 0) / 1024)} KB</figcaption></figure>}
    {kind === 'audio' && uploadFile && <Suspense fallback={<Loading label="Preparando la onda de audio…" />}><AudioClipEditor file={uploadFile} onChange={setAudioClip} /></Suspense>}
    {kind === 'image' && <label className="check-field"><input type="checkbox" checked={ownPhoto} onChange={(event) => { const checked = event.target.checked; setOwnPhoto(checked); if (checked) { setAuthor(profile?.displayName ?? ''); setSource('Fotografía propia'); setLicense('CC-BY-4.0'); } }} /><span>La fotografía es mía (completa la autoría y recomienda CC BY 4.0; también podés elegir CC0).</span></label>}
    <div className="form-grid two"><label className="field"><span>Autor o autora *</span><input value={author} onChange={(event) => setAuthor(event.target.value)} required /></label><label className="field"><span>Licencia *</span><select value={license} onChange={(event) => setLicense(event.target.value as MediaAsset['license'])}><option value="CC-BY-4.0">CC BY 4.0</option><option value="CC0">CC0</option><option value="permission">Autorización particular</option></select></label><label className="field"><span>Fuente u origen *</span><input value={source} onChange={(event) => setSource(event.target.value)} required /></label><label className="field"><span>URL de procedencia</span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label></div>
    {kind === 'image' && <label className="check-field"><input type="checkbox" checked={makePrimary} onChange={(event) => setMakePrimary(event.target.checked)} /><span>Proponer esta imagen como fotografía principal.</span></label>}
    <label className="check-field"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Declaro que tengo derecho a aportar este medio y autorizo su publicación por Natura UY según la licencia indicada.</span></label>{busy && <div className="progress"><span style={{ width: `${progress}%` }}></span><small>{progress < 100 ? `Subiendo ${progress}%` : 'Preparando el procesamiento…'}</small></div>}<footer className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy || preparing || !uploadFile || !accepted || (kind === 'audio' && !clip)}>{busy ? 'Procesando…' : 'Subir y procesar'}</button></footer></form></Modal>;
}
