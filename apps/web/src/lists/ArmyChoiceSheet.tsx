/** "Choose: Dynasty": a sheet with each option of one army choice and what it does. */
import { useWording } from '../rules/wording';
import { Sheet } from '../ui/Sheet';
import { choiceTitle, pickedOf, useArmyChoices, type SheetProps } from './ArmyOptions';
import { ChoiceList } from './ChoiceList';
import type { ArmyChoice } from './newListSetup';
import { describeOption } from './optionText';

/** "Pick 2", "Pick 1–3", "Pick at least 1": how many a group that takes several needs. */
function pickCount(c: ArmyChoice): string {
  if (c.max === -1) return `Pick at least ${c.min}`;
  return c.min === c.max ? `Pick ${c.max}` : `Pick ${c.min}–${c.max}`;
}

/** "Choose: Dynasty": what the choice is for, then each option with what it does. Picking applies at once. */
export function ArmyChoiceSheet({ editor, info, choiceKey, onClose }: SheetProps & { choiceKey: string }) {
  const { scope, dispatch } = editor;
  const { wording } = useWording();
  const state = useArmyChoices(editor);
  const c = state?.choices.find((x) => x.key === choiceKey);
  if (!state || !c) return null;
  const sel = state.selOf(c.entryId);
  const multi = c.max !== 1;
  const picked = pickedOf(c);
  const full = c.max !== -1 && picked.length >= c.max;
  const intro = describeOption(scope, info, wording, c.entryId, c.title).summary;
  const options = c.options.map((o) => describeOption(scope, info, wording, o.id, o.name));

  const pick = (id: string | null) => {
    if (id === null) return sel && dispatch({ type: 'remove', selId: sel.sel.id });
    if (!multi) return dispatch({ type: 'army-choice', choice: c, optionId: id });
    const o = c.options.find((x) => x.id === id)!;
    if (o.selIds.length) o.selIds.forEach((selId) => dispatch({ type: 'remove', selId }));
    else if (sel) dispatch({ type: 'add-child', parentSelId: sel.sel.id, entryId: id });
    else dispatch({ type: 'army-choice', choice: c, optionId: id });
  };

  const title = choiceTitle(c);
  return (
    <Sheet
      kind="full"
      title={`Choose: ${title}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      {intro && <p className="choice-intro">{intro}</p>}
      {state.needsPick(c) && <p className="hint">{`${multi ? pickCount(c) : 'Pick one'}: your army needs this choice.`}</p>}
      <ChoiceList
        name={c.key}
        legend={title}
        multi={multi}
        options={options}
        selected={picked.map((o) => o.id)}
        noneOption={!multi && state.optional(c)}
        disabledIds={multi && full ? c.options.filter((o) => !picked.includes(o)).map((o) => o.id) : []}
        onPick={pick}
      />
    </Sheet>
  );
}
