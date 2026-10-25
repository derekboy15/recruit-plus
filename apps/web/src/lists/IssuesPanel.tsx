import { explain, type Issue, type RosterView, type Scope } from '@recruit/data/roster';
import { useId, useMemo } from 'react';
import { Sheet } from '../ui/Sheet';
import type { EditorAction } from './useRosterEditor';

/** An army choice an issue asks for (Dynasty, Army of Renown…): its sheet's key and short title. */
export interface ChoiceTarget {
  key: string;
  title: string;
}

interface Props {
  issues: Issue[]; view: RosterView; scope: Scope; dispatch: (a: EditorAction) => unknown;
  /** The unit already on screen: fixes that would only open it are left out. */
  openUnitId?: string;
  /** The army choice an issue is about, if any: its fix becomes "Choose …" and opens that choice's sheet. */
  choiceFor?: (issue: Issue) => ChoiceTarget | null;
  onChoose?: (key: string) => void;
}

/** Choices the player still has to make (pick a dynasty, name a Warlord); everything else must be fixed. */
const CHOICE_RULES: Issue['rule'][] = ['option-required', 'warlord-missing'];

interface Item { issue: Issue; text: string; fixLabel?: string; choice: ChoiceTarget | null }

function Group({ title, items, choice, onFix }: { title: string; items: Item[]; choice: boolean; onFix: (item: Item) => void }) {
  const id = useId();
  if (!items.length) return null;
  return (
    <section className="issues-group" aria-labelledby={id}>
      <h3 id={id} className="label-caps issues-group__title">
        {title}
      </h3>
      <ul className="issues">
        {items.map((item, i) => {
          const label = item.choice ? `Choose ${item.choice.title}` : item.fixLabel;
          return (
            <li key={i} className={choice ? 'issues__item issues__item--choice' : 'issues__item'}>
              <p>{item.text}</p>
              {label && (item.choice || item.issue.fix) && (
                <button type="button" className="btn" onClick={() => onFix(item)}>
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Each problem in plain English, with a button that fixes it when the engine knows how: choices first, then fixes. */
export function IssueList({ issues, view, scope, dispatch, openUnitId, choiceFor, onChoose }: Props) {
  // explain() looks up unit names and prices, so explanations are worked out once per validation.
  const items = useMemo(
    () =>
      issues.map((issue): Item => {
        const { text, fixLabel } = explain(issue, view, scope, { shownUnitId: openUnitId });
        // A fix that would only open the unit already on screen is left out.
        const onScreen = issue.fix?.kind === 'open' && issue.fix.selId === openUnitId;
        return { issue, text, fixLabel: onScreen ? undefined : fixLabel, choice: onScreen ? null : (choiceFor?.(issue) ?? null) };
      }),
    [issues, view, scope, openUnitId, choiceFor],
  );
  const fix = (item: Item) => {
    if (item.choice && onChoose) onChoose(item.choice.key);
    else if (item.issue.fix) dispatch({ type: 'apply-fix', fix: item.issue.fix });
  };
  const isChoice = (item: Item) => item.choice !== null || CHOICE_RULES.includes(item.issue.rule);
  return (
    <div className="issues-groups">
      <Group title="Choices to make" items={items.filter(isChoice)} choice onFix={fix} />
      <Group title="Must fix" items={items.filter((i) => !isChoice(i))} choice={false} onFix={fix} />
    </div>
  );
}

export function IssuesPanel({ inline, onClose, ...props }: Props & { inline?: boolean; onClose: () => void }) {
  return (
    <Sheet title="Problems" kind="sheet" inline={inline} onClose={onClose}>
      {props.issues.length === 0 ? <p className="muted">No problems: this list is legal to play.</p> : <IssueList {...props} />}
    </Sheet>
  );
}
