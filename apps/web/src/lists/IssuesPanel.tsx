import { explain, type Issue, type RosterView, type Scope } from '@recruit/data/roster';
import { useMemo } from 'react';
import { Panel } from './Panel';
import type { EditorAction } from './useRosterEditor';

interface Props {
  issues: Issue[]; view: RosterView; scope: Scope; dispatch: (a: EditorAction) => unknown;
  /** The unit already on screen: fixes that would only open it are left out. */
  openUnitId?: string;
}

/** Each problem in plain English, with a button that fixes it when the engine knows how. */
export function IssueList({ issues, view, scope, dispatch, openUnitId }: Props) {
  // explain() looks up unit names and prices, so explanations are worked out once per validation.
  const explained = useMemo(
    () => issues.map((issue) => ({ issue, ...explain(issue, view, scope, { shownUnitId: openUnitId }) })),
    [issues, view, scope, openUnitId],
  );
  return (
    <ul className="issues">
      {explained.map(({ issue, text, fixLabel }, i) => (
        <li key={i} className="issues__item">
          <p>{text}</p>
          {fixLabel && issue.fix && !(issue.fix.kind === 'open' && issue.fix.selId === openUnitId) && (
            <button type="button" className="btn" onClick={() => dispatch({ type: 'apply-fix', fix: issue.fix! })}>
              {fixLabel}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function IssuesPanel({ inline, onClose, ...props }: Props & { inline?: boolean; onClose: () => void }) {
  return (
    <Panel title="Problems" kind="sheet" inline={inline} onClose={onClose}>
      {props.issues.length === 0 ? <p className="muted">No problems: this list is legal to play.</p> : <IssueList {...props} />}
    </Panel>
  );
}
