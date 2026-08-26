import { CheckCircle2, CircleDot, MessageSquareWarning, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Empty, Loading, Notice, PageHeader } from '../components/Ui';
import type { UserReport } from '../domain';
import { listUserReports, resolveUserReport } from '../lib/api';

export function ReportsPage(): React.JSX.Element {
  const [reports, setReports] = useState<UserReport[] | null>(null);
  const [error, setError] = useState('');
  const load = () => void listUserReports().then(setReports).catch((reason: Error) => setError(reason.message));
  useEffect(load, []);
  async function change(id: string, state: 'reviewing' | 'resolved' | 'dismissed') {
    await resolveUserReport(id, state); load();
  }
  return <><PageHeader eyebrow="COMUNIDAD" title="Reportes" subtitle="Errores de datos y problemas enviados desde la aplicación." />
    {error && <Notice kind="error">{error}</Notice>}
    {!reports ? <Loading /> : reports.length === 0 ? <Empty title="No hay reportes pendientes" detail="Los nuevos reportes autenticados aparecerán acá." /> : <section className="panel species-panel"><div className="species-list">{reports.map((report) => <article className="species-row" key={report.id}><span className="species-thumb"><MessageSquareWarning size={18} /></span><span className="species-name"><strong>{report.kind === 'data_error' ? `Dato: ${report.catalogCode ?? 'sin especie'}` : 'Problema de la app'}</strong><em>{report.reporterAlias ? `@${report.reporterAlias}` : report.reporterName} · {new Date(report.createdAt).toLocaleDateString('es-UY')}</em><small>{report.description}</small></span><span className={`status ${report.state}`}>{report.state}</span>{report.state === 'open' && <button className="icon-button" title="Marcar en revisión" onClick={() => void change(report.id, 'reviewing')}><CircleDot size={17} /></button>}<button className="icon-button" title="Resolver" onClick={() => void change(report.id, 'resolved')}><CheckCircle2 size={17} /></button><button className="icon-button" title="Descartar" onClick={() => void change(report.id, 'dismissed')}><XCircle size={17} /></button></article>)}</div></section>}
  </>;
}
