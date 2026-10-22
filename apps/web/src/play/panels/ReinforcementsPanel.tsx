/** The Reinforcements step: units waiting in reserve are set up where the player taps; the engine checks where they may arrive. */
import { livingModels, sheetOf, unitsOf, type Command, type Problem } from '@recruit/engine';
import { useEffect } from 'react';
import { formation } from '../board/formation';
import { toPositions } from '../game/plan';
import { unplacedOrigin } from './boardHelpers';
import { Problems } from './Problems';
import type { PanelProps } from './types';
import { UnitPicker } from './UnitPicker';
import { useDryRun } from './useDryRun';

export function ReinforcementsPanel(props: PanelProps) {
  const { sb, ui } = props;
  const s = sb.state;
  const player = s.active;
  const units = unitsOf(s, player).filter((u) => u.location === 'reserves').map((u) => u.id);
  const unitId = ui.selectedUnitId && units.includes(ui.selectedUnitId) ? ui.selectedUnitId : null;
  useEffect(() => () => ui.setTapHandler(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: string) => {
    const models = livingModels(s, id);
    const base = sheetOf(s, id).base;
    ui.select(id);
    ui.planDispatch({ type: 'start', unitId: id, origin: unplacedOrigin(models.map((m) => m.id)) });
    ui.setTapHandler((at) => ui.planDispatch({ type: 'place', positions: formation(models.map((m) => ({ id: m.id, base })), at) }));
  };
  const plan = unitId && ui.plan?.unitId === unitId ? ui.plan : null;
  const cmd: Command | null =
    plan && Object.keys(plan.positions).length === livingModels(s, unitId!).length ? { type: 'arrive', by: player, unitId: unitId!, positions: toPositions(plan) } : null;
  const dry = useDryRun(props, cmd);
  const run = (problems: Problem[] | null) => {
    ui.setProblems(problems ?? []);
    if (problems) return;
    ui.planDispatch({ type: 'clear' });
    ui.select(null);
    ui.setTapHandler(null);
    ui.setInvalid([]);
  };

  return (
    <section>
      <h2>Reinforcements</h2>
      {units.length ? (
        <UnitPicker units={units} state={s} selected={unitId} onPick={pick} label="Units in reserve" />
      ) : (
        <p className="muted">No units are waiting in reserve.</p>
      )}
      {unitId && (
        <>
          {!plan || !Object.keys(plan.positions).length ? <p className="muted">Tap where {s.units[unitId].name} should arrive, then drag to adjust.</p> : null}
          {dry && <Problems problems={dry} />}
          <button type="button" className="btn btn--primary" disabled={!dry || dry.length > 0} onClick={() => cmd && run(sb.act(cmd))}>
            Set up {s.units[unitId].name}
          </button>
        </>
      )}
      <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'endStep', by: player }))}>
        End Movement phase
      </button>
    </section>
  );
}
