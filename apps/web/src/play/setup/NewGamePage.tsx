import { BATTLE_SIZES, type BattleSizeId } from '@recruit/data/roster';
import type { PlayerId } from '@recruit/engine';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useLists, type ListData } from '../../lists/listStore';
import { useStorage } from '../../storage/StorageContext';
import type { Doc } from '../../storage/types';
import { FactionBadge } from '../../ui/FactionBadge';
import { PageHeader } from '../../ui/PageHeader';
import { createGame, type GameMeta } from '../store/gameStore';
import { buildGameSetup, setupBlockers } from './buildSetup';
import { loadArmy, type LoadedArmy } from './loadArmy';
import { getMissions } from '../../table/missionData';
import { missionDataProvider } from './missionAdapter';
import { missionsFor, type SandboxMission } from './missions';
import { TERRAIN_LAYOUTS } from './terrainLayouts';

type Loading = { status: 'loading' } | { status: 'ready'; army: LoadedArmy } | { status: 'error'; message: string };
const PLAYERS: [PlayerId, string][] = [
  ['A', 'Player 1'],
  ['B', 'Player 2'],
];
const SIZES = Object.keys(BATTLE_SIZES) as BattleSizeId[];
const BACK = { to: '/play', label: 'Practice games' };
const fmt = (n: number) => n.toLocaleString('en-GB');

/** Why a list may not play well, shown under it (it doesn't stop the game: the army's own checks do that). */
export function listWarning(l: Doc<ListData>): string | null {
  const { points, pointsLimit, issueCount } = l.data.summary;
  if (points === 0) return 'This list has no units yet.';
  if (points > pointsLimit) return `Over its points limit: ${fmt(points)} / ${fmt(pointsLimit)} pts.`;
  if (issueCount > 0) return `${issueCount} ${issueCount === 1 ? 'problem' : 'problems'} to fix in the builder.`;
  return null;
}

/** Loads (musters) the list picked for a player whenever the pick changes. */
function useArmy(list: Doc<ListData> | undefined, player: PlayerId): Loading | null {
  const [state, setState] = useState<{ key: string; value: Loading } | null>(null);
  const key = list ? `${list.id}@${list.updatedAt}` : '';
  useEffect(() => {
    if (!list) return;
    let live = true;
    setState({ key, value: { status: 'loading' } });
    loadArmy(list, player).then(
      (army) => live && setState({ key, value: { status: 'ready', army } }),
      (e: unknown) => live && setState({ key, value: { status: 'error', message: `This list couldn't be loaded: ${(e as Error).message}` } }),
    );
    return () => {
      live = false;
    };
    // The key stands for the list: a new pick or a newer save loads again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, player]);
  return list && state?.key === key ? state.value : list ? { status: 'loading' } : null;
}

function ListPicker({ label, name, lists, value, onPick, army }: { label: string; name: string; lists: Doc<ListData>[]; value: string | null; onPick(id: string): void; army: Loading | null }) {
  return (
    <fieldset className="choices play-lists">
      <legend>{label}</legend>
      {lists.map((l) => {
        const { summary } = l.data;
        const warning = listWarning(l);
        return (
          <label key={l.id} className="radio-card play-list">
            <input type="radio" name={name} checked={value === l.id} onChange={() => onPick(l.id)} />
            <FactionBadge slug={summary.catalogueSlug} name={summary.faction} size="sm" />
            <span className="play-list__main">
              <span className="play-list__name">{l.data.roster.name}</span>
              <span className="play-list__meta">{`${summary.faction} · ${BATTLE_SIZES[summary.battleSize].name} · ${fmt(summary.points)} / ${fmt(summary.pointsLimit)} pts`}</span>
              {warning && <span className="play-list__warn">{warning}</span>}
            </span>
          </label>
        );
      })}
      {army?.status === 'loading' && <p className="muted">Getting the army ready…</p>}
      {army?.status === 'error' && <p className="status status--bad">{army.message}</p>}
      {army?.status === 'ready' && army.army.problems.length > 0 && (
        <div className="play-problems">
          <p>
            <strong>Some of this list won't be in the game</strong>
          </p>
          <ul>
            {army.army.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </fieldset>
  );
}

/** Setting up a sandbox game: two saved lists, the battle size, mission, terrain, who attacks, and options. */
/**
 * Practice, then the table companion's real missions for this battle size once /data/missions.json has loaded. If it
 * can't load (offline before it was cached), Practice is still there.
 */
function useSandboxMissions(size: BattleSizeId): SandboxMission[] {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMissions>> | null>(null);
  useEffect(() => {
    let live = true;
    getMissions().then(
      (d) => live && setData(d),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return useMemo(() => [...missionsFor(size), ...(data ? missionDataProvider(data).missions(size) : [])], [size, data]);
}

export function NewGamePage() {
  const { user } = useAuth();
  const { repo } = useStorage();
  const navigate = useNavigate();
  const { lists, loading, error } = useLists();
  const [picks, setPicks] = useState<[string | null, string | null]>([null, null]);
  const [size, setSize] = useState<BattleSizeId | null>(null);
  const [missionId, setMissionId] = useState('practice');
  const [layoutId, setLayoutId] = useState<string>('city');
  const [attacker, setAttacker] = useState<PlayerId>('A');
  const [hints, setHints] = useState(true);
  const [rollWindows, setRollWindows] = useState(true);
  const [handOver, setHandOver] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const docs = picks.map((id) => lists.find((l) => l.id === id)) as [Doc<ListData> | undefined, Doc<ListData> | undefined];
  const armies = [useArmy(docs[0], 'A'), useArmy(docs[1], 'B')];
  const battleSize: BattleSizeId = size ?? docs[0]?.data.roster.battleSize ?? 'combat-patrol';
  const missions = useSandboxMissions(battleSize);
  const mission = missions.find((m) => m.id === missionId) ?? missions[0];
  const layout = TERRAIN_LAYOUTS.find((l) => l.id === layoutId) ?? TERRAIN_LAYOUTS[0];
  const ready = armies.every((a) => a?.status === 'ready') ? (armies.map((a) => (a as Extract<Loading, { status: 'ready' }>).army) as [LoadedArmy, LoadedArmy]) : null;
  const differ = docs[0] && docs[1] && docs[0].data.roster.battleSize !== docs[1].data.roster.battleSize;
  const options = useMemo(
    () => (ready ? { battleSize, mission, layout, armies: ready, attacker, seed: 0, rollWindows } : null),
    [ready?.[0], ready?.[1], battleSize, mission, layout, attacker, rollWindows], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const blockers = options ? setupBlockers(options) : [];

  async function start() {
    if (!options || !user || !ready) return;
    setStarting(null);
    try {
      const setup = buildGameSetup({ ...options, seed: crypto.getRandomValues(new Uint32Array(1))[0] });
      const meta: GameMeta = {
        title: `${ready[0].army.name} vs ${ready[1].army.name}`,
        createdAt: Date.now(),
        hints,
        handOver,
        missionId: mission.id,
        layoutId: layout.id,
        armies: ready.map((a, i) => ({ player: PLAYERS[i][0], listId: picks[i]!, name: setup.armies[i].name, faction: a.faction, catalogueSlugs: a.catalogueSlugs })),
      };
      navigate(`/play/${await createGame(repo, user.id, setup, meta)}`);
    } catch (e) {
      setStarting(`The game couldn't be started: ${(e as Error).message}`);
    }
  }

  if (loading) return <p className="muted">Loading your lists…</p>;
  if (error) return <p role="alert">Couldn’t read your saved lists on this device: {error.message}</p>;
  if (!lists.length)
    return (
      <section className="play-setup">
        <PageHeader title="New game" back={BACK} />
        <p>You need a list to play. Both players can use the same one.</p>
        <Link to="/build/new" className="btn btn--primary">
          Build a list
        </Link>
      </section>
    );

  return (
    <section className="play-setup">
      <PageHeader title="New game" back={BACK} />
      {PLAYERS.map(([player, label], i) => (
        <ListPicker
          key={player}
          label={label}
          name={`list-${player}`}
          lists={lists}
          value={picks[i]}
          army={armies[i]}
          onPick={(id) => setPicks((p) => (i === 0 ? [id, p[1]] : [p[0], id]))}
        />
      ))}
      <fieldset className="choices">
        <legend>Battle size</legend>
        {SIZES.map((s) => (
          <label key={s} className="choices__option">
            <input type="radio" name="size" checked={battleSize === s} onChange={() => setSize(s)} />
            <span>
              {BATTLE_SIZES[s].name} <span className="muted">({fmt(BATTLE_SIZES[s].points)} pts)</span>
            </span>
          </label>
        ))}
        {differ && <p className="muted">Your lists are for different battle sizes; the game uses the size you pick here.</p>}
      </fieldset>
      <fieldset className="choices">
        <legend>Mission</legend>
        {missions.map((m) => (
          <label key={m.id} className="choices__option">
            <input type="radio" name="mission" checked={mission.id === m.id} onChange={() => setMissionId(m.id)} />
            <span>
              <strong>{m.name}</strong> <span className="muted">{m.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="choices">
        <legend>Terrain</legend>
        {TERRAIN_LAYOUTS.map((l) => (
          <label key={l.id} className="choices__option">
            <input type="radio" name="layout" checked={layout.id === l.id} onChange={() => setLayoutId(l.id)} />
            <span>
              <strong>{l.name}</strong> <span className="muted">{l.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="choices">
        <legend>Attacker</legend>
        {PLAYERS.map(([p, label]) => (
          <label key={p} className="choices__option">
            <input type="radio" name="attacker" checked={attacker === p} onChange={() => setAttacker(p)} />
            <span>{label}</span>
          </label>
        ))}
        <p className="muted">The Defender sets up first.</p>
      </fieldset>
      <fieldset className="choices">
        <legend>Options</legend>
        {(
          [
            ['Hints for new players', hints, setHints],
            ['Pause after each roll so you can re-roll', rollWindows, setRollWindows],
            ['Pass-the-device screens', handOver, setHandOver],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="choices__option">
            <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {(blockers.length > 0 || starting) && (
        <div role="alert" className="play-problems">
          {[...blockers, ...(starting ? [starting] : [])].map((b) => (
            <p key={b}>{b}</p>
          ))}
        </div>
      )}
      <button type="button" className="btn btn--primary" disabled={!options || blockers.length > 0} onClick={() => void start()}>
        Start game
      </button>
    </section>
  );
}
