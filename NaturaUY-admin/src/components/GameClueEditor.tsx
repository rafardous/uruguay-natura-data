import { useEffect, useState } from 'react';
import type { SpeciesSummary } from '../domain';
import { listGameClues, submitContentChange, type CatalogSource, type GameClueRow } from '../lib/api';

const KINDS = {habitat:'Hábitat',diet:'Alimentación',behavior:'Comportamiento',appearance:'Apariencia',decisive:'Pista decisiva'};
export function GameClueEditor({species,sources,onChange}:{species:SpeciesSummary[];sources:CatalogSource[];onChange:()=>Promise<unknown>}):React.JSX.Element {
  const [speciesId,setSpeciesId]=useState(''),[id,setId]=useState<string|null>(null);
  const [kind,setKind]=useState<keyof typeof KINDS>('habitat'),[order,setOrder]=useState(1);
  const [body,setBody]=useState(''),[sourceId,setSourceId]=useState(''),[comment,setComment]=useState('');
  const [sourceRecordId,setSourceRecordId]=useState('');
  const [rows,setRows]=useState<GameClueRow[]>([]),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
  const publicSources=sources.filter(source=>source.usePolicy==='redistributable');
  useEffect(()=>{let active=true;setRows([]);setId(null);setBody('');setSourceRecordId('');if(speciesId)void listGameClues(speciesId).then(items=>{if(active)setRows(items);}).catch(error=>{if(active)setMessage(String(error));});return()=>{active=false;};},[speciesId,species]);
  const edit=(row:GameClueRow)=>{setId(row.id);setKind(row.kind);setOrder(row.sortOrder);setBody(row.body);setSourceId(row.sourceId);setSourceRecordId(row.sourceRecordId??'');setComment('');};
  const propose=async(operation:'upsert'|'archive',row?:GameClueRow)=>{
    setSaving(true);setMessage('');
    try{await submitContentChange({contentType:'game_clue',entityId:row?.id??id,speciesId,operation,values:operation==='archive'?{}:{kind,sort_order:order,body,source_id:sourceId,source_record_id:sourceRecordId.trim()||null},comment});setMessage('Pista enviada a la bandeja de revisiones.');setBody('');setSourceRecordId('');setId(null);await onChange();}
    catch(error){setMessage(error instanceof Error?error.message:'No se pudo enviar la pista.');}finally{setSaving(false);}
  };
  return <section className="panel editor-panel"><h2>Pistas de Adiviá</h2><p>Hábitat → alimentación → comportamiento → apariencia → pista decisiva. Las pistas específicas reemplazan campos del catálogo sin duplicar la ficha. Cada edición requiere revisión; evitá mencionar nombres de la respuesta.</p>
    <label className="field"><span>Especie</span><select value={speciesId} onChange={event=>setSpeciesId(event.target.value)}><option value="">Elegí una especie</option>{species.map(item=><option key={item.id} value={item.id}>{item.payload.commonNames[0]} · {item.payload.scientificName}</option>)}</select></label>
    {speciesId&&<><div className="form-grid two"><label className="field"><span>Tipo de pista</span><select value={kind} onChange={event=>{const value=event.target.value as keyof typeof KINDS;setKind(value);setOrder(Object.keys(KINDS).indexOf(value)+1);}}>{Object.entries(KINDS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Orden de revelación</span><select value={order} onChange={event=>setOrder(Number(event.target.value))}>{[1,2,3,4,5].map(value=><option key={value}>{value}</option>)}</select></label></div>
      <label className="field full"><span>Texto (15–600 caracteres)</span><textarea rows={3} value={body} onChange={event=>setBody(event.target.value)}/></label>
      <label className="field full"><span>Referencia de la pista (URL, página o registro)</span><input value={sourceRecordId} onChange={event=>setSourceRecordId(event.target.value)}/></label>
      <div className="form-grid two"><label className="field"><span>Fuente redistribuible</span><select value={sourceId} onChange={event=>setSourceId(event.target.value)}><option value="">Elegí una fuente</option>{publicSources.map(source=><option key={source.id} value={source.id}>{source.name} · {source.license}</option>)}</select></label><label className="field"><span>Motivo y evidencia por campo</span><input value={comment} onChange={event=>setComment(event.target.value)}/></label></div>
      <div className="header-actions"><button className="primary" disabled={saving||!sourceId||body.trim().length<15||body.trim().length>600} onClick={()=>void propose('upsert')}>{id?'Proponer edición':'Proponer pista'}</button>{id&&<button className="secondary" onClick={()=>{setId(null);setBody('');}}>Cancelar edición</button>}</div>
      <h3>Pistas aprobadas</h3>{rows.length===0?<p>Sin pistas específicas. El juego usa los atributos publicados disponibles.</p>:rows.map(row=><article key={row.id}><strong>{row.sortOrder} · {KINDS[row.kind]}</strong><p>{row.body}</p><div className="header-actions"><button className="secondary" onClick={()=>edit(row)}>Editar</button><button className="secondary" disabled={saving} onClick={()=>void propose('archive',row)}>Proponer archivo</button></div></article>)}
    </>}{message&&<p role="status">{message}</p>}
  </section>;
}
