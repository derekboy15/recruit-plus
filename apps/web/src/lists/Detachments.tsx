import { explain, stripCpSuffix, type ForceView } from '@recruit/data/roster';
import { useCallback, useState } from 'react';
import { factionDisplayName } from '../factions/names';
import { IconPlus, IconWarning } from '../ui/icons';
import { firstSentence, isArmyOption, isAutoManaged, issuesOfUnit, unitName, unitsByRole } from './editorView';
import { RoleSection } from './RoleSection';
import { UnitRow } from './UnitRow';
import { useUndoToast } from './undoToast';
import type { ReadyEditor } from './useRosterEditor';

/** Which role sections are closed, per list, for this browser tab (sessionStorage; forgotten if it can't be used). */
export function useCollapsed(listId: string): [Set<string>, (key: string) => void] {
  const storageKey = `builder:collapsed:${listId}`;
  const [closed, setClosed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(storageKey) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const toggle = useCallback(
    (key: string) =>
      setClosed((prev) => {
        const next = new Set(prev);
        if (!next.delete(key)) next.add(key);
        try {
          sessionStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          // Not remembered this time.
        }
        return next;
      }),
    [storageKey],
  );
  return [closed, toggle];
}

interface SectionProps {
  editor: ReadyEditor;
  fv: ForceView;
  /** The army's first detachment: its army choices are chips in the summary instead. */
  first: boolean;
  /** Several detachments: each is headed by its name. */
  showHeading: boolean;
  /** Wide screens end each detachment with Add unit (phones have one bar for the list). */
  addButton: boolean;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  onOpenUnit: (selId: string) => void;
  onAddUnit: (forceSelId: string, role?: string) => void;
  onDatasheet: (selId: string) => void;
}

/** One detachment: its units in collapsible role sections, each unit with its wargear, Warlord and problems. */
export function DetachmentSection({ editor, fv, first, showHeading, addButton, collapsed, onToggle, onOpenUnit, onAddUnit, onDatasheet }: SectionProps) {
  const { scope, roster, view, issues, dispatch } = editor;
  const undoToast = useUndoToast(editor);
  const name = stripCpSuffix(fv.name);
  const groups = unitsByRole(scope, fv);
  // A second detachment's own choices (an ally's faction choice) have nowhere else to live.
  const own = first ? [] : fv.selections.filter((v) => v.merged && isArmyOption(scope, v) && !isAutoManaged(v) && v.merged.children.length > 0);
  const catalogue = scope.catalogue(fv.force.catalogueId)?.name;
  const allied = catalogue && fv.force.catalogueId !== roster.catalogueId ? factionDisplayName(catalogue) : null;
  const problems = (selId: string) => issuesOfUnit(view, issues, selId).map((i) => explain(i, view, scope).text);

  return (
    <section className="detachment" aria-label={name}>
      {showHeading && (
        <h2 className="detachment__title">
          {name}
          {allied && <span className="muted detachment__ally"> · {allied}</span>}
        </h2>
      )}
      {own.length > 0 && (
        <ul className="unit-rows">
          {own.map((v) => (
            <li key={v.sel.id} className="unit-row">
              <button type="button" className="unit-row__open" onClick={() => onOpenUnit(v.sel.id)}>
                <span className="unit-row__text">
                  <span className="unit-row__name">{unitName(v.name)}</span>
                  {problems(v.sel.id).length > 0 && (
                    <span className="unit-row__issue">
                      <IconWarning size={14} aria-hidden="true" />
                      {firstSentence(problems(v.sel.id)[0])}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {groups.length === 0 && <p className="muted detachment__empty">No units yet.</p>}
      {groups.map((g) => {
        const key = `${fv.force.id}|${g.role}`;
        return (
          <RoleSection key={g.role} role={g.role} units={g.units} collapsed={collapsed.has(key)} onToggle={() => onToggle(key)} onAdd={() => onAddUnit(fv.force.id, g.role)}>
            {g.units.map((v) => {
              if (!v.merged) {
                return (
                  <li key={v.sel.id} className="unit-row unit-row--gone">
                    <span className="unit-row__text">
                      <span className="unit-row__name">{v.name}</span>
                      <span className="unit-row__issue">
                        <IconWarning size={14} aria-hidden="true" />
                        Not in the current rules data.
                      </span>
                    </span>
                    <button type="button" className="btn btn--small" onClick={() => dispatch({ type: 'remove', selId: v.sel.id })}>
                      Remove
                    </button>
                  </li>
                );
              }
              const unit = unitName(v.name);
              return (
                <UnitRow
                  key={v.sel.id}
                  v={v}
                  issues={problems(v.sel.id)}
                  onOpen={() => onOpenUnit(v.sel.id)}
                  onDatasheet={() => onDatasheet(v.sel.id)}
                  onDuplicate={() => {
                    dispatch({ type: 'duplicate', selId: v.sel.id });
                    undoToast(`Duplicated ${unit}`);
                  }}
                  onRemove={() => {
                    dispatch({ type: 'remove', selId: v.sel.id });
                    undoToast(`Removed ${unit}`);
                  }}
                />
              );
            })}
          </RoleSection>
        );
      })}
      {addButton && (
        <button type="button" className="btn detachment__add" onClick={() => onAddUnit(fv.force.id)}>
          <IconPlus size={18} aria-hidden="true" />
          Add unit
        </button>
      )}
    </section>
  );
}
