import { useEffect, useState } from 'react';
import { listContentChanges, reviewContentChange, type ContentChangeRow } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import { Modal, Notice } from './Ui';
const LABELS:Record<string,string>={game_profile:'Dificultad',game_rule:'Selección de juego',game_clue:'Pista',fact:'Curiosidad',trivia:'Trivia',taxon_content:'Descripción taxonómica'};
export function ContentReviews() {
  const {profile}=useAuth();const [rows,setRows]=useState<ContentChangeRow[]>([]),[self,setSelf]=useState<{id:string;approve:boolean}|null>(null),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
  const load=()=>void listContentChanges().then(setRows).catch(e=>setError(e.message));useEffect(load,[]);
  const review=async(id:string,approve:boolean,confirm=false)=>{if(!confirm&&rows.find(r=>r.id===id)?.proposedBy===profile?.id){setConfirmed(false);setSelf({id,approve});return;}try{await reviewContentChange(id,approve,confirm);setSelf(null);load();}catch(e){setError(e instanceof Error?e.message:'No se pudo revisar.');}};
  return <section className="form-stack">{error&&<Notice kind="error">{error}</Notice>}{rows.map(r=><article className="panel" key={r.id}><h2>{LABELS[r.contentType]??r.contentType} · {r.speciesName??'General'}</h2><p>{r.proposedByName} · {new Date(r.createdAt).toLocaleString('es-UY')}</p><dl>{Object.entries(r.proposedValues).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{typeof v==='object'?JSON.stringify(v):String(v??'—')}</dd></div>)}</dl>{profile?.role==='admin'&&<div className="header-actions"><button className="primary" onClick={()=>void review(r.id,true)}>Aprobar</button><button className="secondary" onClick={()=>void review(r.id,false)}>Rechazar</button></div>}</article>)}{self&&<Modal title="Confirmar revisión propia" onClose={()=>setSelf(null)}><label className="check-field"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Revisé mi propuesta y confirmo esta decisión editorial.</label><button className="primary" disabled={!confirmed} onClick={()=>void review(self.id,self.approve,true)}>Confirmar</button></Modal>}</section>;
}
