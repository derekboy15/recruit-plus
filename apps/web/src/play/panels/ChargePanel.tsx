/** The Charges step: pick a unit and its targets (tap enemies within 12"), declare, then move it in with the 2D6 roll. */
import { eligibleUnits, onBoard, outerRadius, sheetOf, type Problem } from '@recruit/engine';
import { useEffect, useState } from 'react';
import type { Ring } from '../board/scene';
import { PlanMove } from './PlanMove';
import type { PanelProps } from './types';
import { UnitPicker } from './UnitPicker';
import { PinAction } from '../game/actionBar';

export function ChargePanel(props: PanelProps) {
  const { sb, ui } = props;
  const s = sb.state;
  const player = s.active;
  const a = s.activation?.kind === 'charge' ? s.activation : null;
  const units = eligibleUnits(s, 'charge');
  const unitId = ui.selectedUnitId && units.includes(ui.selectedUnitId) ? ui.selectedUnitId : null;
  const [targets, setTargets] = useState<string[]>([]);
  const run = (problems: Problem[] | null) => {
    ui.setProblems(problems ?? []);
    return !problems;
  };

  useEffect(() => setTargets([]), [unitId]);
  useEffect(() => {
    if (a) {
      ui.setTapHandler(null);
      return;
    }
    ui.setTapHandler((_at, modelId) => {
      if (!modelId) return;
      const m = s.models[modelId];
      if (s.units[m.unitId].player === player) return ui.select(m.unitId);
      setTargets((t) => (t.includes(m.unitId) ? t.filter((x) => x !== m.unitId) : [...t, m.unitId]));
    });
    return () => ui.setTapHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!a, s, player]);
  const shown = a ? a.targets : targets;
  useEffect(() => ui.setTargets(shown), [shown.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (a || !unitId) {
      if (!a) ui.setRings([]);
      return;
    }
    const r = 12 + outerRadius(sheetOf(s, unitId).base);
    const rings: Ring[] = onBoard(s, unitId).map((m, i) => ({ center: { x: m.pos!.x, y: m.pos!.y }, r, kind: 'charge', ...(i === 0 ? { label: '12"' } : {}) }));
    ui.setRings(rings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, !!a]);

  if (a) {
    const name = s.units[a.unitId].name;
    if (a.roll === null)
      return (
        <section>
          <h2>{name} is charging</h2>
          <p className="muted">Waiting for the charge roll.</p>
        </section>
      );
    return (
      <section>
        <h2>
          {name} charges: {a.roll}"
        </h2>
        <p className="muted">Targets: {a.targets.map((t) => s.units[t].name).join(', ')}. End within 1" of every target, and not within 1" of any other enemy unit.</p>
        <PlanMove
          {...props}
          unitId={a.unitId}
          radius={a.roll}
          ringKind="charge"
          confirmLabel="Confirm charge move"
          command={(moves) => ({ type: 'chargeMove', by: player, unitId: a.unitId, moves })}
          onDone={() => ui.select(null)}
        >
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (run(sb.act({ type: 'failCharge', by: player, unitId: a.unitId }))) {
                ui.planDispatch({ type: 'clear' });
                ui.setRings([]);
              }
            }}
          >
            The charge fails
          </button>
        </PlanMove>
      </section>
    );
  }

  return (
    <section>
      <h2>Charges</h2>
      <UnitPicker units={units} state={s} selected={unitId} onPick={(id) => ui.select(id)} label="Units that can charge" />
      {unitId && (
        <div className="play-actions">
          <p className="muted">Tap each enemy unit to charge (within 12"). {targets.length ? `Targets: ${targets.map((t) => s.units[t].name).join(', ')}.` : ''}</p>
          <PinAction slot="main">
            <button type="button" className="btn btn--primary" disabled={!targets.length} onClick={() => run(sb.act({ type: 'declareCharge', by: player, unitId, targetIds: targets })) && setTargets([])}>
              Declare charge
            </button>
          </PinAction>
        </div>
      )}
      <PinAction slot="end">
        <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'endStep', by: player }))}>
          End Charges
        </button>
      </PinAction>
    </section>
  );
}
