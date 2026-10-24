import { expect, test, type Page } from '@playwright/test';
import { listFixture, seedList, signInDev } from './seed';

const PLAY_ID = '00000000-0000-4000-8000-0000000000c1';
const novokh = listFixture('novokh-incursion.json');

const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}-${project}.png` });
};

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test('Play mode: read-only army, datasheets with Previous/Next, phone Back closes, rules and stratagems', async ({ page }, testInfo) => {
  const project = testInfo.project.name;
  await signInDev(page);
  await seedList(page, { id: PLAY_ID, data: novokh });
  await page.goto(`/build/${PLAY_ID}/play`);
  await expect(page.getByRole('heading', { level: 1, name: 'Novokh Incursion' })).toBeVisible();
  await expect(page.getByText(/^Play mode · read only · [\d,]+ pts$/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', `/build/${PLAY_ID}`);
  await expect(page.getByRole('link', { name: 'Back to Your lists', exact: true })).toHaveAttribute('href', '/build');
  await expect(page.getByRole('textbox')).toHaveCount(0);
  for (const name of [/^Army rules/, /^Stratagems/, /^Necron Warriors/]) {
    expect((await page.getByRole('button', { name }).boundingBox())!.height, String(name)).toBeGreaterThanOrEqual(44);
  }
  await noSidewaysScroll(page);
  await shot(page, 'play-mode', project);

  await page.getByRole('button', { name: /^Necron Warriors/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Necron Warriors' });
  await expect(sheet.getByText('Gauss Flayer').first()).toBeVisible();
  await expect(sheet.getByText('Troops · 10 models · 110 pts')).toBeVisible();
  const nav = sheet.getByRole('navigation', { name: 'Other units in this army' });
  for (const name of [/^Previous/, /^Next/]) expect((await nav.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await noSidewaysScroll(page);
  await shot(page, 'play-datasheet', project);
  await nav.getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByRole('dialog', { name: 'Immortals' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/build/${PLAY_ID}/play$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Novokh Incursion' })).toBeVisible();

  await page.getByRole('button', { name: /^Army rules/ }).click();
  await expect(page.getByRole('dialog', { name: 'Army rules' }).getByText(/awakened by murder/i).first()).toBeVisible();
  await noSidewaysScroll(page);
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Stratagems/ }).click();
  const strats = page.getByRole('dialog', { name: 'Stratagems' });
  await expect(strats.getByText('Blood Rites')).toBeVisible();
  await expect(strats.getByText('Talent for Annihilation')).toHaveCount(0);
  await strats.getByRole('checkbox', { name: 'Show every stratagem' }).check();
  await expect(strats.getByText('Talent for Annihilation')).toBeVisible();
  await noSidewaysScroll(page);
});

test('Play mode: a stale unit link opens nothing, and a list that isn’t here says so', async ({ page }) => {
  await signInDev(page);
  await seedList(page, { id: PLAY_ID, data: novokh });
  await page.goto(`/build/${PLAY_ID}/play?unit=not-a-unit`);
  await expect(page.getByRole('heading', { level: 1, name: 'Novokh Incursion' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/build/${PLAY_ID}/play$`));

  await page.goto('/build/00000000-0000-4000-8000-0000000000ee/play');
  await expect(page.getByRole('heading', { level: 1, name: 'List not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to your lists', exact: true })).toHaveAttribute('href', '/build');
  await noSidewaysScroll(page);
});
