/**
 * One-tap effects for a unit (spec §3.3): re-rolls, ±1 to hit, wound and save, +AP, +Damage, +Attacks, ignore cover,
 * Feel No Pain, invulnerable saves, fights first/last and mortal wounds. The engine applies them; each is logged and
 * can be removed.
 */
import { other, type Effect, type EffectKind, type EffectUntil, type Problem } from '@recruit/engine';
import { useState } from 'react';
import type { PanelProps } from '../panels/types';

type Chip = { label: string; side: Effect['side']; effect: EffectKind };
const GROUPS: { title: string; chips: Chip[] }[] = [
  {
    title: 'Re-rolls',
    chips: [
      { label: 'Re-roll hits of 1', side: 'attacking', effect: { kind: 'reroll', roll: 'hit', which: 'ones' } },
      { label: 'Re-roll failed hits', side: 'attacking', effect: { kind: 'reroll', roll: 'hit', which: 'failed' } },
      { label: 'Re-roll wounds of 1', side: 'attacking', effect: { kind: 'reroll', roll: 'wound', which: 'ones' } },
      { label: 'Re-roll failed wounds', side: 'attacking', effect: { kind: 'reroll', roll: 'wound', which: 'failed' } },
      { label: 'Re-roll saves of 1', side: 'defending', effect: { kind: 'reroll', roll: 'save', which: 'ones' } },
      { label: 'Re-roll failed saves', side: 'defending', effect: { kind: 'reroll', roll: 'save', which: 'failed' } },
    ],
  },
  {
    title: 'Its attacks',
    chips: [
      { label: '+1 to hit', side: 'attacking', effect: { kind: 'mod', roll: 'hit', value: 1 } },
      { label: '−1 to hit', side: 'attacking', effect: { kind: 'mod', roll: 'hit', value: -1 } },
      { label: '+1 to wound', side: 'attacking', effect: { kind: 'mod', roll: 'wound', value: 1 } },
      { label: '−1 to wound', side: 'attacking', effect: { kind: 'mod', roll: 'wound', value: -1 } },
      { label: '+1 AP', side: 'attacking', effect: { kind: 'ap', value: 1 } },
      { label: '+1 Damage', side: 'attacking', effect: { kind: 'damage', value: 1 } },
      { label: '+1 Attack', side: 'attacking', effect: { kind: 'attacks', value: 1 } },
      { label: 'Ignore cover', side: 'attacking', effect: { kind: 'ignore-cover' } },
    ],
  },
  {
    title: 'Attacks against it',
    chips: [
      { label: 'Enemy −1 to hit', side: 'defending', effect: { kind: 'mod', roll: 'hit', value: -1 } },
      { label: 'Enemy −1 to wound', side: 'defending', effect: { kind: 'mod', roll: 'wound', value: -1 } },
      { label: '+1 save', side: 'defending', effect: { kind: 'mod', roll: 'save', value: 1 } },
      { label: '−1 save', side: 'defending', effect: { kind: 'mod', roll: 'save', value: -1 } },
      ...[4, 5, 6].map((v): Chip => ({ label: `Feel No Pain ${v}+`, side: 'defending', effect: { kind: 'fnp', value: v } })),
      ...[3, 4, 5, 6].map((v): Chip => ({ label: `Invulnerable save ${v}+`, side: 'defending', effect: { kind: 'invuln', value: v } })),
    ],
  },
  {
    title: 'Its own rolls and order',
    chips: [
      { label: '+1 to charge rolls', side: 'self', effect: { kind: 'mod', roll: 'charge', value: 1 } },
      { label: '+1 to Advance rolls', side: 'self', effect: { kind: 'mod', roll: 'advance', value: 1 } },
      { label: '+1 to Psychic tests', side: 'self', effect: { kind: 'mod', roll: 'psychic', value: 1 } },
      { label: 'Fights first', side: 'self', effect: { kind: 'fights-first' } },
      { label: 'Fights last', side: 'self', effect: { kind: 'fights-last' } },
    ],
  },
];

const UNTIL: [EffectUntil, string][] = [
  ['phase', 'this phase'],
  ['next-activation', 'its next activation'],
  ['turn', 'this turn'],
  ['round', 'this battle round'],
  ['battle', 'the battle'],
  ['fight', 'the Fight phase'],
];
const untilText = (u: EffectUntil) => UNTIL.find(([k]) => k === u)?.[1] ?? u;

export function ModifierBar({ sb, ui, unitId }: PanelProps & { unitId: string }) {
  const s = sb.state;
  const owner = s.units[unitId].player;
  const [until, setUntil] = useState<EffectUntil>('phase');
  const [note, setNote] = useState('');
  const [mortals, setMortals] = useState(1);
  const run = (problems: Problem[] | null) => {
    ui.setProblems(problems ?? []);
    if (!problems) setNote('');
  };
  const add = (c: Chip) => run(sb.act({ type: 'addEffect', by: owner, effect: { unitId, side: c.side, effect: c.effect, until, note: note.trim() || c.label } }));
  const active = s.effects.filter((e) => e.unitId === unitId);

  return (
    <div className="play-mods">
      {active.length > 0 && (
        <ul className="play-tags" aria-label="Effects on this unit">
          {active.map((e) => (
            <li key={e.id}>
              <button type="button" className="btn btn--small" aria-label={`Remove: ${e.note} (${untilText(e.until)})`} onClick={() => run(sb.act({ type: 'removeEffect', by: owner, effectId: e.id }))}>
                ✕ {e.note} ({untilText(e.until)})
              </button>
            </li>
          ))}
        </ul>
      )}
      <details className="play-details">
        <summary>Apply a rule (one tap)</summary>
        <div className="play-row">
          <label className="play-field">
            <span>Lasts</span>
            <select aria-label="Lasts" value={until} onChange={(e) => setUntil(e.target.value as EffectUntil)}>
              {UNTIL.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="play-field">
            <span>Why (for the log)</span>
            <input type="text" aria-label="Why (for the log)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. My Will Be Done" />
          </label>
        </div>
        {GROUPS.map((g) => (
          <div key={g.title} role="group" aria-label={g.title}>
            <p className="play-small muted">{g.title}</p>
            <div className="play-chips">
              {g.chips.map((c) => (
                <button key={c.label} type="button" className="btn btn--small" onClick={() => add(c)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div role="group" aria-label="Mortal wounds">
          <p className="play-small muted">Mortal wounds on this unit</p>
          <div className="play-row">
            <button type="button" className="btn btn--small" aria-label="Fewer mortal wounds" onClick={() => setMortals((n) => Math.max(1, n - 1))}>
              −
            </button>
            <span className="play-count">{mortals}</span>
            <button type="button" className="btn btn--small" aria-label="More mortal wounds" onClick={() => setMortals((n) => n + 1)}>
              +
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => run(sb.act({ type: 'inflictMortalWounds', by: other(owner), unitId, count: mortals, ...(note.trim() ? { note: note.trim() } : {}) }))}
            >
              Inflict {mortals} mortal {mortals === 1 ? 'wound' : 'wounds'}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
