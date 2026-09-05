import { CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Empty, Loading, Notice, PageHeader } from '../components/Ui';
import type { UserReport } from '../domain';
import { listUserReports, resolveUserReport } from '../lib/api';

export function ReportsPage(): React.JSX.Element {
  const [reports, setReports] = useState<UserReport[] | null>(null);
  const [error, setError] = useState('');
  const load = () => void listUserReports().then(setReports).catch((reason: Error) => setError(reason.message));
  useEffect(load, []);
  async function resolve(report: UserReport) {
    await resolveUserReport(report); load();
  }
  return <><PageHeader eyebrow="COMUNIDAD" title="Reportes" subtitle="Solicitudes de revisión de datos, bugs y sugerencias permanecen en colas separadas." />
    {error && <Notice kind="error">{error}</Notice>}
    {!reports ? <Loading /> : reports.length === 0 ? <Empty title="No hay reportes pendientes" detail="Los nuevos reportes autenticados aparecerán acá." /> : <section className="panel species-panel"><div className="species-list">{reports.map((report) => <article className="species-row" key={report.id}><span className="species-thumb"><MessageSquareWarning size={18} /></span><span className="species-name"><strong>{report.kind === 'review' ? 'Dato incorrecto' : report.kind === 'bug' ? 'Problema de la app' : 'Sugerencia'}</strong><em>Usuario {report.reporterId.slice(0, 8)} · {new Date(report.createdAt).toLocaleDateString('es-UY')}</em><small>{report.description}</small></span><span className={`status ${report.state}`}>{report.state}</span>{report.state === 'open' && <button className="icon-button" title="Resolver" onClick={() => void resolve(report)}><CheckCircle2 size={17} /></button>}</article>)}</div></section>}
  </>;
}
