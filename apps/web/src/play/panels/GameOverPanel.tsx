/** The end of the game: who won and why, and each army's VP. */
import { other, totalVp, type PlayerId } from '@recruit/engine';
import { Link } from 'react-router-dom';
import { armyName } from '../game/names';
import type { PanelProps } from './types';

export function GameOverPanel({ sb }: PanelProps) {
  const s = sb.state;
  const e = s.ended;
  if (!e) return null;
  const reason =
    e.reason === 'concede' && e.winner ? `${armyName(s, other(e.winner))} conceded.` : e.reason === 'agreed' ? 'The players ended the game.' : `All ${s.setup.rules.battleRounds} battle rounds were played.`;
  return (
    <section>
      <h2>{e.winner ? `${armyName(s, e.winner)} wins` : 'A draw'}</h2>
      <p>{reason}</p>
      {(['A', 'B'] as PlayerId[]).map((p) => {
        const v = s.vp[p];
        const secondary = Object.values(v.secondary).reduce((a, x) => a + x, 0);
        return (
          <p key={p}>
            <strong>
              {armyName(s, p)}: {totalVp(s, p)} VP
            </strong>{' '}
            <span className="muted">{`Primary ${v.primary} · Secondary ${secondary} · Painted ${v.painted}`}</span>
          </p>
        );
      })}
      <Link to="/play" className="btn btn--primary">
        Back to Practice games
      </Link>
    </section>
  );
}
