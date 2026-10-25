import { Link, useParams } from 'react-router-dom';
import type { PackOut, PlayerKey } from '@recruit/data/missions';
import { useAsync } from '../factions/useAsync';
import { deriveState, other, type PlayerTotals, type TableGameData } from './game';
import { getMissions, missionById } from './missionData';
import { primaryByRound } from './ScoreSheet';
import { useTableGame } from './tableStore';
import { TableScroll } from '../layout/TableScroll';
import { PageHeader } from '../ui/PageHeader';

const BACK = { to: '/table', label: 'Table games' };

/** "You win" / "Opponent wins": the app calls one player "You" by default. */
const verb = (name: string, you: string, they: string) => `${name} ${name === 'You' ? you : they}`;

export interface Summary {
  winner: PlayerKey | null;
  headline: string;
  players: Record<PlayerKey, PlayerTotals>;
  primaryByRound: Record<PlayerKey, number[]>;
  stratagems: Record<PlayerKey, string[]>;
}

export function summarise(data: TableGameData, pack: PackOut): Summary {
  const state = deriveState(data, pack);
  const name = (p: PlayerKey) => data.setup.players[p].name;
  const end = state.ended?.t === 'end' ? state.ended : null;
  const { A, B } = state.players;
  let winner: PlayerKey | null = A.total > B.total ? 'A' : B.total > A.total ? 'B' : null;
  let headline = winner ? `${verb(name(winner), 'win', 'wins')}, ${state.players[winner].total} to ${state.players[other(winner)].total}.` : `Draw, ${A.total} to ${B.total}.`;
  if (end?.reason === 'concede' && end.concededBy) {
    const c = end.concededBy;
    winner = other(c);
    headline = pack.concede === 'conceder-scores-0'
      ? `${name(c)} conceded and ${name(c) === 'You' ? 'score' : 'scores'} 0 VP, so ${verb(name(winner), 'win', 'wins')}.`
      : `${name(c)} conceded, so ${verb(name(winner), 'win', 'wins')}.`;
  }
  const stratagems = { A: [] as string[], B: [] as string[] };
  for (const e of data.events) if (e.t === 'stratagem') stratagems[e.player].push(e.name);
  return { winner, headline, players: state.players, primaryByRound: { A: primaryByRound(data, 'A'), B: primaryByRound(data, 'B') }, stratagems };
}

/** After the game: who won, and how each player scored. */
export function SummaryPage() {
  const { id = '' } = useParams();
  const { game, loading } = useTableGame(id);
  const missions = useAsync(getMissions, 'missions');
  if (loading || missions.status === 'loading') return <p className="muted">Loading the game…</p>;
  if (missions.status === 'error') return <p role="alert">Couldn’t load the missions: {missions.error.message}</p>;
  if (!game) return <NotFound>This game doesn’t exist on this device.</NotFound>;
  const { setup } = game.data;
  const pack = missions.data.packs.find((p) => p.id === setup.pack);
  const mission = missionById(missions.data, setup.missionId);
  if (!pack || !mission) return <NotFound>This game’s mission isn’t in the app’s data.</NotFound>;
  const s = summarise(game.data, pack);
  const secondaryName = (sid: string) => pack.secondaries.find((x) => x.id === sid)?.name ?? (mission.missionSecondary?.id === sid ? mission.missionSecondary.name : sid);
  const order: PlayerKey[] = [setup.firstTurn, other(setup.firstTurn)];
  return (
    <section className="summary">
      <PageHeader back={BACK} title={s.headline} subtitle={`${mission.name} · ${pack.name}`} />
      <TableScroll label="Primary VP by battle round">
        <table className="summary__rounds">
          <caption>Primary VP by battle round</caption>
          <thead><tr><th scope="col">Player</th>{[1, 2, 3, 4, 5].map((r) => <th key={r} scope="col">{r}</th>)}</tr></thead>
          <tbody>
            {order.map((p) => (
              <tr key={p}><th scope="row">{setup.players[p].name}</th>{s.primaryByRound[p].map((v, i) => <td key={i}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      {order.map((p) => {
        const t = s.players[p];
        return (
          <section key={p} className="card" aria-label={setup.players[p].name}>
            <h2>{setup.players[p].name} · {t.total} VP</h2>
            <dl className="summary__list">
              <Row term="Primary" value={`${t.primary} / ${pack.caps.primary}`} />
              {setup.players[p].secondaries.map((sid) => <Row key={sid} term={secondaryName(sid)} value={`${t.secondary[sid] ?? 0} / ${pack.caps.secondaryEach}`} />)}
              <Row term="Battle Ready" value={String(t.battleReady)} />
              <Row term="CP left" value={String(t.cp)} />
              <Row term="Stratagems used" value={s.stratagems[p].length ? `${s.stratagems[p].length}: ${s.stratagems[p].join(', ')}` : 'None'} />
            </dl>
          </section>
        );
      })}
      <div className="prompt__actions">
        <Link className="btn" to={`/table/${id}?tab=Log`}>View log</Link>
        <Link className="btn btn--primary" to="/table/new">New game</Link>
      </div>
    </section>
  );
}

function NotFound({ children }: { children: string }) {
  return (
    <section className="summary">
      <PageHeader back={BACK} title="Game not found" />
      <p role="alert">{children}</p>
    </section>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="summary__row">
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
