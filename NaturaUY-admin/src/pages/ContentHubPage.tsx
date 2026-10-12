import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { CatalogContentPage } from './CatalogContentPage';
import { LearningPage } from './LearningPage';
export function ContentHubPage({initial='catalogue'}:{initial?:'catalogue'|'stories'}) {
  const {profile}=useAuth();const [tab,setTab]=useState(initial);
  return <><nav className="content-tabs" aria-label="Contenido"><button className={tab==='catalogue'?'primary':'secondary'} onClick={()=>setTab('catalogue')}>Curiosidades y descripciones</button>{profile?.role==='admin'&&<button className={tab==='stories'?'primary':'secondary'} onClick={()=>setTab('stories')}>Historias y lecturas</button>}</nav>{tab==='stories'&&profile?.role==='admin'?<LearningPage/>:<CatalogContentPage mode="content"/>}</>;
}
