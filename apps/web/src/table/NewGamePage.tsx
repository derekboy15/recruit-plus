import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { BattleSizeId, MissionsOut, PackOut, PlayerKey, SecondaryOut } from '@recruit/data/missions';
import type { DataIndex } from '@recruit/data/model';
import { useAuth } from '../auth/AuthContext';
import { getIndex } from '../factions/dataClient';
import { useAsync } from '../factions/useAsync';
import { useLists } from '../lists/listStore';
import { RulesText } from '../rules/RulesText';
import { useStorage } from '../storage/StorageContext';
import { rollDice } from './dice';
import type { PlayerSetup, TableSetup } from './game';
import { getMissions, missionById } from './missionData';
import { MissionMap } from './MissionMap';
import { defaultSetup, missionForRoll, missionsFor, packFor, secondaryChoices, secondaryProblems } from './setupModel';
import { createTableGame } from './tableStore';

const STEPS = ['Battle size', 'Mission', 'Armies', 'Attacker and Defender', 'Secondary objectives', 'Ready'];
const SIZES: { id: BattleSizeId; name: string; points: string }[] = [
  { id: 'combat-patrol', name: 'Combat Patrol', points: '500' },
  { id: 'incursion', name: 'Incursion', points: '1,000' },
  { id: 'strike-force', name: 'Strike Force', points: '2,000' },
  { id: 'onslaught', name: 'Onslaught', points: '3,000' },
];
const PACK_LABEL = { 'arks-of-omen': 'Arks of Omen GT missions', 'core-book': 'Core Book missions' } as const;

type Side = 'you' | 'opp';
const SIDES: Side[] = ['you', 'opp'];
interface Army { name: string; source: 'list' | 'faction' | null; listId: string; catalogueSlug: string }
const otherSide = (s: Side): Side => (s === 'you' ? 'opp' : 'you');
const otherZone = (z: PlayerKey): PlayerKey => (z === 'A' ? 'B' : 'A');
const defaultRoll = (sides: 3 | 6) => rollDice(1, sides)[0];

/** Sets up a table game in six short steps; Start game saves it and opens the game screen. */
export function NewGamePage({ roll = defaultRoll }: { roll?: (sides: 3 | 6) => number }) {
  const data = useAsync(() => Promise.all([getMissions(), getIndex()]), 'new-game');
  if (data.status === 'loading') return <p className="muted">Loading missions…</p>;
  if (data.status === 'error') return <p role="alert">Couldn’t load the missions: {data.error.message}</p>;
  return <Wizard missions={data.data[0]} index={data.data[1]} roll={roll} />;
}

function Wizard({ missions, index, roll }: { missions: MissionsOut; index: DataIndex; roll: (sides: 3 | 6) => number }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { repo } = useStorage();
  const { lists } = useLists();
  const factions = useMemo(() => index.catalogues.filter((c) => !c.library).sort((a, b) => a.name.localeCompare(b.name)), [index]);
  const [step, setStep] = useState(0);
  const [size, setSize] = useState<BattleSizeId | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [rolled, setRolled] = useState<string | null>(null);
  const [armies, setArmies] = useState<Record<Side, Army>>({
    you: { name: 'You', source: null, listId: '', catalogueSlug: '' },
    opp: { name: 'Opponent', source: null, listId: '', catalogueSlug: '' },
  });
  const [defender, setDefender] = useState<Side | null>(null);
  const [zone, setZone] = useState<PlayerKey | null>(null);
  const [first, setFirst] = useState<Side | null>(null);
  const [rollOff, setRollOff] = useState<string | null>(null);
  const [secondaries, setSecondaries] = useState<Record<Side, string[]>>({ you: [], opp: [] });
  const [battleReady, setBattleReady] = useState<Record<Side, boolean>>({ you: false, opp: false });
  const [cp, setCp] = useState<Record<Side, number>>({ you: 0, opp: 0 });
  const [saving, setSaving] = useState(false);

  const packId = size ? packFor(size) : null;
  const pack: PackOut | undefined = missions.packs.find((p) => p.id === packId);
  const mission = missionId ? missionById(missions, missionId) : undefined;
  const slugOf = (s: Side) => {
    const a = armies[s];
    return a.source === 'list' ? (lists.find((l) => l.id === a.listId)?.data.summary.catalogueSlug ?? '') : a.source === 'faction' ? a.catalogueSlug : '';
  };
  const armyReady = (s: Side) => Boolean(armies[s].name.trim()) && Boolean(slugOf(s));
  const hasList = SIDES.some((s) => armies[s].source === 'list');
  const choices = (s: Side) => (pack && mission ? secondaryChoices(missions, pack.id, slugOf(s), mission.id) : null);
  const allSecondaries = (s: Side): SecondaryOut[] => {
    const c = choices(s);
    return c ? [...c.universal, ...c.faction, ...(c.mission ? [c.mission] : [])] : [];
  };
  const chosen = (s: Side) => secondaries[s].map((id) => allSecondaries(s).find((x) => x.id === id)).filter((x): x is SecondaryOut => Boolean(x));
  const problems = (s: Side) => (pack ? secondaryProblems(pack, chosen(s)) : []);

  const pickSize = (id: BattleSizeId) => {
    setSize(id);
    setMissionId(null);
    setRolled(null);
    const p = missions.packs.find((x) => x.id === packFor(id));
    if (p) {
      const d = defaultSetup(p, id);
      setSecondaries({ you: [...d.secondaries], opp: [...d.secondaries] });
      setCp({ you: d.startingCp, opp: d.startingCp });
    }
  };
  const rollMission = () => {
    if (!size) return;
    const d33 = packFor(size) === 'arks-of-omen';
    const d1 = roll(d33 ? 3 : 6);
    const d2 = d33 ? roll(3) : undefined;
    const m = missionForRoll(missions, size, d1, d2);
    setMissionId(m.id);
    setRolled(d33 ? `You rolled ${d1} and ${d2}: ${d1}${d2}.` : `You rolled ${d1}.`);
  };
  const doRollOff = () => {
    let a = roll(6);
    let b = roll(6);
    let tries = 0;
    while (a === b && tries++ < 20) {
      a = roll(6);
      b = roll(6);
    }
    const winner = a > b ? armies.you.name : armies.opp.name;
    setRollOff(`${armies.you.name} rolled ${a}, ${armies.opp.name} rolled ${b}: ${winner} wins the roll-off.`);
  };
  const toggleSecondary = (s: Side, id: string) =>
    setSecondaries((prev) => ({ ...prev, [s]: prev[s].includes(id) ? prev[s].filter((x) => x !== id) : [...prev[s], id] }));

  const canNext = [
    Boolean(size),
    Boolean(mission),
    SIDES.every(armyReady) && hasList,
    Boolean(defender && zone && first),
    SIDES.every((s) => problems(s).length === 0),
    true,
  ][step];

  const start = async () => {
    if (!size || !pack || !mission || !defender || !zone || !first || !user) return;
    setSaving(true);
    const zoneOf: Record<Side, PlayerKey> = { [defender]: zone, [otherSide(defender)]: otherZone(zone) } as Record<Side, PlayerKey>;
    const player = (s: Side): PlayerSetup => ({
      name: armies[s].name.trim(),
      ...(armies[s].source === 'list' ? { listId: armies[s].listId } : {}),
      catalogueSlug: slugOf(s),
      secondaries: secondaries[s],
      battleReady: battleReady[s],
      startingCp: cp[s],
    });
    const setup: TableSetup = {
      battleSize: size,
      pack: pack.id,
      missionId: mission.id,
      players: { [zoneOf.you]: player('you'), [zoneOf.opp]: player('opp') } as Record<PlayerKey, PlayerSetup>,
      attacker: zoneOf[otherSide(defender)],
      firstTurn: zoneOf[first],
    };
    const id = await createTableGame(repo, user.id, setup);
    navigate(`/table/${id}`);
  };

  const board = (id: BattleSizeId) => missions.missions.find((m) => m.battleSize === id)?.map.board;
  return (
    <section className="new-game">
      <h1>New game</h1>
      <p className="muted" style={{ margin: '0 0 0.5rem' }}>{`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}</p>
      <div className="steps steps--6" aria-hidden="true">
        {STEPS.map((s, i) => <span key={s} className={i <= step ? 'steps__bar steps__bar--done' : 'steps__bar'} />)}
      </div>

      {step === 0 && (
        <ul className="list">
          {SIZES.map((s) => {
            const b = board(s.id);
            const label = `${s.name} · ${s.points} pts · ${b ? `44" × ${b.width === 44 ? b.height : b.width}"` : ''} · ${PACK_LABEL[packFor(s.id)]}`;
            return (
              <li key={s.id}>
                <button type="button" className="choice" aria-pressed={size === s.id} onClick={() => pickSize(s.id)}>{label}</button>
              </li>
            );
          })}
        </ul>
      )}

      {step === 1 && size && (
        <>
          <p className="muted">Agree on a mission, or roll for one{packFor(size) === 'arks-of-omen' ? ' (a D33: two D3s, tens then units)' : ' (a D6)'}.</p>
          <button type="button" className="btn" onClick={rollMission}>Roll for mission</button>
          {rolled && <p role="status">{rolled}</p>}
          <ul className="list" style={{ marginTop: '0.75rem' }}>
            {missionsFor(missions, size).map((m) => (
              <li key={m.id}>
                <button type="button" className="choice" aria-pressed={missionId === m.id} onClick={() => { setMissionId(m.id); setRolled(null); }}>
                  <span><strong>{m.roll}</strong> {m.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {mission && <MissionMap map={mission.map} />}
        </>
      )}

      {step === 2 && (
        <>
          {SIDES.map((s) => (
            <fieldset key={s} className="choices" aria-label={s === 'you' ? 'Your army' : "Your opponent's army"}>
              <legend>{s === 'you' ? 'Your army' : "Your opponent's army"}</legend>
              <label className="muted" htmlFor={`name-${s}`}>Name</label>
              <input id={`name-${s}`} className="input" value={armies[s].name} onChange={(e) => setArmies({ ...armies, [s]: { ...armies[s], name: e.target.value } })} />
              {(['list', 'faction'] as const).map((src) => (
                <label key={src} className="choices__option">
                  <input type="radio" name={`source-${s}`} checked={armies[s].source === src} onChange={() => setArmies({ ...armies, [s]: { ...armies[s], source: src } })} />
                  {src === 'list' ? 'Use one of my lists' : 'Just pick a faction'}
                </label>
              ))}
              {armies[s].source === 'list' &&
                (lists.length ? (
                  <label className="choices__option">
                    List
                    <select className="input" aria-label="List" value={armies[s].listId} onChange={(e) => setArmies({ ...armies, [s]: { ...armies[s], listId: e.target.value } })}>
                      <option value="">Choose a list</option>
                      {lists.map((l) => <option key={l.id} value={l.id}>{`${l.data.roster.name} (${l.data.summary.faction})`}</option>)}
                    </select>
                  </label>
                ) : (
                  <p className="muted">You have no saved lists yet. <Link to="/build">Build one</Link>, or pick a faction.</p>
                ))}
              {armies[s].source === 'faction' && (
                <label className="choices__option">
                  Faction
                  <select className="input" aria-label="Faction" value={armies[s].catalogueSlug} onChange={(e) => setArmies({ ...armies, [s]: { ...armies[s], catalogueSlug: e.target.value } })}>
                    <option value="">Choose a faction</option>
                    {factions.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
                  </select>
                </label>
              )}
            </fieldset>
          ))}
          {SIDES.every(armyReady) && !hasList && <p className="hint">At least one army needs to be one of your saved lists.</p>}
        </>
      )}

      {step === 3 && mission && pack && (
        <>
          <p className="muted">Roll off. The winner decides who is the Attacker and who is the Defender.</p>
          <button type="button" className="btn" onClick={doRollOff}>Roll off</button>
          {rollOff && <p role="status">{rollOff}</p>}
          <ChoiceGroup label="Who is the Defender?" options={SIDES.map((s) => ({ id: s, label: armies[s].name }))} value={defender} onPick={(v) => setDefender(v as Side)} />
          <ChoiceGroup label="Which deployment zone does the Defender pick?" options={[{ id: 'A', label: 'Player A' }, { id: 'B', label: 'Player B' }]} value={zone} onPick={(v) => setZone(v as PlayerKey)} />
          <MissionMap map={mission.map} highlight={zone ?? undefined} />
          <p className="muted">
            {pack.firstTurn === 'winner-takes-first' ? 'Roll off for the first turn: the winner takes the first turn.' : 'Roll off for the first turn: the winner chooses who goes first.'}
          </p>
          <ChoiceGroup label="Who takes the first turn?" options={SIDES.map((s) => ({ id: s, label: armies[s].name }))} value={first} onPick={(v) => setFirst(v as Side)} />
        </>
      )}

      {step === 4 && pack && (
        <>
          {pack.defaultSecondaries.length > 0 && <p className="muted">If you don't pick your own, you use Assassination, Grind Them Down and Behind Enemy Lines.</p>}
          {SIDES.map((s) => {
            const c = choices(s);
            if (!c) return null;
            const groups = new Map<string, (SecondaryOut & { note?: string })[]>();
            for (const x of [...c.universal, ...c.faction, ...(c.mission ? [c.mission] : [])]) groups.set(x.category, [...(groups.get(x.category) ?? []), x]);
            return (
              <section key={s} aria-label={`Secondary objectives: ${armies[s].name}`} className="card">
                <h2>Secondary objectives: {armies[s].name}</h2>
                {problems(s).map((p) => <p key={p} className="hint">{p}</p>)}
                {[...groups].map(([category, list]) => (
                  <fieldset key={category} className="choices">
                    <legend>{category === 'Mission' ? 'This mission' : category}</legend>
                    <div className="chips">
                      {list.map((x) => (
                        <button key={x.id} type="button" className="chip" aria-pressed={secondaries[s].includes(x.id)} onClick={() => toggleSecondary(s, x.id)} title={x.note}>
                          {x.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
                {chosen(s).map((x) => (
                  <details key={x.id} className="secondary-text">
                    <summary>{x.name}</summary>
                    {'note' in x && x.note ? <p className="note">{String(x.note)}</p> : null}
                    <RulesText official={x.text} plain={x.plain} amended={x.amended} />
                  </details>
                ))}
              </section>
            );
          })}
        </>
      )}

      {step === 5 && pack && size && (
        <>
          {SIDES.map((s) => (
            <div key={s} className="card">
              <h2>{armies[s].name}</h2>
              <label className="choices__option">
                <input type="checkbox" checked={battleReady[s]} onChange={(e) => setBattleReady({ ...battleReady, [s]: e.target.checked })} />
                {`${armies[s].name}'s army is painted to a Battle Ready standard (+10 VP)`}
              </label>
              <div className="stepper">
                <span>Starting CP</span>
                <button type="button" className="btn btn--small" aria-label={`Less CP for ${armies[s].name}`} onClick={() => setCp({ ...cp, [s]: Math.max(0, cp[s] - 1) })}>−</button>
                <strong aria-live="polite">{cp[s]}</strong>
                <button type="button" className="btn btn--small" aria-label={`More CP for ${armies[s].name}`} onClick={() => setCp({ ...cp, [s]: cp[s] + 1 })}>+</button>
              </div>
              <p className="muted">
                {pack.id === 'arks-of-omen'
                  ? 'Arks of Omen: 6 CP. Take off any CP you spent on Warlord Traits, Relics or Heroic Support.'
                  : 'Take off CP spent on detachments and upgrades.'}
              </p>
            </div>
          ))}
          <details className="card">
            <summary>What happens before the battle</summary>
            <ol className="setup-steps">
              {pack.setupSteps.map((x) => (
                <li key={x.id}><strong>{x.name.replace(/^\d+\.\s*/, '')}</strong>: {x.text}</li>
              ))}
            </ol>
          </details>
        </>
      )}

      <div className="wizard-actions">
        {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)} disabled={saving}>Back</button>}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn--primary" onClick={() => setStep(step + 1)} disabled={!canNext}>Next</button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => void start()} disabled={saving}>Start game</button>
        )}
      </div>
    </section>
  );
}

function ChoiceGroup({ label, options, value, onPick }: { label: string; options: { id: string; label: string }[]; value: string | null; onPick: (id: string) => void }) {
  return (
    <div role="group" aria-label={label} className="choice-group">
      <p className="choice-group__label">{label}</p>
      <div className="chips">
        {options.map((o) => (
          <button key={o.id} type="button" className="chip" aria-pressed={value === o.id} onClick={() => onPick(o.id)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}
