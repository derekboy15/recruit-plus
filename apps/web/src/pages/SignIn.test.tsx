import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { fakeAuthBackend } from '../auth/__fixtures__/fakeBackend';
import type { AuthBackend } from '../auth/types';
import { ResetPassword } from './ResetPassword';
import { SignIn } from './SignIn';

afterEach(() => localStorage.clear());

function page(backend: AuthBackend, at = '/sign-in') {
  render(
    <AuthProvider backend={backend}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/learn" element={<p>Learn page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const email = () => screen.getByLabelText('Email');
const password = () => screen.getByLabelText('Password', { exact: true });

test('signs in with email and password, and offers Google, but no email sign-in link', async () => {
  const signInWithPassword = vi.fn(async () => {});
  page(fakeAuthBackend({ signInWithPassword }));
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  expect(screen.queryByText(/sign-in link/i)).not.toBeInTheDocument();
  await userEvent.type(email(), ' a@b.c ');
  await userEvent.type(password(), 'my-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(signInWithPassword).toHaveBeenCalledWith('a@b.c', 'my-password');
});

test('a wrong password shows the error and keeps the email filled in', async () => {
  page(fakeAuthBackend({ signInWithPassword: async () => { throw new Error('Wrong email or password.'); } }));
  await userEvent.type(await screen.findByLabelText('Email'), 'a@b.c');
  await userEvent.type(password(), 'wrong');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
  expect(email()).toHaveValue('a@b.c');
});

test('the password can be shown while typing', async () => {
  page(fakeAuthBackend());
  await userEvent.type(await screen.findByLabelText('Email'), 'a@b.c');
  expect(password()).toHaveAttribute('type', 'password');
  await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(password()).toHaveAttribute('type', 'text');
});

test('creating an account needs 8+ characters, then asks you to confirm your email and can resend it', async () => {
  const signUp = vi.fn(async () => ({ confirmEmail: true }));
  const resendConfirmation = vi.fn(async () => {});
  page(fakeAuthBackend({ signUp, resendConfirmation }));
  await userEvent.click(await screen.findByRole('button', { name: 'Create an account' }));
  expect(screen.getByRole('heading', { name: 'Create an account' })).toBeInTheDocument();
  await userEvent.type(email(), 'new@b.c');
  await userEvent.type(password(), 'short');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 8 characters.');
  expect(signUp).not.toHaveBeenCalled();
  await userEvent.type(password(), '-but-longer');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(signUp).toHaveBeenCalledWith('new@b.c', 'short-but-longer');
  expect(await screen.findByRole('status')).toHaveTextContent(/check your email/i);
  await userEvent.click(screen.getByRole('button', { name: 'Send the email again' }));
  expect(resendConfirmation).toHaveBeenCalledWith('new@b.c');
});

test('an unconfirmed account can ask for the confirmation email again from the sign-in form', async () => {
  const resendConfirmation = vi.fn(async () => {});
  page(fakeAuthBackend({ signInWithPassword: async () => { throw new Error('Confirm your email address first: open the link we emailed you.'); }, resendConfirmation }));
  await userEvent.type(await screen.findByLabelText('Email'), 'a@b.c');
  await userEvent.type(password(), 'my-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Send the email again' }));
  expect(resendConfirmation).toHaveBeenCalledWith('a@b.c');
});

test('forgot password sends a reset link to the email', async () => {
  const sendPasswordReset = vi.fn(async () => {});
  page(fakeAuthBackend({ sendPasswordReset }), '/sign-in?mode=forgot');
  expect(await screen.findByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Password', { exact: true })).not.toBeInTheDocument();
  await userEvent.type(email(), 'a@b.c');
  await userEvent.click(screen.getByRole('button', { name: 'Email me a reset link' }));
  expect(sendPasswordReset).toHaveBeenCalledWith('a@b.c');
  expect(await screen.findByRole('status')).toHaveTextContent(/check your email/i);
  await userEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
});

test('the reset page sets a new password for the signed-in user and goes on to the app', async () => {
  localStorage.setItem('recruit.lastUser', JSON.stringify({ id: 'u1', email: 'a@b.c' }));
  const updatePassword = vi.fn(async () => {});
  page(fakeAuthBackend({ getUser: async () => ({ id: 'u1', email: 'a@b.c' }), updatePassword }), '/reset-password');
  const field = await screen.findByLabelText('New password');
  await userEvent.type(field, 'brand-new-password');
  await userEvent.type(screen.getByLabelText('Type it again'), 'brand-new-passw0rd');
  await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
  expect(await screen.findByRole('alert')).toHaveTextContent("The two passwords don't match.");
  await userEvent.clear(screen.getByLabelText('Type it again'));
  await userEvent.type(screen.getByLabelText('Type it again'), 'brand-new-password');
  await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
  expect(updatePassword).toHaveBeenCalledWith('brand-new-password');
  expect(await screen.findByText('Learn page')).toBeInTheDocument();
});

test('the reset page without a valid link says so and offers a new one', async () => {
  page(fakeAuthBackend({ getUser: async () => null }), '/reset-password');
  expect(await screen.findByText(/expired or has already been used/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Send a new reset link' })).toHaveAttribute('href', '/sign-in?mode=forgot');
  await waitFor(() => expect(screen.queryByLabelText('New password')).not.toBeInTheDocument());
});
