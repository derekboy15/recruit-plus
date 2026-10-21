import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { Legal } from './pages/Legal';
import { Placeholder } from './pages/Placeholder';
import { DatasheetPage } from './factions/DatasheetPage';
import { FactionPage } from './factions/FactionPage';
import { FactionsPage } from './factions/FactionsPage';

// The builder pages carry the roster engine, so they load on first visit rather than with the app.
const ListsPage = lazy(() => import('./lists/ListsPage').then((m) => ({ default: m.ListsPage })));
const NewListPage = lazy(() => import('./lists/NewListPage').then((m) => ({ default: m.NewListPage })));

const loadingPage = <p className="muted">Loading…</p>;
const builder = (page: ReactNode) => <Suspense fallback={loadingPage}>{page}</Suspense>;

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
      <Route
        path="/build/:id"
        element={guard(<Placeholder title="Your list" milestone={2} blurb="The list editor, with plain-English explanations and fixes for every error." />)}
      />
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
      <Route path="/factions" element={guard(<FactionsPage />)} />
      <Route path="/factions/:slug" element={guard(<FactionPage />)} />
      <Route path="/factions/:slug/units/:unitSlug" element={guard(<DatasheetPage />)} />
      {extra}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
