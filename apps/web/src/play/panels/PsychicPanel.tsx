/** The Psychic phase: pick a psyker and a power (Smite targets itself); the engine runs the Psychic test, Deny and Perils. */
import { eligibleUnits, sheetOf, smiteTarget, type Problem } from '@recruit/engine';
import { useState } from 'react';
import type { PanelProps } from './types';
import { UnitPicker } from './UnitPicker';
import { PinAction } from '../game/actionBar';

export function PsychicPanel({ sb, ui }: PanelProps) {
  const s = sb.state;
  const player = s.active;
  const units = eligibleUnits(s, 'psychic');
  const unitId = ui.selectedUnitId && units.includes(ui.selectedUnitId) ? ui.selectedUnitId : null;
  const [target, setTarget] = useState('');
  const [other, setOther] = useState({ name: '', wc: '' });
  const run = (problems: Problem[] | null) => ui.setProblems(problems ?? []);

  const psyker = unitId ? sheetOf(s, unitId).psyker : null;
  const powers = psyker ? [...psyker.powers] : [];
  if (psyker && !powers.some((p) => p.smite || p.name.toLowerCase() === 'smite')) powers.unshift({ name: 'Smite', wc: 5, smite: true });
  const smiteWc = 5 + s.psychic.smites[player];
  const smiteAt = unitId ? smiteTarget(s, unitId) : null;
  const left = unitId && psyker ? psyker.cast - s.units[unitId].turn.psychicAttempts : 0;
  const manifest = (power: string, extra: { wc?: number; targetUnitId?: string } = {}) =>
    unitId && run(sb.act({ type: 'manifest', by: player, unitId, power, ...extra }));

  return (
    <section>
      <h2>Psychic</h2>
      <UnitPicker units={units} state={s} selected={unitId} onPick={(id) => ui.select(id)} label="Psykers" />
      {unitId && psyker && (
        <div className="play-actions">
          <p className="muted">
            {s.units[unitId].name} can attempt {left} more {left === 1 ? 'power' : 'powers'} this phase.
          </p>
          <p>{smiteAt ? `Smite hits the closest visible enemy unit within 18": ${s.units[smiteAt].name}.` : 'No enemy unit is visible within 18": Smite would have no target.'}</p>
          <label className="play-field">
            <span>Target for other powers (if the power needs one)</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">No target</option>
              {Object.values(s.units)
                .filter((u) => u.location === 'battlefield')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          {powers.map((p) => {
            const smite = p.smite || p.name.toLowerCase() === 'smite';
            const wc = smite ? smiteWc : p.wc;
            return (
              <button key={p.name} type="button" className="btn" onClick={() => manifest(p.name, smite || !target ? {} : { targetUnitId: target })}>
                Manifest {p.name} (warp charge {wc ?? '?'})
              </button>
            );
          })}
          <details className="play-details">
            <summary>Another power…</summary>
            <p className="muted play-small">For a power chosen with the list (its warp charge is on its card).</p>
            <label className="play-field">
              <span>Power</span>
              <input value={other.name} onChange={(e) => setOther((o) => ({ ...o, name: e.target.value }))} />
            </label>
            <label className="play-field">
              <span>Warp charge</span>
              <input inputMode="numeric" value={other.wc} onChange={(e) => setOther((o) => ({ ...o, wc: e.target.value.replace(/\D/g, '') }))} />
            </label>
            <button
              type="button"
              className="btn"
              disabled={!other.name.trim() || !other.wc}
              onClick={() => manifest(other.name.trim(), { wc: Number(other.wc), ...(target ? { targetUnitId: target } : {}) })}
            >
              Manifest {other.name.trim() || 'it'}
            </button>
          </details>
        </div>
      )}
      <PinAction slot="end">
        <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'endPhase', by: player }))}>
          End Psychic phase
        </button>
      </PinAction>
    </section>
  );
}
