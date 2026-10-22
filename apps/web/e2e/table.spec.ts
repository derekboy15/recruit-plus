import { expect, test, type Page, type TestInfo } from '@playwright/test';

/** No sideways scroll, every visible button at least 44px tall, and a screenshot when SHOT_DIR is set. */
async function checkScreen(page: Page, testInfo: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${name}: sideways scroll`).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main button, main a.btn')]
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .map((b) => ({ text: (b.textContent ?? '').trim() || b.getAttribute('aria-label'), h: b.getBoundingClientRect().height }))
      .filter((b) => b.h < 44),
  );
  expect(small, `${name}: buttons under 44px`).toEqual([]);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/table-${name}-${testInfo.project.name}.png`, fullPage: true });
}

async function createList(page: Page) {
  await page.goto('/build');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await page.getByRole('link', { name: 'New list' }).click();
  await page.getByRole('button', { name: /^Necrons/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Incursion/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Arks of Omen Detachment/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Create list' }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]{36}$/);
}

const nextPhase = (page: Page) => page.getByRole('button', { name: 'Next phase' }).click();
const position = (page: Page) => page.locator('.scoreboard__pos');
const vpOf = (page: Page, name: string) => page.getByRole('group', { name }).locator('.scoreboard__vp');
const cpOf = (page: Page, name: string) => page.getByRole('group', { name }).locator('.scoreboard__cp');

/** Taps through a turn's phases to its Morale phase, then End turn, skipping any end-of-turn scoring. */
async function finishTurn(page: Page) {
  for (let i = 0; i < 6; i++) await nextPhase(page);
  await page.getByRole('button', { name: 'End turn' }).click();
  while (await page.getByRole('region', { name: /^Score:/ }).count()) {
    await page.getByRole('region', { name: /^Score:/ }).getByRole('button', { name: 'Skip' }).click();
  }
}

test('short tracked game', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  await createList(page);

  // Setup.
  await page.goto('/table');
  await expect(page.getByRole('heading', { name: 'Table companion' })).toBeVisible();
  await checkScreen(page, testInfo, 'home');
  await page.getByRole('link', { name: 'New game' }).click();
  await page.getByRole('button', { name: /^Incursion/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /11 Cleanse the Land/ }).click();
  await expect(page.getByRole('img', { name: /Deployment map/ })).toBeVisible();
  await checkScreen(page, testInfo, 'mission');
  await page.getByRole('button', { name: 'Next' }).click();
  const yours = page.getByRole('group', { name: 'Your army' });
  await yours.getByRole('radio', { name: 'Use one of my lists' }).check();
  await yours.getByRole('combobox', { name: 'List' }).selectOption({ index: 1 });
  const theirs = page.getByRole('group', { name: "Your opponent's army" });
  await theirs.getByRole('radio', { name: 'Just pick a faction' }).check();
  await theirs.getByRole('combobox', { name: 'Faction' }).selectOption('orks');
  await checkScreen(page, testInfo, 'armies');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('group', { name: 'Who is the Defender?' }).getByRole('button', { name: 'You' }).click();
  await page.getByRole('group', { name: 'Which deployment zone does the Defender pick?' }).getByRole('button', { name: 'Player A' }).click();
  await page.getByRole('group', { name: 'Who takes the first turn?' }).getByRole('button', { name: 'You' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Assassination', pressed: true })).toHaveCount(2);
  await checkScreen(page, testInfo, 'secondaries');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/\/table\/[0-9a-f-]{36}$/);

  // Round 1, your Command phase: both players gain the Battle-forged CP bonus.
  await expect(position(page)).toHaveText("Round 1 · Your turn · Command phase");
  await expect(cpOf(page, 'You')).toHaveText('7 CP');
  await expect(cpOf(page, 'Opponent')).toHaveText('7 CP');
  await checkScreen(page, testInfo, 'turn');
  // The scoreboard stays in view below the top bar when the page scrolls.
  await page.evaluate(() => window.scrollBy(0, 400));
  const overlap = await page.evaluate(() => document.querySelector('.topbar')!.getBoundingClientRect().bottom - document.querySelector('.scoreboard')!.getBoundingClientRect().top);
  expect(overlap, 'scoreboard hidden under the top bar').toBeLessThanOrEqual(1);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Shooting: use Command Re-roll.
  for (let i = 0; i < 3; i++) await nextPhase(page);
  await expect(position(page)).toHaveText("Round 1 · Your turn · Shooting phase");
  await page.getByRole('tab', { name: 'Stratagems' }).click();
  const mine = page.getByRole('region', { name: 'You (your turn)' });
  await mine.locator('article', { has: page.getByRole('heading', { name: 'Command Re-roll' }) }).getByRole('button', { name: 'Use (1 CP)' }).click();
  await expect(cpOf(page, 'You')).toHaveText('6 CP');
  await checkScreen(page, testInfo, 'stratagems');

  // Tools: dice and attack odds.
  await page.getByRole('tab', { name: 'Tools' }).click();
  await page.getByRole('button', { name: 'More: Dice' }).click();
  await page.getByRole('button', { name: 'More: Dice' }).click();
  await page.getByRole('button', { name: 'Roll 3D6' }).click();
  await expect(page.getByRole('list', { name: 'Results' }).getByRole('listitem')).toHaveCount(3);
  await checkScreen(page, testInfo, 'dice');
  await page.getByRole('tab', { name: 'Attack odds' }).click();
  await expect(page.getByRole('region', { name: 'Expected result' })).toContainText('Unsaved wounds');
  await expect(page.getByRole('region', { name: 'Expected result' })).toContainText('1.11');
  await checkScreen(page, testInfo, 'odds');
  await page.getByRole('tab', { name: 'Log' }).click();
  await expect(page.getByRole('list', { name: 'Game log' })).toContainText('Rolled 3D6');
  await expect(page.getByRole('list', { name: 'Game log' })).toContainText('You used Command Re-roll (1 CP)');

  // Finish round 1.
  await page.getByRole('tab', { name: 'Turn' }).click();
  for (let i = 0; i < 3; i++) await nextPhase(page);
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('region', { name: /^Score: You/ }).getByRole('button', { name: 'Skip' }).click();
  await expect(position(page)).toHaveText("Round 1 · Opponent's turn · Command phase");
  await finishTurn(page);

  // Round 2, your Command phase: score the primary, 2 objectives against 1.
  await expect(position(page)).toHaveText("Round 2 · Your turn · Command phase");
  await nextPhase(page);
  const score = page.getByRole('region', { name: /^Score: You/ });
  await score.getByRole('button', { name: 'More: Objective markers you control' }).click();
  await score.getByRole('button', { name: 'More: Objective markers you control' }).click();
  await score.getByRole('button', { name: 'More: Objective markers your opponent controls' }).click();
  await checkScreen(page, testInfo, 'score-prompt');
  await score.getByRole('button', { name: 'Score 12 VP' }).click();
  await expect(vpOf(page, 'You')).toHaveText('12 VP');

  // Undo, then score again.
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(vpOf(page, 'You')).toHaveText('0 VP');
  await expect(position(page)).toHaveText("Round 2 · Your turn · Command phase");
  await nextPhase(page);
  await score.getByRole('button', { name: 'More: Objective markers you control' }).click();
  await score.getByRole('button', { name: 'More: Objective markers you control' }).click();
  await score.getByRole('button', { name: 'More: Objective markers your opponent controls' }).click();
  await score.getByRole('button', { name: 'Score 12 VP' }).click();
  await expect(vpOf(page, 'You')).toHaveText('12 VP');

  // Reload mid-game resumes at the same phase.
  await expect(position(page)).toHaveText("Round 2 · Your turn · Movement phase");
  await page.reload();
  await expect(position(page)).toHaveText("Round 2 · Your turn · Movement phase");
  await expect(vpOf(page, 'You')).toHaveText('12 VP');

  // Offline: scoring still saves on the phone, marked to sync later. (Reloading the app shell offline needs the
  // production service worker, which the dev server doesn't run; that is part of the Milestone 8 offline audit.)
  await context.setOffline(true);
  await page.getByRole('tab', { name: 'Score' }).click();
  await page.getByRole('region', { name: 'You' }).getByRole('button', { name: 'More VP: Grind Them Down' }).click();
  await expect(vpOf(page, 'You')).toHaveText('13 VP');
  await checkScreen(page, testInfo, 'score-sheet');
  const gameId = page.url().split('/').pop()!.split('?')[0];
  const saved = await page.evaluate(
    (id) =>
      new Promise<{ dirty: boolean; vp: number }>((resolve, reject) => {
        const open = indexedDB.open('recruitplus');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('docs').objectStore('docs').get(id);
          get.onsuccess = () => {
            const doc = get.result as { dirty: boolean; data: { events: { t: string; vp?: number }[] } };
            resolve({ dirty: doc.dirty, vp: doc.data.events.filter((e) => e.t === 'vp').reduce((a, e) => a + (e.vp ?? 0), 0) });
          };
        };
      }),
    gameId,
  );
  expect(saved).toEqual({ dirty: true, vp: 13 });
  await context.setOffline(false);
  await page.reload();
  await expect(vpOf(page, 'You')).toHaveText('13 VP');

  // End early: the summary shows You ahead.
  await page.getByRole('button', { name: 'End the game' }).click();
  await page.getByRole('button', { name: 'We agreed to stop early' }).click();
  await expect(page).toHaveURL(/\/summary$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You win, 13 to 0.');
  await checkScreen(page, testInfo, 'summary');
  await page.getByRole('link', { name: 'Back to games' }).click();
  await expect(page.getByRole('link', { name: /Cleanse the Land/ })).toContainText('You 13 – 0 Opponent');
});
