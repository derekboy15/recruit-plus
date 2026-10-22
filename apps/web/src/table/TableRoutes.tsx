import { Route, Routes } from 'react-router-dom';
import { TableHome } from './TableHome';
import './table.css';

/** Everything under /table. */
export function TableRoutes() {
  return (
    <Routes>
      <Route index element={<TableHome />} />
    </Routes>
  );
}
