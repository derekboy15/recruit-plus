import { useParams } from 'react-router-dom';
import { LoadError } from '../layout/OfflineNotice';
import { ReportButton } from '../rules/ReportButton';
import { DatasheetView } from '../ui/datasheet';
import { PageHeader } from '../ui/PageHeader';
import { getCatalogue } from './dataClient';
import { factionDisplayName } from './names';
import { useAsync } from './useAsync';

export function DatasheetPage() {
  const { slug = '', unitSlug = '' } = useParams();
  const state = useAsync(() => getCatalogue(slug), slug);
  if (state.status === 'loading') return <p className="muted">Loading datasheet…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="this faction" />;
  const back = { to: `/factions/${slug}`, label: factionDisplayName(state.data.name) };
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
      {/* Profile, weapon and keyword errors: one report for the whole datasheet. */}
      <ReportButton target={{ kind: 'datasheet', name: unit.name }} text={unit.name} />
    </>
  );
}
