import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }): React.JSX.Element {
  return <header className="topbar"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>{action}</header>;
}

export function Loading({ label = 'Cargando…' }: { label?: string }): React.JSX.Element {
  return <div className="state-card"><LoaderCircle className="spin" /><p>{label}</p></div>;
}

export function Empty({ title, detail }: { title: string; detail: string }): React.JSX.Element {
  return <div className="state-card"><CircleAlert /><h2>{title}</h2><p>{detail}</p></div>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }): React.JSX.Element {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X /></button></header>{children}</section></div>;
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'success'; children: ReactNode }): React.JSX.Element {
  return <div className={`notice ${kind}`}>{children}</div>;
}
