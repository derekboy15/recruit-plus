import { Link } from 'react-router-dom';
import { DISCLAIMER } from '../layout/Footer';
import { PageHeader } from '../ui/PageHeader';

export const TERMS_UPDATED = '23 October 2026';

export function Terms() {
  return (
    <article>
      <PageHeader title="Terms of use" back={{ to: '/', label: 'Home' }} />
      <p className="muted">Last updated {TERMS_UPDATED}.</p>

      <h2>What Recruit+ is</h2>
      <p>A free, non-commercial fan project for learning and playing Warhammer 40,000 9th Edition.</p>
      <p className="card">{DISCLAIMER}</p>

      <h2>Rules text</h2>
      <p>
        The plain-English rules are our own summaries. We check them carefully, but they can be wrong. For tournaments
        and disputes, the official rules decide. If you spot a mistake, use “Report a problem” at the foot of the page and choose the rule.
      </p>

      <h2>No guarantees</h2>
      <p>
        Recruit+ is provided as it is, without any warranty. Features may change, and the service may pause or stop.
        Keep a copy of anything you can't afford to lose: every list can be exported as text.
      </p>

      <h2>Your content</h2>
      <p>
        Your lists, games and notes stay yours. A list you share by link is public to anyone who has the link. What we
        store, and how to delete it, is on the <Link to="/privacy">privacy page</Link>.
      </p>

      <h2>Fair use</h2>
      <p>
        Please don't attack, overload or scrape the service, try to reach other people's data, or use it to harass anyone.
        Accounts that do may be removed.
      </p>

      <h2>Names and data</h2>
      <p>
        Warhammer 40,000 names, rules and points belong to Games Workshop. Army data comes from the BSData community
        project, and rules data is partly powered by Wahapedia. See <Link to="/legal">legal notices and credits</Link>.
      </p>
    </article>
  );
}
