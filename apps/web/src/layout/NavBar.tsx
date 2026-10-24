import { NavLink } from 'react-router-dom';
import { IconLearn, IconLists, IconPractice, IconRules, IconTable, type LucideIcon } from '../ui/icons';

export const NAV_ITEMS: readonly { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/learn', label: 'Learn', Icon: IconLearn },
  { to: '/build', label: 'Lists', Icon: IconLists },
  // "Practice", not "Play", so it doesn't clash with a list's Play mode.
  { to: '/play', label: 'Practice', Icon: IconPractice },
  { to: '/table', label: 'Table', Icon: IconTable },
  { to: '/rules', label: 'Rules', Icon: IconRules },
];

/** Bottom tab bar on phones, side rail from 768px (see theme.css). */
export function NavBar() {
  return (
    <nav className="nav" aria-label="Main">
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className="nav__item">
          <span className="nav__icon" aria-hidden="true">
            <Icon size={22} aria-hidden="true" />
          </span>
          <span className="nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
