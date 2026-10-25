import { PageHeader } from '../ui/PageHeader';
import { FactionPicker } from './FactionPicker';

export function FactionsPage() {
  return (
    <section>
      <PageHeader title="Factions" back={{ to: '/rules', label: 'Rules' }} />
      <FactionPicker to={(c) => `/factions/${c.slug}`} />
    </section>
  );
}
