import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type Mode = 'signin' | 'signup' | 'forgot';

const MIN_PASSWORD = 8;
const TITLES: Record<Mode, string> = { signin: 'Sign in', signup: 'Create an account', forgot: 'Reset your password' };

/** Email and password with a show/hide toggle; shared by the sign-in and create-account forms. */
export function PasswordField({ id, label, value, onChange, autoComplete }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
}) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          className="input"
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn btn--ghost" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} onClick={() => setShown((s) => !s)}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
    </>
  );
}

export function SignIn() {
  const auth = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/learn';
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'signup' ? 'signup' : params.get('mode') === 'forgot' ? 'forgot' : 'signin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Show "Send the email again" for this address (after sign-up, or when sign-in says it isn't confirmed). */
  const [resendFor, setResendFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A cached user whose sign-in expired still needs to sign in again, so stay on this page.
  if (auth.user && !auth.needsReauth) return <Navigate to={from} replace />;

  const go = (next: Mode) => {
    setError(null);
    setNotice(null);
    setResendFor(null);
    setPassword('');
    setParams(next === 'signin' ? {} : { mode: next }, { replace: true, state: { from } });
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(message);
      if (/confirm your email/i.test(message)) setResendFor(email.trim());
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (mode === 'forgot') {
      void run(async () => {
        await auth.sendPasswordReset(address);
        setNotice(`Check your email: we've sent a reset link to ${address}.`);
      });
      return;
    }
    if (mode === 'signup' && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (mode === 'signup') {
      void run(async () => {
        const { confirmEmail } = await auth.signUp(address, password);
        if (confirmEmail) {
          setNotice(`Check your email: open the link we sent to ${address} to confirm it, then sign in.`);
          setResendFor(address);
        } else navigate(from, { replace: true });
      });
      return;
    }
    void run(async () => {
      await auth.signInWithPassword(address, password);
      navigate(from, { replace: true });
    });
  };

  const resend = () =>
    void run(async () => {
      await auth.resendConfirmation(resendFor!);
      setNotice(`Sent again to ${resendFor}. It can take a few minutes; check your spam folder too.`);
    });

  const disabled = busy || auth.unavailable;

  return (
    <section className="auth-page">
      <h1>{TITLES[mode]}</h1>
      <p className="muted">
        {mode === 'forgot'
          ? "Enter your account's email and we'll send a link to choose a new password."
          : 'Your army lists, lesson progress and saved games follow you between devices.'}
      </p>
      {auth.unavailable && (
        <p role="alert" className="card">
          Sign-in isn’t configured for this site yet.
        </p>
      )}
      {auth.canDevSignIn && mode === 'signin' && (
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

      <form onSubmit={submit} className="auth-form" noValidate>
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode !== 'forgot' && (
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        )}
        {mode === 'signup' && <p className="muted auth-form__hint">At least {MIN_PASSWORD} characters.</p>}
        {mode === 'signin' && (
          <button type="button" className="link-btn auth-form__forgot" onClick={() => go('forgot')}>
            Forgot password?
          </button>
        )}
        {error && <p role="alert" className="auth-form__error">{error}</p>}
        {notice && <p role="status" className="auth-form__notice">{notice}</p>}
        {resendFor && (
          <button type="button" className="btn" disabled={busy} onClick={resend}>
            Send the email again
          </button>
        )}
        <button className="btn btn--primary" type="submit" disabled={disabled}>
          {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Email me a reset link'}
        </button>
      </form>

      {mode !== 'forgot' && (
        <>
          <p className="auth-divider muted">or</p>
          <button className="btn auth-google" disabled={disabled} onClick={() => void run(auth.signInWithGoogle)}>
            Continue with Google
          </button>
        </>
      )}

      <p className="auth-switch">
        {mode === 'signin' && (
          <>
            New here?{' '}
            <button type="button" className="link-btn" onClick={() => go('signup')}>Create an account</button>
          </>
        )}
        {mode === 'signup' && (
          <>
            Already have an account?{' '}
            <button type="button" className="link-btn" onClick={() => go('signin')}>Sign in</button>
          </>
        )}
        {mode === 'forgot' && (
          <button type="button" className="link-btn" onClick={() => go('signin')}>Back to sign in</button>
        )}
      </p>
    </section>
  );
}
