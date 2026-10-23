import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './layout/ErrorBoundary';
import { Home } from './pages/Home';
import { Legal } from './pages/Legal';
import { DatasheetPage } from './factions/DatasheetPage';
import { FactionPage } from './factions/FactionPage';
import { FactionsPage } from './factions/FactionsPage';

// The builder pages carry the roster engine, so they load on first visit rather than with the app.
const ListsPage = lazy(() => import('./lists/ListsPage').then((m) => ({ default: m.ListsPage })));
const NewListPage = lazy(() => import('./lists/NewListPage').then((m) => ({ default: m.NewListPage })));
const ListEditorPage = lazy(() => import('./lists/ListEditorPage').then((m) => ({ default: m.ListEditorPage })));
const SharePage = lazy(() => import('./lists/SharePage').then((m) => ({ default: m.SharePage })));
// The Rules Reference loads on first visit too.
const RulesHome = lazy(() => import('./rules/RulesHome').then((m) => ({ default: m.RulesHome })));
const RulesArticlePage = lazy(() => import('./rules/RulesArticlePage').then((m) => ({ default: m.RulesArticlePage })));
const GlossaryPage = lazy(() => import('./rules/GlossaryPage').then((m) => ({ default: m.GlossaryPage })));
const CoreStratagemsPage = lazy(() => import('./rules/CoreStratagemsPage').then((m) => ({ default: m.CoreStratagemsPage })));
const GuidesIndexPage = lazy(() => import('./rules/GuidesIndexPage').then((m) => ({ default: m.GuidesIndexPage })));
const FactionGuidePage = lazy(() => import('./factions/FactionGuidePage').then((m) => ({ default: m.FactionGuidePage })));
const StratagemsPage = lazy(() => import('./factions/StratagemsPage').then((m) => ({ default: m.StratagemsPage })));
const ReportsPage = lazy(() => import('./rules/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const PlayRoutes = lazy(() => import('./play/PlayRoutes').then((m) => ({ default: m.PlayRoutes })));
const LearnRoutes = lazy(() => import('./learn/LearnRoutes').then((m) => ({ default: m.LearnRoutes })));

const loadingPage = <p className="muted">Loading…</p>;

/** A lazy page: a loading line while its code arrives, and a reload offer if it can't be fetched. */
function LazyPage({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={loadingPage}>{children}</Suspense>
    </ErrorBoundary>
  );
}
const lazyPage = (page: ReactNode) => <LazyPage>{page}</LazyPage>;

/** Wraps routes that need a signed-in user (replaced by RequireAuth in Task 10). */
export type Guard = (children: ReactNode) => ReactNode;

const TableRoutes = lazy(() => import('./table/TableRoutes').then((m) => ({ default: m.TableRoutes })));

export function AppRoutes({ guard = (c) => c, extra }: { guard?: Guard; extra?: ReactNode }) {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/legal" element={<Legal />} />
      <Route path="/learn/*" element={guard(lazyPage(<LearnRoutes />))} />
      <Route path="/build" element={guard(lazyPage(<ListsPage />))} />
      <Route path="/build/new" element={guard(lazyPage(<NewListPage />))} />
      <Route path="/build/:id" element={guard(lazyPage(<ListEditorPage />))} />
      {/* A shared list opens read-only for anyone, signed in or not: deliberately not behind the guard. */}
      <Route path="/share/:id" element={lazyPage(<SharePage />)} />
      <Route
        path="/play/*"
        element={guard(lazyPage(<PlayRoutes />))}
      />
      <Route
        path="/table/*"
        element={guard(lazyPage(<TableRoutes />))}
      />
      <Route path="/rules" element={guard(lazyPage(<RulesHome />))} />
      <Route path="/rules/glossary" element={guard(lazyPage(<GlossaryPage />))} />
      <Route path="/rules/stratagems" element={guard(lazyPage(<CoreStratagemsPage />))} />
      <Route path="/rules/factions" element={guard(lazyPage(<GuidesIndexPage />))} />
      <Route path="/rules/:articleId" element={guard(lazyPage(<RulesArticlePage />))} />
      <Route path="/rules/reports" element={guard(lazyPage(<ReportsPage />))} />
      <Route path="/factions" element={guard(<FactionsPage />)} />
      <Route path="/factions/:slug" element={guard(<FactionPage />)} />
      <Route path="/factions/:slug/guide" element={guard(lazyPage(<FactionGuidePage />))} />
      <Route path="/factions/:slug/stratagems" element={guard(lazyPage(<StratagemsPage />))} />
      <Route path="/factions/:slug/units/:unitSlug" element={guard(<DatasheetPage />)} />
      {extra}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
