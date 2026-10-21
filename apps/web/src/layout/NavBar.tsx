import { NavLink } from 'react-router-dom';

export const NAV_ITEMS = [
  { to: '/learn', label: 'Learn', icon: '📖' },
  { to: '/build', label: 'Build', icon: '🛡' },
  { to: '/play', label: 'Play', icon: '🎲' },
  { to: '/table', label: 'Table', icon: '⏱' },
  { to: '/rules', label: 'Rules', icon: '📜' },
] as const;

/** Bottom tab bar on phones, side rail from 768px (see theme.css). */
export function NavBar() {
  return (
    <nav className="nav" aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} className="nav__item">
          <span className="nav__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
