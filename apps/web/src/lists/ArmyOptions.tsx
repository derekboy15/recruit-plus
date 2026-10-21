import {
  armyOptions,
  displayName,
  childConstraints,
  type ForceView,
  type Issue,
  type Roster,
  type RosterView,
  type Scope,
} from '@recruit/data/roster';
import { useMemo } from 'react';
import { isAutoManagedEntry, isHelperOption } from './editorView';
import { armyChoices, type ArmyChoice } from './newListSetup';
import type { EditorAction } from './useRosterEditor';

interface Props { scope: Scope; roster: Roster; view: RosterView; army: ForceView; issues: Issue[]; dispatch: (a: EditorAction) => unknown }

/** "Pick 2", "Pick 1–3", "Pick at least 1": how many a group that takes several needs. */
function pickCount(c: ArmyChoice): string {
  if (c.max === -1) return `Pick at least ${c.min}`;
  return c.min === c.max ? `Pick ${c.max}` : `Pick ${c.min}–${c.max}`;
}

/**
 * Army-wide choices (Dynasty, Army of Renown, the Arks of Omen compulsory type…) as pick-one lists, and on/off army
 * options such as stratagems bought before the battle. They live in the first detachment.
 */
export function ArmyOptions({ scope, roster, view, army, issues, dispatch }: Props) {
  const choices = useMemo(() => armyChoices(scope, roster), [scope, roster]);
  const toggles = useMemo(() => {
    const picked = new Set(choices.map((c) => c.entryId));
    // A BattleScribe helper is left out, unless the list already has it on (so it can be turned off).
    const has = new Set(army.selections.map((s) => s.sel.entryId));
    return armyOptions(scope, roster, army.force.id).filter(
      (o) => !picked.has(o.entryId) && !isAutoManagedEntry(scope, o.entryId) && (has.has(o.entryId) || !isHelperOption(scope, o.entryId)),
    );
  }, [scope, roster, army, choices]);
  if (!choices.length && !toggles.length) return null;

  const selOf = (entryId: string) => army.selections.find((s) => s.sel.entryId === entryId);
  /**
   * A problem asks for this choice: too few picked in its group, or the army option itself is missing. A problem about
   * the army option that names none of its groups (a choice nested deeper) marks all of them.
   */
  const needsPick = (c: ArmyChoice) => {
    const sel = selOf(c.entryId);
    if (!sel) return issues.some((i) => i.fix?.kind === 'add-unit' && i.fix.entryIds.length === 1 && i.fix.entryIds[0] === c.entryId);
    const own = issues.filter((i) => i.rule === 'option-required' && i.selId === sel.sel.id);
    const groups = new Set(choices.filter((x) => x.entryId === c.entryId).map((x) => x.groupId));
    return own.some((i) => i.subject.id === c.groupId || !groups.has(i.subject.id));
  };
  /** Optional army options (Army of Renown) can be taken out again; ones the army must have (Dynasty Choice) can't. */
  const optional = (c: ArmyChoice) => {
    const node = scope.node(c.entryId);
    if (!node) return false;
    return !childConstraints(scope, view, army, node).some(
      (k) => k.type === 'min' && k.field === 'selections' && k.value >= 1 && ['parent', 'force', 'roster'].includes(k.scope),
    );
  };

  return (
    <section className="card army-options" aria-labelledby="army-options-title">
      <h2 id="army-options-title">Army options</h2>
      {choices.map((c) => {
        const sel = selOf(c.entryId);
        const missing = needsPick(c);
        const none = optional(c);
        // A group that takes more than one (Chivalric Oath: two) is a set of checkboxes.
        const multi = c.max !== 1;
        const picked = multi ? c.options.filter((o) => o.selIds.length > 0) : c.options.filter((o) => o.id === c.current);
        const current = picked.length ? picked.map((o) => o.name).join(', ') : none && !sel ? 'None' : 'Not chosen';
        const full = c.max !== -1 && picked.length >= c.max;
        // Collapsed to "Title: choice" so a phone reaches the units quickly; open while a choice is still needed.
        return (
          <details key={c.key} className="army-choice" open={missing || undefined}>
            <summary>
              <span className="army-choice__title">{c.title}</span>
              <span className={missing ? 'army-choice__value army-choice__value--bad' : 'army-choice__value muted'}>{current}</span>
            </summary>
            <fieldset className="choices">
              <legend className="sr-only">{c.title}</legend>
              {missing && <p className="hint">{`${multi ? pickCount(c) : 'Pick one'}: your army needs this choice.`}</p>}
              {multi &&
                c.options.map((o) => {
                  const on = o.selIds.length > 0;
                  const toggle = () =>
                    on
                      ? o.selIds.forEach((selId) => dispatch({ type: 'remove', selId }))
                      : sel
                        ? dispatch({ type: 'add-child', parentSelId: sel.sel.id, entryId: o.id })
                        : dispatch({ type: 'army-choice', choice: c, optionId: o.id });
                  return (
                    <label key={o.id} className="opt">
                      <input type="checkbox" checked={on} disabled={!on && full} onChange={toggle} />
                      <span className="opt__name">{o.name}</span>
                    </label>
                  );
                })}
              {!multi && none && (
                <label className="radio-card">
                  <input type="radio" name={c.key} checked={!sel} onChange={() => sel && dispatch({ type: 'remove', selId: sel.sel.id })} />
                  <span className="radio-card__name">None</span>
                </label>
              )}
              {!multi && c.options.map((o) => (
                <label key={o.id} className="radio-card">
                  <input
                    type="radio"
                    name={c.key}
                    checked={c.current === o.id}
                    onChange={() => dispatch({ type: 'army-choice', choice: c, optionId: o.id })}
                  />
                  <span className="radio-card__name">{o.name}</span>
                </label>
              ))}
            </fieldset>
          </details>
        );
      })}
      {toggles.map((o) => {
        const sel = selOf(o.entryId);
        return (
          <label key={o.entryId} className="opt">
            <input
              type="checkbox"
              checked={sel !== undefined}
              onChange={() => (sel ? dispatch({ type: 'remove', selId: sel.sel.id }) : dispatch({ type: 'add-unit', forceSelId: army.force.id, entryId: o.entryId }))}
            />
            <span className="opt__name">{displayName(o.name)}</span>
          </label>
        );
      })}
    </section>
  );
}
