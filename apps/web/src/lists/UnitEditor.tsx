import { BATTLE_SIZES, childOptions, COST_PTS, findSelView, optionDisplay, unitSummary, type OptionNode, type SelView } from '@recruit/data/roster';
import { useMemo, useState } from 'react';
import type { EntryInfoIndex } from '../data/entryInfo';
import { useWording } from '../rules/wording';
import { Sheet } from '../ui/Sheet';
import { DatasheetSheet } from './DatasheetSheet';
import { fmt, isArmyOption, isAutoManaged, issuesOfUnit, plural, unitName } from './editorView';
import { IssueList } from './IssuesPanel';
import { OptionList, type OptionCtx } from './OptionControls';
import { unitInfo, type UnitIndex } from './unitIndex';
import { useUndoToast } from './undoToast';
import type { ReadyEditor } from './useRosterEditor';

interface Props {
  editor: ReadyEditor;
  selId: string;
  units: UnitIndex | null;
  info: EntryInfoIndex | null;
  onClose: () => void;
}

/** Spec §4 (L15): under Arks of Omen a Warlord takes a trait only through the 1 CP Warlord Trait requisition. */
export const REQUISITION_NOTE =
  'In Arks of Omen games your Warlord only gets a Warlord trait if you pay 1 CP for it. Tick Warlord trait (1 CP) below to choose one.';

/** Whether the unit has bought the Warlord Trait requisition (then its trait group is on screen). */
const hasTraitRequisition = (v: SelView): boolean =>
  v.children.some((c) => {
    const d = optionDisplay(c.name);
    return (d.heading === 'Stratagem' && /^warlord trait$/i.test(d.name)) || hasTraitRequisition(c);
  });

/** One unit (or army choice): its models and wargear, its problems, its datasheet, and duplicate / remove. */
export function UnitEditor({ editor, selId, units, info, onClose }: Props) {
  const { scope, roster, view, issues, dispatch } = editor;
  const { wording } = useWording();
  const undoToast = useUndoToast(editor);
  const [datasheet, setDatasheet] = useState(false);
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

  const summary = unitSummary(v);
  const aoo = BATTLE_SIZES[roster.battleSize]?.mode === 'aoo';
  const warlordNote = summary.warlord && aoo && summary.traits.length === 0 && !hasTraitRequisition(v) ? REQUISITION_NOTE : null;
  const ctx: OptionCtx = { scope, view, dispatch, optionsOf, info, wording, warlordNote };
  const nodes = optionsOf(selId);
  const sheet = unitInfo(scope, units, v.sel.entryId);
  const armyChoice = v.merged !== null && isArmyOption(scope, v);
  const managed = v.merged !== null && isAutoManaged(v);
  const pts = v.total[COST_PTS] ?? 0;
  const name = unitName(v.name);
  const remove = () => {
    dispatch({ type: 'remove', selId });
    onClose();
    undoToast(`Removed ${name}`);
  };
  const duplicate = () => {
    dispatch({ type: 'duplicate', selId });
    undoToast(`Duplicated ${name}`);
  };

  return (
    <Sheet title={name} kind="full" closeLabel="Done" onClose={onClose}>
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
            {chosen(v).map((n, i) => (
              <li key={i}>{n}</li>
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
        {sheet && (
          <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setDatasheet(true)}>
            View datasheet
          </button>
        )}
        {!armyChoice && v.merged && (
          <button type="button" className="btn" onClick={duplicate}>
            Duplicate unit
          </button>
        )}
        {!armyChoice && !managed && (
          <button type="button" className="btn btn--danger" onClick={remove}>
            Remove unit
          </button>
        )}
      </div>
      {datasheet && <DatasheetSheet v={v} info={sheet} onClose={() => setDatasheet(false)} />}
    </Sheet>
  );
}

/** The names of what is chosen inside a selection, innermost choices included ("Matched", "1. Eternal War"). */
const chosen = (v: SelView): string[] => v.children.flatMap((c) => [unitName(c.name), ...chosen(c)]);
