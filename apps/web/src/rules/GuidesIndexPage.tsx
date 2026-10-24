import { FactionPicker } from '../factions/FactionPicker';
import { PageHeader } from '../ui/PageHeader';

export function GuidesIndexPage() {
  return (
    <section>
      <PageHeader title="Faction guides" back={{ to: '/rules', label: 'Rules' }} />
      <p className="muted">How each army plays, its rules in plain English, and the units to know.</p>
      <FactionPicker to={(c) => `/factions/${c.slug}/guide`} />
    </section>
  );
}
