import { Route, Routes } from 'react-router-dom';
import { GamesPage } from './GamesPage';
import './play.css';

/** The sandbox: saved games, the new-game setup and the game screen. Loaded on first visit to /play. */
export function PlayRoutes() {
  return (
    <Routes>
      <Route index element={<GamesPage />} />
      <Route path="new" element={<p className="muted">The new-game screen arrives in the next step.</p>} />
      <Route path=":id" element={<p className="muted">The game screen arrives in a later step.</p>} />
    </Routes>
  );
}
