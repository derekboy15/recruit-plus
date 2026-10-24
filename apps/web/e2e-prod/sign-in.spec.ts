import { E2E_PASSWORD, E2E_USER } from './fake-supabase';
import { expect, test } from './fixtures';

// The production build's real supabase-js talks to the fake Supabase host (fake-supabase.ts).

test('password sign-in: a wrong password is explained, the right one opens the app, and the landing page knows you', async ({ page, remote }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText(/sign-in link/i)).toHaveCount(0);
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.');

  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/learn$/);
  expect(remote.requests.filter((r) => r.startsWith('POST /auth/v1/token?grant_type=password'))).toHaveLength(2);

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Continue learning' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to start' })).toHaveCount(0);
});

test('creating an account and resetting a password both say to check your email', async ({ page, remote }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email').fill('new@player.test');
  await page.getByLabel('Password', { exact: true }).fill('a-good-long-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  expect(remote.requests.some((r) => r.startsWith('POST /auth/v1/signup'))).toBe(true);

  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByRole('button', { name: 'Email me a reset link' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  expect(remote.requests.some((r) => r.startsWith('POST /auth/v1/recover'))).toBe(true);
});
