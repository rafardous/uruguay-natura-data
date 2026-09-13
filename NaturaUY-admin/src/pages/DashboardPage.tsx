import { BookOpenCheck, ChevronRight, CircleAlert, Database, Images, Leaf, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { Empty, Loading, PageHeader } from '../components/Ui';
import type { DashboardStats, SpeciesSummary } from '../domain';
import { getDashboardStats, listSpecies, requestPublish } from '../lib/api';
import { navigate } from '../lib/router';

export function DashboardPage(): React.JSX.Element {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [species, setSpecies] = useState<SpeciesSummary[]>([]);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    void Promise.all([getDashboardStats(), listSpecies({ pageSize: 5, sort: 'recent' })])
      .then(([nextStats, result]) => { setStats(nextStats); setSpecies(result.rows); })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <Empty title="No pudimos cargar el panel" detail={error} />;
  if (!stats) return <Loading label="Preparando el catálogo…" />;

  async function publish() {
    setPublishing(true);
    try { await requestPublish(); setStats({ ...stats!, dirtyChanges: false }); }
    finally { setPublishing(false); }
  }

  return <>
    <PageHeader
      eyebrow="SUPABASE · DATOS EN VIVO"
      title="Catálogo editorial"
      subtitle="Este panel lee la base editorial. La app móvil recibe únicamente las versiones publicadas."
      action={<button className="primary" onClick={() => navigate('/species/new')}><Plus size={18} /> Nueva especie</button>}
    />
    <section className="stats" aria-label="Estado del catálogo">
      <article><span className="stat-icon green"><Database /></span><div><small>Especies activas</small><strong>{stats.activeSpecies.toLocaleString('es-UY')}</strong><p>{stats.retiredSpecies} archivadas</p></div></article>
      <article><span className="stat-icon gold"><CircleAlert /></span><div><small>Cambios por revisar</small><strong>{stats.unreviewedSpecies.toLocaleString('es-UY')}</strong><p><button className="inline-link" onClick={() => navigate('/reviews')}>Abrir revisiones</button></p></div></article>
      <article><span className="stat-icon sage"><Images /></span><div><small>Cobertura multimedia</small><strong>{stats.withImage.toLocaleString('es-UY')} <span>fotos</span></strong><p>{stats.withAudio.toLocaleString('es-UY')} audios · {stats.pendingMedia} procesándose</p></div></article>
    </section>
    <section className="work-grid">
      <article className="panel species-panel">
        <div className="panel-head"><div><p className="eyebrow">ÚLTIMAS EDICIONES</p><h2>Especies recientes</h2></div><button className="link-button" onClick={() => navigate('/species')}>Abrir catálogo <ChevronRight size={17} /></button></div>
        <div className="species-list">{species.map((item) => <button className="species-row" key={item.id} onClick={() => navigate(`/species/${item.id}`)}><span className={item.imageUrl ? 'species-thumb ready' : 'species-thumb'}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Leaf size={18} />}</span><span className="species-name"><strong>{item.payload.commonNames[0] ?? item.payload.scientificName}</strong><em>{item.payload.scientificName}</em></span><span className="taxon">{item.payload.taxonomy.class} · {item.payload.taxonomy.family}</span><ChevronRight size={17} /></button>)}</div>
      </article>
      <aside className="right-column">
        <article className="panel publish-card"><div className="publish-icon"><BookOpenCheck size={24} /></div><p className="eyebrow">VERSIÓN PARA LA APP</p><h2>{stats.dirtyChanges ? 'Hay cambios sin publicar' : `Versión ${stats.lastRelease ?? '—'} publicada`}</h2><p>{stats.dirtyChanges ? 'La app todavía no ve esos cambios.' : stats.lastPublishedAt ? `Publicada el ${new Date(stats.lastPublishedAt).toLocaleString('es-UY')}.` : 'Todavía no hay una versión publicada.'}</p>{profile?.role === 'admin' && <button className="primary wide" disabled={!stats.dirtyChanges || publishing} onClick={() => void publish()}>{publishing ? 'Solicitando…' : 'Publicar cambios'}</button>}<button className="publish-details" onClick={() => navigate('/releases')}>Ver publicaciones <ChevronRight size={16} /></button></article>
      </aside>
    </section>
  </>;
}
