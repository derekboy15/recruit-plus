import { Link } from 'react-router-dom';

export const DISCLAIMER =
  'Unofficial fan-made tool. Not affiliated with or endorsed by Games Workshop. Warhammer 40,000 and all associated names are trademarks of Games Workshop Ltd.';

/**
 * The full footer (disclaimer, data credits, links) on Home and the legal and sign-in pages; elsewhere the disclaimer
 * alone, small, with one link to the rest. The disclaimer is on every page either way.
 */
export function Footer({ full }: { full: boolean }) {
  if (!full)
    return (
      <footer className="footer">
        <p className="footer__compact">
          <span>{DISCLAIMER}</span> <Link to="/legal">Legal &amp; credits</Link>
        </p>
      </footer>
    );
  return (
    <footer className="footer">
      <p>{DISCLAIMER}</p>
      <p>
        Data from the BSData community project and partly powered by Wahapedia.
      </p>
      <p>
        <Link to="/legal">Legal &amp; credits</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
      </p>
    </footer>
  );
}
