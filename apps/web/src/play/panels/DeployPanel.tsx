/** Deployment: the player due to set up picks a unit, taps their zone to place it in formation, adjusts, and deploys. */
import { livingModels, other, sheetOf, unitHas, unitsOf, type Command, type GameState, type PlayerId } from '@recruit/engine';
import { useEffect, useState } from 'react';
import { formation } from '../board/formation';
import { toPositions } from '../game/plan';
import { armyName } from '../game/names';
import { Problems } from './Problems';
import { TurnButtons } from './TurnButtons';
import type { PanelProps } from './types';
import { UnitPicker } from './UnitPicker';
import { useDryRun } from './useDryRun';
import { PinAction } from '../game/actionBar';

const waiting = (s: GameState, p: PlayerId) => unitsOf(s, p).filter((u) => u.location === 'deploying').map((u) => u.id);

export function DeployPanel(props: PanelProps) {
  const { sb, ui } = props;
  const s = sb.state;
  const deployer = waiting(s, s.deploy.next).length ? s.deploy.next : other(s.deploy.next);
  const units = waiting(s, deployer);
  const unitId = ui.selectedUnitId && units.includes(ui.selectedUnitId) ? ui.selectedUnitId : null;
  const [inside, setInside] = useState<string[]>([]);

  useEffect(
    () => () => {
      ui.setTapHandler(null);
      ui.setDraggable(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pick = (id: string) => {
    const models = livingModels(s, id);
    const base = sheetOf(s, id).base;
    ui.select(id);
    ui.setProblems([]);
    setInside([]);
    ui.planDispatch({ type: 'start', unitId: id, origin: Object.fromEntries(models.map((m) => [m.id, null])) });
    ui.setTapHandler((at) =>
      ui.planDispatch({ type: 'place', positions: formation(models.map((m) => ({ id: m.id, base })), at, s.setup.zones[deployer]) }),
    );
  };

  const plan = unitId && ui.plan?.unitId === unitId ? ui.plan : null;
  const placed = !!plan && Object.keys(plan.positions).length === livingModels(s, unitId!).length;
  const cmd: Command | null = placed
    ? { type: 'deploy', by: deployer, unitId: unitId!, positions: toPositions(plan!), ...(inside.length ? { embarked: inside } : {}) }
    : null;
  const dry = useDryRun(props, cmd);

  const done = (problems: ReturnType<typeof sb.act>) => {
    ui.setProblems(problems ?? []);
    if (problems) return;
    ui.planDispatch({ type: 'clear' });
    ui.select(null);
    ui.setTapHandler(null);
    ui.setInvalid([]);
  };
  const reserve = (kind: 'strategic' | 'deep-strike') => unitId && done(sb.act({ type: 'declareReserves', by: deployer, unitIds: [unitId], kind }));
  const name = unitId ? s.units[unitId].name : '';
  const passengers = unitId && unitHas(s, unitId, 'TRANSPORT') ? units.filter((id) => id !== unitId) : [];

  return (
    <section>
      <h2>{armyName(s, deployer)} sets up a unit</h2>
      <UnitPicker units={units} state={s} selected={unitId} onPick={pick} label="Units waiting to be set up" />
      {unitId && (
        <div className="play-actions">
          {!placed && <p className="muted">Tap inside your deployment zone to set up {name} there.</p>}
          {passengers.length > 0 && (
            <fieldset className="choices">
              <legend>Start with units inside</legend>
              {passengers.map((id) => (
                <label key={id} className="choices__option">
                  <input type="checkbox" checked={inside.includes(id)} onChange={(e) => setInside((x) => (e.target.checked ? [...x, id] : x.filter((y) => y !== id)))} />
                  <span>{s.units[id].name}</span>
                </label>
              ))}
            </fieldset>
          )}
          {placed && <TurnButtons ui={ui} />}
          {dry && <Problems problems={dry} />}
          <PinAction slot="main">
            <button type="button" className="btn btn--primary" disabled={!dry || dry.length > 0} onClick={() => cmd && done(sb.act(cmd))}>
              Deploy {name}
            </button>
          </PinAction>
          <div className="play-row">
            <button type="button" className="btn" onClick={() => reserve('strategic')}>
              Strategic Reserves
            </button>
            <button type="button" className="btn" onClick={() => reserve('deep-strike')}>
              Deep Strike
            </button>
          </div>
          <p className="muted play-small">Deep Strike is only for units whose rules allow it (check the unit's abilities).</p>
        </div>
      )}
    </section>
  );
}
