import { CheckCircle2, GitCompareArrows, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { Empty, Loading, Modal, Notice, PageHeader } from '../components/Ui';
import type { ChangeRequest } from '../domain';
import { approveChangeRequest, listChangeRequests, rejectChangeRequest } from '../lib/api';

const SELF_VALIDATION_DISCLAIMER = 'Confirmo que revisé mi propio cambio con el mismo rigor que aplicaría al cambio de otra persona y asumo la responsabilidad editorial de esta validación.';

export function ReviewsPage(): React.JSX.Element {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ChangeRequest[] | null>(null);
  const [selfRequest, setSelfRequest] = useState<ChangeRequest | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const load = () => void listChangeRequests().then(setRequests).catch((error: Error) => setMessage(error.message));
  useEffect(load, []);

  async function approve(request: ChangeRequest, confirmSelfValidation = false) {
    try {
      await approveChangeRequest(request.id, confirmSelfValidation);
      setSelfRequest(null); setConfirmed(false); setMessage('La solicitud fue aprobada y auditada.'); load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo aprobar.'); }
  }

  async function reject(request: ChangeRequest) {
    try { await rejectChangeRequest(request.id); setMessage('La solicitud fue rechazada.'); load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo rechazar.'); }
  }

  return <><PageHeader eyebrow="CONTROL EDITORIAL" title="Solicitudes de revisión" subtitle="Compará cada diff contra la ficha aprobada. Aprobar aplica ficha, medios, auditoría y estado del catálogo en una sola transacción." />
    {message && <Notice kind={message.includes('fue') ? 'success' : 'error'}>{message}</Notice>}
    {!requests ? <Loading label="Cargando solicitudes…" /> : requests.length === 0 ? <Empty title="No hay cambios pendientes" detail="Las propuestas nuevas aparecerán acá sin alterar el catálogo aprobado." /> : <section className="form-stack">{requests.map((request) => <article className="panel" key={request.id}><div className="panel-head"><div><p className="eyebrow">{request.changeType.toUpperCase()}</p><h2>{request.commonName || String(request.proposedChanges.common_name ?? 'Nueva especie')}</h2><p><i>{request.scientificName || String(request.proposedChanges.scientific_name ?? '')}</i> · {request.catalogCode || String(request.proposedChanges.catalog_code ?? '')}</p></div><GitCompareArrows /></div><p>{request.comment || 'Sin comentario editorial.'}</p><small>Propuesto por {request.proposedByName} · {new Date(request.createdAt).toLocaleString('es-UY')}</small><div className="data-table"><div className="table-row table-head"><span>Campo</span><span>Antes</span><span>Después</span></div>{Object.entries(request.proposedChanges).map(([field, value]) => <div className="table-row" key={field}><code>{field}</code><span>{renderValue(request.currentValues[field])}</span><span>{renderValue(value)}</span></div>)}</div><footer className="modal-actions"><button className="secondary" onClick={() => void reject(request)}><XCircle size={17} /> Rechazar</button><button className="primary" onClick={() => request.proposedBy === profile?.id ? setSelfRequest(request) : void approve(request)}><CheckCircle2 size={17} />{request.proposedBy === profile?.id ? 'Validar mi propio cambio' : 'Aprobar'}</button></footer></article>)}</section>}
    {selfRequest && <Modal title="Validar mi propio cambio" onClose={() => { setSelfRequest(null); setConfirmed(false); }}><Notice>La autovalidación queda registrada explícitamente en la auditoría.</Notice><label className="check-field"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{SELF_VALIDATION_DISCLAIMER}</span></label><footer className="modal-actions"><button className="secondary" onClick={() => setSelfRequest(null)}>Cancelar</button><button className="primary" disabled={!confirmed} onClick={() => void approve(selfRequest, true)}>Confirmar y aprobar</button></footer></Modal>}
  </>;
}

function renderValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
