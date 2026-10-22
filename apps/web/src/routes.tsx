import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './layout/ErrorBoundary';
import { Home } from './pages/Home';
import { Legal } from './pages/Legal';
import { Placeholder } from './pages/Placeholder';
import { DatasheetPage } from './factions/DatasheetPage';
import { FactionPage } from './factions/FactionPage';
import { FactionsPage } from './factions/FactionsPage';
import { ReportsPage } from './rules/ReportsPage';

// The builder pages carry the roster engine, so they load on first visit rather than with the app.
const ListsPage = lazy(() => import('./lists/ListsPage').then((m) => ({ default: m.ListsPage })));
const NewListPage = lazy(() => import('./lists/NewListPage').then((m) => ({ default: m.NewListPage })));
const ListEditorPage = lazy(() => import('./lists/ListEditorPage').then((m) => ({ default: m.ListEditorPage })));
const SharePage = lazy(() => import('./lists/SharePage').then((m) => ({ default: m.SharePage })));

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
const builder = (page: ReactNode) => <LazyPage>{page}</LazyPage>;

/** Wraps routes that need a signed-in user (replaced by RequireAuth in Task 10). */
export type Guard = (children: ReactNode) => ReactNode;

export function AppRoutes({ guard = (c) => c, extra }: { guard?: Guard; extra?: ReactNode }) {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/legal" element={<Legal />} />
      <Route
        path="/learn"
        element={guard(<Placeholder title="Learn" milestone={6} blurb="Short lessons that teach each phase with real dice on a small board." />)}
      />
      <Route path="/build" element={guard(builder(<ListsPage />))} />
      <Route path="/build/new" element={guard(builder(<NewListPage />))} />
      <Route path="/build/:id" element={guard(builder(<ListEditorPage />))} />
      {/* A shared list opens read-only for anyone, signed in or not: deliberately not behind the guard. */}
      <Route path="/share/:id" element={builder(<SharePage />)} />
      <Route
        path="/play"
        element={guard(<Placeholder title="Play" milestone={5} blurb="The on-screen sandbox: two players, one device, core rules handled for you." />)}
      />
      <Route
        path="/table"
        element={guard(<Placeholder title="Table" milestone={7} blurb="The tabletop companion: phases, CP, VP, missions and stratagems." />)}
      />
      <Route
        path="/rules"
        element={guard(<Placeholder title="Rules" milestone={3} blurb="Searchable plain-English rules, glossary and faction guides." />)}
      />
      <Route path="/rules/reports" element={guard(<ReportsPage />)} />
      <Route path="/factions" element={guard(<FactionsPage />)} />
      <Route path="/factions/:slug" element={guard(<FactionPage />)} />
      <Route path="/factions/:slug/units/:unitSlug" element={guard(<DatasheetPage />)} />
      {extra}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
