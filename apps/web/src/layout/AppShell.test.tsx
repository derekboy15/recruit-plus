import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import type { AuthBackend, User } from '../auth/types';
import { AccountMenu } from './AccountMenu';
import { AppShell } from './AppShell';
import { DISCLAIMER } from './Footer';

const makeBackend = (user: User | null, signOut = vi.fn(async () => {})): AuthBackend => ({
  getUser: async () => user,
  onChange: () => () => {},
  signInWithPassword: async () => {},
  signUp: async () => ({ confirmEmail: true }),
  sendPasswordReset: async () => {},
  updatePassword: async () => {},
  resendConfirmation: async () => {},
  signInWithGoogle: async () => {},
  signOut,
});
const backend = makeBackend(null);

const renderShell = (path: string, b: AuthBackend = backend) =>
  render(
    <AuthProvider backend={b}>
      <MemoryRouter initialEntries={[path]}>
        <AppShell account={<AccountMenu />}>
          <h1>Page</h1>
        </AppShell>
      </MemoryRouter>
    </AuthProvider>,
  );

afterEach(() => localStorage.clear());

test('the first Tab stop is a skip link that moves focus to the main content', async () => {
  renderShell('/');
  await userEvent.tab();
  const skip = screen.getByRole('link', { name: 'Skip to main content' });
  expect(skip).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByRole('main')).toHaveFocus();
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
});

test('Home has the full footer: the disclaimer, the data credits and the links', () => {
  renderShell('/');
  expect(screen.getByText(DISCLAIMER, { exact: true })).toBeInTheDocument();
  expect(screen.getByText(/Data from the BSData community project/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
});

test('other pages have the compact footer: the disclaimer and one link', () => {
  renderShell('/build');
  expect(screen.getByText(DISCLAIMER, { exact: true })).toBeInTheDocument();
  expect(screen.queryByText(/Data from the BSData community project/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Legal & credits' })).toHaveAttribute('href', '/legal');
  expect(document.querySelector('.footer__compact')).not.toBeNull();
});

test('signed out, there is no Account button', async () => {
  renderShell('/');
  await screen.findByRole('heading', { name: 'Page' });
  expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
});

test('signed in, Account opens a menu with the email and Sign out', async () => {
  const signOut = vi.fn(async () => {});
  renderShell('/build', makeBackend({ id: 'u1', email: 'derek@example.com' }, signOut));
  const account = await screen.findByRole('button', { name: 'Account' });
  await userEvent.click(account);
  const menu = screen.getByRole('menu', { name: 'Account' });
  expect(menu).toHaveTextContent('derek@example.com');
  // The email is shown, not a menu item.
  expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Sign out']);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  expect(signOut).toHaveBeenCalledTimes(1);
});

test('a shared list has no Account button even when signed in', async () => {
  renderShell('/share/abc', makeBackend({ id: 'u1', email: 'derek@example.com' }));
  await screen.findByRole('heading', { name: 'Page' });
  expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
});
