import { Link } from 'react-router-dom';

export const PRIVACY_UPDATED = '23 October 2026';

/**
 * Plain description of what Recruit+ stores. The contact and the database's region come from VITE_CONTACT_EMAIL and
 * VITE_DATA_REGION, set when the site is published (DEPLOY.md).
 */
export function Privacy({
  contact = import.meta.env.VITE_CONTACT_EMAIL ?? '',
  region = import.meta.env.VITE_DATA_REGION ?? '',
}: {
  contact?: string;
  region?: string;
}) {
  const contactLine = contact ? (
    <>
      To delete your account and everything stored with it, email <a href={`mailto:${contact}`}>{contact}</a> from the
      address you sign in with.
    </>
  ) : (
    <>
      To delete your account and everything stored with it, contact the site operator.{' '}
      <span>The contact address is added when the site is published.</span>
    </>
  );
  return (
    <article>
      <h1>Privacy</h1>
      <p className="muted">Last updated {PRIVACY_UPDATED}.</p>
      <p>Recruit+ is a free fan project. It keeps only what it needs to save your work and sync it between your devices.</p>

      <h2>What we store</h2>
      <ul>
        <li>
          Your email address, so you can sign in. Supabase, our database and sign-in provider, keeps it. If you sign in
          with Google, Google also sends your name and profile picture, which Supabase stores with your sign-in account;
          Recruit+ doesn't show or use them. If you use a password, Supabase stores only a one-way scrambled (hashed)
          form of it, which nobody, including us, can read back.
        </li>
        <li>Your army lists, saved games (sandbox and table companion) and lesson progress.</li>
        <li>Any rules-error reports you send, with the text you wrote.</li>
      </ul>

      <h2>Where it is kept</h2>
      <p>
        On your device, in your browser's storage (IndexedDB and localStorage), so the app works without a connection.
        And in our Supabase database, so your lists and games follow you to your other devices.{' '}
        {region ? `The database is hosted in ${region}.` : 'The hosting region is added when the site is published.'}
      </p>

      <h2>Who can see it</h2>
      <p>
        Only you. If you share a list by link, anyone who has that link can read that list. You can stop sharing it at any
        time from the list's export screen.
      </p>

      <h2>What we don't do</h2>
      <ul>
        <li>No adverts, analytics or tracking.</li>
        <li>We never sell or share your data.</li>
        <li>No cookies. Your sign-in session is kept in your browser's storage.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Deleting a list or a game in the app removes it from your lists on every device once they sync. Its contents
        are erased from this device and from our database; only a record that it was deleted is kept, so your other
        devices know to remove it too.
      </p>
      <p>{contactLine}</p>
      <p>
        Signing out on a shared device ends your session. Lists and games already downloaded stay in that browser until
        its site data is cleared.
      </p>

      <p>
        See also the <Link to="/terms">terms of use</Link> and <Link to="/legal">legal notices and credits</Link>.
      </p>
    </article>
  );
}
