import { FileCheck2, FileClock, Image, LayoutDashboard, Leaf, LogOut, MessageSquareWarning, Settings, Users } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { navigate } from '../lib/router';
import type { NavigationCounts } from '../domain';
import { getNavigationCounts } from '../lib/api';

const items: Array<{ path: string; label: string; icon: typeof Leaf; admin?: boolean; badge?: keyof NavigationCounts }> = [
  { path: '/', label: 'Resumen', icon: LayoutDashboard },
  { path: '/species', label: 'Especies', icon: Leaf },
  { path: '/reviews', label: 'Revisiones', icon: FileCheck2, badge: 'pendingReviews' },
  { path: '/media', label: 'Medios', icon: Image },
  { path: '/releases', label: 'Publicaciones', icon: FileClock },
  { path: '/reports', label: 'Reportes', icon: MessageSquareWarning, badge: 'openReports' },
  { path: '/users', label: 'Usuarios', icon: Users, admin: true },
];

export function Shell({ path, children }: { path: string; children: ReactNode }): React.JSX.Element {
  const { profile, signOut } = useAuth();
  const [counts, setCounts] = useState<NavigationCounts>({ pendingReviews: 0, openReports: 0 });
  useEffect(() => { void getNavigationCounts().then(setCounts).catch(() => undefined); }, [path]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => navigate('/')}><span className="brand-mark"><img src="/natura-uy-icon.png" alt="" /></span><span>Natura UY<small>Panel editorial</small></span></button>
        <nav aria-label="Navegación principal">
          {items.filter((item) => !item.admin || profile?.role === 'admin').map(({ path: itemPath, label, icon: Icon, badge }) => {
            const active = itemPath === '/' ? path === '/' : path.startsWith(itemPath);
            const count = badge ? counts[badge] : 0;
            return <button className={active ? 'nav-item active' : 'nav-item'} key={itemPath} onClick={() => navigate(itemPath)}><Icon size={19} /><span className="nav-label">{label}</span>{count > 0 && <span className="nav-badge" aria-label={`${count} pendientes`}>{count > 99 ? '99+' : count}</span>}</button>;
          })}
        </nav>
        <div className="sidebar-foot">
          <button className="nav-item"><Settings size={19} /><span>Configuración</span></button>
          <div className="profile"><span className="avatar">{profile?.displayName.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><span>{profile?.displayName}<small>{profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}</small></span><button className="icon-button inverse" aria-label="Cerrar sesión" onClick={() => void signOut()}><LogOut size={17} /></button></div>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
