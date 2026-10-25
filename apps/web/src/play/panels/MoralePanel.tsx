/** The Morale phase: units that lost models this turn test (the engine runs the roll and Combat Attrition). */
import { leadership, needsMoraleTest, type Problem } from '@recruit/engine';
import type { PanelProps } from './types';
import { PinAction } from '../game/actionBar';

export function MoralePanel({ sb, ui }: PanelProps) {
  const s = sb.state;
  const run = (problems: Problem[] | null) => ui.setProblems(problems ?? []);
  const units = s.step === 'morale-tests' ? needsMoraleTest(s) : [];
  const last = [...sb.log].reverse().find((l) => /Morale test|Combat Attrition|fled/.test(l.text) && l.round === s.round);
  return (
    <section>
      <h2>Morale</h2>
      {s.step === 'coherency' && <p className="muted">Units out of unit coherency lose models until they are back in coherency.</p>}
      {last && <p>{last.text}</p>}
      {s.step === 'morale-tests' && !units.length && <p className="muted">No unit has to take a Morale test.</p>}
      {units.map((id) => {
        const u = s.units[id];
        const by = u.player;
        return (
          <div key={id} className="play-weapon">
            <p>{`${u.name}: lost ${u.turn.lostThisTurn} ${u.turn.lostThisTurn === 1 ? 'model' : 'models'} this turn · Leadership ${leadership(s, id)}`}</p>
            <div className="play-row">
              <button type="button" className="btn" onClick={() => run(sb.act({ type: 'moraleTest', by, unitId: id }))}>
                Take Morale test
              </button>
              <button type="button" className="btn" onClick={() => run(sb.act({ type: 'moraleTest', by, unitId: id, insaneBravery: true }))}>
                Insane Bravery (2 CP)
              </button>
            </div>
          </div>
        );
      })}
      <PinAction slot="end">
        <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'endPhase', by: s.active }))}>
          End Morale phase
        </button>
      </PinAction>
    </section>
  );
}
