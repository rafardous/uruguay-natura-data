import { BookOpenCheck, ChevronRight, CircleAlert, Database, Images, Leaf, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { Empty, Loading, PageHeader } from '../components/Ui';
import type { DashboardStats, SpeciesSummary, CatalogRelease } from '../domain';
import { getDashboardStats, listSpecies, listReleases, requestPublish } from '../lib/api';
import { navigate } from '../lib/router';

export function DashboardPage(): React.JSX.Element {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [species, setSpecies] = useState<SpeciesSummary[]>([]);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [activeRelease, setActiveRelease] = useState<CatalogRelease | undefined>();

  useEffect(() => {
    void Promise.all([getDashboardStats(), listSpecies({ pageSize: 5, sort: 'recent' }), listReleases()])
      .then(([nextStats, result, releases]) => { setStats(nextStats); setSpecies(result.rows); setActiveRelease(releases.find(r=>r.status==='pending'||r.status==='building')); })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <Empty title="No pudimos cargar el panel" detail={error} />;
  if (!stats) return <Loading label="Preparando el catálogo…" />;

  async function publish() {
    setPublishing(true);
    try { await requestPublish(); navigate('/releases'); }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo solicitar la publicación.'); }
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
        <article className="panel publish-card"><div className="publish-icon"><BookOpenCheck size={24} /></div><p className="eyebrow">VERSIÓN PARA LA APP</p><h2>{activeRelease?'Publicación en curso':stats.dirtyChanges?'Hay cambios sin publicar':stats.lastRelease?'Versión publicada al día':'Todavía no hay una versión publicada'}</h2><p>{activeRelease?`La versión ${activeRelease.dataVersion} se está preparando. Podés seguirla en Publicaciones.`:stats.dirtyChanges?'La app todavía no ve esos cambios.':stats.lastPublishedAt?`No hay cambios aprobados pendientes de publicar. Versión ${stats.lastRelease}, publicada el ${new Date(stats.lastPublishedAt).toLocaleString('es-UY')}.`:'La primera publicación aparecerá acá.'}</p>{profile?.role === 'admin' && <button className="primary wide" disabled={!stats.dirtyChanges || publishing || !!activeRelease} onClick={() => void publish()}>{publishing ? 'Solicitando…' : 'Publicar cambios'}</button>}<button className="publish-details" onClick={() => navigate('/releases')}>Ver publicaciones <ChevronRight size={16} /></button></article>
      </aside>
    </section>
  </>;
}
