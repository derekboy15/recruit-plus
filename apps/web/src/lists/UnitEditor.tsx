import { childOptions, COST_PTS, findSelView, type Issue, type OptionNode, type Roster, type RosterView, type Scope, type SelView } from '@recruit/data/roster';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fmt, isArmyOption, isAutoManaged, issuesOfUnit, plural, unitName } from './editorView';
import { IssueList } from './IssuesPanel';
import { OptionList, type OptionCtx } from './OptionControls';
import { Sheet } from '../ui/Sheet';
import { datasheetPath, unitInfo, type UnitIndex } from './unitIndex';
import type { EditorAction } from './useRosterEditor';

interface Props {
  selId: string;
  scope: Scope;
  roster: Roster;
  view: RosterView;
  issues: Issue[];
  units: UnitIndex | null;
  dispatch: (a: EditorAction) => unknown;
  onClose: () => void;
}

/** One unit (or army choice): its models and wargear, its problems, and duplicate / remove. */
export function UnitEditor({ selId, scope, roster, view, issues, units, dispatch, onClose }: Props) {
  const v = findSelView(view, selId);
  // childOptions evaluates the roster, so each selection's options are worked out once per edit.
  const optionsOf = useMemo(() => {
    const cache = new Map<string, OptionNode[]>();
    return (id: string) => {
      let nodes = cache.get(id);
      if (!nodes) cache.set(id, (nodes = childOptions(scope, roster, id)));
      return nodes;
    };
  }, [scope, roster]);
  const own = useMemo(() => issuesOfUnit(view, issues, selId), [view, issues, selId]);
  if (!v) return null;

  const ctx: OptionCtx = { scope, view, dispatch, optionsOf };
  const nodes = optionsOf(selId);
  const info = unitInfo(scope, units, v.sel.entryId);
  const armyChoice = v.merged !== null && isArmyOption(scope, v);
  const managed = v.merged !== null && isAutoManaged(v);
  const pts = v.total[COST_PTS] ?? 0;
  const remove = () => {
    dispatch({ type: 'remove', selId });
    onClose();
  };

  return (
    <Sheet title={unitName(v.name)} kind="full" closeLabel="Done" onClose={onClose}>
      <p className="unit-summary">
        <span>{`${fmt(pts)} pts`}</span>
        {v.models > 0 && <span className="muted">{plural(v.models, 'model', 'models')}</span>}
      </p>
      {own.length > 0 && (
        <div className="unit-issues">
          <IssueList issues={own} view={view} scope={scope} dispatch={dispatch} openUnitId={selId} />
        </div>
      )}
      {managed ? (
        <>
          <ul className="managed-choices">
            {chosen(v).map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
          <p className="muted">Set by the battle size.</p>
        </>
      ) : nodes.length === 0 ? (
        <p className="muted">{v.merged ? 'Nothing to choose for this one.' : 'This item isn’t in the current rules data.'}</p>
      ) : (
        <OptionList ctx={ctx} selId={selId} nodes={nodes} room={Infinity} spare={Infinity} depth={0} />
      )}
      <div className="unit-actions">
        {info && (
          <Link className="btn" to={datasheetPath(info)}>
            View datasheet
          </Link>
        )}
        {!armyChoice && v.merged && (
          <button type="button" className="btn" onClick={() => dispatch({ type: 'duplicate', selId })}>
            Duplicate unit
          </button>
        )}
        {!armyChoice && !managed && (
          <button type="button" className="btn btn--danger" onClick={remove}>
            Remove unit
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** The names of what is chosen inside a selection, innermost choices included ("Matched", "1. Eternal War"). */
const chosen = (v: SelView): string[] => v.children.flatMap((c) => [unitName(c.name), ...chosen(c)]);
