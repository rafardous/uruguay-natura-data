import {useEffect,useId,useState} from 'react';
import type {TaxonomyPayload} from '../domain';
import {readAll} from '../lib/editorial';

const ranks=['kingdom','phylum','class','order','family','genus'] as const;
const labels={kingdom:'Reino',phylum:'Filo',class:'Clase',order:'Orden',family:'Familia',genus:'Género'};

export function TaxonomyFields({value,onChange}:{value:TaxonomyPayload;onChange(value:TaxonomyPayload):void}) {
  const [rows,setRows]=useState<TaxonomyPayload[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const id=useId();
  useEffect(()=>{
    let current=true;
    void readAll<{kingdom:string;phylum:string;class:string;order_name:string;family:string;genus:string}>('species_editor','kingdom,phylum,class,order_name,family,genus')
      .then(data=>{if(current)setRows(data.map(row=>({...row,order:row.order_name})));})
      .catch(()=>{if(current)setError('No se pudieron cargar las opciones taxonómicas. Podés escribir los valores y volver a abrir este bloque para reintentar.');})
      .finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[]);
  return <>{error&&<p role="alert">{error}</p>}<div className="form-grid three">{ranks.map((rank,index)=>{
    const available=rows.filter(row=>ranks.slice(0,index).every(parent=>!value[parent].trim()||row[parent]?.toLocaleLowerCase('es')===value[parent].trim().toLocaleLowerCase('es')));
    const choices=[...new Set(available.map(row=>row[rank]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const list=id+'-'+rank;
    return <label className="field" key={rank}><span>{labels[rank]}</span><input list={list} value={value[rank]} onChange={e=>onChange({...value,[rank]:e.target.value})} placeholder={loading?'Cargando opciones…':'Elegí o escribí un valor nuevo'} autoComplete="off"/><datalist id={list}>{choices.map(name=><option key={name} value={name}/>)}</datalist><small>{choices.length} opciones según los niveles anteriores. Podés escribir una nueva; se incorporará al aprobar la ficha.</small></label>;
  })}</div></>;
}
