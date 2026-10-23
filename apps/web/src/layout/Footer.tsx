import { Link } from 'react-router-dom';

export const DISCLAIMER =
  'Unofficial fan-made tool. Not affiliated with or endorsed by Games Workshop. Warhammer 40,000 and all associated names are trademarks of Games Workshop Ltd.';

export function Footer() {
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
