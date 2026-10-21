import { BATTLE_SIZES, COST_CP, COST_PL, COST_PTS, type RosterView } from '@recruit/data/roster';
import { fmt, problemsLabel } from './editorView';
import type { EditorAction } from './useRosterEditor';

interface Props {
  view: RosterView;
  issueCount: number;
  issuesOpen: boolean;
  /** The name to fall back to when the player clears the name box. */
  defaultName: string;
  dispatch: (a: EditorAction) => unknown;
  onIssues: () => void;
}

/** Sticky: the list name, the points bar (red when over), PL and CP, and the Legal / problems button. */
export function EditorHeader({ view, issueCount, issuesOpen, defaultName, dispatch, onIssues }: Props) {
  const { roster, total } = view;
  const pts = total[COST_PTS] ?? 0;
  const limit = BATTLE_SIZES[roster.battleSize]?.points ?? 0;
  const over = pts > limit;
  const text = `${fmt(pts)} / ${fmt(limit)} pts`;
  return (
    <header className="editor-head">
      <input
        className="input editor-head__name"
        aria-label="List name"
        value={roster.name}
        onChange={(e) => dispatch({ type: 'rename', name: e.target.value })}
        onBlur={(e) => !e.target.value.trim() && dispatch({ type: 'rename', name: defaultName })}
      />
      <div className="editor-head__row">
        <div
          className="points"
          role="meter"
          aria-label="Points"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={pts}
          aria-valuetext={text}
          aria-invalid={over}
        >
          <span className="points__text">{text}</span>
          <span className="points__bar" aria-hidden="true">
            <span className="points__fill" style={{ width: `${limit ? Math.min(100, (pts / limit) * 100) : 0}%` }} />
          </span>
        </div>
        <span className="muted editor-head__pl">{`${fmt(total[COST_PL] ?? 0)} PL · ${fmt(total[COST_CP] ?? 0)} CP`}</span>
        <button
          type="button"
          className={`issues-btn status ${issueCount ? 'status--bad' : 'status--ok'}`}
          aria-expanded={issuesOpen}
          onClick={onIssues}
        >
          {problemsLabel(issueCount)}
        </button>
      </div>
    </header>
  );
}
