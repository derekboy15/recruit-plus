import { useParams } from 'react-router-dom';
import { LoadError } from '../layout/OfflineNotice';
import { ReportButton } from '../rules/ReportButton';
import { useWording } from '../rules/wording';
import { DatasheetView } from '../ui/datasheet';
import { PageHeader } from '../ui/PageHeader';
import { getCatalogue } from './dataClient';
import { factionLabel } from './factionSearch';
import { useAsync } from './useAsync';

export function DatasheetPage() {
  const { slug = '', unitSlug = '' } = useParams();
  const state = useAsync(() => getCatalogue(slug), slug);
  const { wording } = useWording();
  if (state.status === 'loading') return <p className="muted">Loading datasheet…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="this faction" />;
  const back = { to: `/factions/${slug}`, label: factionLabel(state.data).name };
  const unit = state.data.units.find((u) => u.slug === unitSlug);
  if (!unit)
    return (
      <>
        <PageHeader title="Unit not found" back={back} />
        <p role="alert">Unit not found.</p>
      </>
    );
  return (
    <>
      <PageHeader title={unit.name} back={back} />
      {/* The page header holds the name (h1); the view's sections are h2. */}
      <DatasheetView unit={unit} headingLevel={1} hideName />
      {/* One report for the page: the datasheet itself (profiles, weapons, keywords) or one of its abilities. */}
      <ReportButton
        target={{ kind: 'datasheet', name: unit.name }}
        text={unit.name}
        parts={[
          { name: unit.name, text: unit.name },
          ...unit.abilities.map((a) => ({ name: a.name, text: wording === 'plain' && a.plain ? a.plain : a.text })),
        ]}
      />
    </>
  );
}
