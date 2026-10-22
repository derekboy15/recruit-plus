import { Route, Routes } from 'react-router-dom';
import { GamePage } from './GamePage';
import { NewGamePage } from './NewGamePage';
import { SummaryPage } from './SummaryPage';
import { TableHome } from './TableHome';
import './table.css';

/** Everything under /table. */
export function TableRoutes() {
  return (
    <Routes>
      <Route index element={<TableHome />} />
      <Route path="new" element={<NewGamePage />} />
      <Route path=":id" element={<GamePage />} />
      <Route path=":id/summary" element={<SummaryPage />} />
    </Routes>
  );
}
