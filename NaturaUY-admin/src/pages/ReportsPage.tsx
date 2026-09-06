import { Bug, CheckCircle2, ExternalLink, MessageSquareWarning, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Empty, Loading, Notice, PageHeader } from '../components/Ui';
import type { UserReport } from '../domain';
import { listUserReports, resolveUserReport } from '../lib/api';

const AREA_LABELS: Record<UserReport['area'], string> = { species: 'Ficha', general: 'General', app: 'App', games: 'Juegos' };
const STATUS_LABELS: Record<UserReport['state'], string> = { open: 'Abierto', reviewing: 'En revisión', resolved: 'Resuelto', dismissed: 'Descartado' };

export function ReportsPage(): React.JSX.Element {
  const [reports, setReports] = useState<UserReport[] | null>(null);
  const [error, setError] = useState('');
  const [area, setArea] = useState<'all' | UserReport['area']>('all');
  const [state, setState] = useState<'all' | UserReport['state']>('all');
  const [selected, setSelected] = useState<UserReport | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => void listUserReports().then(setReports).catch((reason: Error) => setError(reason.message));
  useEffect(load, []);
  const visible = useMemo(() => (reports ?? []).filter((report) => (area === 'all' || report.area === area) && (state === 'all' || report.state === state)), [area, reports, state]);
  async function transition(next: 'reviewing' | 'resolved' | 'dismissed'): Promise<void> {
    if (!selected || (next !== 'reviewing' && note.trim().length < 3)) return;
    setBusy(true);
    try { await resolveUserReport(selected, next, note.trim() || undefined); setSelected(null); setNote(''); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar el reporte.'); } finally { setBusy(false); }
  }
  return <><PageHeader eyebrow="COMUNIDAD" title="Reportes" subtitle="Revisá feedback de fichas, contenido, app y juegos desde una sola bandeja." />
    {error && <Notice kind="error">{error}</Notice>}
    {!reports ? <Loading /> : reports.length === 0 ? <Empty title="No hay reportes" detail="Los nuevos reportes autenticados aparecerán acá." /> : <>
      <div className="toolbar"><select value={area} onChange={(event) => setArea(event.target.value as typeof area)}><option value="all">Todas las áreas</option>{Object.entries(AREA_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={state} onChange={(event) => setState(event.target.value as typeof state)}><option value="all">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <section className="panel species-panel"><div className="species-list">{visible.map((report) => <button className="species-row" key={report.id} onClick={() => setSelected(report)}><span className="species-thumb">{report.kind === 'bug' ? <Bug size={18} /> : <MessageSquareWarning size={18} />}</span><span className="species-name"><strong>{AREA_LABELS[report.area]} · {report.kind === 'review' ? 'Dato incorrecto' : report.kind === 'bug' ? 'Problema' : 'Sugerencia'}</strong><em>{report.reporterName ?? `Usuario ${report.reporterId.slice(0, 8)}`} · {new Date(report.createdAt).toLocaleDateString('es-UY')} · {report.platform}</em><small>{report.description}</small></span><span className={`status ${report.state}`}>{STATUS_LABELS[report.state]}</span></button>)}</div></section>
    </>}
    {selected && <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}><div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="modal-header"><h2>Detalle del reporte</h2><button className="icon-button" onClick={() => setSelected(null)} aria-label="Cerrar"><XCircle size={18} /></button></div><dl><dt>Área</dt><dd>{AREA_LABELS[selected.area]} · {selected.platform} {selected.appVersion ?? ''}</dd><dt>Usuario</dt><dd>{selected.reporterName ?? selected.reporterId}</dd>{selected.catalogCode && <><dt>Especie</dt><dd>{selected.speciesName ?? selected.catalogCode} <a href={`/species/${selected.speciesId ?? ''}`}><ExternalLink size={14} /></a></dd></>}<dt>Descripción</dt><dd>{selected.description}</dd></dl><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota obligatoria para resolver o descartar" rows={4} /><div className="modal-actions"><button disabled={busy} onClick={() => void transition('reviewing')}><RotateCcw size={16} /> Revisando</button><button disabled={busy || note.trim().length < 3} onClick={() => void transition('resolved')}><CheckCircle2 size={16} /> Resolver</button><button disabled={busy || note.trim().length < 3} onClick={() => void transition('dismissed')}><XCircle size={16} /> Descartar</button></div></div></div>}
  </>;
}
