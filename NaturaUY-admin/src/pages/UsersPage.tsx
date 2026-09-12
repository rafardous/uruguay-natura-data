import { MailPlus, MessageCircle, Shield, UserRoundCheck, UserRoundX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Loading, Modal, Notice, PageHeader } from '../components/Ui';
import type { CollaboratorApplication, Profile } from '../domain';
import { inviteUser, listCollaboratorApplications, listUsers, reviewCollaboratorApplication, setUserActive } from '../lib/api';

type Tab = 'users' | 'applications';

export function UsersPage(): React.JSX.Element {
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [applications, setApplications] = useState<CollaboratorApplication[] | null>(null);
  const [tab, setTab] = useState<Tab>('users');
  const [invite, setInvite] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = (): void => {
    setError('');
    void Promise.all([listUsers(), listCollaboratorApplications()]).then(([nextUsers, nextApplications]) => { setUsers(nextUsers); setApplications(nextApplications); }).catch((reason: Error) => setError(reason.message));
  };
  useEffect(load, []);

  async function toggle(user: Profile): Promise<void> {
    try { await setUserActive(user.id, !user.active); setMessage(user.active ? 'Persona desactivada.' : 'Persona activada.'); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cambiar el acceso.'); }
  }

  return <>
    <PageHeader eyebrow="ACCESO PRIVADO" title="Usuarios" subtitle="Gestioná cuentas invitadas y solicitudes de colaboración." action={<button className="primary" onClick={() => setInvite(true)}><MailPlus size={18} /> Invitar persona</button>} />
    {message && <Notice kind="success">{message}</Notice>}{error && <Notice kind="error">{error}</Notice>}
    <div className="toolbar users-tabs"><button className={tab === 'users' ? 'primary' : 'secondary'} onClick={() => setTab('users')}>Personas</button><button className={tab === 'applications' ? 'primary' : 'secondary'} onClick={() => setTab('applications')}>Solicitudes {applications && applications.filter((item) => item.status === 'pending').length > 0 ? `(${applications.filter((item) => item.status === 'pending').length})` : ''}</button></div>
    {tab === 'users' ? !users ? <Loading /> : <section className="panel user-grid">{users.map((user) => <article key={user.id} className={!user.active ? 'inactive' : ''}><span className="user-avatar">{user.displayName.split(' ').map((part) => part[0]).slice(0,2).join('')}</span><div><h2>{user.displayName}</h2><p>{user.email}</p><span className="role"><Shield />{user.role === 'admin' ? 'Administrador' : 'Colaborador'}</span></div><button className="secondary" onClick={() => void toggle(user)}>{user.active ? <UserRoundX /> : <UserRoundCheck />}{user.active ? 'Desactivar' : 'Activar'}</button></article>)}</section> : !applications ? <Loading label="Cargando solicitudes…" /> : <ApplicationQueue applications={applications} onReviewed={(text) => { setMessage(text); load(); }} onError={setError} />}
    {invite && <InviteModal onClose={() => setInvite(false)} onComplete={() => { setInvite(false); setMessage('La invitación fue enviada correctamente.'); load(); }} />}
  </>;
}

function ApplicationQueue({ applications, onReviewed, onError }: { applications: CollaboratorApplication[]; onReviewed(message: string): void; onError(message: string): void }): React.JSX.Element {
  if (applications.length === 0) return <section className="panel state-card"><MessageCircle size={28} /><h2>Todavía no hay solicitudes</h2><p>Las solicitudes enviadas desde la app aparecerán acá para su revisión.</p></section>;
  return <section className="application-grid">{applications.map((application) => <ApplicationCard key={application.id} application={application} onReviewed={onReviewed} onError={onError} />)}</section>;
}

function ApplicationCard({ application, onReviewed, onError }: { application: CollaboratorApplication; onReviewed(message: string): void; onError(message: string): void }): React.JSX.Element {
  const [status, setStatus] = useState(application.status);
  const [note, setNote] = useState(application.reviewerNote ?? '');
  const [busy, setBusy] = useState(false);
  async function save(): Promise<void> {
    setBusy(true);
    try { await reviewCollaboratorApplication(application.id, status, note); onReviewed('Solicitud actualizada. Aceptar no otorga acceso editorial automáticamente: todavía hay que invitar a la persona.'); } catch (reason) { onError(reason instanceof Error ? reason.message : 'No se pudo actualizar la solicitud.'); } finally { setBusy(false); }
  }
  return <article className="panel application-card"><header><div><span className={`job-state ${status}`}>{status === 'pending' ? 'Pendiente' : status === 'reviewing' ? 'En revisión' : status === 'accepted' ? 'Aceptada' : status === 'rejected' ? 'Rechazada' : 'Retirada'}</span><h2>{application.contactName}</h2><a href={`mailto:${application.contactEmail}`}>{application.contactEmail}</a></div><small>{new Date(application.createdAt).toLocaleDateString('es-UY')}</small></header><dl><dt>Intereses</dt><dd>{application.interests.join(' · ')}</dd><dt>Disponibilidad</dt><dd>{application.availability}</dd><dt>Experiencia</dt><dd>{application.experience}</dd><dt>Motivación</dt><dd>{application.motivation}</dd>{application.referenceUrl && <><dt>Referencia</dt><dd><a href={application.referenceUrl} target="_blank" rel="noreferrer">{application.referenceUrl}</a></dd></>}</dl><label className="field"><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value as CollaboratorApplication['status'])}><option value="pending">Pendiente</option><option value="reviewing">En revisión</option><option value="accepted">Aceptada</option><option value="rejected">Rechazada</option><option value="withdrawn">Retirada</option></select></label><label className="field"><span>Respuesta interna</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Nota para el equipo o respuesta…" /></label><button className="primary" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar revisión'}</button></article>;
}

function InviteModal({ onClose, onComplete }: { onClose(): void; onComplete(): void }): React.JSX.Element {
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [role, setRole] = useState<Profile['role']>('collaborator'); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent): Promise<void> { event.preventDefault(); setBusy(true); try { await inviteUser(email, name, role); onComplete(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo enviar la invitación.'); setBusy(false); } }
  return <Modal title="Invitar colaborador" onClose={onClose}><form className="form-stack" onSubmit={(event) => void submit(event)}>{error && <Notice kind="error">{error}</Notice>}<label className="field"><span>Nombre visible</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="field"><span>Correo electrónico</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="field"><span>Rol inicial</span><select value={role} onChange={(event) => setRole(event.target.value as Profile['role'])}><option value="collaborator">Colaborador</option><option value="admin">Administrador</option></select></label><Notice>Todos los editores pueden proponer y validar cambios. Solamente los administradores gestionan usuarios y publican el catálogo; el acceso requiere una cuenta invitada y activa.</Notice><footer className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar invitación'}</button></footer></form></Modal>;
}
