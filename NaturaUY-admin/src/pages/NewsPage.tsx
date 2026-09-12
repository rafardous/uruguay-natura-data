import { ExternalLink, Image, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Loading, Modal, Notice, PageHeader } from '../components/Ui';
import type { HomeNews } from '../domain';
import { archiveHomeNews, listHomeNews, saveHomeNews } from '../lib/api';

type Draft = {
  id?: string;
  title: string;
  source: string;
  articleUrl: string;
  imageUrl: string;
  publishedAt: string;
  status: HomeNews['status'];
  sortOrder: string;
};

const blank = (): Draft => ({ title: '', source: '', articleUrl: '', imageUrl: '', publishedAt: new Date().toISOString().slice(0, 16), status: 'draft', sortOrder: '0' });

function toDraft(item: HomeNews): Draft {
  return { id: item.id, title: item.title, source: item.source, articleUrl: item.articleUrl, imageUrl: item.imageUrl ?? '', publishedAt: item.publishedAt?.slice(0, 16) ?? '', status: item.status, sortOrder: String(item.sortOrder) };
}

export function NewsPage(): React.JSX.Element {
  const [items, setItems] = useState<HomeNews[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = (): void => { void listHomeNews().then(setItems).catch((reason: Error) => setError(reason.message)); };
  useEffect(load, []);

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!draft) return;
    setError('');
    try {
      await saveHomeNews({
        id: draft.id, title: draft.title, source: draft.source, articleUrl: draft.articleUrl,
        imageUrl: draft.imageUrl || null, publishedAt: draft.status === 'published' && draft.publishedAt ? new Date(draft.publishedAt).toISOString() : null,
        status: draft.status, sortOrder: Number(draft.sortOrder) || 0,
      });
      setDraft(null); setMessage('La noticia fue guardada.'); load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la noticia.'); }
  }

  async function archive(item: HomeNews): Promise<void> {
    if (!window.confirm(`¿Archivar “${item.title}”?`)) return;
    try { await archiveHomeNews(item.id); setMessage('La noticia fue archivada.'); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo archivar.'); }
  }

  return <>
    <PageHeader eyebrow="CONTENIDO DE INICIO" title="Noticias" subtitle="Enlaces curados: la app muestra como máximo tres y nunca copia el artículo." action={<button className="primary" onClick={() => setDraft(blank())}><Plus size={18} /> Nuevo enlace</button>} />
    {message && <Notice kind="success">{message}</Notice>}{error && <Notice kind="error">{error}</Notice>}
    {!items ? <Loading label="Cargando noticias…" /> : items.length === 0 ? <section className="panel state-card"><Image /><h2>Todavía no hay noticias curadas</h2><p>Agregá título, enlace y una miniatura opcional. La miniatura debe poder utilizarse públicamente.</p></section> : <section className="panel table-panel"><div className="data-table news-table"><div className="table-row table-head"><span>Artículo</span><span>Fuente</span><span>Publicación</span><span>Estado</span><span></span></div>{items.map((item) => <div className="table-row" key={item.id}><span className="news-admin-cell">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="news-admin-placeholder"><Image size={18} /></span>}<span><b>{item.title}</b><small><a href={item.articleUrl} target="_blank" rel="noreferrer">Abrir artículo <ExternalLink size={11} /></a></small></span></span><span>{item.source}</span><span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('es-UY') : '—'}</span><span><span className={`job-state ${item.status}`}>{item.status === 'published' ? 'Publicado' : item.status === 'archived' ? 'Archivado' : 'Borrador'}</span></span><span className="row-actions"><button className="icon-button" aria-label={`Editar ${item.title}`} onClick={() => setDraft(toDraft(item))}><Pencil size={16} /></button>{item.status !== 'archived' && <button className="icon-button" aria-label={`Archivar ${item.title}`} onClick={() => void archive(item)}><Trash2 size={16} /></button>}</span></div>)}</div></section>}
    {draft && <Modal title={draft.id ? 'Editar noticia' : 'Nueva noticia'} onClose={() => setDraft(null)}><form className="form-stack" onSubmit={(event) => void save(event)}>
      <label className="field"><span>Título visible</span><input value={draft.title} maxLength={180} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
      <label className="field"><span>Fuente</span><input value={draft.source} maxLength={80} placeholder="Ministerio de Ambiente" onChange={(event) => setDraft({ ...draft, source: event.target.value })} required /></label>
      <label className="field"><span>Enlace al artículo</span><input type="url" value={draft.articleUrl} placeholder="https://" onChange={(event) => setDraft({ ...draft, articleUrl: event.target.value })} required /></label>
      <label className="field"><span>Miniatura pública opcional</span><input type="url" value={draft.imageUrl} placeholder="https://…/imagen.jpg" onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} /><small>Usala sólo cuando la fuente permita mostrarla; la app tiene fallback si no carga.</small></label>
      <div className="form-grid"><label className="field"><span>Estado</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft['status'] })}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label><label className="field"><span>Orden</span><input type="number" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} /></label></div>
      <label className="field"><span>Fecha de publicación</span><input type="datetime-local" value={draft.publishedAt} onChange={(event) => setDraft({ ...draft, publishedAt: event.target.value })} /><small>Obligatoria al publicar.</small></label>
      <footer className="modal-actions"><button type="button" className="secondary" onClick={() => setDraft(null)}>Cancelar</button><button className="primary">Guardar</button></footer>
    </form></Modal>}
  </>;
}
