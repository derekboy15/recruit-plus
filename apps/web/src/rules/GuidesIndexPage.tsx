import { Link } from 'react-router-dom';
import { FactionPicker } from '../factions/FactionPicker';

export function GuidesIndexPage() {
  return (
    <section>
      <p>
        <Link to="/rules">← Rules</Link>
      </p>
      <h1>Faction guides</h1>
      <p className="muted">How each army plays, its rules in plain English, and the units to know.</p>
      <FactionPicker to={(c) => `/factions/${c.slug}/guide`} />
    </section>
  );
}
