import type { CatalogueOut } from '@recruit/data/model';
import { Link, useParams } from 'react-router-dom';
import { isOfflineError, LoadError, OfflineNotice } from '../layout/OfflineNotice';
import { Blocks, InlineText } from '../rules/Blocks';
import { ReportButton } from '../rules/ReportButton';
import { RulesText } from '../rules/RulesText';
import { useWording, WordingToggle } from '../rules/wording';
import { PageHeader } from '../ui/PageHeader';
import { getCatalogue, getGuide, getIndex } from './dataClient';
import { factionLabel } from './factionSearch';
import { FACTIONS_BACK, FactionTabs } from './FactionTabs';
import { factionDisplayName } from './names';
import { capitalised } from './guideText';
import { useAsync } from './useAsync';

const SYSTEM = 'system';

/** The faction and every catalogue it draws on (its roster scope), for their army rules; and its guide, if one exists. */
async function loadGuidePage(slug: string) {
  const [index, cat] = await Promise.all([getIndex(), getCatalogue(slug)]);
  const scope = (index.catalogues.find((c) => c.slug === slug)?.rosterScope ?? [slug]).filter((s) => s !== SYSTEM);
  const scopeCats = await Promise.all(scope.map((s) => (s === slug ? cat : getCatalogue(s).catch(() => null))));
  // A missing guide file means no guide yet; a failed fetch while offline must not be read as that.
  const guide = await getGuide(slug).catch((e: unknown) => (isOfflineError(e) ? ('offline' as const) : null));
  return { cat, ruleCats: scopeCats.filter((c): c is CatalogueOut => !!c && c.rules.length > 0), guide };
}

export function FactionGuidePage() {
  const { slug = '' } = useParams();
  const state = useAsync(() => loadGuidePage(slug), slug);
  const { wording } = useWording();
  if (state.status === 'loading') return <p className="muted">Loading the guide…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="this faction" />;
  const { cat, ruleCats, guide } = state.data;
  const name = factionLabel(cat).name;
  const hasGuide = !!guide && guide !== 'offline';
  const shown = (r: CatalogueOut['rules'][number]) => (wording === 'plain' && r.plain ? r.plain : r.text);
  const parts = [...(hasGuide ? [{ name: `${name} guide`, text: guide.title }] : []), ...ruleCats.flatMap((c) => c.rules.map((r) => ({ name: r.name, text: shown(r) })))];
  // Several catalogues: each one's rules under its name, one heading level down.
  const RuleHeading = ruleCats.length > 1 ? 'h4' : 'h3';
  return (
    <article className="faction-guide">
      <PageHeader title={name} back={FACTIONS_BACK} />
      <FactionTabs slug={cat.slug} library={cat.library} />
      {guide === 'offline' ? (
        <OfflineNotice />
      ) : guide ? (
        <>
          <h2>How this army plays</h2>
          <Blocks blocks={guide.plays} />
          <h2>Army rules</h2>
          <Blocks blocks={guide.armyRules} />
          <h2>Key units</h2>
          <ul className="list">
            {guide.keyUnits.map((k) => (
              <li key={k.unitSlug}>
                <Link className="list__link key-unit" to={`/factions/${cat.slug}/units/${k.unitSlug}`}>
                  <span className="key-unit__name">{k.name}</span>
                  <span className="key-unit__why">
                    <InlineText c={capitalised(k.why)} links={false} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">No guide for this faction yet.</p>
      )}
      {ruleCats.length > 0 && (
        <details className="faction-guide__full">
          <summary>Army rules in full</summary>
          <WordingToggle />
          {ruleCats.map((c) => (
            <section key={c.slug}>
              {ruleCats.length > 1 && <h3>{factionDisplayName(c.name)}</h3>}
              {c.rules.map((r) => (
                <section key={r.id} className="rules-section">
                  <RuleHeading>{r.name}</RuleHeading>
                  <RulesText official={r.text} plain={r.plain} amended={r.amended} />
                </section>
              ))}
            </section>
          ))}
        </details>
      )}
      <ReportButton target={{ kind: hasGuide ? 'guide' : 'army-rule', name: hasGuide ? `${name} guide` : `${name} army rules` }} text={name} parts={parts} />
    </article>
  );
}
