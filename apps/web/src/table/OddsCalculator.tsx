import { useId, useMemo, useState, type ReactNode } from 'react';
import { attackOdds, DEFAULT_ODDS, type OddsInput, type Reroll } from './odds';
import { Stepper } from './Stepper';

const fmt = (v: number) => v.toFixed(2);
const pct = (p: number) => `${Math.round(p * 100)}%`;
const ROLLS = [2, 3, 4, 5, 6];
const REROLL: Record<Reroll, string> = { none: 'No re-roll', ones: 'Re-roll 1s', failed: 'Re-roll fails' };

/** One row of the odds grid: the label in the first column, the control in the second (11rem, so every control lines up). */
function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <>
      <label className="odds__label" htmlFor={id}>{label}</label>
      {children(id)}
    </>
  );
}

function Select<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; text: string }[]; onChange: (v: T) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className="input" aria-label={label} value={String(value)} onChange={(e) => onChange(options.find((o) => String(o.v) === e.target.value)!.v)}>
          {options.map((o) => <option key={String(o.v)} value={String(o.v)}>{o.text}</option>)}
        </select>
      )}
    </Field>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <Field label={label}>{(id) => <input id={id} className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />}</Field>;
}
/** Roll options with a "none" choice stored as 0. */
const plus = (none: string) => [{ v: 0, text: none }, ...ROLLS.map((r) => ({ v: r, text: `${r}+` }))];

/** What one weapon profile is likely to do to one target unit, using the engine's attack maths. */
export function OddsCalculator() {
  const [i, setI] = useState<OddsInput>(DEFAULT_ODDS);
  const set = <K extends keyof OddsInput>(k: K, v: OddsInput[K]) => setI({ ...i, [k]: v });
  const r = useMemo(() => attackOdds(i), [i]);
  const mods = [-1, 0, 1].map((v) => ({ v, text: v > 0 ? `+${v}` : String(v) }));
  const rerolls = (['none', 'ones', 'failed'] as Reroll[]).map((v) => ({ v, text: REROLL[v] }));
  return (
    <div className="odds">
      <fieldset className="choices">
        <legend>Attacker</legend>
        <div className="odds__grid">
          <Stepper grid label="Models or weapons firing" value={i.weapons} min={1} max={60} onChange={(v) => set('weapons', v)} />
          <Text label="Attacks each" value={i.attacks} onChange={(v) => set('attacks', v)} />
          <Field label="Blast">{(id) => <span className="odds__check"><input id={id} type="checkbox" checked={i.blast} onChange={(e) => set('blast', e.target.checked)} /></span>}</Field>
          <Select label="BS or WS" value={i.skill} options={[{ v: 'auto' as const, text: 'Hits automatically' }, ...ROLLS.map((r2) => ({ v: r2, text: `${r2}+` }))] as { v: number | 'auto'; text: string }[]} onChange={(v) => set('skill', v)} />
          <Select label="Hit modifier" value={i.hitMod} options={mods} onChange={(v) => set('hitMod', v)} />
          <Select label="Hit re-rolls" value={i.rerollHits} options={rerolls} onChange={(v) => set('rerollHits', v)} />
          <Stepper grid label="Strength" value={i.strength} min={1} max={20} onChange={(v) => set('strength', v)} />
          <Select label="Wound modifier" value={i.woundMod} options={mods} onChange={(v) => set('woundMod', v)} />
          <Select label="Wound re-rolls" value={i.rerollWounds} options={rerolls} onChange={(v) => set('rerollWounds', v)} />
          <Select label="AP" value={i.ap} options={[0, -1, -2, -3, -4, -5, -6].map((v) => ({ v, text: String(v) }))} onChange={(v) => set('ap', v)} />
          <Text label="Damage" value={i.damage} onChange={(v) => set('damage', v)} />
        </div>
      </fieldset>
      <fieldset className="choices">
        <legend>Target</legend>
        <div className="odds__grid">
          <Stepper grid label="Models in the unit" value={i.targetModels} min={1} max={60} onChange={(v) => set('targetModels', v)} />
          <Stepper grid label="Toughness" value={i.toughness} min={1} max={20} onChange={(v) => set('toughness', v)} />
          <Stepper grid label="Wounds per model" value={i.woundsPerModel} min={1} max={40} onChange={(v) => set('woundsPerModel', v)} />
          <Select label="Save" value={i.save ?? 0} options={plus('No armour save')} onChange={(v) => set('save', v || null)} />
          <Select label="Invulnerable save" value={i.invuln ?? 0} options={plus('None')} onChange={(v) => set('invuln', v || null)} />
          <Select label="Other save modifier" value={i.saveMod} options={mods} onChange={(v) => set('saveMod', v)} />
          <Select label="Feel No Pain" value={i.fnp ?? 0} options={plus('None')} onChange={(v) => set('fnp', v || null)} />
        </div>
      </fieldset>
      <section className="card odds__result" aria-label="Expected result">
        <h3>Expected result</h3>
        <dl>
          <dt>Hits</dt><dd>{fmt(r.hits)}</dd>
          <dt>Wounds</dt><dd>{fmt(r.wounds)}</dd>
          <dt>Unsaved wounds</dt><dd>{fmt(r.unsaved)}</dd>
          <dt>Damage</dt><dd>{fmt(r.damage)}</dd>
          <dt>Models destroyed</dt><dd>{fmt(r.kills)}</dd>
          <dt>Chance to destroy at least 1</dt><dd>{pct(r.atLeast[0] ?? 0)}</dd>
          <dt>Chance to destroy the unit</dt><dd>{pct(r.atLeast.at(-1) ?? 0)}</dd>
        </dl>
        <p className="muted">These are averages from the dice odds; faction rules that change the attack aren't included unless you set them above.</p>
      </section>
    </div>
  );
}
