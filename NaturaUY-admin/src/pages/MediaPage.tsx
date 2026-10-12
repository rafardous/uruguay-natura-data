import { useEffect, useState } from 'react';
import { editorialClient } from '../lib/editorial';
import { requestMediaProcessing } from '../lib/api';
import { navigate } from '../lib/router';
import { Loading, Notice, PageHeader } from '../components/Ui';
export function MediaPage() {
 const [rows,setRows]=useState<Record<string,any>[]|null>(null),[total,setTotal]=useState(0),[page,setPage]=useState(0),[filter,setFilter]=useState('pending'),[query,setQuery]=useState(''),[error,setError]=useState('');
 const speciesId=new URLSearchParams(window.location.search).get('species');
 async function load(){let request=editorialClient().from('media_queue').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id');
 if(filter==='pending')request=request.in('status',['reserved','processing','ready','failed']);else if(filter!=='all')request=request.eq('status',filter);
 if(query.trim())request=request.ilike('species_name',`%${query.trim().replace(/[%_]/g,'')}%`);
 const {data,count,error}=await request.range(page*30,page*30+29);if(error){setError(error.message);return;}setRows(data??[]);setTotal(count??0);setError('');
 }
 useEffect(()=>{if(speciesId){navigate(`/species/${encodeURIComponent(speciesId)}#gallery`);return;}void load();},[page,filter,query,speciesId]);
 return <><PageHeader eyebrow="PROCESAMIENTO" title="Pendientes de fotos y audio" subtitle="Los medios se editan dentro de cada especie. Acá podés seguir cargas, revisar errores y reintentar procesamiento."/>{error&&<Notice kind="error">{error}</Notice>}<div className="toolbar"><input aria-label="Buscar especie" placeholder="Buscar especie…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select aria-label="Estado del procesamiento" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="pending">Pendientes y errores</option><option value="failed">Errores</option><option value="processing">Procesando</option><option value="ready">Listos para revisar</option><option value="all">Todos los estados</option></select><button className="secondary" onClick={()=>void load()}>Actualizar</button></div>
 {!rows?<Loading label="Cargando bandeja…"/>:<section className="panel"><p>{total} medios · página {page+1}</p>{rows.length===0?<p>No hay medios para estos filtros.</p>:rows.map(r=><article className="media-pending" key={r.id}><div><strong>{r.species_name??'Alta pendiente'} · {r.type==='image'?'Foto':'Audio'}</strong><p>{{reserved:'En cola',processing:'Procesando',ready:'Lista para revisar',approved:'Aprobada',failed:'Error',archived:'Archivada',rejected:'Rechazada'}[r.status as string]??r.status} · {r.author}</p>{r.processing_error&&<p role="alert">{r.processing_error}</p>}</div><div className="header-actions">{r.species_id&&<button className="secondary" onClick={()=>navigate(`/species/${r.species_id}#gallery`)}>Abrir especie</button>}{r.status==='failed'&&<button className="secondary" onClick={()=>void requestMediaProcessing(r.id).then(load).catch(e=>setError(e.message))}>Reintentar</button>}</div></article>)}<footer className="modal-actions"><button className="secondary" disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</button><button className="secondary" disabled={(page+1)*30>=total} onClick={()=>setPage(page+1)}>Siguiente</button></footer></section>}
 </>;
}

