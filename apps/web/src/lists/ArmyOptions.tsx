/**
 * Army-wide choices (Dynasty, Army of Renown, the Arks of Omen compulsory type…) as chips in the editor's summary,
 * each opening a sheet that says what every option does; and on/off army options (stratagems bought before the
 * battle) under a "More options" chip. They live in the first detachment.
 */
import { armyOptions, optionDisplay, type Issue } from '@recruit/data/roster';
import { useMemo } from 'react';
import type { EntryInfoIndex } from '../data/entryInfo';
import { useWording } from '../rules/wording';
import { IconWarning } from '../ui/icons';
import { Sheet } from '../ui/Sheet';
import { ChoiceList } from './ChoiceList';
import { isAutoManagedEntry, isHelperOption, offeredAtSize } from './editorView';
import { armyChoices, isOptionalChoice, type ArmyChoice } from './newListSetup';
import { describeOption } from './optionText';
import type { ReadyEditor } from './useRosterEditor';

/**
 * A choice's short title: its own group's name when its army option holds several ("Questor Allegiance: Noble
 * Households" → "Noble Households"), without a trailing "Choice" or "Selection" ("Dynasty Choice" → "Dynasty").
 */
export function choiceTitle(c: ArmyChoice): string {
  const own = c.title.split(': ').pop()!.trim();
  return own.replace(/\s+(choices?|selections?)$/i, '').trim() || own;
}

export interface ArmyChoiceState {
  choices: ArmyChoice[];
  /** On/off army options that aren't one of the choices (e.g. "Stratagem: Heroic Support"). */
  toggles: { entryId: string; name: string }[];
  /** The army option's selection in the first detachment, if the list has it. */
  selOf(entryId: string): { sel: { id: string } } | undefined;
  /** A problem asks for this choice. */
  needsPick(c: ArmyChoice): boolean;
  /** The army can do without it (Army of Renown), so None is offered. */
  optional(c: ArmyChoice): boolean;
}

export function useArmyChoices(editor: ReadyEditor): ArmyChoiceState | null {
  const { scope, roster, view, issues } = editor;
  return useMemo(() => {
    const army = view.forces[0];
    if (!army) return null;
    const choices = armyChoices(scope, roster);
    const picked = new Set(choices.map((c) => c.entryId));
    // A BattleScribe helper, or an option the battle size doesn't use, is left out unless the list already has it on (so it can be turned off).
    const has = new Set(army.selections.map((s) => s.sel.entryId));
    const toggles = armyOptions(scope, roster, army.force.id).filter(
      (o) => !picked.has(o.entryId) && !isAutoManagedEntry(scope, o.entryId) && (has.has(o.entryId) || (!isHelperOption(scope, o.entryId) && offeredAtSize(scope, roster, o.entryId))),
    );
    const selOf = (entryId: string) => army.selections.find((s) => s.sel.entryId === entryId);
    /**
     * Too few picked in its group, or the army option itself is missing. A problem about the army option that names
     * none of its groups (a choice nested deeper) marks all of them.
     */
    const needsPick = (c: ArmyChoice) => {
      const sel = selOf(c.entryId);
      if (!sel) return issues.some((i: Issue) => i.fix?.kind === 'add-unit' && i.fix.entryIds.length === 1 && i.fix.entryIds[0] === c.entryId);
      const own = issues.filter((i) => i.rule === 'option-required' && i.selId === sel.sel.id);
      const groups = new Set(choices.filter((x) => x.entryId === c.entryId).map((x) => x.groupId));
      return own.some((i) => i.subject.id === c.groupId || !groups.has(i.subject.id));
    };
    const optional = (c: ArmyChoice) => isOptionalChoice(scope, roster, c, view);
    return { choices, toggles, selOf, needsPick, optional };
  }, [scope, roster, view, issues]);
}

export const pickedOf = (c: ArmyChoice) => (c.max !== 1 ? c.options.filter((o) => o.selIds.length > 0) : c.options.filter((o) => o.id === c.current));

/** "Dynasty: Novokh", "Dynasty: choose" (a required choice not made yet) or "Army of Renown: None". */
function chipLabel(state: ArmyChoiceState, c: ArmyChoice): string {
  const picked = pickedOf(c);
  const current = picked.length
    ? picked.map((o) => optionDisplay(o.name).name).join(', ')
    : state.optional(c) && !state.selOf(c.entryId)
      ? 'None'
      : 'choose';
  return `${choiceTitle(c)}: ${current}`;
}

export function ArmyChoiceChips({ editor, onOpen }: { editor: ReadyEditor; onOpen: (p: Record<string, string>) => void }) {
  const state = useArmyChoices(editor);
  if (!state) return null;
  return (
    <>
      {state.choices.map((c) => {
        const missing = state.needsPick(c);
        return (
          <button key={c.key} type="button" className={missing ? 'chip chip--warn' : 'chip'} onClick={() => onOpen({ choice: c.key })}>
            {missing && <IconWarning size={15} aria-hidden="true" />}
            {chipLabel(state, c)}
          </button>
        );
      })}
      {state.toggles.length > 0 && (
        <button type="button" className="chip" onClick={() => onOpen({ sheet: 'options' })}>
          More options
        </button>
      )}
    </>
  );
}

export interface SheetProps {
  editor: ReadyEditor;
  info: EntryInfoIndex | null;
  onClose: () => void;
}

/** The army's on/off options (stratagems bought before the battle…), each saying what it does. */
export function MoreOptionsSheet({ editor, info, onClose }: SheetProps) {
  const { scope, dispatch, view } = editor;
  const { wording } = useWording();
  const state = useArmyChoices(editor);
  const army = view.forces[0];
  if (!state || !army) return null;
  const toggle = (id: string | null) => {
    if (!id) return;
    const sel = state.selOf(id);
    if (sel) dispatch({ type: 'remove', selId: sel.sel.id });
    else dispatch({ type: 'add-unit', forceSelId: army.force.id, entryId: id });
  };
  return (
    <Sheet
      title="More options"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <ChoiceList
        name="more-options"
        legend="More options"
        multi
        options={state.toggles.map((o) => describeOption(scope, info, wording, o.entryId, o.name))}
        selected={state.toggles.filter((o) => state.selOf(o.entryId)).map((o) => o.entryId)}
        onPick={toggle}
      />
    </Sheet>
  );
}
