import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function SignIn() {
  const auth = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/learn';
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.user) return <Navigate to={from} replace />;

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onEmail = (e: FormEvent) => {
    e.preventDefault();
    void run(() => auth.signInWithEmail(email.trim()), 'Check your inbox for a sign-in link.');
  };

  return (
    <section style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      <p className="muted">Your army lists, lesson progress and saved games follow you between devices.</p>
      {auth.unavailable && (
        <p role="alert" className="card">
          Sign-in isn’t configured for this site yet.
        </p>
      )}
      {auth.canDevSignIn && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ marginTop: 0 }}>Local development mode — no account needed.</p>
          <button className="btn btn--primary" disabled={busy} onClick={() => void run(async () => {
            await auth.signInDev();
            navigate(from, { replace: true });
          })}>
            Continue (dev)
          </button>
        </div>
      )}
      <form onSubmit={onEmail} style={{ display: 'grid', gap: '0.5rem' }}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn btn--primary" type="submit" disabled={busy || auth.unavailable}>
          Email me a sign-in link
        </button>
      </form>
      <p className="muted" style={{ textAlign: 'center' }}>or</p>
      <button className="btn" style={{ width: '100%' }} disabled={busy || auth.unavailable} onClick={() => void run(auth.signInWithGoogle)}>
        Continue with Google
      </button>
      {message && (
        <p role="status" style={{ marginTop: '1rem' }}>
          {message}
        </p>
      )}
    </section>
  );
}
