import { FactionPicker } from './FactionPicker';

export function FactionsPage() {
  return (
    <section>
      <h1>Factions</h1>
      <FactionPicker to={(c) => `/factions/${c.slug}`} />
    </section>
  );
}
