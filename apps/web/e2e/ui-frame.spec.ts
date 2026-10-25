/** The app frame across every tab: no sideways scroll on phones, the display face on headings, no emoji. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGES = ['/', '/build', '/learn', '/rules', '/table', '/play', '/factions/necrons/units/necron-warriors', '/no-such-page'];

async function signIn(page: Page) {
  await page.goto('/build');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await expect(page).toHaveURL(/\/build$/);
}

async function checkPage(page: Page, path: string, label: string) {
  await page.goto(path);
  const h1 = page.locator('h1').first();
  await expect(h1, `${path} heading`).toBeVisible({ timeout: 20_000 });
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth) - document.documentElement.clientWidth);
  expect(overflow, `${path} sideways scroll at ${label}`).toBeLessThanOrEqual(0);
  const family = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family, `${path} h1 face`).toMatch(/^"?Barlow Condensed"?/);
  const text = await page.evaluate(() => document.body.innerText);
  expect(text.match(/\p{Extended_Pictographic}/gu), `${path} emoji`).toBeNull();
}

test('every tab fits a 320px and a 375px phone, with the display face and no emoji', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone widths');
  test.setTimeout(120_000);
  await signIn(page);
  for (const size of [{ width: 320, height: 700 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(size);
    for (const path of PAGES) await checkPage(page, path, `${size.width}px`);
  }
});

test('every tab on a desktop has the display face and no emoji', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop width');
  test.setTimeout(120_000);
  await signIn(page);
  for (const path of PAGES) await checkPage(page, path, 'desktop');
});

test('the datasheet has a 44px Back link to its faction, and a long title stays on one line at 320px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone width');
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/factions/necrons/units/necron-warriors');
  const back = page.getByRole('link', { name: 'Back to Necrons' });
  await expect(back).toBeVisible();
  const box = (await back.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);

  // A unit with a long name: the title clips with an ellipsis instead of wrapping or pushing Back off screen.
  await page.goto('/factions/necrons/units/canoptek-reanimator');
  const title = page.locator('.page-head__title');
  await expect(title).toBeVisible();
  await title.evaluate((el) => (el.textContent = 'An extraordinarily long unit name that cannot possibly fit'));
  const { lines, clipped } = await title.evaluate((el) => {
    const s = getComputedStyle(el);
    return { lines: Math.round(el.getBoundingClientRect().height / parseFloat(s.lineHeight)), clipped: s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth };
  });
  expect(lines).toBe(1);
  expect(clipped).toBe(true);
  const backBox = (await page.getByRole('link', { name: 'Back to Necrons' }).boundingBox())!;
  expect(backBox.x).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('the account menu opens from its icon and stays inside a 320px screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'phone width');
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Account', exact: true });
  await expect(menu).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  // The open menu, its email header included, passes axe.
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('.menu').analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeFocused();
});
