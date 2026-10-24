import type { SelView } from '@recruit/data/roster';
import { useId, type ReactNode } from 'react';
import { IconExpand, IconPlus } from '../ui/icons';
import { article, fmt, plural, roleTotals } from './editorView';

interface Props {
  role: string;
  units: SelView[];
  collapsed: boolean;
  onToggle: () => void;
  /** Opens the unit picker on this role. */
  onAdd: () => void;
  /** The unit rows (<li>s). */
  children: ReactNode;
}

/** One battlefield role in a detachment: a heading that opens and closes it, its count and points, and its own +. */
export function RoleSection({ role, units, collapsed, onToggle, onAdd, children }: Props) {
  const id = useId();
  const { count, points } = roleTotals(units);
  return (
    <section className="role-section" aria-labelledby={id}>
      <div className="role-section__head">
        <h2 className="role-section__title">
          <button id={id} type="button" className="role-section__toggle" aria-expanded={!collapsed} onClick={onToggle}>
            <IconExpand size={18} aria-hidden="true" className="role-section__chevron" />
            <span className="label-caps">{role}</span>{' '}
            <span className="role-section__count">{`${plural(count, 'unit', 'units')} · ${fmt(points)} pts`}</span>
          </button>
        </h2>
        <button type="button" className="btn btn--icon role-section__add" aria-label={`Add ${article(role)} ${role} unit`} onClick={onAdd}>
          <IconPlus size={22} aria-hidden="true" />
        </button>
      </div>
      {!collapsed && <ul className="unit-rows">{children}</ul>}
    </section>
  );
}
