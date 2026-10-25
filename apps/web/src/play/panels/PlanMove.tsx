/** A planned move the engine checks on drop: charge moves, Heroic Interventions, piling in and consolidating. */
import type { Command, MoveSpec, Problem } from '@recruit/engine';
import { useEffect, type ReactNode } from 'react';
import type { Ring } from '../board/scene';
import { toMoves } from '../game/plan';
import { engagementRings, originOf, rangeRings } from './boardHelpers';
import { Problems } from './Problems';
import { TurnButtons } from './TurnButtons';
import type { PanelProps } from './types';
import { useDryRun } from './useDryRun';
import { PinAction } from '../game/actionBar';

export interface PlanMoveProps extends PanelProps {
  unitId: string;
  /** How far each model's centre may go (the ring), in inches. */
  radius: number;
  ringKind: Ring['kind'];
  command(moves: Record<string, MoveSpec>): Command;
  confirmLabel: string;
  onDone?(): void;
  children?: ReactNode;
}

export function PlanMove(props: PlanMoveProps) {
  const { sb, ui, unitId, radius, ringKind, command, confirmLabel, onDone, children } = props;
  const s = sb.state;
  const plan = ui.plan?.unitId === unitId ? ui.plan : null;
  useEffect(() => {
    if (plan) return;
    // A drag past the ring stops on it, so a move that needs every inch of the roll can still be made.
    const origin = originOf(s, unitId);
    ui.planDispatch({ type: 'start', unitId, origin, limits: Object.fromEntries(Object.keys(origin).map((id) => [id, radius])) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, !plan]);
  useEffect(() => {
    if (plan) ui.setRings([...rangeRings(plan, () => radius, ringKind, ui.focusModelId), ...engagementRings(s, s.units[unitId].player)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.origin, radius, ui.focusModelId]);
  const cmd = plan ? command(toMoves(plan)) : null;
  const dry = useDryRun(props, cmd);
  const confirm = () => {
    if (!cmd) return;
    const problems = sb.act(cmd) as Problem[] | null;
    ui.setProblems(problems ?? []);
    if (problems) return;
    ui.planDispatch({ type: 'clear' });
    ui.setRings([]);
    ui.setInvalid([]);
    onDone?.();
  };
  return (
    <div className="play-actions">
      <p className="muted">Drag the models; the rings show how far each can go, red rings are 1" around enemy models.</p>
      <label className="choices__option">
        <input type="checkbox" checked={plan?.together ?? true} onChange={(e) => ui.planDispatch({ type: 'together', value: e.target.checked })} />
        <span>Move as a unit</span>
      </label>
      <TurnButtons ui={ui} />
      {dry && <Problems problems={dry} />}
      <PinAction slot="main">
        <button type="button" className="btn btn--primary" disabled={!dry || dry.length > 0} onClick={confirm}>
          {confirmLabel}
        </button>
      </PinAction>
      <div className="play-row">
        <button type="button" className="btn" onClick={() => ui.planDispatch({ type: 'reset' })}>
          Reset
        </button>
        {children}
      </div>
    </div>
  );
}
