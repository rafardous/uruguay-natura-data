import { ArchiveRestore, ArrowLeft, Check, History, ImagePlus, Leaf, Plus, Save, Trash2, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { NewSpeciesMedia, mediaDraftIsComplete, type NewSpeciesMediaDraft, uploadNewSpeciesMedia } from '../components/NewSpeciesMedia';
import { Empty, Loading, Modal, Notice, PageHeader } from '../components/Ui';
import { emptySpeciesPayload, type Revision, type SpeciesPayload, type SpeciesSummary } from '../domain';
import { findOwnPendingCreateRequest, getSpecies, saveSpecies, submitLifecycleChange } from '../lib/api';
import { navigate } from '../lib/router';

type Tab = 'identity' | 'content' | 'conservation' | 'sources' | 'history';
const tabs: Array<[Tab, string]> = [
  ['identity', 'Identidad y taxonomía'],
  ['content', 'Contenido y medios'],
  ['conservation', 'Conservación'],
  ['sources', 'Fuentes'],
  ['history', 'Historial'],
];

export function SpeciesEditorV2Page({ id }: { id: string | null }): React.JSX.Element {
  const { profile } = useAuth();
  const creating = id === null;
  const [species, setSpecies] = useState<SpeciesSummary | null>(null);
  const [payload, setPayload] = useState<SpeciesPayload>(emptySpeciesPayload());
  const [catalogCode, setCatalogCode] = useState('');
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [tab, setTab] = useState<Tab>('identity');
  const [mediaDrafts, setMediaDrafts] = useState<NewSpeciesMediaDraft[]>([]);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!creating);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<'retire' | 'restore' | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!id) return;
    void getSpecies(id).then((result) => {
      setSpecies(result.species);
      setPayload(result.species.payload);
      setCatalogCode(result.species.catalogCode);
      setRevisions(result.revisions);
      setLoading(false);
    }).catch((error: Error) => { setMessage(error.message); setLoading(false); });
  }, [id]);

  const title = payload.commonNames[0] || payload.scientificName || 'Nueva especie';
  const dirty = useMemo(() => creating || JSON.stringify(payload) !== JSON.stringify(species?.payload) || catalogCode !== species?.catalogCode, [payload, species, catalogCode, creating]);
  const patch = <K extends keyof SpeciesPayload>(key: K, value: SpeciesPayload[K]) => setPayload((current) => ({ ...current, [key]: value }));

  async function save(): Promise<void> {
    if (!payload.scientificName.trim() || !catalogCode.trim() || !payload.commonNames[0]?.trim()) {
      setMessage('El código Natura UY, el nombre científico y el nombre común principal son obligatorios.');
      return;
    }
    if (mediaDrafts.some((draft) => !mediaDraftIsComplete(draft))) {
      setTab('content');
      setMessage('Completá archivo, atribución, licencia y declaración de derechos para cada medio.');
      return;
    }
    setSaving(true); setMessage('');
    try {
      const requestId = pendingRequestId
        ?? (creating ? await findOwnPendingCreateRequest(catalogCode) : null)
        ?? await saveSpecies({ id: species?.id, catalogCode, payload, baseUpdatedAt: species?.updatedAt ?? null, reason: reason || (creating ? 'Alta de especie' : 'Rectificación editorial') });
      setPendingRequestId(requestId);
      if (creating && mediaDrafts.length) await Promise.all(mediaDrafts.map((draft) => uploadNewSpeciesMedia(requestId, draft)));
      navigate('/reviews');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.');
    } finally { setSaving(false); }
  }

  async function lifecycleAction(): Promise<void> {
    if (!species || !confirm) return;
    await submitLifecycleChange(species, confirm === 'retire' ? 'archived' : 'active', reason);
    setConfirm(null); navigate('/reviews');
  }

  if (loading) return <Loading label="Abriendo ficha editorial…" />;
  if (!creating && !species) return <Empty title="Especie no encontrada" detail={message || 'El registro no existe o fue retirado.'} />;

  return <>
    <button className="back-link" onClick={() => navigate('/species')}><ArrowLeft size={17} /> Volver al catálogo</button>
    <PageHeader eyebrow={creating ? 'ALTA DE ESPECIE' : 'FICHA APROBADA'} title={title} subtitle={payload.scientificName || 'Completá la identidad taxonómica'} action={<div className="header-actions">{species && <button className="secondary" onClick={() => setConfirm(species.lifecycle === 'active' ? 'retire' : 'restore')}>{species.lifecycle === 'active' ? <Trash2 size={17} /> : <ArchiveRestore size={17} />}{species.lifecycle === 'active' ? 'Proponer baja' : 'Proponer restauración'}</button>}<button className="primary" disabled={!dirty || saving} onClick={() => void save()}><Save size={17} />{saving ? 'Enviando…' : 'Enviar para revisión'}</button></div>} />
    {message && <Notice kind="error">{message}</Notice>}
    {species && <ApprovedMediaPreview species={species} title={title} />}
    <section className="editor-layout">
      <aside className="editor-tabs">
        {tabs.map(([key, label]) => <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}>{key === 'history' && <History size={17} />}{label}</button>)}
        <div className="editor-state"><small>Versión visible</small><span className="status validated">Aprobada</span><small>Editar nunca modifica la ficha publicada hasta que una solicitud sea validada.</small></div>
      </aside>
      <article className="panel editor-panel">
        {tab === 'identity' && <IdentityAndTaxonomy payload={payload} catalogCode={catalogCode} setCatalogCode={setCatalogCode} patch={patch} />}
        {tab === 'content' && <ContentAndMedia payload={payload} patch={patch} creating={creating} species={species} title={title} mediaDrafts={mediaDrafts} setMediaDrafts={setMediaDrafts} profile={profile} />}
        {tab === 'conservation' && <Conservation payload={payload} patch={patch} />}
        {tab === 'sources' && <Sources payload={payload} patch={patch} />}
        {tab === 'history' && <HistorySection revisions={revisions} />}
        {tab !== 'history' && <label className="field full"><span>Motivo del cambio</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: rectificación según fuente oficial" /></label>}
      </article>
    </section>
    {confirm && <Modal title={confirm === 'retire' ? 'Dar de baja la especie' : 'Restaurar la especie'} onClose={() => setConfirm(null)}><p>{confirm === 'retire' ? 'La especie dejará de aparecer en la próxima publicación, pero todo su historial se conservará.' : 'La especie volverá a incluirse en el catálogo publicado.'}</p><label className="field"><span>Motivo obligatorio</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label><footer className="modal-actions"><button className="secondary" onClick={() => setConfirm(null)}>Cancelar</button><button className="primary" disabled={!reason.trim()} onClick={() => void lifecycleAction()}>Confirmar</button></footer></Modal>}
  </>;
}

function ApprovedMediaPreview({ species, title }: { species: SpeciesSummary; title: string }): React.JSX.Element {
  return <section className="panel species-editor-preview"><span className="species-editor-preview-image">{species.imageUrl ? <img src={species.imageUrl} alt={`Imagen principal de ${title}`} /> : <Leaf size={25} />}</span><div><small>IMAGEN PRINCIPAL</small><strong>{species.imageUrl ? 'Medio aprobado' : 'Esta especie todavía no tiene imagen'}</strong><p>{species.hasAudio ? 'También tiene audio aprobado.' : 'Sin audio aprobado.'}</p></div><button className="secondary" onClick={() => navigate(`/media?species=${species.id}`)}><ImagePlus size={17} /> {species.imageUrl ? 'Cambiar o agregar medios' : 'Agregar imagen o audio'}</button></section>;
}

function IdentityAndTaxonomy({ payload, catalogCode, setCatalogCode, patch }: EditorSectionProps & { catalogCode: string; setCatalogCode(value: string): void }): React.JSX.Element {
  return <><FormSection title="Identidad" detail="La guía muestra un nombre científico, un nombre común principal y, cuando existen, nombres comunes alternativos."><div className="form-grid"><Field label="Código Natura UY" value={catalogCode} onChange={setCatalogCode} required /><Field label="Nombre científico de la ficha" value={payload.scientificName} onChange={(value) => patch('scientificName', value)} required italic /><Field label="Nombre común principal" value={payload.commonNames[0] ?? ''} onChange={(value) => patch('commonNames', [value, ...payload.commonNames.slice(1)])} required /><Field label="Otros nombres comunes" value={payload.commonNames.slice(1).join(', ')} onChange={(value) => patch('commonNames', [payload.commonNames[0] ?? '', ...split(value)])} hint="Opcionales, separados por comas" /><Field label="Nombre científico aceptado (si difiere)" value={payload.acceptedName} onChange={(value) => patch('acceptedName', value)} italic hint="Solo cuando el nombre de la ficha sea un sinónimo o una combinación anterior." /></div></FormSection><SectionDivider /><FormSection title="Clasificación taxonómica" detail="Jerarquía utilizada para ordenar, buscar y filtrar el catálogo."><div className="form-grid three">{(['kingdom','phylum','class','order','family','genus'] as const).map((key) => <Field key={key} label={{ kingdom:'Reino', phylum:'Filo', class:'Clase', order:'Orden', family:'Familia', genus:'Género' }[key]} value={payload.taxonomy[key]} onChange={(value) => patch('taxonomy', { ...payload.taxonomy, [key]: value })} italic={key !== 'kingdom'} />)}</div></FormSection></>;
}

function ContentAndMedia({ payload, patch, creating, species, title, mediaDrafts, setMediaDrafts, profile }: EditorSectionProps & { creating: boolean; species: SpeciesSummary | null; title: string; mediaDrafts: NewSpeciesMediaDraft[]; setMediaDrafts(value: NewSpeciesMediaDraft[]): void; profile: ReturnType<typeof useAuth>['profile'] }): React.JSX.Element {
  return <><FormSection title="Presencia en Uruguay" detail="Origen, establecimiento, estacionalidad y certeza son dimensiones diferentes."><div className="form-grid two"><SelectField label="Origen" value={payload.origin} onChange={(value) => patch('origin', value as SpeciesPayload['origin'])} options={[['native','Nativa'],['introduced','Introducida'],['unknown','Desconocido']]} /><SelectField label="Establecimiento" value={payload.establishment} onChange={(value) => patch('establishment', value as SpeciesPayload['establishment'])} options={[['established','Establecida'],['casual','Casual'],['uncertain','Incierto']]} /><SelectField label="Estacionalidad" value={payload.seasonality} onChange={(value) => patch('seasonality', value as SpeciesPayload['seasonality'])} options={[['resident','Residente'],['migratory','Migratoria'],['occasional','Ocasional'],['unknown','Desconocida']]} /><SelectField label="Certeza de presencia" value={payload.presenceCertainty} onChange={(value) => patch('presenceCertainty', value as SpeciesPayload['presenceCertainty'])} options={[['confirmed','Confirmada'],['probable','Probable'],['uncertain','Incierta']]} /><Field label="Abundancia" value={payload.abundanceStatus} onChange={(value) => patch('abundanceStatus', value)} hint="No confundir con conservación" /></div></FormSection><SectionDivider /><FormSection title="Biología y descripción" detail="Contenido comprensible para el público general."><div className="form-stack"><TextArea label="Descripción" value={payload.description} onChange={(value) => patch('description', value)} /><div className="form-grid two"><Field label="Hábitats" value={payload.habitat.join(', ')} onChange={(value) => patch('habitat', split(value))} hint="Separados por comas" /><Field label="Alimentación" value={payload.diet.join(', ')} onChange={(value) => patch('diet', split(value))} hint="Separada por comas" /><Field label="Tamaño" value={payload.size} onChange={(value) => patch('size', value)} /><Field label="Nota relevante" value={payload.relevantNote} onChange={(value) => patch('relevantNote', value)} /></div></div></FormSection><SectionDivider />{creating ? <NewSpeciesMedia drafts={mediaDrafts} onChange={setMediaDrafts} profile={profile} /> : <FormSection title="Multimedia" detail="La imagen principal aparece en la ficha, el resumen y los listados una vez procesada y aprobada."><div className="media-overview"><span className="media-overview-image">{species?.imageUrl ? <img src={species.imageUrl} alt={`Imagen principal de ${title}`} /> : <ImagePlus />}</span><div><strong>{species?.imageUrl ? 'Imagen principal aprobada' : 'Sin imagen principal'}</strong><p>{species?.hasAudio ? 'Audio aprobado disponible.' : 'Sin audio aprobado.'}</p><button className="secondary" onClick={() => species && navigate(`/media?species=${species.id}`)}><ImagePlus size={17} /> Gestionar medios</button>{species?.hasAudio && <span className="media-audio"><Volume2 size={16} /> Audio disponible</span>}</div></div></FormSection>}</>;
}

function Conservation({ payload, patch }: EditorSectionProps): React.JSX.Element { return <FormSection title="Estado de conservación" detail="Este estado es independiente de la abundancia observada."><div className="form-grid two"><Field label="Sistema" value={payload.conservation.system} onChange={(value) => patch('conservation', { ...payload.conservation, system: value })} /><SelectField label="Categoría" value={payload.conservation.category} onChange={(value) => patch('conservation', { ...payload.conservation, category: value as SpeciesPayload['conservation']['category'] })} options={['NE','DD','LC','NT','VU','EN','CR','EW','EX'].map((value) => [value, value])} /><Field label="Fuente" value={payload.conservation.source} onChange={(value) => patch('conservation', { ...payload.conservation, source: value })} /><Field type="date" label="Fecha de evaluación" value={payload.conservation.assessedAt} onChange={(value) => patch('conservation', { ...payload.conservation, assessedAt: value })} /></div></FormSection>; }

function Sources({ payload, patch }: EditorSectionProps): React.JSX.Element { return <FormSection title="Referencias de la especie" detail="Lista pública y simple de bibliografía, organismos o URLs que respaldan la ficha."><div className="source-list">{payload.sourceReferences.map((reference, index) => <article className="source-card" key={`${reference}-${index}`}><button className="icon-button source-remove" aria-label="Quitar referencia" onClick={() => patch('sourceReferences', payload.sourceReferences.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button><Field label={`Referencia ${index + 1}`} value={reference} onChange={(value) => patch('sourceReferences', payload.sourceReferences.map((item, itemIndex) => itemIndex === index ? value : item))} /></article>)}</div><button className="secondary" onClick={() => patch('sourceReferences', [...payload.sourceReferences, ''])}><Plus size={17} /> Agregar referencia</button></FormSection>; }

function HistorySection({ revisions }: { revisions: Revision[] }): React.JSX.Element { return <FormSection title="Auditoría de cambios aprobados" detail="Cada entrada guarda únicamente el diff validado, su autor y la persona que lo aprobó."><div className="timeline">{revisions.map((revision) => <article key={revision.id}><span className="timeline-icon"><Check /></span><div><header><strong>Cambio aprobado #{revision.id}</strong><span className="status validated">Aprobado</span></header><p>{revision.reason}</p><small>Propuesto por {revision.editedBy} · validado por {revision.validatedBy} · {new Date(revision.editedAt).toLocaleString('es-UY')}</small></div></article>)}</div></FormSection>; }

type Patch = <K extends keyof SpeciesPayload>(key: K, value: SpeciesPayload[K]) => void;
interface EditorSectionProps { payload: SpeciesPayload; patch: Patch; }
const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
function FormSection({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) { return <section className="form-section"><header><h2>{title}</h2><p>{detail}</p></header>{children}</section>; }
function SectionDivider() { return <hr className="form-divider" />; }
function Field({ label, value, onChange, required, italic, hint, type = 'text' }: { label: string; value: string; onChange(value: string): void; required?: boolean; italic?: boolean; hint?: string; type?: string }) { return <label className="field"><span>{label}{required && ' *'}</span><input className={italic ? 'italic' : ''} type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />{hint && <small>{hint}</small>}</label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) { return <label className="field"><span>{label}</span><textarea rows={6} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange(value: string): void; options: string[][] }) { return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>; }
