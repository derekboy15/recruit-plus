import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { necronsList } from '../e2e-prod/data';

/**
 * No sideways scroll, every visible button at least 44px tall, and a screenshot when SHOT_DIR is set. The width is
 * checked against the viewport we set, not window.innerWidth: a phone browser widens its layout to fit content that
 * overflows, so innerWidth grows with it.
 */
async function checkScreen(page: Page, testInfo: TestInfo, name: string) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth)), `${name}: sideways scroll`).toBeLessThanOrEqual(width);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main button, main a.btn')]
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .map((b) => ({ text: (b.textContent ?? '').trim() || b.getAttribute('aria-label'), h: b.getBoundingClientRect().height }))
      .filter((b) => b.h < 44),
  );
  expect(small, `${name}: buttons under 44px`).toEqual([]);
  const smallChecks = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement>('main input[type=checkbox], main input[type=radio]')]
      .filter((i) => i.offsetParent !== null)
      .map((i) => ({
        text: [...(i.labels ?? [])].map((l) => l.textContent?.trim()).join(' ') || i.getAttribute('aria-label'),
        h: Math.max(i.getBoundingClientRect().height, ...[...(i.labels ?? [])].map((l) => l.getBoundingClientRect().height)),
      }))
      .filter((b) => b.h < 44),
  );
  expect(smallChecks, `${name}: checkboxes and radios under 44px`).toEqual([]);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/table-${name}-${testInfo.project.name}.png`, fullPage: true });
}

/**
 * Signs in and saves a Necrons list straight into the local database, as the builder would: other plans own the
 * builder screens, so this flow doesn't drive them. Returns the list's id.
 */
async function seedList(page: Page): Promise<string> {
  await page.goto('/build');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await expect(page).toHaveURL(/\/build$/);
  return page.evaluate(async (data) => {
    // Wait for the app to create its database (Dexie's version 1 is IndexedDB version 10): opening it first here
    // would create an empty one and block the app's upgrade.
    for (let i = 0; !(await indexedDB.databases()).some((d) => d.name === 'recruitplus' && (d.version ?? 0) >= 10); i++) {
      if (i > 100) throw new Error('The app never opened its database.');
      await new Promise((r) => setTimeout(r, 100));
    }
    return new Promise<string>((resolve, reject) => {
      const id = crypto.randomUUID();
      const open = indexedDB.open('recruitplus');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction('docs', 'readwrite');
          const ownerId = '00000000-0000-4000-8000-000000000001'; // the dev sign-in's user
          tx.objectStore('docs').put({ id, kind: 'list', ownerId, data, isPublic: false, deleted: false, updatedAt: Date.now(), dirty: true });
          tx.oncomplete = () => {
            open.result.close();
            resolve(id);
          };
          tx.onerror = () => reject(tx.error);
        } catch (e) {
          open.result.close();
          reject(e);
        }
      };
    });
  }, necronsList());
}

/** 43 characters: long enough to push a row, the game header or the scoreboard sideways if anything doesn't truncate. */
const OPPONENT = 'Warboss Gutrippa of the Blood Axe Kommandos';

/** Next phase stays tappable while a question is open but does nothing then, so wait for any question to be answered. */
async function nextPhase(page: Page) {
  await expect(page.getByText('Answer the question above first.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next phase' }).click();
}
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
  await seedList(page);

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
  await yours.getByRole('radio', { name: /Necrons Strike Force/ }).check();
  const theirs = page.getByRole('group', { name: "Your opponent's army" });
  await theirs.getByRole('textbox', { name: 'Name' }).fill(OPPONENT);
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
  await expect(cpOf(page, OPPONENT)).toHaveText('7 CP');
  await checkScreen(page, testInfo, 'turn-long-name');
  // The scoreboard stays in view under the sticky page header when the page scrolls. The open mission card makes the
  // page long enough to scroll at both sizes.
  await page.getByText('Mission: Cleanse the Land').click();
  await page.evaluate(() => window.scrollBy(0, 400));
  const top = await page.evaluate(() => ({
    scrolled: window.scrollY,
    head: document.querySelector('.game__top .page-head')!.getBoundingClientRect().toJSON() as DOMRect,
    board: document.querySelector('.scoreboard')!.getBoundingClientRect().toJSON() as DOMRect,
  }));
  expect(top.scrolled, 'the page scrolled').toBeGreaterThanOrEqual(400);
  expect(top.head.top, 'page header stuck to the top').toBe(0);
  expect(Math.abs(top.board.top - top.head.bottom), 'scoreboard right under the header').toBeLessThanOrEqual(1);
  expect(top.board.bottom, 'scoreboard pushed down the screen').toBeLessThanOrEqual(220);
  await page.getByText('Mission: Cleanse the Land').click();
  await page.evaluate(() => window.scrollTo(0, 0));

  // The smallest phone: the long name must truncate, not push the header or the scoreboard sideways.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 700 });
  await checkScreen(page, testInfo, 'turn-320');
  await page.setViewportSize(size);

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
  const lefts = await page.locator('.odds__grid > :nth-child(2n)').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  expect(lefts.length, 'odds controls found').toBeGreaterThan(10);
  expect(new Set(lefts).size, 'odds controls share one left edge').toBe(1);
  const oddsSize = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 700 });
  const cut = await page.locator('.odds__grid > :nth-child(2n+1)').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  expect(cut, 'odds labels overflowing into their controls at 320px').toEqual([]);
  await checkScreen(page, testInfo, 'odds-320');
  await page.setViewportSize(oddsSize);
  await page.getByRole('tab', { name: 'Log' }).click();
  await expect(page.getByRole('list', { name: 'Game log' })).toContainText('Rolled 3D6');
  await expect(page.getByRole('list', { name: 'Game log' })).toContainText('You used Command Re-roll (1 CP)');

  // Finish round 1.
  await page.getByRole('tab', { name: 'Turn' }).click();
  for (let i = 0; i < 3; i++) await nextPhase(page);
  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('region', { name: /^Score: You/ }).getByRole('button', { name: 'Skip' }).click();
  await expect(position(page)).toHaveText(`Round 1 · ${OPPONENT}'s turn · Command phase`);
  await finishTurn(page);

  // Round 2, your Command phase: score the primary, 2 objectives against 1.
  await expect(position(page)).toHaveText("Round 2 · Your turn · Command phase");
  await nextPhase(page);
  const score = page.getByRole('region', { name: /^Score: You/ });
  await score.getByRole('button', { name: 'More: Objective markers you control' }).click();
  await score.getByRole('button', { name: 'More: Objective markers you control' }).click();
  await score.getByRole('button', { name: 'More: Objective markers your opponent controls' }).click();
  await checkScreen(page, testInfo, 'score-prompt');
  const promptSize = page.viewportSize()!;
  await page.setViewportSize({ width: promptSize.width, height: 600 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const where = () =>
    page.evaluate(() => ({
      question: document.querySelector('.turn__prompt h2')!.getBoundingClientRect().top,
      header: document.querySelector('.game__top')!.getBoundingClientRect().bottom,
    }));
  expect((await where()).question, 'the question starts out scrolled under the header').toBeLessThan((await where()).header);
  await page.getByRole('button', { name: 'Next phase' }).click();
  await expect(score.getByRole('heading', { level: 2 })).toBeFocused();
  const after = await where();
  expect(after.question, 'the focused question is hidden under the sticky scoreboard').toBeGreaterThanOrEqual(after.header);
  await page.setViewportSize(promptSize);
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
  await page.getByRole('button', { name: 'Game actions' }).click();
  await page.getByRole('menuitem', { name: 'End the game…' }).click();
  await page.getByRole('dialog', { name: 'End the game' }).getByRole('button', { name: 'We agreed to stop early' }).click();
  await expect(page).toHaveURL(/\/summary$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You win, 13 to 0.');
  await checkScreen(page, testInfo, 'summary');
  await page.getByRole('link', { name: 'Back to Table games' }).click();
  await expect(page.getByRole('link', { name: /Cleanse the Land/ })).toContainText(`You 13 – 0 ${OPPONENT}`);

  // The games list at 320px, then delete the game and bring it back.
  await page.setViewportSize({ width: 320, height: 700 });
  await checkScreen(page, testInfo, 'home-320');
  // The page's one-line explanation wraps rather than being cut off.
  for (const el of ['.page-head__title', '.page-head__sub']) {
    expect(await page.locator(el).evaluate((e) => e.scrollWidth <= e.clientWidth), `${el} cut off at 320px`).toBe(true);
  }
  await page.getByRole('button', { name: 'Actions for Cleanse the Land' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('link', { name: /Cleanse the Land/ })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Game deleted');
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: /Cleanse the Land/ })).toContainText(/You 13 – 0/);
  await page.reload();
  await expect(page.getByRole('link', { name: /Cleanse the Land/ })).toContainText(/You 13 – 0/);
});
