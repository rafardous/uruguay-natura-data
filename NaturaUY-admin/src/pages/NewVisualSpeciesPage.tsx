import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {emptySpeciesPayload,type SpeciesPayload} from '../domain';
import {saveSpecies} from '../lib/api';
import {editorialClient,editorialRpc} from '../lib/editorial';
import {navigate} from '../lib/router';
import {NewSpeciesMedia,mediaDraftIsComplete,uploadNewSpeciesMedia,type NewSpeciesMediaDraft,type NewMediaUploadState} from '../components/NewSpeciesMedia';
import {BirdProfileEditor} from '../components/BirdProfileEditor';
import {IdentityAndTaxonomy,SizeEditor,EcologyEditor,NaturalHistoryEditor,Conservation,SelectField} from './SpeciesEditorV2Page';
import {Modal,Notice,PageHeader} from '../components/Ui';
import {abundanceLabel} from '../../../NaturaUY-source/src/domain/catalogLabels';
export function NewVisualSpeciesPage() {
 const {profile}=useAuth();const [payload,setPayload]=useState(emptySpeciesPayload),[code,setCode]=useState(''),[drafts,setDrafts]=useState<NewSpeciesMediaDraft[]>([]),[reason,setReason]=useState(''),[error,setError]=useState(''),[requestId,setRequestId]=useState<string|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[confirmed,setConfirmed]=useState(false);
 const patch=<K extends keyof SpeciesPayload>(key:K,value:SpeciesPayload[K])=>setPayload(p=>({...p,[key]:value}));
 const uploads=useRef<Record<string,NewMediaUploadState>>({}),[uploadsComplete,setUploadsComplete]=useState(false),[uploadFailed,setUploadFailed]=useState(false);
 const dirty=!requestId&&(!!code||drafts.length>0||JSON.stringify(payload)!==JSON.stringify(emptySpeciesPayload));
 useEffect(()=>{const unload=(e:BeforeUnloadEvent)=>{if(dirty)e.preventDefault();};const leave=(e:Event)=>{if(dirty&&!window.confirm('Hay cambios sin guardar. ¿Querés descartarlos y salir?'))e.preventDefault();};window.addEventListener('beforeunload',unload);window.addEventListener('arapy:beforeNavigate',leave);return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('arapy:beforeNavigate',leave);};},[dirty]);
 const props={payload,patch};
 useEffect(()=>{if(!requestId||!uploadsComplete)return;const timer=window.setInterval(()=>{void editorialClient().from('species_media').select('status').eq('change_id',requestId).then(({data,error})=>{if(!error)setReady((data??[]).length===drafts.length&&(data??[]).every(r=>['ready','approved'].includes(r.status)));});},5000);return()=>clearInterval(timer);},[requestId,uploadsComplete,drafts.length]);
 async function uploadDrafts(id:string){setUploadFailed(false);try{const main=drafts.find(d=>d.kind==='image'&&d.makePrimary)??drafts.find(d=>d.kind==='image');for(const draft of drafts){const state=uploads.current[draft.id]??(uploads.current[draft.id]={});await uploadNewSpeciesMedia(id,{...draft,makePrimary:draft.id===main?.id},state);}setUploadsComplete(true);setReady(drafts.length===0);}catch(e){setUploadFailed(true);throw e;}}
 async function save(){setBusy(true);setError('');try{
   if(requestId){if(!uploadsComplete){await uploadDrafts(requestId);setConfirm(false);return;}if(!ready)throw new Error('Esperá a que todos los medios estén verificados.');const id=await editorialRpc('review_species_change',{p_change_id:requestId,p_approve:true,p_confirm_self_validation:confirmed});navigate('/species/'+id);return;}
   if(!payload.scientificName.trim()||!payload.commonNames[0]?.trim()||!code.trim())throw new Error('Completá código, nombre común y nombre científico.');
   if(drafts.filter(d=>d.kind==='image').length>3||drafts.filter(d=>d.kind==='audio').length>1)throw new Error('Máximo tres fotos y un audio.');
   if(drafts.some(d=>!mediaDraftIsComplete(d)))throw new Error('Completá archivos, autoría y derechos.');
   const id=await saveSpecies({catalogCode:code,payload,baseUpdatedAt:null,reason});setRequestId(id);
   await uploadDrafts(id);setConfirm(false);
   if(profile?.role==='admin'&&drafts.length===0){const speciesId=await editorialRpc('review_species_change',{p_change_id:id,p_approve:true,p_confirm_self_validation:confirmed});navigate('/species/'+speciesId);}
 }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el alta.');}finally{setBusy(false);}}
 return <div className="visual-species"><button className="back-link" onClick={()=>navigate('/species')}>← Volver al catálogo</button><PageHeader eyebrow="ALTA EDITORIAL" title={payload.commonNames[0]||'Nueva especie'} subtitle="Prepará la ficha y sus medios. La aprobación conserva su identidad e historial."/>{error&&<Notice kind="error">{error}</Notice>}
 {uploadFailed&&requestId&&<button className="secondary" disabled={busy} onClick={()=>void save()}>Reintentar carga de medios</button>}
 {requestId&&<Notice>Alta enviada. {ready?'Los medios están preparados para revisión.':'Los archivos se están preparando; la ficha todavía no está publicada.'} <button className="text-button" onClick={()=>navigate('/reviews')}>Ver solicitud en Revisiones</button></Notice>}
 <fieldset disabled={!!requestId||busy} style={{border:0,padding:0}}>
 <section className="panel visual-block"><IdentityAndTaxonomy {...props} catalogCode={code} setCatalogCode={setCode}/></section>
 <section className="panel visual-gallery"><NewSpeciesMedia drafts={drafts} onChange={setDrafts} profile={profile}/></section>
 <details className="panel visual-block" open><summary>Origen y conservación</summary><SelectField label="Origen" value={payload.origin} onChange={v=>patch('origin',v as SpeciesPayload['origin'])} options={[['native','Nativa'],['introduced','Introducida'],['unknown','Sin determinar']]}/><Conservation {...props}/></details>
 {payload.taxonomy.kingdom!=='Plantae'&&<details className="panel visual-block"><summary>Presencia, abundancia y tamaño</summary><SelectField label="Estacionalidad" value={payload.seasonality} onChange={v=>patch('seasonality',v as SpeciesPayload['seasonality'])} options={[['resident','Residente'],['migratory','Migratoria'],['summer_visitor','Visitante estival'],['occasional','Ocasional'],['unknown','Sin determinar']]}/><SelectField label="Abundancia" value={payload.abundanceStatus} onChange={v=>patch('abundanceStatus',v as SpeciesPayload['abundanceStatus'])} options={['','abundant','common','fairly_common','uncommon','rare','scarce','occasional'].map(v=>[v,v?abundanceLabel(v):'Sin dato'])}/><SizeEditor {...props}/></details>}
 <details className="panel visual-block"><summary>Ambientes y alimentación</summary><EcologyEditor {...props}/></details>
 <section className="panel visual-block"><h2>Descripción e información relevante</h2><label className="field"><span>Descripción</span><textarea rows={6} value={payload.description} onChange={e=>patch('description',e.target.value)}/></label><label className="field"><span>Nota relevante</span><textarea value={payload.relevantNote} onChange={e=>patch('relevantNote',e.target.value)}/></label></section>
 <details className="panel visual-block"><summary>Perfil del grupo</summary>{payload.taxonomy.class==='Aves'?<BirdProfileEditor payload={payload} onChange={setPayload}/>:<NaturalHistoryEditor {...props}/>}</details>
 <details className="panel visual-secondary"><summary>Fuentes por campo</summary>{[...new Set(['description','abundance_status','natural_history.bird',...Object.keys(payload.fieldSources)])].map(path=><label className="field" key={path}><span>{path}</span><input value={(payload.fieldSources[path]??[]).join(', ')} onChange={e=>patch('fieldSources',{...payload.fieldSources,[path]:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)})}/></label>)}</details>
 </fieldset>
 <footer className="visual-save-bar"><span>{requestId?'Alta pendiente de aprobación':'Nueva ficha en preparación'}</span><button className="primary" disabled={busy||!!requestId&&(!ready||profile?.role!=='admin')} onClick={()=>{setConfirmed(false);setConfirm(true);}}>{requestId?'Revisar y aplicar alta':profile?.role==='admin'?'Revisar alta':'Enviar propuesta'}</button></footer>
 {confirm&&<Modal title="Revisar alta de especie" onClose={()=>setConfirm(false)}><p>{payload.commonNames[0]} · {payload.scientificName} · {drafts.filter(d=>d.kind==='image').length} fotos y {drafts.filter(d=>d.kind==='audio').length} audio.</p><label className="field"><span>Motivo del alta</span><textarea required value={reason} onChange={e=>setReason(e.target.value)}/></label>{profile?.role==='admin'&&<label className="check-field"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Revisé datos, fuentes y derechos. Confirmo la validación editorial.</label>}<button className="primary" disabled={busy||!reason.trim()||profile?.role==='admin'&&!confirmed} onClick={()=>void save()}>{busy?'Guardando…':requestId?'Aplicar alta':'Guardar y preparar'}</button></Modal>}
 </div>;
}
