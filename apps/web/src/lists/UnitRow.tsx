import { COST_PTS, unitSummary, type SelView } from '@recruit/data/roster';
import { useMemo } from 'react';
import { IconWarlord, IconWarning } from '../ui/icons';
import { Menu } from '../ui/Menu';
import { firstSentence, fmt, unitName } from './editorView';

interface Props {
  v: SelView;
  /** This unit's problems, explained (the row shows the first sentence of the first). */
  issues: string[];
  onOpen: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDatasheet: () => void;
}

/** One unit in the list: its name and size, wargear, Warlord and trait, relics, its first problem and its points. */
export function UnitRow({ v, issues, onOpen, onDuplicate, onRemove, onDatasheet }: Props) {
  const summary = useMemo(() => unitSummary(v), [v]);
  const name = unitName(v.name);
  return (
    <li className="unit-row">
      <button type="button" className="unit-row__open" onClick={onOpen}>
        <span className="unit-row__text">
          <span className="unit-row__name">
            {name}
            {v.models > 1 && <span className="unit-row__models">{` · ${fmt(v.models)}`}</span>}
          </span>
          {summary.gear.length > 0 && <span className="unit-row__gear">{summary.gear.join(' · ')}</span>}
          {summary.warlord && (
            <span className="unit-row__warlord">
              <IconWarlord size={14} aria-hidden="true" />
              {summary.traits.length ? `Warlord · ${summary.traits[0]}` : 'Warlord'}
            </span>
          )}
          {summary.relics.length > 0 && <span className="unit-row__relic">{`Relic: ${summary.relics.join(' · ')}`}</span>}
          {issues.length > 0 && (
            <span className="unit-row__issue">
              <IconWarning size={14} aria-hidden="true" />
              {firstSentence(issues[0])}
            </span>
          )}
        </span>
        <span className="unit-row__pts">{fmt(v.total[COST_PTS] ?? 0)}</span>
      </button>
      <Menu
        label={`Options for ${name}`}
        items={[
          { label: 'Duplicate', onSelect: onDuplicate },
          { label: 'Remove', onSelect: onRemove },
          { label: 'View datasheet', onSelect: onDatasheet },
        ]}
      />
    </li>
  );
}
