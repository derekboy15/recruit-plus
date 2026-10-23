import type { CatalogueOut } from '@recruit/data/model';
import { Link, useParams } from 'react-router-dom';
import { Blocks, InlineText } from '../rules/Blocks';
import { ReportButton } from '../rules/ReportButton';
import { RulesText } from '../rules/RulesText';
import { useWording, WordingToggle } from '../rules/wording';
import { getCatalogue, getGuide, getIndex } from './dataClient';
import { FactionTabs } from './FactionTabs';
import { factionDisplayName } from './names';
import { useAsync } from './useAsync';
import { isOfflineError, LoadError, OfflineNotice } from '../layout/OfflineNotice';

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

function ArmyRule({ rule }: { rule: CatalogueOut['rules'][number] }) {
  const { wording } = useWording();
  return (
    <div className="card">
      <h4 style={{ margin: 0 }}>{rule.name}</h4>
      <RulesText official={rule.text} plain={rule.plain} amended={rule.amended} />
      <ReportButton target={{ kind: 'army-rule', name: rule.name }} text={wording === 'plain' && rule.plain ? rule.plain : rule.text} />
    </div>
  );
}

export function FactionGuidePage() {
  const { slug = '' } = useParams();
  const state = useAsync(() => loadGuidePage(slug), slug);
  if (state.status === 'loading') return <p className="muted">Loading the guide…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="this faction" />;
  const { cat, ruleCats, guide } = state.data;
  const name = factionDisplayName(cat.name);
  return (
    <article>
      <p>
        <Link to="/factions">← All factions</Link>
      </p>
      <h1>{name}</h1>
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
              <li key={k.unitSlug} className="card">
                <Link to={`/factions/${cat.slug}/units/${k.unitSlug}`}>{k.name}</Link>
                <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                  <InlineText c={k.why} />
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">No guide for this faction yet.</p>
      )}
      {ruleCats.length > 0 && (
        <section>
          <h2>Army rules in full</h2>
          <WordingToggle />
          {ruleCats.map((c) => (
            <section key={c.slug}>
              {ruleCats.length > 1 && <h3>{factionDisplayName(c.name)}</h3>}
              <div className="stack">
                {c.rules.map((r) => (
                  <ArmyRule key={r.id} rule={r} />
                ))}
              </div>
            </section>
          ))}
        </section>
      )}
      {guide && guide !== 'offline' && <ReportButton target={{ kind: 'guide', name: `${name} guide` }} text={guide.title} />}
    </article>
  );
}
