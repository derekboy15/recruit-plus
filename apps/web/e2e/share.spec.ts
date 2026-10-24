import { expect, test, type Page } from '@playwright/test';
import { listFixture, seedList, signInDev, signOutDev } from './seed';

// The editor's Export and Share sheets are covered by editor.spec.ts; this opens a shared list that is already saved.
const SHARE_ID = '00000000-0000-4000-8000-0000000000a1';
const novokh = listFixture('novokh-incursion.json');

const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}-${project}.png` });
};

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test('a shared list opens read-only without signing in: the army, a datasheet, Copy list and Build your own', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  await signInDev(page);
  await seedList(page, { id: SHARE_ID, data: novokh, isPublic: true });
  await signOutDev(page);

  await page.goto(`/share/${SHARE_ID}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Novokh Incursion' })).toBeVisible();
  await expect(page.getByText('Necrons · Incursion')).toBeVisible();
  await expect(page.getByText(/^[\d,]+ \/ 1,000 pts$/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('button', { name: 'Account', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save to my lists' })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect((await page.getByRole('button', { name: 'Copy list' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByRole('link', { name: 'Build your own' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await noSidewaysScroll(page);
  await shot(page, 'shared-list', project);

  const card = page.getByRole('button', { name: /^Necron Warriors/ });
  await expect(card).toContainText('10x Gauss Flayer');
  await card.click();
  await expect(page.getByRole('dialog', { name: 'Necron Warriors' }).getByText('Gauss Flayer').first()).toBeVisible();
  await noSidewaysScroll(page);
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/share/${SHARE_ID}$`));

  // Not a shared list: the friendly message.
  await page.goto('/share/00000000-0000-4000-8000-0000000000ff');
  await expect(page.getByText("This list isn't shared, or the link is wrong.")).toBeVisible();
  await noSidewaysScroll(page);
});

test('signed in: Save to my lists copies a shared list into your lists and opens it', async ({ page }) => {
  await signInDev(page);
  await seedList(page, { id: SHARE_ID, data: novokh, isPublic: true });
  await page.goto(`/share/${SHARE_ID}`);
  await expect(page.getByRole('link', { name: 'Build your own' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save to my lists' }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]{36}$/);
  expect(page.url()).not.toContain(SHARE_ID);
});
