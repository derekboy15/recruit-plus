/** The score: each army's VP by category, who controls each objective now, and secondary or painted VP added by hand. */
import { objectiveControl, totalVp, type Command, type GameState, type PlayerId, type Problem } from '@recruit/engine';
import { useState } from 'react';
import { Problems } from '../panels/Problems';
import { armyName } from './names';
import { objectiveLabels } from './objectives';
import { Dialog } from './Overlays';

function ArmyScore({ state, player, act }: { state: GameState; player: PlayerId; act(cmd: Command): Problem[] | null }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(1);
  const [problems, setProblems] = useState<Problem[]>([]);
  const v = state.vp[player];
  const secondary = Object.values(v.secondary).reduce((a, x) => a + x, 0);
  const run = (cmd: Command) => setProblems(act(cmd) ?? []);
  return (
    <fieldset className="choices" aria-label={armyName(state, player)}>
      <legend>
        {armyName(state, player)}: {totalVp(state, player)} VP
      </legend>
      <p className="muted">{`Primary ${v.primary} · Secondary ${secondary} · Painted ${v.painted}`}</p>
      {Object.entries(v.secondary).map(([n, x]) => (
        <p key={n} className="play-small">
          {n}: {x} VP
        </p>
      ))}
      <label className="play-field">
        <span>Secondary objective</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="play-row">
        <button type="button" className="btn btn--small" aria-label="Fewer VP" onClick={() => setAmount((a) => Math.max(-15, a - 1))}>
          −
        </button>
        <span className="play-count">{amount}</span>
        <button type="button" className="btn btn--small" aria-label="More VP" onClick={() => setAmount((a) => Math.min(15, a + 1))}>
          +
        </button>
        <button
          type="button"
          className="btn"
          disabled={!name.trim() || amount === 0}
          onClick={() => run({ type: 'scoreVp', by: player, player, category: 'secondary', name: name.trim(), amount })}
        >
          {amount < 0 ? `Take off ${-amount} VP` : `Add ${amount} VP`}
        </button>
      </div>
      <button type="button" className="btn" disabled={v.painted >= 10} onClick={() => run({ type: 'scoreVp', by: player, player, category: 'painted', amount: 10 })}>
        Painted army (10 VP)
      </button>
      <Problems problems={problems} />
    </fieldset>
  );
}

export function ScoreSheet({ state, act, onClose }: { state: GameState; act(cmd: Command): Problem[] | null; onClose(): void }) {
  const control = objectiveControl(state);
  const labels = objectiveLabels(state.setup.objectives);
  return (
    <Dialog label="Score" onClose={onClose}>
      <h2>Score</h2>
      <p className="muted play-small">
        {state.setup.rules.secondPlayerRound5 === 'end-of-turn'
          ? "Primary VP are scored for you at the end of each player's Command phase from battle round 2; in battle round 5 the player going second scores at the end of their turn instead."
          : "Primary VP are scored for you at the end of each player's Command phase from battle round 2."}
      </p>
      <ul className="play-small">
        {state.setup.objectives.map((o) => (
          <li key={o.id}>{`Objective ${labels.get(o.id)}: ${control[o.id] ? armyName(state, control[o.id]!) : 'nobody'}`}</li>
        ))}
      </ul>
      {(['A', 'B'] as PlayerId[]).map((p) => (
        <ArmyScore key={p} state={state} player={p} act={act} />
      ))}
    </Dialog>
  );
}
