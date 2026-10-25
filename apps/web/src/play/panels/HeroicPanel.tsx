/** Heroic Interventions: after all charges, the other player's characters near the enemy may move up to 3" closer. */
import { eligibleUnits, other, type Problem } from '@recruit/engine';
import { armyName } from '../game/names';
import { PlanMove } from './PlanMove';
import type { PanelProps } from './types';
import { UnitPicker } from './UnitPicker';
import { PinAction } from '../game/actionBar';

export function HeroicPanel(props: PanelProps) {
  const { sb, ui } = props;
  const s = sb.state;
  const defender = other(s.active);
  const units = eligibleUnits(s, 'heroic');
  const unitId = ui.selectedUnitId && units.includes(ui.selectedUnitId) ? ui.selectedUnitId : null;
  const run = (problems: Problem[] | null) => ui.setProblems(problems ?? []);
  return (
    <section>
      <h2>{armyName(s, defender)}: Heroic Interventions</h2>
      {units.length ? (
        <UnitPicker units={units} state={s} selected={unitId} onPick={(id) => ui.select(id)} label="Characters that could intervene" />
      ) : (
        <p className="muted">No character can Heroically Intervene.</p>
      )}
      {unitId && (
        <PlanMove
          {...props}
          unitId={unitId}
          radius={3}
          ringKind="move"
          confirmLabel="Intervene"
          command={(moves) => ({ type: 'heroicIntervention', by: defender, unitId, moves })}
          onDone={() => ui.select(null)}
        />
      )}
      <PinAction slot="end">
        <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'endStep', by: s.active }))}>
          No more Heroic Interventions
        </button>
      </PinAction>
    </section>
  );
}
