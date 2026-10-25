/** The sheets behind the editor's summary chips: the battle size and the army's detachments. */
import { BATTLE_SIZES, detachmentChoices, stripCpSuffix, type BattleSizeId } from '@recruit/data/roster';
import { useMemo, useState } from 'react';
import { factionDisplayName } from '../factions/names';
import { Sheet } from '../ui/Sheet';
import { fmt, plural } from './editorView';
import type { ReadyEditor } from './useRosterEditor';

/**
 * The battle sizes as a pick-one list with their points. Picking one changes the list's size at once (it can be
 * undone); the sheet stays open until Done, so arrow keys can move through the sizes.
 */
export function SizeSheet({ editor, onClose }: { editor: ReadyEditor; onClose: () => void }) {
  const { roster, dispatch } = editor;
  const pick = (size: BattleSizeId) => {
    if (size !== roster.battleSize) dispatch({ type: 'battle-size', size });
  };
  return (
    <Sheet
      title="Battle size"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <fieldset className="choice-list">
        <legend className="sr-only">Battle size</legend>
        {Object.values(BATTLE_SIZES).map((s) => (
          <div key={s.id} className={roster.battleSize === s.id ? 'choice-row choice-row--on' : 'choice-row'}>
            <label className="choice-row__label">
              <input type="radio" name="battle-size" checked={roster.battleSize === s.id} onChange={() => pick(s.id)} />
              <span className="choice-row__text">
                <span className="choice-row__name">{s.name}</span>
                <span className="choice-row__summary">{`${fmt(s.points)} pts · ${s.mode === 'aoo' ? 'Arks of Omen rules' : 'Core Book rules'}`}</span>
              </span>
            </label>
          </div>
        ))}
      </fieldset>
    </Sheet>
  );
}

/**
 * The army's detachments, each with Remove (asked twice: it takes the detachment's units with it), then Add
 * detachment: the army's own first, allies by faction.
 */
export function DetachmentSheet({ editor, onClose }: { editor: ReadyEditor; onClose: () => void }) {
  const { scope, roster, view, policy, catalogues, dispatch } = editor;
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const factionName = (id: string) => factionDisplayName(catalogues.find((c) => c.id === id)?.name ?? scope.catalogue(id)?.name ?? 'Allies');

  const choices = useMemo(() => {
    if (!adding) return [];
    const seen = new Set<string>();
    return detachmentChoices(scope, roster, policy, catalogues).filter((c) => {
      const key = `${c.catalogueId}|${c.forceId}`;
      return !seen.has(key) && (seen.add(key), true);
    });
  }, [adding, scope, roster, policy, catalogues]);
  const own = choices.filter((c) => !c.allied);
  const allies = new Map<string, typeof choices>();
  for (const c of choices.filter((x) => x.allied)) allies.set(c.catalogueId, [...(allies.get(c.catalogueId) ?? []), c]);

  const add = (forceId: string, catalogueId: string) => {
    dispatch({ type: 'add-force', forceId, catalogueId });
    setAdding(false);
  };
  const button = (c: (typeof choices)[number]) => (
    <li key={`${c.catalogueId}|${c.forceId}`}>
      <button type="button" className="row" onClick={() => add(c.forceId, c.catalogueId)}>
        <span className="row__name">{stripCpSuffix(c.name)}</span>
      </button>
    </li>
  );

  return (
    <Sheet title="Detachments" onClose={onClose}>
      <ul className="detachment-list">
        {view.forces.map((fv, i) => {
          const allied = fv.force.catalogueId !== roster.catalogueId ? factionName(fv.force.catalogueId) : null;
          // The army's own detachment stays while an ally needs it: the first one goes only if another of its own follows.
          const canRemove = i > 0 || view.forces[1]?.force.catalogueId === roster.catalogueId;
          const id = fv.force.id;
          return (
            <li key={id} className="detachment-list__item">
              <span className="detachment-list__name">
                {stripCpSuffix(fv.name)}
                {allied && <span className="muted"> · {allied}</span>}
              </span>
              {canRemove &&
                (confirming === id ? (
                  <span className="detachment-list__confirm">
                    <button type="button" className="btn btn--danger" onClick={() => dispatch({ type: 'remove-force', forceSelId: id })}>
                      Remove it and its units
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirming(null)}>
                      Keep it
                    </button>
                  </span>
                ) : (
                  <button type="button" className="btn" aria-label={`Remove ${stripCpSuffix(fv.name)}`} onClick={() => setConfirming(id)}>
                    Remove
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn detachment-list__add" aria-expanded={adding} onClick={() => setAdding(!adding)}>
        Add detachment
      </button>
      {adding && (
        <div className="army-setup__choices">
          {choices.length === 0 && <p className="muted">{`No more detachments can be added at ${BATTLE_SIZES[roster.battleSize]?.name ?? 'this size'}.`}</p>}
          {own.length > 0 && <ul className="list">{own.map(button)}</ul>}
          {allies.size > 0 && <h3 className="role-head">Allies</h3>}
          {[...allies].map(([id, list]) => (
            <details key={id} className="ally">
              <summary>{factionName(id)}</summary>
              <ul className="list">{list.map(button)}</ul>
            </details>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/** "Add to which detachment?": with several detachments, Add unit asks first. */
export function AddToSheet({ editor, onPick, onClose }: { editor: ReadyEditor; onPick: (forceSelId: string) => void; onClose: () => void }) {
  const { scope, roster, view } = editor;
  return (
    <Sheet title="Add to which detachment?" onClose={onClose}>
      <ul className="list">
        {view.forces.map((fv) => {
          const catalogue = scope.catalogue(fv.force.catalogueId)?.name;
          const allied = catalogue && fv.force.catalogueId !== roster.catalogueId ? factionDisplayName(catalogue) : null;
          const units = fv.selections.filter((v) => v.merged && v.models > 0).length;
          return (
            <li key={fv.force.id}>
              <button type="button" className="row" onClick={() => onPick(fv.force.id)}>
                <span className="row__name">
                  {stripCpSuffix(fv.name)}
                  {allied && <span className="muted">{` · ${allied}`}</span>}
                </span>
                <span className="muted">{plural(units, 'unit', 'units')}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
