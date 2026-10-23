import { expect, test, type Page } from '@playwright/test';

/**
 * The Learn path at phone and desktop sizes: lessons 1 and 2 with their drills on the real board, then (with every
 * lesson marked done through the DEV-only hook) "Your first game". The board is a canvas, so models are found through
 * the DEV-only `window.__sandbox` hook.
 */

type Pt = { x: number; y: number };
interface DrillState {
  units: Record<string, { name: string; modelIds: string[] }>;
  models: Record<string, { pos: { x: number; y: number } | null }>;
}

const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/learn-${name}-${project}.png` });
};
const state = (page: Page) => page.evaluate(() => (window as unknown as { __sandbox: { state(): unknown } }).__sandbox.state() as DrillState);
const screenOf = (page: Page, modelId: string) =>
  page.evaluate((id) => (window as unknown as { __sandbox: { screenOf(id: string): Pt } }).__sandbox.screenOf(id), modelId);
const screenAt = (page: Page, world: Pt) => page.evaluate((w) => (window as unknown as { __sandbox: { screenAt(p: Pt): Pt } }).__sandbox.screenAt(w), world);

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}
/** Every visible button and link on the Learn and drill screens is a 44px touch target. */
async function touchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.learn button, .learn a.btn, .learn .learn-path__link, .game button, .game a.btn, .drill-card label')]
      .filter((b) => (b as HTMLElement).offsetParent !== null && !(b as HTMLElement).closest('details:not([open])'))
      .map((b) => [b.textContent?.trim(), Math.round(b.getBoundingClientRect().height)] as const)
      .filter(([, h]) => h > 0 && h < 44),
  );
  expect(small).toEqual([]);
}
const card = (page: Page) => page.getByRole('region', { name: 'Drill' });
async function answer(page: Page, label: string | RegExp) {
  await card(page).getByRole('radio', { name: label }).check();
  await card(page).getByRole('button', { name: 'Check answer' }).click();
}

test('learn: lessons 1 and 2 with their drills, then Your first game', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const project = testInfo.project.name;

  await page.goto('/learn');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await expect(page).toHaveURL(/\/learn$/);
  const path = page.getByRole('list', { name: 'Lessons' });
  await expect(path.getByRole('listitem')).toHaveCount(15);
  await expect(path.getByRole('listitem').nth(0)).toContainText('Next');
  await expect(path.getByRole('listitem').nth(1)).toContainText('Locked');
  await noSidewaysScroll(page);
  await touchTargets(page);
  await shot(page, 'home', project);

  // Lesson 1: the text, then the drill: a Normal Move onto the objective.
  await path.getByRole('link', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'What 40k is', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Key words' })).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, 'lesson', project);
  await page.getByRole('link', { name: 'Start the drill' }).click();
  await expect(card(page)).toContainText('Your five Intercessors');

  const s = await state(page);
  const squad = Object.values(s.units).find((u) => u.name === 'Intercessor Squad')!;
  const lead = squad.modelIds[0];
  const from = s.models[lead].pos!;
  const a = await screenOf(page, lead);
  await page.mouse.click(a.x, a.y);
  await page.locator('.game__panel').getByRole('button', { name: 'Normal Move', exact: true }).click();
  const b = await screenAt(page, { x: from.x, y: from.y + 4 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  const confirm = page.getByRole('button', { name: 'Confirm move' });
  await expect(confirm).toBeEnabled();
  await touchTargets(page);
  await noSidewaysScroll(page);
  await shot(page, 'drill-move', project);
  await confirm.click();
  await answer(page, 'You');
  await expect(card(page).getByRole('heading', { name: 'Drill complete' })).toBeVisible();
  await shot(page, 'drill-done', project);

  // Back on the path: lesson 1 done, lesson 2 next.
  await card(page).getByRole('link', { name: 'Back to Learn' }).click();
  await expect(path.getByRole('listitem').nth(0)).toContainText('Done');
  await expect(path.getByRole('listitem').nth(1)).toContainText('Next');

  // Lesson 2: read the datasheets, then fire the bolt rifles.
  await path.getByRole('link', { name: 'Start' }).click();
  await page.getByRole('link', { name: 'Start the drill' }).click();
  await expect(card(page).getByText('See datasheet: Intercessor Squad')).toBeVisible();
  await answer(page, '6"');
  await answer(page, '4+');
  await answer(page, '1 shot');
  await page.locator('.game__panel').getByRole('button', { name: /^Intercessor Squad/ }).first().click();
  await page.getByRole('combobox', { name: 'Target for Bolt rifle' }).selectOption({ label: 'Necron Warriors' });
  await page.locator('.game__panel').getByRole('button', { name: 'Shoot', exact: true }).click();
  await expect(card(page).getByRole('heading', { name: 'Drill complete' })).toBeVisible();
  await expect(card(page)).toContainText('5 hit rolls');
  await noSidewaysScroll(page);

  // Every lesson done (the DEV hook): Your first game opens a real sandbox game with hints on.
  await card(page).getByRole('link', { name: 'Back to Learn' }).click();
  await expect(path.getByRole('listitem').nth(1)).toContainText('Done');
  await page.evaluate(() => (window as unknown as { __learn: { completeAll(): Promise<void> } }).__learn.completeAll());
  const firstGame = page.getByRole('region', { name: 'Your first game' });
  await expect(firstGame.getByRole('link', { name: 'Play your first game' })).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Lessons done' })).toContainText('15 of 15 lessons done');
  await shot(page, 'unlocked', project);
  await firstGame.getByRole('link', { name: 'Play your first game' }).click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByRole('banner', { name: 'Game status' })).toContainText('Deployment');
  await expect(page.getByRole('note', { name: 'Hint' })).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, 'first-game', project);
});
