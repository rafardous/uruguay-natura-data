import { useEffect, useState } from 'react';
import { editorialClient } from '../lib/editorial';
import { dietLabel } from '../../../NaturaUY-source/src/domain/catalogLabels';
export function TagSelector({label,values,onChange,options=[],field,format=(s:string)=>s,allowNew=true}:{label:string;values:string[];onChange(v:string[]):void;options?:string[];field?:string;format?:(s:string)=>string;allowNew?:boolean}) {
  const [query,setQuery]=useState(''),[known,setKnown]=useState<string[]>([]);
  useEffect(()=>{if(!field)return;void editorialClient().rpc('get_editorial_trait_options',{p_field:field}).then(({data,error})=>{if(!error)setKnown(data??[]);});},[field]);
  const choices=[...new Set([...options,...known,...values])].filter(v=>format(v).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))).sort((a,b)=>format(a).localeCompare(format(b),'es'));
  const add=(v:string)=>{if(v&&!values.includes(v))onChange([...values,v]);setQuery('');};
  return <fieldset className="field full"><legend>{label}</legend><div className="tag-picks">{values.map(v=><button type="button" className="selected" key={v} onClick={()=>onChange(values.filter(x=>x!==v))} aria-label={`Quitar ${format(v)}`}>{format(v)} ×</button>)}</div><input aria-label={`Buscar ${label}`} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar una opción…"/><div className="tag-options">{choices.filter(v=>!values.includes(v)).slice(0,40).map(v=><button className="secondary" type="button" key={v} onClick={()=>add(v)}>{format(v)}</button>)}</div>{allowNew&&query.trim()&&!choices.includes(query.trim())&&<button className="secondary" type="button" onClick={()=>add(query.trim().normalize('NFC'))}>Agregar «{query.trim()}»</button>}</fieldset>;
}
export const DIET_OPTIONS=['algae','amphibians_reptiles','birds_mammals','carrion','fish','fruit','invertebrates','nectar','other_plant_material','seeds'];
export {dietLabel};
