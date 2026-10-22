import type { Phase } from '@recruit/engine';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';
import { useGames, type GameData } from './store/gameStore';

export const PHASE_NAMES: Record<Phase, string> = {
  'pre-battle': 'Setting up',
  command: 'Command',
  movement: 'Movement',
  psychic: 'Psychic',
  shooting: 'Shooting',
  charge: 'Charge',
  fight: 'Fight',
  morale: 'Morale',
  ended: 'Finished',
};

function status(g: GameData): string {
  const { summary, meta } = g;
  if (summary.ended) {
    const winner = meta.armies.find((a) => a.player === summary.winner);
    return winner ? `Finished: ${winner.name} won` : 'Finished: a draw';
  }
  return summary.phase === 'pre-battle' ? 'Setting up' : `Round ${summary.round} · ${PHASE_NAMES[summary.phase]}`;
}

function GameCard({ doc }: { doc: Doc<GameData> }) {
  const { repo } = useStorage();
  const [confirming, setConfirming] = useState(false);
  const { summary } = doc.data;
  return (
    <li className="play-game">
      <Link to={`/play/${doc.id}`} className="list__link list__link--card">
        <span className="list__main">
          <strong>{doc.data.meta.title}</strong>
          <span className="muted">{status(doc.data)}</span>
        </span>
        <span className="list__side">{`VP ${summary.vp.A}–${summary.vp.B}`}</span>
      </Link>
      {confirming ? (
        <div className="play-game__confirm" role="group" aria-label="Confirm delete">
          <p>Delete this game? This can't be undone.</p>
          <button type="button" className="btn btn--danger" onClick={() => void repo.deleteDoc(doc.id)}>
            Delete game
          </button>
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--small" onClick={() => setConfirming(true)}>
          Delete
        </button>
      )}
    </li>
  );
}

/** The saved sandbox games: resume one, delete one, or start a new one. */
export function GamesPage() {
  const { games, loading, error } = useGames();
  return (
    <section>
      <h1>Play</h1>
      <p className="muted">Two players, one device: the app runs the core rules for you.</p>
      <Link to="/play/new" className="btn btn--primary" style={{ marginBottom: '1rem' }}>
        New game
      </Link>
      {loading && <p className="muted">Loading your games…</p>}
      {error && <p role="alert">Couldn’t read your saved games on this device: {error.message}</p>}
      {!loading && !error && games.length === 0 && <p className="muted">No games yet.</p>}
      <ul className="list">
        {games.map((g) => (
          <GameCard key={g.id} doc={g} />
        ))}
      </ul>
    </section>
  );
}
