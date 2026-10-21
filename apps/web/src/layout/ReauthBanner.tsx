import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/** Shown above the page when the server has said the sign-in expired; local lists keep working. */
export function ReauthBanner() {
  const { needsReauth } = useAuth();
  if (!needsReauth) return null;
  return (
    <div
      role="alert"
      className="card"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderColor: 'var(--brass)' }}
    >
      <span style={{ flex: '1 1 16rem' }}>Your sign-in has expired. Your lists are safe on this device. Sign in again to sync them.</span>
      <Link to="/sign-in" className="btn btn--primary" style={{ textDecoration: 'none' }}>
        Sign in again
      </Link>
    </div>
  );
}
