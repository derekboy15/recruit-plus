/** The Move Units step: pick a unit, choose how it moves, drag it (the engine checks every limit), confirm. */
import { isEngaged, livingModels, moveInches, sheetOf, unitHas, unitsOf, eligibleUnits, type Command, type Problem } from '@recruit/engine';
import { useEffect, useState } from 'react';
import { formation } from '../board/formation';
import { toMoves, toPositions } from '../game/plan';
import { engagementRings, originOf, rangeRings, unplacedOrigin } from './boardHelpers';
import { Problems } from './Problems';
import { TurnButtons } from './TurnButtons';
import type { PanelProps } from './types';
import { UnitPicker } from './UnitPicker';
import { useDryRun } from './useDryRun';
import { PinAction } from '../game/actionBar';

export function MovementPanel(props: PanelProps) {
  const { sb, ui } = props;
  const s = sb.state;
  const player = s.active;
  const a = s.activation?.kind === 'move' ? s.activation : null;
  const [focus, setFocus] = useState<string | null>(null);
  const [embarkInto, setEmbarkInto] = useState('');
  const [gettingOut, setGettingOut] = useState<string | null>(null);
  const run = (problems: Problem[] | null) => {
    ui.setProblems(problems ?? []);
    return !problems;
  };
  const finish = () => {
    ui.planDispatch({ type: 'clear' });
    ui.setRings([]);
    ui.setInvalid([]);
    ui.setTapHandler(null);
    setFocus(null);
    setEmbarkInto('');
    setGettingOut(null);
  };

  // An open move: plan from where the models stand, rings for how far each can go and the enemy's Engagement Range.
  const moving = a?.rolled ? a.unitId : null;
  useEffect(() => {
    if (!moving || !a) return;
    if (ui.plan?.unitId !== moving) {
      // A drag past the ring stops on it: each model's Move (plus the Advance roll).
      const limits = Object.fromEntries(livingModels(s, moving).map((m) => [m.id, moveInches(s, m) + (a.bonus ?? 0)]));
      ui.planDispatch({ type: 'start', unitId: moving, origin: originOf(s, moving), limits });
    }
    ui.setTapHandler((_at, id) => id && s.models[id]?.unitId === moving && setFocus(id));
    // Restarted whenever the plan goes missing (e.g. a toolkit opened and closed mid-move), not only for a new move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, ui.plan?.unitId]);
  const plan = ui.plan;
  const bonus = a?.bonus ?? 0;
  useEffect(() => {
    if (!moving || !plan || plan.unitId !== moving) return;
    ui.setRings([...rangeRings(plan, (id) => moveInches(s, s.models[id]) + bonus, 'move', ui.focusModelId), ...engagementRings(s, player)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, bonus, plan?.origin, ui.focusModelId]);
  useEffect(() => () => ui.setTapHandler(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const moveCmd: Command | null =
    moving && plan?.unitId === moving ? { type: 'completeMove', by: player, unitId: moving, moves: toMoves(plan), ...(embarkInto ? { embarkInto } : {}) } : null;
  const outCmd: Command | null =
    gettingOut && plan?.unitId === gettingOut && Object.keys(plan.positions).length === livingModels(s, gettingOut).length
      ? { type: 'disembark', by: player, unitId: gettingOut, positions: toPositions(plan) }
      : null;
  const dry = useDryRun(props, moveCmd ?? outCmd);

  if (a) {
    const name = s.units[a.unitId].name;
    const target = focus ?? (ui.focusModelId && plan?.positions[ui.focusModelId] ? ui.focusModelId : null) ?? Object.keys(plan?.positions ?? {})[0] ?? null;
    const transports = unitsOf(s, player).filter((u) => u.id !== a.unitId && u.location === 'battlefield' && unitHas(s, u.id, 'TRANSPORT'));
    return (
      <section>
        <h2>
          {name}: {a.breakout ? 'Desperate Breakout' : a.moveKind === 'advance' ? 'Advance' : a.moveKind === 'fall-back' ? 'Fall Back' : 'Normal Move'}
        </h2>
        {!a.rolled ? (
          <p className="muted">Roll for the Advance first.</p>
        ) : (
          <>
            <p className="muted">Drag the models. The rings show how far each one can go; red rings are 1" around enemy models.</p>
            <label className="choices__option">
              <input type="checkbox" checked={plan?.together ?? true} onChange={(e) => ui.planDispatch({ type: 'together', value: e.target.checked })} />
              <span>Move as a unit</span>
            </label>
            <TurnButtons ui={ui} modelId={target} />
            {transports.length > 0 && (
              <label className="play-field">
                <span>Embark in</span>
                <select value={embarkInto} onChange={(e) => setEmbarkInto(e.target.value)}>
                  <option value="">Don't embark</option>
                  {transports.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {dry && <Problems problems={dry} />}
            <PinAction slot="main">
              <button type="button" className="btn btn--primary" disabled={!dry || dry.length > 0} onClick={() => moveCmd && run(sb.act(moveCmd)) && finish()}>
                Confirm move
              </button>
            </PinAction>
            <div className="play-row">
              <button type="button" className="btn" onClick={() => ui.planDispatch({ type: 'reset' })}>
                Reset
              </button>
              <button type="button" className="btn" onClick={() => run(sb.act({ type: 'cancelMove', by: player, unitId: a.unitId })) && finish()}>
                Cancel
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  if (gettingOut) {
    const name = s.units[gettingOut].name;
    return (
      <section>
        <h2>{name} gets out</h2>
        <p className="muted">Tap where to set it up: wholly within 3" of its transport, then drag to adjust.</p>
        <TurnButtons ui={ui} />
        {dry && <Problems problems={dry} />}
        <PinAction slot="main">
          <button type="button" className="btn btn--primary" disabled={!dry || dry.length > 0} onClick={() => outCmd && run(sb.act(outCmd)) && finish()}>
            Set up {name}
          </button>
        </PinAction>
        <button type="button" className="btn" onClick={finish}>
          Cancel
        </button>
      </section>
    );
  }

  const aboard = unitsOf(s, player).filter((u) => u.location === 'embarked' && u.embarkedIn && s.units[u.embarkedIn].location === 'battlefield').map((u) => u.id);
  const units = [...eligibleUnits(s, 'move'), ...aboard];
  const sel = ui.selectedUnitId && s.units[ui.selectedUnitId]?.player === player ? ui.selectedUnitId : null;
  const u = sel ? s.units[sel] : null;
  const begin = (kind: 'normal' | 'advance' | 'fall-back') => sel && run(sb.act({ type: 'beginMove', by: player, unitId: sel, kind }));
  const getOut = () => {
    if (!sel) return;
    const models = livingModels(s, sel);
    const base = sheetOf(s, sel).base;
    setGettingOut(sel);
    ui.planDispatch({ type: 'start', unitId: sel, origin: unplacedOrigin(models.map((m) => m.id)) });
    ui.setTapHandler((at) => ui.planDispatch({ type: 'place', positions: formation(models.map((m) => ({ id: m.id, base })), at, undefined, 4, 0.5) }));
  };
  const engaged = u?.location === 'battlefield' && isEngaged(s, u.id);

  return (
    <section>
      <h2>Move units</h2>
      <UnitPicker units={units} state={s} selected={sel} onPick={(id) => ui.select(id)} label="Units that can move" />
      {u && u.location === 'embarked' && (
        <div className="play-row">
          <button type="button" className="btn" onClick={getOut}>
            Get out (disembark)
          </button>
        </div>
      )}
      {u && u.location === 'battlefield' && (
        <div className="play-row" role="group" aria-label={`Move ${u.name}`}>
          {!engaged && (
            <>
              <button type="button" className="btn" onClick={() => begin('normal')}>
                Normal Move
              </button>
              <button type="button" className="btn" onClick={() => begin('advance')}>
                Advance
              </button>
            </>
          )}
          {engaged && (
            <button type="button" className="btn" onClick={() => begin('fall-back')}>
              Fall Back
            </button>
          )}
          <button type="button" className="btn" onClick={() => run(sb.act({ type: 'remainStationary', by: player, unitId: u.id })) && ui.select(null)}>
            Remain Stationary
          </button>
          {engaged && (
            <button type="button" className="btn" onClick={() => run(sb.act({ type: 'desperateBreakout', by: player, unitId: u.id }))}>
              Desperate Breakout (2 CP)
            </button>
          )}
          {unitHas(s, u.id, 'AIRCRAFT') && (
            <button type="button" className="btn" onClick={() => run(sb.act({ type: 'aircraftLeave', by: player, unitId: u.id }))}>
              Fly off the battlefield
            </button>
          )}
        </div>
      )}
      <PinAction slot="end">
        <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'endStep', by: player })) && finish()}>
          End Movement
        </button>
      </PinAction>
    </section>
  );
}
