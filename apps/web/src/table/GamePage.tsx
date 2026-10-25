import { lazy, Suspense, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PlayerKey } from '@recruit/data/missions';
import { useAsync } from '../factions/useAsync';
import { armyEntries } from './armyEntries';
import { rollDice } from './dice';
import { deriveState, makeEvent, undo, type TableEvent, type TableSetup } from './game';
import { LogPanel } from './LogPanel';
import { getMissions, missionById } from './missionData';
import { Scoreboard } from './Scoreboard';
import { ScoreSheet } from './ScoreSheet';
import { StratagemPanel } from './StratagemPanel';
import { ToolsPanel } from './ToolsPanel';
import { useTableGame } from './tableStore';
import { TurnPanel } from './TurnPanel';
import { LoadError } from '../layout/OfflineNotice';
import { IconLists } from '../ui/icons';
import { Menu, type MenuItem } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { Sheet } from '../ui/Sheet';

const TABS = ['Turn', 'Score', 'Stratagems', 'Tools', 'Log'] as const;
type Tab = (typeof TABS)[number];
const defaultRoll = (sides: 3 | 6) => rollDice(1, sides)[0];
const BACK = { to: '/table', label: 'Table games' };
/** Play mode's read-only army, loaded only when a player opens it, so the game screen stays small. */
const ArmyDrawer = lazy(() => import('../lists/play/ArmyDrawer').then((m) => ({ default: m.ArmyDrawer })));

/** A game that can't be shown: the page still has its header, so there is a way back. */
function NotFound({ children }: { children: string }) {
  return (
    <section className="game">
      <PageHeader back={BACK} title="Game not found" />
      <p role="alert">{children}</p>
    </section>
  );
}

/** One game at the table: the scoreboard, then the current phase and the other tabs. */
export function GamePage({ roll = defaultRoll }: { roll?: (sides: 3 | 6) => number }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { game, loading, append, update } = useTableGame(id);
  const missions = useAsync(getMissions, 'missions');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const asked = params.get('tab');
  const [tab, setTab] = useState<Tab>(TABS.includes(asked as Tab) ? (asked as Tab) : 'Turn');
  const [ending, setEnding] = useState(false);
  if (loading || missions.status === 'loading') return <p className="muted">Loading the game…</p>;
  if (missions.status === 'error') return <LoadError error={missions.error} what="the missions" />;
  if (!game) return <NotFound>This game doesn’t exist on this device.</NotFound>;
  const pack = missions.data.packs.find((p) => p.id === game.data.setup.pack);
  const mission = missionById(missions.data, game.data.setup.missionId);
  if (!pack || !mission) return <NotFound>This game’s mission isn’t in the app’s data.</NotFound>;
  const state = deriveState(game.data, pack);
  const toSummary = () => navigate(`/table/${id}/summary`);
  // The open army lives in the URL (?army=A), so the phone's Back button closes it.
  const armies = armyEntries(game.data.setup);
  const openArmy = armies.find((e) => e.player === params.get('army'));
  const showArmy = (player: PlayerKey) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('army', player);
      return next;
    }, { state: { armyOpenedHere: true } });
  const closeArmy = () => {
    // Back undoes the step that opened it; a page that was opened at ?army= just drops it.
    if ((location.state as { armyOpenedHere?: boolean } | null)?.armyOpenedHere) navigate(-1);
    else
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.delete('army');
        return next;
      }, { replace: true });
  };
  const armyAction =
    armies.length === 1 ? (
      <button type="button" className="btn btn--small game__army" onClick={() => showArmy(armies[0].player)}>
        <IconLists size={18} aria-hidden="true" />
        <span>{armies[0].label}</span>
      </button>
    ) : armies.length === 2 ? (
      <span className="game__armies">
        <Menu
          label="Armies"
          trigger={<><IconLists size={18} aria-hidden="true" /><span>Armies</span></>}
          items={armies.map((e) => ({ label: e.label, onSelect: () => showArmy(e.player) }))}
        />
      </span>
    ) : null;
  const actions: MenuItem[] = state.ended
    ? [{ label: 'See the summary', to: `/table/${id}/summary` }, { label: 'Undo the end', onSelect: () => void update(undo) }]
    : [{ label: 'End the game…', danger: true, onSelect: () => setEnding(true) }];
  return (
    <section className="game">
      <div className="game__top">
        <PageHeader
          back={BACK} title={mission.name} subtitle={pack.name}
          actions={<>{armyAction}<Menu label="Game actions" items={actions} /></>}
        />
        <Scoreboard setup={game.data.setup} state={state} />
      </div>
      <div className="seg game__tabs" role="tablist" aria-label="Game">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" className="seg__btn" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {state.ended ? (
        <p>
          This game is over. <Link to={`/table/${id}/summary`}>See the summary</Link>{' '}
          <button type="button" className="btn btn--small" onClick={() => void update(undo)}>Undo the end</button>
        </p>
      ) : (
        tab === 'Turn' && state.pos && (
          <TurnPanel data={game.data} pack={pack} mission={mission} state={state} append={append} update={update} roll={roll} onEnded={toSummary} />
        )
      )}
      {tab === 'Score' && <ScoreSheet data={game.data} pack={pack} mission={mission} state={state} append={append} />}
      {tab === 'Log' && <LogPanel data={game.data} missions={missions.data} append={append} />}
      {tab === 'Stratagems' && !state.ended && <StratagemPanel data={game.data} state={state} append={append} />}
      {tab === 'Tools' && <ToolsPanel pos={state.pos} roll={roll} append={append} />}
      {openArmy && (
        <Suspense fallback={null}>
          <ArmyDrawer listId={openArmy.listId} onClose={closeArmy} />
        </Suspense>
      )}
      {ending && !state.ended && <EndGameSheet setup={game.data.setup} pos={state.pos} append={append} onEnded={toSummary} onClose={() => setEnding(false)} />}
    </section>
  );
}

/** End the game after round 5, by agreement, or by one player conceding. Asked once: only Undo the end brings it back. */
function EndGameSheet({ setup, pos, append, onEnded, onClose }: {
  setup: TableSetup; pos: TableEvent['pos']; append: (e: TableEvent[]) => Promise<void>; onEnded: () => void; onClose: () => void;
}) {
  const [step, setStep] = useState<'choose' | 'concede'>('choose');
  // A second tap while the first is saving would log a second end, and Undo the end would then remove only one.
  const ending = useRef(false);
  const [saving, setSaving] = useState(false);
  const end = async (reason: 'complete' | 'agreed' | 'concede', concededBy?: PlayerKey) => {
    if (ending.current) return;
    ending.current = true;
    setSaving(true);
    try {
      await append([makeEvent({ t: 'end', reason, ...(concededBy ? { concededBy } : {}) }, pos)]);
    } catch (e) {
      ending.current = false;
      setSaving(false);
      throw e;
    }
    onClose();
    onEnded();
  };
  return (
    <Sheet kind="sheet" title="End the game" onClose={onClose}>
      {step === 'choose' ? (
        <div className="prompt__actions prompt__actions--stack">
          <button type="button" className="btn" disabled={saving} onClick={() => void end('complete')}>We’ve finished all 5 rounds</button>
          <button type="button" className="btn" disabled={saving} onClick={() => void end('agreed')}>We agreed to stop early</button>
          <button type="button" className="btn" disabled={saving} onClick={() => setStep('concede')}>A player concedes</button>
        </div>
      ) : (
        <>
          <p className="muted">Who concedes?</p>
          <div className="prompt__actions prompt__actions--stack">
            {(['A', 'B'] as const).map((p) => (
              <button key={p} type="button" className="btn" disabled={saving} onClick={() => void end('concede', p)}>{setup.players[p].name} concedes</button>
            ))}
            <button type="button" className="btn" disabled={saving} onClick={() => setStep('choose')}>Back</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
