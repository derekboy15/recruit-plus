import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PasswordField } from './SignIn';

const MIN_PASSWORD = 8;

/**
 * Where a password-reset email lands. Supabase signs the user in from the link, so a user being present means the link
 * worked (a signed-in user can also use this page to change their password).
 */
export function ResetPassword() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.loading) return <p className="muted">Checking your link…</p>;
  if (!auth.user)
    return (
      <section className="auth-page">
        <h1>Reset your password</h1>
        <p>This reset link has expired or has already been used.</p>
        <Link className="btn btn--primary" to="/sign-in?mode=forgot">Send a new reset link</Link>
      </section>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== again) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await auth.updatePassword(password);
      navigate('/learn', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-page">
      <h1>Choose a new password</h1>
      <p className="muted">For {auth.user.email ?? 'your account'}.</p>
      <form onSubmit={(e) => void submit(e)} className="auth-form" noValidate>
        <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
        <p className="muted auth-form__hint">At least {MIN_PASSWORD} characters.</p>
        <PasswordField id="new-password-again" label="Type it again" value={again} onChange={setAgain} autoComplete="new-password" />
        {error && <p role="alert" className="auth-form__error">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={busy}>Save new password</button>
      </form>
    </section>
  );
}
