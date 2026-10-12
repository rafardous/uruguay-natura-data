import { ArchiveRestore, ArrowLeft, Check, ExternalLink, History, ImagePlus, Leaf, Plus, Save, Trash2, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { NewSpeciesMedia, mediaDraftIsComplete, type NewSpeciesMediaDraft, uploadNewSpeciesMedia } from '../components/NewSpeciesMedia';
import { Empty, Loading, Modal, Notice, PageHeader } from '../components/Ui';
import { emptySpeciesPayload, type Revision, type SpeciesNaturalHistoryPayload, type SpeciesPayload, type SpeciesSummary } from '../domain';
import { findOwnPendingCreateRequest, getSpecies, saveSpecies, submitLifecycleChange } from '../lib/api';
import { navigate } from '../lib/router';
import { HabitatSelector } from '../components/HabitatSelector';
import { TagSelector, DIET_OPTIONS, dietLabel } from '../components/TagSelector';
import {CommonNameTags} from '../components/CommonNameTags';
import {TaxonomyFields} from '../components/TaxonomyFields';

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
      setMessage('El código Arapy, el nombre científico y el nombre común principal son obligatorios.');
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
    setSaving(true);setMessage('');
    try{await submitLifecycleChange(species, confirm === 'retire' ? 'archived' : 'active', reason);setConfirm(null);navigate('/reviews');}
    catch(error){setMessage(error instanceof Error?error.message:'No se pudo enviar el cambio de estado.');}
    finally{setSaving(false);}
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
        <div className="editor-state"><small>Versión visible</small><span className="status validated">{creating ? 'Alta en preparación' : species?.lifecycle === 'retired' ? 'Archivada' : 'Aprobada'}</span><small>Editar nunca modifica la ficha publicada hasta que una solicitud sea validada.</small></div>
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
    {confirm && <Modal title={confirm === 'retire' ? 'Dar de baja la especie' : 'Restaurar la especie'} onClose={() => setConfirm(null)}><p>{confirm === 'retire' ? 'La especie dejará de aparecer en la próxima publicación, pero todo su historial se conservará.' : 'La especie volverá a incluirse en el catálogo publicado.'}</p><label className="field"><span>Motivo obligatorio</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label><footer className="modal-actions"><button className="secondary" onClick={() => setConfirm(null)}>Cancelar</button><button className="primary" disabled={!reason.trim() || saving} onClick={() => void lifecycleAction()}>Confirmar</button></footer></Modal>}
  </>;
}

function ApprovedMediaPreview({ species, title }: { species: SpeciesSummary; title: string }): React.JSX.Element {
  return <section className="panel species-editor-preview"><span className="species-editor-preview-image">{species.imageUrl ? <img src={species.imageUrl} alt={`Imagen principal de ${title}`} /> : <Leaf size={25} />}</span><div><small>IMAGEN PRINCIPAL</small><strong>{species.imageUrl ? species.imageIsLegacy ? 'Imagen externa heredada' : 'Medio aprobado' : 'Esta especie todavía no tiene imagen'}</strong><p>{species.hasAudio ? 'También tiene audio aprobado.' : 'Sin audio aprobado.'}</p></div><button className="secondary" onClick={() => navigate(`/media?species=${species.id}`)}><ImagePlus size={17} /> {species.imageUrl ? 'Cambiar o agregar medios' : 'Agregar imagen o audio'}</button></section>;
}

function IdentityAndTaxonomy({ payload, catalogCode, setCatalogCode, patch, protectCode }: EditorSectionProps & { catalogCode: string; setCatalogCode(value: string): void; protectCode?: boolean }): React.JSX.Element {
  return <><FormSection title="Identidad" detail="La guía muestra un nombre científico, un nombre común principal y, cuando existen, nombres comunes alternativos."><div className="form-grid"><Field label="Código Arapy" value={catalogCode} onChange={setCatalogCode} required readOnly={protectCode} /><Field label="Nombre científico de la ficha" value={payload.scientificName} onChange={(value) => patch('scientificName', value)} required italic /><Field label="Nombre común principal" value={payload.commonNames[0] ?? ''} onChange={(value) => patch('commonNames', [value, ...payload.commonNames.slice(1)])} required /><CommonNameTags values={payload.commonNames.slice(1)} onChange={value=>patch('commonNames',[payload.commonNames[0]??'',...value])}/><Field label="Nombre científico aceptado (si difiere)" value={payload.acceptedName} onChange={(value) => patch('acceptedName', value)} italic hint="Solo cuando el nombre de la ficha sea un sinónimo o una combinación anterior." /></div></FormSection><SectionDivider /><FormSection title="Clasificación taxonómica" detail="Jerarquía utilizada para ordenar, buscar y filtrar el catálogo."><TaxonomyFields value={payload.taxonomy} onChange={value=>patch('taxonomy',value)}/></FormSection></>;
}

type ContentAndMediaProps = EditorSectionProps & { creating: boolean; species: SpeciesSummary | null; title: string; mediaDrafts: NewSpeciesMediaDraft[]; setMediaDrafts(value: NewSpeciesMediaDraft[]): void; profile: ReturnType<typeof useAuth>['profile'] };

function ContentAndMedia(props: ContentAndMediaProps): React.JSX.Element {
  const { creating, species, title, mediaDrafts, setMediaDrafts, profile } = props;
  return <>
    {creating ? <NewSpeciesMedia drafts={mediaDrafts} onChange={setMediaDrafts} profile={profile} /> : <FormSection title="Multimedia" detail="La ficha usa primero los medios aprobados y, mientras no existan, muestra la referencia externa heredada."><div className="media-overview"><span className="media-overview-image">{species?.imageUrl ? <img src={species.imageUrl} alt={`Imagen principal de ${title}`} /> : <ImagePlus />}</span><div><strong>{species?.imageUrl ? species.imageIsLegacy ? 'Imagen externa heredada' : 'Imagen principal aprobada' : 'Sin imagen asociada'}</strong>{species?.imageSourceUrl && <a className="media-source-link" href={species.imageSourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /><span>{species.imageSourceUrl}</span></a>}<p>{species?.hasAudio ? 'Audio aprobado disponible.' : 'Sin audio aprobado.'}</p><button className="secondary" onClick={() => species && navigate(`/media?species=${species.id}`)}><ImagePlus size={17} /> Gestionar medios</button>{species?.hasAudio && <span className="media-audio"><Volume2 size={16} /> Audio disponible</span>}</div></div></FormSection>}
    <SectionDivider />
    <div className="content-media-fields"><ContentAndMediaFields {...props} /></div>
    <SectionDivider />
    {props.payload.taxonomy.kingdom !== 'Plantae' && <SizeEditor payload={props.payload} patch={props.patch} />}
    <SectionDivider />
    <EcologyEditor payload={props.payload} patch={props.patch} />
    <NaturalHistoryEditor payload={props.payload} patch={props.patch} />
  </>;
}

function SizeEditor({ payload, patch }: EditorSectionProps): React.JSX.Element {
  const find = (kind: SpeciesPayload['measurements'][number]['kind']) => payload.measurements.find((item) => item.kind === kind);
  const setMeasurement = (kind: SpeciesPayload['measurements'][number]['kind'], raw: string, unit: 'mm' | 'g', basis: SpeciesPayload['measurements'][number]['basis'] = null) => {
    const rest = payload.measurements.filter((item) => item.kind !== kind);
    const value = Number(raw.replace(',', '.'));
    const previous = find(kind);
    patch('measurements', raw.trim() && Number.isFinite(value) && value > 0 ? [...rest, { ...previous, kind, value, unit, basis, estimated: previous?.estimated ?? false, sourceCode: previous?.sourceCode ?? '', sourceRecordId: previous?.sourceRecordId ?? null, provenance: previous?.provenance ?? 'verified' }] : rest);
  };
  const source = (kind: SpeciesPayload['measurements'][number]['kind']) => <><Field label="Fuente (opcional)" value={find(kind)?.sourceCode ?? ''} onChange={(value) => patch('measurements', payload.measurements.map((item) => item.kind === kind ? { ...item, sourceCode: value } : item))} /><Field label="ID en la fuente" value={find(kind)?.sourceRecordId ?? ''} onChange={(value) => patch('measurements', payload.measurements.map((item) => item.kind === kind ? { ...item, sourceRecordId: value || null } : item))} /></>;
  return <FormSection title="Tamaño" detail="Cada medida conserva su convención, fuente y procedencia; el largo corporal nunca se calcula sumando otras medidas."><div className="form-grid three">
    <Field label="Longitud corporal (mm)" value={find('body_length')?.value.toString() ?? ''} onChange={(value) => setMeasurement('body_length', value, 'mm', 'body_length')} />
    <Field label="Longitud máxima (mm)" value={find('max_length')?.value.toString() ?? ''} onChange={(value) => setMeasurement('max_length', value, 'mm', find('max_length')?.basis ?? null)} />
    <SelectField label="Convención de longitud" value={find('max_length')?.basis ?? ''} onChange={(value) => patch('measurements', payload.measurements.map((item) => item.kind === 'max_length' ? { ...item, basis: value ? value as 'TL'|'SL'|'FL'|'SVL' : null } : item))} options={[["","Sin especificar"],["TL","TL · longitud total"],["SL","SL · longitud estándar"],["FL","FL · longitud a la horquilla"],["SVL","SVL · hocico-cloaca"]]} />
    <Field label="Masa (g)" value={find('body_mass')?.value.toString() ?? ''} onChange={(value) => setMeasurement('body_mass', value, 'g')} />
    <Field label="Ala (mm)" value={find('wing_length')?.value.toString() ?? ''} onChange={(value) => setMeasurement('wing_length', value, 'mm')} />
    <Field label="Cola (mm)" value={find('tail_length')?.value.toString() ?? ''} onChange={(value) => setMeasurement('tail_length', value, 'mm')} />
    <Field label="Tarso (mm)" value={find('tarsus_length')?.value.toString() ?? ''} onChange={(value) => setMeasurement('tarsus_length', value, 'mm')} />
    <details className="field full"><summary>Fuentes de las medidas (opcional)</summary><p>Si no indicás una, se guardará «Sin fuente».</p><div className="form-grid two">
    {find('body_length') && source('body_length')}
    {find('max_length') && source('max_length')}
    {find('body_mass') && source('body_mass')}
    {find('wing_length') && source('wing_length')}
    {find('tail_length') && source('tail_length')}
    {find('tarsus_length') && source('tarsus_length')}
    </div></details>
  </div></FormSection>;
}

function EcologyEditor({ payload, patch }: EditorSectionProps): React.JSX.Element {
  const update = <K extends keyof SpeciesPayload['ecology']>(key: K, value: SpeciesPayload['ecology'][K]) => patch('ecology', { ...payload.ecology, [key]: value });
  const source = (label: string, path: string) => <Field label={`Fuente · ${label}`} value={(payload.fieldSources[path] ?? []).join(', ')} onChange={(value) => patch('fieldSources', { ...payload.fieldSources, [path]: split(value) })} hint="Código registrado y, si corresponde, ID del registro" />;
  const controlled = (label: string, key: 'lifeModes'|'activity'|'aquaticEnvironments'|'waterZones', options: Array<readonly [string,string]>) => <MultiSelectField label={label} values={payload.ecology[key]} options={options} onChange={(values) => update(key, values)} />;
  if (payload.taxonomy.kingdom === 'Plantae') return <FormSection title="Ambientes" detail="Hábitats y formaciones vegetales requieren fuente por campo."><div className="form-grid three">
    <HabitatSelector value={payload.ecology.habitats} onChange={(value)=>update('habitats',value)} />
    <Field label="Formaciones vegetales" value={payload.ecology.vegetationFormations.join(', ')} onChange={(value) => update('vegetationFormations', split(value))} />
    {source('Hábitats','ecology.habitats')}{source('Formaciones vegetales','ecology.vegetationFormations')}
  </div></FormSection>;
  return <FormSection title="Ecología" detail="Los campos ecológicos se publican separados del tamaño y con rutas de fuente propias."><div className="form-grid three">
    <HabitatSelector value={payload.ecology.habitats} onChange={(value)=>update('habitats',value)} />
    <TagSelector label="Alimentación general" values={payload.ecology.diet} options={DIET_OPTIONS} field="diet" format={dietLabel} onChange={(value)=>update('diet',value)} />
    {controlled('Modo de vida','lifeModes',[['terrestrial','Terrestre'],['arboreal','Arborícola'],['aquatic','Acuático'],['aerial','Aéreo'],['fossorial','Fosorial'],['perching','Posador'],['generalist','Generalista']])}
    {controlled('Actividad','activity',[['diurnal','Diurna'],['nocturnal','Nocturna'],['both','Diurna y nocturna']])}
    {controlled('Ambiente acuático','aquaticEnvironments',[['freshwater','Agua dulce'],['brackish','Salobre'],['marine','Marino']])}
    {controlled('Zona de agua','waterZones',[['benthic','Bentónica'],['demersal','Demersal'],['pelagic','Pelágica']])}
    <Field label="Profundidad mínima (m)" value={payload.ecology.depthMinM?.toString() ?? ''} onChange={(value) => update('depthMinM', value.trim() ? Number(value.replace(',','.')) : null)} />
    <Field label="Profundidad máxima (m)" value={payload.ecology.depthMaxM?.toString() ?? ''} onChange={(value) => update('depthMaxM', value.trim() ? Number(value.replace(',','.')) : null)} />
    <Field label="Microhábitats" value={payload.ecology.microhabitats.join(', ')} onChange={(value) => update('microhabitats', split(value))} />
    <Field label="Roles tróficos" value={payload.ecology.trophicRoles.join(', ')} onChange={(value) => update('trophicRoles', split(value))} />
    <Field label="Hospedadores" value={payload.ecology.hosts.join(', ')} onChange={(value) => update('hosts', split(value))} />
    <Field label="Asociaciones con plantas" value={payload.ecology.plantAssociations.join(', ')} onChange={(value) => update('plantAssociations', split(value))} />
    <Field label="Formaciones vegetales" value={payload.ecology.vegetationFormations.join(', ')} onChange={(value) => update('vegetationFormations', split(value))} />
    {source('Hábitats','ecology.habitats')}{source('Alimentación','ecology.diet')}{source('Modo de vida','ecology.lifeModes')}{source('Actividad','ecology.activity')}
    {source('Ambiente acuático','ecology.aquaticEnvironments')}{source('Zona de agua','ecology.waterZones')}{source('Profundidad','ecology.depth')}
    {source('Microhábitats','ecology.microhabitats')}{source('Roles tróficos','ecology.trophicRoles')}{source('Hospedadores','ecology.hosts')}
    {source('Asociaciones con plantas','ecology.plantAssociations')}{source('Formaciones vegetales','ecology.vegetationFormations')}
  </div></FormSection>;
}

function NaturalHistoryEditor({ payload, patch }: EditorSectionProps): React.JSX.Element | null {
  if (payload.taxonomy.kingdom === 'Plantae') {
    const history = payload.naturalHistory ?? { version: 1 as const };
    const plant = history.plant ?? {};
    const update = (next: NonNullable<SpeciesNaturalHistoryPayload['plant']>): void => patch('naturalHistory', { ...history, version: 1, plant: next });
    return <><SectionDivider/><FormSection title="Perfil botánico" detail="Hábito, forma de vida y ambiente se publican sólo cuando una fuente del catálogo los respalda."><div className="form-grid three">
      <Field label="Hábito" value={plant.habit ?? ''} onChange={(value)=>update({...plant,habit:value||null})} hint="Árbol, arbusto, hierba perenne…"/>
      <Field label="Forma de vida" value={plant.lifeForm ?? ''} onChange={(value)=>update({...plant,lifeForm:value||null})} hint="Fanerófita, caméfita…"/>
      <Field label="Altura mínima (cm)" value={plant.heightCm?.min?.toString() ?? ''} onChange={(value)=>update({...plant,heightCm:{min:value.trim()?Number(value.replace(',','.')):null,max:plant.heightCm?.max??null}})} />
      <Field label="Altura máxima (cm)" value={plant.heightCm?.max?.toString() ?? ''} onChange={(value)=>update({...plant,heightCm:{min:plant.heightCm?.min??null,max:value.trim()?Number(value.replace(',','.')):null}})} />
      <Field label="Meses de floración" value={(plant.phenology?.floweringMonths??[]).join(', ')} onChange={(value)=>update({...plant,phenology:{...plant.phenology,floweringMonths:split(value).map(Number).filter((month)=>month>=1&&month<=12)}})} hint="1 a 12, separados por comas"/>
      <Field label="Meses de fructificación" value={(plant.phenology?.fruitingMonths??[]).join(', ')} onChange={(value)=>update({...plant,phenology:{...plant.phenology,fruitingMonths:split(value).map(Number).filter((month)=>month>=1&&month<=12)}})}/>
      <Field label="Autoría del nombre" value={plant.nomenclature?.authorship ?? ''} onChange={(value)=>update({...plant,nomenclature:{...plant.nomenclature,authorship:value||null}})}/>
      <Field label="Publicación original" value={plant.nomenclature?.publication ?? ''} onChange={(value)=>update({...plant,nomenclature:{...plant.nomenclature,publication:value||null}})}/>
      <Field label="Nombres alternativos de familia" value={(plant.nomenclature?.familyAliases??[]).join(', ')} onChange={(value)=>update({...plant,nomenclature:{...plant.nomenclature,familyAliases:split(value)}})}/>
      <Field label="Fuentes del perfil" value={(plant.sources??[]).join(', ')} onChange={(value)=>update({...plant,sources:split(value)})}/>
      <Field label="Fuente · altura" value={(payload.fieldSources['naturalHistory.plant.heightCm']??[]).join(', ')} onChange={(value)=>patch('fieldSources',{...payload.fieldSources,'naturalHistory.plant.heightCm':split(value)})}/>
      <Field label="Fuente · floración" value={(payload.fieldSources['naturalHistory.plant.phenology.floweringMonths']??[]).join(', ')} onChange={(value)=>patch('fieldSources',{...payload.fieldSources,'naturalHistory.plant.phenology.floweringMonths':split(value)})}/>
      <Field label="Fuente · fructificación" value={(payload.fieldSources['naturalHistory.plant.phenology.fruitingMonths']??[]).join(', ')} onChange={(value)=>patch('fieldSources',{...payload.fieldSources,'naturalHistory.plant.phenology.fruitingMonths':split(value)})}/>
    </div></FormSection></>;
  }
  if (payload.taxonomy.phylum !== 'Arthropoda' && !['Arachnida', 'Insecta', 'Malacostraca'].includes(payload.taxonomy.class)) return null;
  const history = payload.naturalHistory ?? { version: 1 as const };
  const arthropod = history.arthropod ?? {};
  const update = (next: SpeciesNaturalHistoryPayload['arthropod']): void => patch('naturalHistory', { ...history, version: 1, arthropod: next });
  const list = (value: string[] | undefined): string => (value ?? []).join(', ');
  const human = arthropod.humanRelevance ?? {};
  const relevance = (key: 'vector' | 'pest' | 'venomous' | 'veterinaryImportance', label: string) => <label className="check-field"><input type="checkbox" checked={human[key] === true} onChange={(event) => update({ ...arthropod, humanRelevance: { ...human, [key]: event.target.checked } })} /><span>{label}</span></label>;
  return <>
    <SectionDivider />
    <FormSection title="Historia natural de artrópodos" detail="Contenido técnico opcional para reconocer el grupo. Cada afirmación sobre vectores, plagas o veneno debe tener una fuente aprobada.">
      <div className="form-grid three">
        <Field label="Regiones corporales" value={list(arthropod.morphology?.bodyRegions)} onChange={(value) => update({ ...arthropod, morphology: { ...arthropod.morphology, bodyRegions: split(value) } })} hint="cabeza, tórax, abdomen…" />
        <Field label="Patas" value={arthropod.morphology?.legs?.toString() ?? ''} onChange={(value) => update({ ...arthropod, morphology: { ...arthropod.morphology, legs: value.trim() ? Number(value) : null } })} />
        <Field label="Exoesqueleto" value={arthropod.morphology?.exoskeleton ?? ''} onChange={(value) => update({ ...arthropod, morphology: { ...arthropod.morphology, exoskeleton: value } })} />
        <Field label="Antenas" value={arthropod.morphology?.antennae ?? ''} onChange={(value) => update({ ...arthropod, morphology: { ...arthropod.morphology, antennae: value } })} />
        <Field label="Alas" value={arthropod.morphology?.wings ?? ''} onChange={(value) => update({ ...arthropod, morphology: { ...arthropod.morphology, wings: value } })} />
        <Field label="Quelíceros / pedipalpos" value={arthropod.morphology?.cheliceraePedipalps ?? ''} onChange={(value) => update({ ...arthropod, morphology: { ...arthropod.morphology, cheliceraePedipalps: value } })} />
        <Field label="Fuentes de morfología" value={list(arthropod.morphology?.sources)} onChange={(value) => update({ ...arthropod, morphology: { ...arthropod.morphology, sources: split(value) } })} hint="Códigos o URLs aprobados" />
        <Field label="Caracteres diagnósticos" value={list(arthropod.identification?.diagnosticCharacters)} onChange={(value) => update({ ...arthropod, identification: { ...arthropod.identification, diagnosticCharacters: split(value) } })} hint="Separados por comas" />
        <Field label="Especies similares" value={list(arthropod.identification?.similarSpecies)} onChange={(value) => update({ ...arthropod, identification: { ...arthropod.identification, similarSpecies: split(value) } })} />
        <Field label="Fuentes de identificación" value={list(arthropod.identification?.sources)} onChange={(value) => update({ ...arthropod, identification: { ...arthropod.identification, sources: split(value) } })} hint="Códigos o URLs aprobados" />
        <Field label="Etapas del ciclo" value={list(arthropod.lifeCycle?.stages)} onChange={(value) => update({ ...arthropod, lifeCycle: { ...arthropod.lifeCycle, stages: split(value) } })} hint="huevo, larva, ninfa, adulto…" />
        <SelectField label="Metamorfosis" value={arthropod.lifeCycle?.metamorphosis ?? ''} onChange={(value) => update({ ...arthropod, lifeCycle: { ...arthropod.lifeCycle, metamorphosis: (value || null) as NonNullable<NonNullable<SpeciesNaturalHistoryPayload['arthropod']>['lifeCycle']>['metamorphosis'] } })} options={[['','Sin especificar'],['none','Sin metamorfosis'],['incomplete','Incompleta'],['complete','Completa'],['variable','Variable']]} />
        <Field label="Fuentes del ciclo de vida" value={list(arthropod.lifeCycle?.sources)} onChange={(value) => update({ ...arthropod, lifeCycle: { ...arthropod.lifeCycle, sources: split(value) } })} hint="Códigos o URLs aprobados" />
        <div className="field full"><span>Relevancia humana (sólo con evidencia)</span><div className="form-grid two">{relevance('vector', 'Puede actuar como vector')}{relevance('pest', 'Puede ser plaga')}{relevance('venomous', 'Tiene veneno o estructuras venenosas')}{relevance('veterinaryImportance', 'Tiene importancia veterinaria')}</div><small>Estas marcas no se publican como diagnóstico ni implican riesgo por sí solas.</small></div>
        <Field label="Nota de relevancia humana" value={human.note ?? ''} onChange={(value) => update({ ...arthropod, humanRelevance: { ...human, note: value } })} hint="No usar lenguaje médico sin respaldo editorial." />
        <Field label="Fuentes de relevancia" value={list(human.sources)} onChange={(value) => update({ ...arthropod, humanRelevance: { ...human, sources: split(value) } })} />
        <Field label="Fuentes de historia natural" value={list(arthropod.sources)} onChange={(value) => update({ ...arthropod, sources: split(value) })} />
      </div>
    </FormSection>
  </>;
}

function ContentAndMediaFields({ payload, patch, creating, species, title, mediaDrafts, setMediaDrafts, profile }: ContentAndMediaProps): React.JSX.Element {
  return <><FormSection title="Presencia en Uruguay" detail="Origen, estacionalidad y abundancia experta se mantienen separados."><div className="form-grid two"><SelectField label="Origen" value={payload.origin} onChange={(value) => patch('origin', value as SpeciesPayload['origin'])} options={[['native','Nativa'],['introduced','Introducida'],['unknown','Desconocido']]} /><SelectField label="Estacionalidad" value={payload.seasonality} onChange={(value) => patch('seasonality', value as SpeciesPayload['seasonality'])} options={[['resident','Residente'],['migratory','Migratoria'],['occasional','Ocasional'],['unknown','Desconocida']]} /><SelectField label="Abundancia" value={payload.abundanceStatus} onChange={(value) => patch('abundanceStatus', value as SpeciesPayload['abundanceStatus'])} options={[['','Sin dato'],['abundant','Abundante'],['common','Común'],['fairly_common','Bastante común'],['uncommon','Poco común'],['rare','Rara'],['scarce','Escasa'],['occasional','Ocasional']]} /><Field label="Fuente de abundancia" value={(payload.fieldSources.abundance_status ?? []).join(', ')} onChange={(value) => patch('fieldSources', { ...payload.fieldSources, abundance_status: split(value) })} hint="Opcional: si falta, se guardará «Sin fuente»" /></div></FormSection><SectionDivider /><FormSection title="Descripción" detail="Contenido comprensible para el público general."><div className="form-stack"><TextArea label="Descripción" value={payload.description} onChange={(value) => patch('description', value)} /><Field label="Nota relevante" value={payload.relevantNote} onChange={(value) => patch('relevantNote', value)} /></div></FormSection><SectionDivider />{creating ? <NewSpeciesMedia drafts={mediaDrafts} onChange={setMediaDrafts} profile={profile} /> : <FormSection title="Multimedia" detail="La ficha usa medios procesados y aprobados."><button className="secondary" onClick={() => species && navigate(`/media?species=${species.id}`)}><ImagePlus size={17} /> Gestionar medios</button></FormSection>}</>;
}

function Conservation({ payload, patch }: EditorSectionProps): React.JSX.Element {
  const updateAssessment = (system: 'nationalRedList'|'iucnGlobal', values: Partial<SpeciesPayload['conservation'][typeof system]>) => patch('conservation', { ...payload.conservation, [system]: { ...payload.conservation[system], ...values } });
  return <><FormSection title="Lista Roja Uruguay" detail="La ausencia de evaluación queda vacía; nunca se convierte automáticamente en LC."><div className="form-grid two"><SelectField label="Categoría nacional" value={payload.conservation.nationalRedList.category} onChange={(category) => updateAssessment('nationalRedList', { category: category as SpeciesPayload['conservation']['nationalRedList']['category'] })} options={['','DD','LC','NT','VU','EN','CR','RE'].map((value) => [value, value || 'Sin evaluación'])} /><Field label="Código de fuente" value={payload.conservation.nationalRedList.sourceCode} onChange={(sourceCode) => updateAssessment('nationalRedList', { sourceCode })} /><Field label="Versión" value={payload.conservation.nationalRedList.version} onChange={(version) => updateAssessment('nationalRedList', { version })} /><Field type="date" label="Fecha" value={payload.conservation.nationalRedList.assessedAt} onChange={(assessedAt) => updateAssessment('nationalRedList', { assessedAt })} /></div></FormSection><SectionDivider/><FormSection title="UICN global" detail="Evaluación global independiente de la lista nacional."><div className="form-grid two"><SelectField label="Categoría UICN" value={payload.conservation.iucnGlobal.category} onChange={(category) => updateAssessment('iucnGlobal', { category: category as SpeciesPayload['conservation']['iucnGlobal']['category'] })} options={['','DD','LC','NT','VU','EN','CR','EW','EX'].map((value) => [value, value || 'Sin evaluación'])} /><Field label="Código de fuente" value={payload.conservation.iucnGlobal.sourceCode} onChange={(sourceCode) => updateAssessment('iucnGlobal', { sourceCode })} /><Field label="Versión" value={payload.conservation.iucnGlobal.version} onChange={(version) => updateAssessment('iucnGlobal', { version })} /><Field type="date" label="Fecha" value={payload.conservation.iucnGlobal.assessedAt} onChange={(assessedAt) => updateAssessment('iucnGlobal', { assessedAt })} /></div></FormSection><SectionDivider/><FormSection title="Designaciones nacionales" detail="Condiciones nacionales que se muestran por separado."><MultiSelectField label="Designaciones" values={payload.conservation.nationalDesignations} options={[['priority','Prioritaria'],['threatened','Amenazada'],['snap','Vinculada al SNAP']]} onChange={(nationalDesignations) => patch('conservation', { ...payload.conservation, nationalDesignations: nationalDesignations as SpeciesPayload['conservation']['nationalDesignations'] })} /></FormSection></>;
}

function Sources({ payload, patch }: EditorSectionProps): React.JSX.Element { return <FormSection title="Referencias de la especie" detail="Lista pública y simple de bibliografía, organismos o URLs que respaldan la ficha."><div className="source-list">{payload.sourceReferences.map((reference, index) => <article className="source-card" key={`${reference}-${index}`}><button className="icon-button source-remove" aria-label="Quitar referencia" onClick={() => patch('sourceReferences', payload.sourceReferences.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button><Field label={`Referencia ${index + 1}`} value={reference} onChange={(value) => patch('sourceReferences', payload.sourceReferences.map((item, itemIndex) => itemIndex === index ? value : item))} /></article>)}</div><button className="secondary" onClick={() => patch('sourceReferences', [...payload.sourceReferences, ''])}><Plus size={17} /> Agregar referencia</button></FormSection>; }

function HistorySection({ revisions }: { revisions: Revision[] }): React.JSX.Element { return <FormSection title="Auditoría de cambios aprobados" detail="Cada entrada guarda únicamente el diff validado, su autor y la persona que lo aprobó."><div className="timeline">{revisions.map((revision) => <article key={revision.id}><span className="timeline-icon"><Check /></span><div><header><strong>Cambio aprobado #{revision.id}</strong><span className="status validated">Aprobado</span></header><p>{revision.reason}</p><small>Propuesto por {revision.editedBy} · validado por {revision.validatedBy} · {new Date(revision.editedAt).toLocaleString('es-UY')}</small></div></article>)}</div></FormSection>; }

type Patch = <K extends keyof SpeciesPayload>(key: K, value: SpeciesPayload[K]) => void;
interface EditorSectionProps { payload: SpeciesPayload; patch: Patch; }
const split = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
function FormSection({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) { return <section className="form-section"><header><h2>{title}</h2><p>{detail}</p></header>{children}</section>; }
function SectionDivider() { return <hr className="form-divider" />; }
function Field({ label, value, onChange, required, italic, hint, type = 'text', readOnly = false }: { label: string; value: string; onChange(value: string): void; required?: boolean; italic?: boolean; hint?: string; type?: string; readOnly?: boolean }) { return <label className="field"><span>{label}{required && ' *'}</span><input className={italic ? 'italic' : ''} type={type} readOnly={readOnly} value={value} onChange={(event) => onChange(event.target.value)} required={required} />{hint && <small>{hint}</small>}</label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) { return <label className="field"><span>{label}</span><textarea rows={6} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange(value: string): void; options: Array<readonly [string, string]> }) { const normalizedOptions: Array<readonly [string,string]> = label === 'Estacionalidad' && !options.some(([key]) => key === 'summer_visitor') ? [...options, ['summer_visitor', 'Visitante estival']] : options; return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{normalizedOptions.map(([key, text]) => <option value={key} key={key}>{text}</option>)}</select></label>; }
function MultiSelectField({ label, values, options, onChange }: { label: string; values: string[]; options: Array<readonly [string,string]>; onChange(values: string[]): void }) { return <fieldset className="field full"><legend>{label}</legend><div className="form-grid three">{options.map(([value, text]) => <label className="check-field" key={value}><input type="checkbox" checked={values.includes(value)} onChange={(event) => onChange(event.target.checked ? [...values, value] : values.filter((item) => item !== value))}/><span>{text}</span></label>)}</div></fieldset>; }

export { IdentityAndTaxonomy, SizeEditor, EcologyEditor, NaturalHistoryEditor, Conservation, Sources, HistorySection, SelectField };
