import { FileAudio, FileImage, Plus, Trash2, UploadCloud } from 'lucide-react';

import type { Profile, MediaAsset } from '../domain';
import { requestMediaProcessing, reserveMediaUpload } from '../lib/api';
import { uploadIncoming } from '../lib/mediaUpload';
import { prepareImageForUpload } from '../lib/prepareImage';

export interface NewSpeciesMediaDraft {
  id: string;
  kind: 'image' | 'audio';
  file: File | null;
  author: string;
  license: MediaAsset['license'];
  source: string;
  sourceUrl: string;
  makePrimary: boolean;
  accepted: boolean;
  clipStartSeconds: number;
  clipDurationSeconds: number;
}

const newDraft = (kind: NewSpeciesMediaDraft['kind']): NewSpeciesMediaDraft => ({
  id: crypto.randomUUID(), kind, file: null, author: '', license: 'CC-BY-4.0', source: '', sourceUrl: '', makePrimary: false, accepted: false, clipStartSeconds: 0, clipDurationSeconds: 15,
});

export function mediaDraftIsComplete(draft: NewSpeciesMediaDraft): boolean {
  return Boolean(draft.file && draft.author.trim() && draft.source.trim() && draft.accepted && (draft.kind === 'image' || (draft.clipStartSeconds >= 0 && draft.clipDurationSeconds > 0 && draft.clipDurationSeconds <= 15)));
}

export async function uploadNewSpeciesMedia(requestId: string, draft: NewSpeciesMediaDraft): Promise<void> {
  if (!draft.file) throw new Error('Elegí un archivo para cada medio propuesto.');
  const uploadFile = draft.kind === 'image' ? await prepareImageForUpload(draft.file) : draft.file;
  const sizeLimit = (draft.kind === 'image' ? 20 : 45) * 1024 * 1024;
  if (uploadFile.size > sizeLimit) throw new Error(`El archivo ${draft.file.name} supera el máximo permitido.`);
  const reservation = await reserveMediaUpload({
    speciesId: null, changeRequestId: requestId, kind: draft.kind, author: draft.author, license: draft.license,
    source: draft.source, sourceUrl: draft.sourceUrl, originalFilename: uploadFile.name, makePrimary: draft.kind === 'image' && draft.makePrimary,
    confirmRights: draft.accepted, clipStartSeconds: draft.kind === 'audio' ? draft.clipStartSeconds : undefined,
    clipDurationSeconds: draft.kind === 'audio' ? draft.clipDurationSeconds : undefined,
  });
  await uploadIncoming(uploadFile, reservation.incomingPath, () => undefined);
  await requestMediaProcessing(reservation.jobId);
}

export function NewSpeciesMedia({ drafts, onChange, profile }: { drafts: NewSpeciesMediaDraft[]; onChange(drafts: NewSpeciesMediaDraft[]): void; profile: Profile | null }): React.JSX.Element {
  const update = (id: string, patch: Partial<NewSpeciesMediaDraft>) => onChange(drafts.map((draft) => draft.id === id ? { ...draft, ...patch } : patch.makePrimary ? { ...draft, makePrimary: false } : draft));
  return <section className="form-section"><header><h2>Fotos y sonidos</h2><p>Los medios quedan asociados a esta solicitud de alta. Primero se procesan y luego una persona editora los aprueba junto con la especie.</p></header>
    <div className="form-stack">{drafts.map((draft) => <article className="source-card" key={draft.id}><button type="button" className="icon-button source-remove" aria-label="Quitar medio" onClick={() => onChange(drafts.filter((item) => item.id !== draft.id))}><Trash2 /></button><div className="form-grid two"><label className="field"><span>Tipo *</span><select value={draft.kind} onChange={(event) => update(draft.id, { kind: event.target.value as NewSpeciesMediaDraft['kind'], file: null, makePrimary: false })}><option value="image">Imagen</option><option value="audio">Audio</option></select></label><label className="field"><span>Archivo *</span><span className="file-input"><UploadCloud size={16} /><input type="file" accept={draft.kind === 'image' ? 'image/jpeg,image/png,image/webp,image/heic,image/heif' : 'audio/*,.flac,.wav,.m4a,.ogg'} onChange={(event) => update(draft.id, { file: event.target.files?.[0] ?? null })} /></span><small>{draft.file?.name ?? (draft.kind === 'image' ? 'JPEG, PNG, WebP o HEIC; se prepara a 1600 px.' : 'Audio de hasta 45 MB; se publicará un recorte de hasta 15 s.')}</small></label></div>
      {draft.kind === 'audio' && <div className="form-grid two"><NumberField label="Inicio del recorte (segundos)" value={draft.clipStartSeconds} onChange={(value) => update(draft.id, { clipStartSeconds: value })} min={0} /><NumberField label="Duración del recorte (máx. 15 s)" value={draft.clipDurationSeconds} onChange={(value) => update(draft.id, { clipDurationSeconds: value })} min={0.1} max={15} /></div>}
      <div className="form-grid two"><label className="field"><span>Autor o autora *</span><input value={draft.author} onChange={(event) => update(draft.id, { author: event.target.value })} required /></label><label className="field"><span>Licencia *</span><select value={draft.license} onChange={(event) => update(draft.id, { license: event.target.value as MediaAsset['license'] })}><option value="CC-BY-4.0">CC BY 4.0</option><option value="CC0">CC0</option><option value="permission">Autorización particular</option></select></label><label className="field"><span>Fuente u origen *</span><input value={draft.source} onChange={(event) => update(draft.id, { source: event.target.value })} required /></label><label className="field"><span>URL de procedencia</span><input type="url" value={draft.sourceUrl} onChange={(event) => update(draft.id, { sourceUrl: event.target.value })} /></label></div>
      {draft.kind === 'image' && <><label className="check-field"><input type="checkbox" onChange={(event) => { if (event.target.checked) update(draft.id, { author: profile?.displayName ?? '', source: 'Fotografía propia', license: 'CC-BY-4.0' }); }} /><span>La fotografía es mía: completa autoría, origen y recomienda CC BY 4.0.</span></label><label className="check-field"><input type="checkbox" checked={draft.makePrimary} onChange={(event) => update(draft.id, { makePrimary: event.target.checked })} /><span>Proponer como fotografía principal.</span></label></>}
      <label className="check-field"><input type="checkbox" checked={draft.accepted} onChange={(event) => update(draft.id, { accepted: event.target.checked })} /><span>Declaro que tengo derecho a aportar este medio y autorizo su publicación según la licencia indicada.</span></label>
    </article>)}</div>
    <div className="header-actions"><button type="button" className="secondary" onClick={() => onChange([...drafts, newDraft('image')])}><FileImage size={17} /> Agregar imagen</button><button type="button" className="secondary" onClick={() => onChange([...drafts, newDraft('audio')])}><FileAudio size={17} /> Agregar audio</button></div>
  </section>;
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange(value: number): void; min: number; max?: number }): React.JSX.Element { return <label className="field"><span>{label}</span><input type="number" value={value} min={min} max={max} step="0.1" onChange={(event) => onChange(Number(event.target.value))} /></label>; }
