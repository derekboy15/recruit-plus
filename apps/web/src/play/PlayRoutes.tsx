import { Route, Routes } from 'react-router-dom';
import { GamePage } from './game/GamePage';
import { GamesPage } from './GamesPage';
import { NewGamePage } from './setup/NewGamePage';
import './play.css';

/** The sandbox: saved games, the new-game setup and the game screen. Loaded on first visit to /play. */
export function PlayRoutes() {
  return (
    <Routes>
      <Route index element={<GamesPage />} />
      <Route path="new" element={<NewGamePage />} />
      <Route path=":id" element={<GamePage />} />
    </Routes>
  );
}
