import { NavLink } from 'react-router-dom';

/** Guide · Units · Stratagems under a faction's title. A library catalogue (not a playable army) has only its units. */
export function FactionTabs({ slug, library = false }: { slug: string; library?: boolean }) {
  const tabs = library
    ? [{ to: `/factions/${slug}`, label: 'Units' }]
    : [
        { to: `/factions/${slug}/guide`, label: 'Guide' },
        { to: `/factions/${slug}`, label: 'Units' },
        { to: `/factions/${slug}/stratagems`, label: 'Stratagems' },
      ];
  return (
    <nav className="tabs" aria-label="Faction pages">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end className="tabs__link">
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
