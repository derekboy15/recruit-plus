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
  /** A problem asks for this choice: nothing picked yet, or the army option itself is missing. */
  const needsPick = (c: ArmyChoice) => {
    const sel = selOf(c.entryId);
    return issues.some((i) =>
      sel
        ? i.rule === 'option-required' && i.selId === sel.sel.id
        : i.fix?.kind === 'add-unit' && i.fix.entryIds.length === 1 && i.fix.entryIds[0] === c.entryId,
    );
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
        const current = c.options.find((o) => o.id === c.current)?.name ?? (none && !sel ? 'None' : 'Not chosen');
        // Collapsed to "Title: choice" so a phone reaches the units quickly; open while a choice is still needed.
        return (
          <details key={c.key} className="army-choice" open={missing || undefined}>
            <summary>
              <span className="army-choice__title">{c.title}</span>
              <span className={missing ? 'army-choice__value army-choice__value--bad' : 'army-choice__value muted'}>{current}</span>
            </summary>
            <fieldset className="choices">
              <legend className="sr-only">{c.title}</legend>
              {missing && <p className="hint">Pick one: your army needs this choice.</p>}
              {none && (
                <label className="radio-card">
                  <input type="radio" name={c.key} checked={!sel} onChange={() => sel && dispatch({ type: 'remove', selId: sel.sel.id })} />
                  <span className="radio-card__name">None</span>
                </label>
              )}
              {c.options.map((o) => (
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
