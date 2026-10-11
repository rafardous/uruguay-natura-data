import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Shell } from './components/Shell';
import { ConfigurationError, Loading } from './components/Ui';
import { usePathname } from './lib/router';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const MediaPage = lazy(() => import('./pages/MediaPage').then((module) => ({ default: module.MediaPage })));
const ReleasesPage = lazy(() => import('./pages/ReleasesPage').then((module) => ({ default: module.ReleasesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage').then((module) => ({ default: module.ReviewsPage })));
const SpeciesEditorV2Page = lazy(() => import('./pages/SpeciesEditorV2Page').then((module) => ({ default: module.SpeciesEditorV2Page })));
const SpeciesListPage = lazy(() => import('./pages/SpeciesListPage').then((module) => ({ default: module.SpeciesListPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const CatalogContentPage = lazy(() => import('./pages/CatalogContentPage').then((module) => ({ default: module.CatalogContentPage })));
const NewsPage = lazy(() => import('./pages/NewsPage').then((module) => ({ default: module.NewsPage })));
const HabitatsPage = lazy(() => import('./pages/HabitatsPage').then((module) => ({ default: module.HabitatsPage })));
const LearningPage = lazy(() => import('./pages/LearningPage').then((module) => ({ default: module.LearningPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));

function Router(): React.JSX.Element {
  const path = usePathname(); const { loading, profile, configurationError, accessDenied,accessError } = useAuth();
  if (configurationError) return <ConfigurationError detail={configurationError} />;
  if (loading) return <div className="full-state"><Loading label="Verificando acceso…" /></div>;
  if (!profile) return <LoginPage accessDenied={accessDenied} accessError={accessError} />;
  let page: React.JSX.Element;
  if (path === '/') page = <DashboardPage />;
  else if (path === '/species') page = <SpeciesListPage />;
  else if (path === '/habitats') page = <HabitatsPage />;
  else if (/^\/habitats\/[^/]+$/.test(path)) page = <HabitatsPage id={decodeURIComponent(path.split('/')[2]??'')} />;
  else if (path === '/species/new') page = <SpeciesEditorV2Page key="new-species" id={null} />;
  else if (path === '/content') page = <CatalogContentPage />;
  else if (path === '/learning' && profile.role === 'admin') page = <LearningPage />;
  else if (path === '/home' && profile.role === 'admin') page = <HomePage />;
  else if (/^\/species\/[^/]+$/.test(path)) page = <SpeciesEditorV2Page key={path} id={decodeURIComponent(path.split('/')[2] ?? '')} />;
  else if (path === '/media') page = <MediaPage />;
  else if (path === '/reviews') page = <ReviewsPage />;
  else if (path === '/releases') page = <ReleasesPage />;
  else if (path === '/reports') page = <ReportsPage />;
  else if (path === '/users' && profile.role === 'admin') page = <UsersPage />;
  else if (path === '/news' && profile.role === 'admin') page = <NewsPage />;
  else page = <DashboardPage />;
  return <Shell path={path}><Suspense fallback={<Loading label="Cargando…" />}>{page}</Suspense></Shell>;
}

export function App(): React.JSX.Element { return <AuthProvider><Suspense fallback={<div className="full-state"><Loading label="Cargando…" /></div>}><Router /></Suspense></AuthProvider>; }
