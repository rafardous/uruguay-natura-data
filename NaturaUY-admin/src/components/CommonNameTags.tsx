import {useState} from 'react';

export function CommonNameTags({values,onChange}:{values:string[];onChange(values:string[]):void}) {
  const [draft,setDraft]=useState('');
  const commit=(text:string)=>{
    const names=[...values,...text.split(',')].map(v=>v.normalize('NFC').replace(/\s+/g,' ').trim()).filter(Boolean);
    onChange([...new Map(names.map(v=>[v.toLocaleLowerCase('es'),v])).values()]);
  };
  const add=()=>{if(draft.trim())commit(draft);setDraft('');};
  return <div className="field full"><label htmlFor="alternate-common-names">Otros nombres comunes</label><div className="tag-picks">{values.map((name,index)=><button key={name} className="selected" type="button" aria-label={'Quitar nombre '+name} onClick={()=>onChange(values.filter((_,i)=>i!==index))}>{name} ×</button>)}</div><input id="alternate-common-names" value={draft} placeholder="Escribí un nombre y agregá una coma…" onChange={e=>{
    const raw=e.target.value;if(!raw.includes(',')){setDraft(raw);return;}
    const parts=raw.split(',');const rest=parts.pop()??'';commit(parts.join(','));setDraft(rest);
  }} onBlur={add} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}else if(e.key==='Tab')add();}}/><small>Separá con comas o presioná Enter. Cada nombre aparece como etiqueta; × lo quita.</small></div>;
}
