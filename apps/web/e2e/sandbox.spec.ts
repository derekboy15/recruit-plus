import { expect, test, type Page } from '@playwright/test';

/**
 * A short sandbox game at phone and desktop sizes: seed a list, start a game with it on both sides, deploy, move,
 * shoot, play out the turns, undo, reload (the game is saved) and concede. The board is a canvas, so the test finds
 * models and places through the DEV-only `window.__sandbox` hook.
 */

type Pt = { x: number; y: number };
interface SandboxState {
  active: 'A' | 'B';
  phase: string;
  step: string;
  round: number;
  setup: { zones: Record<'A' | 'B', Pt[]>; armies: { player: 'A' | 'B'; name: string }[] };
  units: Record<string, { id: string; player: 'A' | 'B'; name: string; modelIds: string[]; location: string }>;
  models: Record<string, { pos: { x: number; y: number } | null; destroyed: boolean }>;
}

const shot = async (page: Page, name: string, project: string) => {
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/sandbox-${name}-${project}.png` });
};
const state = (page: Page) => page.evaluate(() => (window as unknown as { __sandbox: { state(): unknown } }).__sandbox.state() as SandboxState);
const screenOf = (page: Page, modelId: string) =>
  page.evaluate((id) => (window as unknown as { __sandbox: { screenOf(id: string): Pt } }).__sandbox.screenOf(id), modelId);
const screenAt = (page: Page, world: Pt) => page.evaluate((w) => (window as unknown as { __sandbox: { screenAt(p: Pt): Pt } }).__sandbox.screenAt(w), world);
const centre = (poly: Pt[]) => ({ x: poly.reduce((a, p) => a + p.x, 0) / poly.length, y: poly.reduce((a, p) => a + p.y, 0) / poly.length });

/** Dismisses the pass-the-device screen if it is showing (it appears just after the player to act changes). */
async function handOver(page: Page) {
  await page.waitForTimeout(150);
  const over = page.getByRole('dialog', { name: /^Pass the device to/ });
  if (await over.isVisible()) await over.getByRole('button', { name: /^I'm / }).click();
}
/** Clicks a button in the game panel, passing the device first if asked. */
async function press(page: Page, name: string | RegExp) {
  await handOver(page);
  await page.locator('.game__panel').getByRole('button', { name, exact: typeof name === 'string' }).first().click();
  await handOver(page);
}

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}
/** Every visible button on the game screen is a 44px touch target. */
async function touchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.game button')]
      .filter((b) => (b as HTMLElement).offsetParent !== null && !(b as HTMLElement).closest('details:not([open])'))
      .map((b) => [b.textContent?.trim(), Math.round(b.getBoundingClientRect().height)] as const)
      .filter(([, h]) => h > 0 && h < 44),
  );
  expect(small).toEqual([]);
}

/** Signs in (dev) and saves a one-unit Necrons Combat Patrol list through the DEV-only `window.__practice` hook. */
async function seedList(page: Page) {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect
    .poll(() => page.evaluate(() => typeof (window as unknown as { __practice?: unknown }).__practice))
    .toBe('object');
  await page.evaluate(() =>
    (window as unknown as { __practice: { seedList(spec: unknown): Promise<string> } }).__practice.seedList({
      catalogue: 'necrons',
      name: 'Necrons Combat Patrol',
      size: 'combat-patrol',
      units: ['Necron Warriors'],
    }),
  );
  await page.reload();
  await expect(page.getByRole('link', { name: 'New game' })).toBeVisible();
}

/** Ends phases and steps (passing the device and taking Morale tests) until it is the other player's turn. */
async function finishTurn(page: Page) {
  const start = await state(page);
  for (let guard = 0; guard < 30; guard++) {
    const s = await state(page);
    if (s.active !== start.active || s.phase === 'ended') return;
    await handOver(page);
    const panel = page.locator('.game__panel');
    if (await panel.getByRole('button', { name: 'Accept' }).isVisible()) {
      await press(page, 'Accept');
      continue;
    }
    if (await panel.getByRole('button', { name: 'No', exact: true }).isVisible()) {
      await press(page, 'No');
      continue;
    }
    if (await panel.getByRole('button', { name: 'Take Morale test' }).first().isVisible()) {
      await press(page, 'Take Morale test');
      continue;
    }
    const end = panel.getByRole('button', { name: /^(End .*|No more Heroic Interventions)$/ }).last();
    await end.click();
  }
  throw new Error('the turn did not end');
}

test('play a short sandbox game: deploy, move, shoot, undo, reload and concede', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  page.setDefaultTimeout(15_000);
  const project = testInfo.project.name;
  await seedList(page);

  // A new game with the same list on both sides.
  await page.goto('/play');
  await page.getByRole('link', { name: 'New game' }).click();
  for (const player of ['Player 1', 'Player 2']) await page.getByRole('group', { name: player }).getByRole('radio', { name: /Necrons Combat Patrol/ }).check();
  await page.getByRole('group', { name: 'Terrain' }).getByRole('radio', { name: /Open field/ }).check();
  const startGame = page.getByRole('button', { name: 'Start game' });
  await expect(startGame).toBeEnabled({ timeout: 30_000 });
  await noSidewaysScroll(page);
  await shot(page, 'setup', project);
  await startGame.click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('banner', { name: 'Game status' })).toContainText('Deployment');

  // Deployment: each army's Warriors, tapped into the middle of its own zone.
  for (let i = 0; i < 2; i++) {
    await handOver(page);
    const s = await state(page);
    const unit = Object.values(s.units).find((u) => u.location === 'deploying')!;
    const deployer = Object.values(s.units).filter((u) => u.location === 'deploying').find((u) => u.player !== (i === 0 ? 'A' : 'B')) ?? unit;
    await page.locator('.game__panel').getByRole('button', { name: /Necron Warriors/ }).first().click();
    const at = await screenAt(page, centre(s.setup.zones[deployer.player]));
    await page.mouse.click(at.x, at.y);
    const deploy = page.getByRole('button', { name: 'Deploy Necron Warriors' });
    await expect(deploy).toBeEnabled();
    if (i === 0) {
      await touchTargets(page);
      await shot(page, 'deploy', project);
    }
    await deploy.click();
  }
  await press(page, 'Roll off');
  const chooser = page.locator('.game__panel').getByRole('button', { name: /goes first$/ });
  if (await chooser.first().isVisible()) await press(page, /\(Player 1\) goes first$/);
  await press(page, 'Start the battle');
  await expect(page.getByRole('banner', { name: 'Game status' })).toContainText('Round 1 · Command');

  // The first player's turn: move the Warriors 4" towards the enemy and shoot.
  const first = (await state(page)).active;
  await press(page, 'End Command phase');
  const s1 = await state(page);
  const mine = Object.values(s1.units).find((u) => u.player === first)!;
  const theirs = Object.values(s1.units).find((u) => u.player !== first)!;
  const lead = mine.modelIds[0];
  const from = s1.models[lead].pos!;
  const towards = s1.models[theirs.modelIds[0]].pos!.y > from.y ? 4 : -4;
  const a = await screenOf(page, lead);
  await page.mouse.click(a.x, a.y);
  await press(page, 'Normal Move');
  const b = await screenAt(page, { x: from.x, y: from.y + towards });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  const confirm = page.getByRole('button', { name: 'Confirm move' });
  await expect(confirm).toBeEnabled();
  await shot(page, 'move', project);
  await confirm.click();
  await press(page, 'End Movement');
  await press(page, 'End Movement phase');
  await press(page, 'End Psychic phase');
  await page.locator('.game__panel').getByRole('button', { name: /Necron Warriors/ }).first().click();
  const t = await screenOf(page, theirs.modelIds[0]);
  await page.mouse.click(t.x, t.y);
  await press(page, 'Shoot');
  const panel = page.locator('.game__panel');
  if (await panel.getByRole('alert').isVisible()) {
    await expect(panel.getByRole('alert')).toContainText('out of range');
  } else {
    await expect(panel.getByRole('heading', { name: /hit rolls/ })).toBeVisible();
    await expect(panel.getByRole('group', { name: 'Dice' })).toBeVisible();
    await shot(page, 'dice', project);
    await touchTargets(page);
  }
  await finishTurn(page);

  // The log has the move; the second player plays their turn out.
  await handOver(page);
  await page.getByRole('button', { name: 'Log' }).click();
  await expect(page.getByRole('dialog', { name: 'Game log' })).toContainText('Necron Warriors made a Normal Move.');
  await page.getByRole('dialog', { name: 'Game log' }).getByRole('button', { name: 'Close' }).click();
  await finishTurn(page);

  // Round 2: undo is refused at the start of a phase; a move started can be cancelled.
  await expect(page.getByRole('banner', { name: 'Game status' })).toContainText('Round 2 · Command');
  await press(page, 'End Command phase');
  await handOver(page);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.game__panel').getByRole('alert')).toContainText("You can't undo past the start of this phase.");
  await page.locator('.game__panel').getByRole('button', { name: /Necron Warriors/ }).first().click();
  await press(page, 'Normal Move');
  await press(page, 'Cancel');
  await noSidewaysScroll(page);

  // The game is saved: a reload reopens it where it was.
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole('banner', { name: 'Game status' })).toContainText('Round 2 · Movement');

  // Concede: the other army wins.
  await handOver(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Concede' }).click();
  await page.getByRole('button', { name: /\(Player 2\) concedes$/ }).click();
  await expect(page.locator('.game__panel').getByRole('heading', { name: /\(Player 1\) wins$/ })).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, 'game-over', project);
});

test('a real mission from the table companion data sets the board: Strike Force, Recover the Relics', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  await seedList(page);
  await page.goto('/play');
  await page.getByRole('link', { name: 'New game' }).click();
  for (const player of ['Player 1', 'Player 2']) await page.getByRole('group', { name: player }).getByRole('radio', { name: /Necrons Combat Patrol/ }).check();
  await page.getByRole('group', { name: 'Battle size' }).getByRole('radio', { name: /Strike Force/ }).check();
  await page.getByRole('group', { name: 'Mission' }).getByRole('radio', { name: /Recover the Relics/ }).check();
  await page.getByRole('group', { name: 'Terrain' }).getByRole('radio', { name: /Open field/ }).check();
  const startGame = page.getByRole('button', { name: 'Start game' });
  await expect(startGame).toBeEnabled({ timeout: 30_000 });
  await startGame.click();
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('banner', { name: 'Game status' })).toContainText('Deployment');

  // The 60"x44" map is turned onto the 44"x60" board: the long-edge deployment zones end up at the short ends.
  const s = (await state(page)) as SandboxState & { setup: { board: { w: number; h: number }; objectives: { pos: Pt }[] } };
  expect(s.setup.board).toEqual({ w: 44, h: 60 });
  expect(s.setup.objectives).toHaveLength(6);
  const ys = (k: 'A' | 'B') => s.setup.zones[k].map((p) => p.y);
  expect(Math.max(...ys('A')) <= 30 || Math.min(...ys('A')) >= 30).toBe(true);
  expect(Math.max(...ys('B')) <= 30 || Math.min(...ys('B')) >= 30).toBe(true);
  await handOver(page);
  await shot(page, 'real-mission', testInfo.project.name);
});
