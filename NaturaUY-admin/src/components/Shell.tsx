import { FileCheck2, FileClock, Image, LayoutDashboard, Leaf, LogOut, MessageSquareWarning, Settings, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { navigate } from '../lib/router';

const items = [
  { path: '/', label: 'Resumen', icon: LayoutDashboard },
  { path: '/species', label: 'Especies', icon: Leaf },
  { path: '/reviews', label: 'Revisiones', icon: FileCheck2 },
  { path: '/media', label: 'Medios', icon: Image },
  { path: '/releases', label: 'Publicaciones', icon: FileClock },
  { path: '/reports', label: 'Reportes', icon: MessageSquareWarning },
  { path: '/users', label: 'Usuarios', icon: Users, admin: true },
];

export function Shell({ path, children }: { path: string; children: ReactNode }): React.JSX.Element {
  const { profile, signOut } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-button" onClick={() => navigate('/')}><span className="brand-mark"><Leaf size={20} /></span><span>Natura UY<small>Panel editorial</small></span></button>
        <nav aria-label="Navegación principal">
          {items.filter((item) => !item.admin || profile?.role === 'admin').map(({ path: itemPath, label, icon: Icon }) => {
            const active = itemPath === '/' ? path === '/' : path.startsWith(itemPath);
            return <button className={active ? 'nav-item active' : 'nav-item'} key={itemPath} onClick={() => navigate(itemPath)}><Icon size={19} /><span>{label}</span></button>;
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
