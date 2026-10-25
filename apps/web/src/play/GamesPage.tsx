import type { Phase, PlayerId } from '@recruit/engine';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useStorage } from '../storage/StorageContext';
import type { Doc } from '../storage/types';
import { FactionBadge } from '../ui/FactionBadge';
import { IconDelete, IconPlay, IconPlus } from '../ui/icons';
import { Menu } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { relativeTime } from '../ui/relativeTime';
import { useToast } from '../ui/toast';
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

/** "Round 2 · Shooting", "Setting up", "Finished: Necrons won". */
export function statusLine(g: GameData): string {
  const { summary, meta } = g;
  if (summary.ended) {
    const winner = meta.armies.find((a) => a.player === summary.winner);
    return winner ? `Finished: ${winner.name} won` : 'Finished: a draw';
  }
  return summary.phase === 'pre-battle' ? 'Setting up' : `Round ${summary.round} · ${PHASE_NAMES[summary.phase]}`;
}

/**
 * "Necrons 10 – 5 Ultramarines": the Table's game-card score ("You 13 – 0 Opponent"), with the army names in place of
 * You and Opponent, since both players sit at this device.
 */
export function scoreLine(g: GameData): string {
  const name = (p: PlayerId) => g.meta.armies.find((a) => a.player === p)?.name ?? `Player ${p === 'A' ? 1 : 2}`;
  return `${name('A')} ${g.summary.vp.A} – ${g.summary.vp.B} ${name('B')}`;
}

function GameCard({ doc }: { doc: Doc<GameData> }) {
  const { repo } = useStorage();
  const toast = useToast();
  const { meta, summary } = doc.data;
  const first = meta.armies.find((a) => a.player === 'A') ?? meta.armies[0];

  // Deleted at once, with Undo. The restore is saved as a newer edit than the deletion, so it wins when both sync.
  const remove = async () => {
    const { id, ownerId, data } = doc;
    await repo.deleteDoc(id);
    const deletedAt = (await repo.getDoc(id))?.updatedAt ?? Date.now();
    toast.show({
      message: 'Game deleted',
      action: { label: 'Undo', onAction: () => void repo.saveDoc<GameData>({ id, kind: 'game', ownerId, data, updatedAt: Math.max(Date.now(), deletedAt + 1) }) },
    });
  };

  return (
    <li className="play-game">
      <Link to={`/play/${doc.id}`} className="play-game__link">
        {first && <FactionBadge slug={first.catalogueSlugs[0] ?? ''} name={first.faction} />}
        <span className="play-game__main">
          <span className="play-game__title">{meta.title}</span>
          <span className="play-game__meta">{statusLine(doc.data)}</span>
          <span className="play-game__meta">{`${scoreLine(doc.data)} · ${relativeTime(doc.updatedAt)}`}</span>
        </span>
      </Link>
      <Menu
        label={`Actions for ${meta.title}`}
        items={[
          { label: summary.ended ? 'View' : 'Resume', icon: <IconPlay size={18} />, to: `/play/${doc.id}` },
          { label: 'Delete', icon: <IconDelete size={18} />, danger: true, onSelect: () => void remove() },
        ]}
      />
    </li>
  );
}

/** The Practice tab: the saved sandbox games (resume one, delete one) and a new game. */
export function GamesPage() {
  const { games, loading, error } = useGames();
  const { user } = useAuth();
  const { repo } = useStorage();
  useEffect(() => {
    // DEV only: the sandbox e2e seeds its list here instead of through the builder screens.
    if (!import.meta.env.DEV || !user) return;
    window.__practice = { seedList: async (spec) => (await import('./devSeed')).seedPracticeList(repo, user.id, spec) };
    return () => {
      delete window.__practice;
    };
  }, [repo, user]);
  return (
    <section className="play-games">
      <PageHeader
        variant="top"
        title="Practice"
        subtitle="Two players, one device: the app runs the core rules for you."
        actions={
          <Link to="/play/new" className="btn btn--primary">
            <IconPlus size={18} aria-hidden="true" />
            New game
          </Link>
        }
      />
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
