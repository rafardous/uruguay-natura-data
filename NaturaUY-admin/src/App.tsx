import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Shell } from './components/Shell';
import { ConfigurationError, Loading } from './components/Ui';
import { usePathname } from './lib/router';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MediaPage } from './pages/MediaPage';
import { ReleasesPage } from './pages/ReleasesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SpeciesEditorV2Page } from './pages/SpeciesEditorV2Page';
import { SpeciesListPage } from './pages/SpeciesListPage';
import { UsersPage } from './pages/UsersPage';

function Router(): React.JSX.Element {
  const path = usePathname(); const { loading, profile, configurationError } = useAuth();
  if (configurationError) return <ConfigurationError detail={configurationError} />;
  if (loading) return <div className="full-state"><Loading label="Verificando acceso…" /></div>;
  if (!profile) return <LoginPage />;
  let page: React.JSX.Element;
  if (path === '/') page = <DashboardPage />;
  else if (path === '/species') page = <SpeciesListPage />;
  else if (path === '/species/new') page = <SpeciesEditorV2Page id={null} />;
  else if (/^\/species\/[^/]+$/.test(path)) page = <SpeciesEditorV2Page id={decodeURIComponent(path.split('/')[2] ?? '')} />;
  else if (path === '/media') page = <MediaPage />;
  else if (path === '/reviews') page = <ReviewsPage />;
  else if (path === '/releases') page = <ReleasesPage />;
  else if (path === '/reports') page = <ReportsPage />;
  else if (path === '/users' && profile.role === 'admin') page = <UsersPage />;
  else page = <DashboardPage />;
  return <Shell path={path}>{page}</Shell>;
}

export function App(): React.JSX.Element { return <AuthProvider><Router /></AuthProvider>; }
