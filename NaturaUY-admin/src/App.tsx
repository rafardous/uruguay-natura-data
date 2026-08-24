import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Shell } from './components/Shell';
import { Loading } from './components/Ui';
import { usePathname } from './lib/router';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MediaPage } from './pages/MediaPage';
import { ReleasesPage } from './pages/ReleasesPage';
import { SpeciesEditorPage } from './pages/SpeciesEditorPage';
import { SpeciesListPage } from './pages/SpeciesListPage';
import { UsersPage } from './pages/UsersPage';

function Router(): React.JSX.Element {
  const path = usePathname(); const { loading, profile } = useAuth();
  if (loading) return <div className="full-state"><Loading label="Verificando acceso…" /></div>;
  if (!profile) return <LoginPage />;
  let page: React.JSX.Element;
  if (path === '/') page = <DashboardPage />;
  else if (path === '/species') page = <SpeciesListPage />;
  else if (path === '/species/new') page = <SpeciesEditorPage id={null} />;
  else if (/^\/species\/[^/]+$/.test(path)) page = <SpeciesEditorPage id={decodeURIComponent(path.split('/')[2] ?? '')} />;
  else if (path === '/media') page = <MediaPage />;
  else if (path === '/releases') page = <ReleasesPage />;
  else if (path === '/users' && profile.role === 'admin') page = <UsersPage />;
  else page = <DashboardPage />;
  return <Shell path={path}>{page}</Shell>;
}

export function App(): React.JSX.Element { return <AuthProvider><Router /></AuthProvider>; }
