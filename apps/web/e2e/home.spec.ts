import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The signed-in home: your next lesson, your latest lists with Play, and games in progress. Lists and games are seeded
 * straight into the local database (the builder screens are not this spec's business).
 */

const LONG_NAME = 'Szarekhan Dynasty Strike Force with a very long name that never fits on a phone';

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Continue (dev)' }).click();
  await expect(page).toHaveURL(/\/learn$/);
  // The Learn page has read progress from the local database, so the app has created it before we seed it.
  await expect(page.getByRole('heading', { name: 'Learn to play', level: 1 })).toBeVisible({ timeout: 20_000 });
}

/** Puts a list and an unfinished table game for the signed-in user into IndexedDB. */
async function seed(page: Page): Promise<{ listId: string; gameId: string }> {
  return page.evaluate(async (longName) => {
    const user = JSON.parse(localStorage.getItem('recruit.lastUser') ?? '{}') as { id: string };
    const now = Date.now();
    const doc = (kind: string, data: unknown, ago: number) => ({
      id: crypto.randomUUID(), kind, ownerId: user.id, updatedAt: now - ago, deleted: false, isPublic: false, dirty: true, data,
    });
    const list = doc('list', {
      roster: { schema: 1, name: longName, catalogueId: 'x', battleSize: 'strike-force', forces: [] },
      summary: { catalogueSlug: 'necrons', faction: 'Necrons', battleSize: 'strike-force', points: 1995, pointsLimit: 2000, issueCount: 2 },
    }, 60_000);
    const game = doc('game', {
      mode: 'table', schema: 1, setup: { players: { A: { name: 'You' }, B: { name: 'Opponent' } } }, events: [],
    }, 3_600_000);
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('recruitplus');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('docs', 'readwrite');
        for (const d of [list, game]) tx.objectStore('docs').put(d);
        // Close at once: an open connection would block the app's own database upgrades.
        tx.oncomplete = () => (open.result.close(), resolve());
        tx.onerror = () => (open.result.close(), reject(tx.error));
      };
    });
    return { listId: list.id, gameId: game.id };
  }, LONG_NAME);
}

test('home picks up your lesson, lists and games', async ({ page }) => {
  await signIn(page);
  const { listId, gameId } = await seed(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Continue learning' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lesson 1: What 40k is' })).toHaveAttribute('href', '/learn/what-is-40k');
  const play = page.getByRole('link', { name: `Play ${LONG_NAME}` });
  await expect(play).toBeVisible();
  await expect(play).toHaveAttribute('href', `/build/${listId}/play`);
  await expect(page.getByRole('link', { name: LONG_NAME, exact: true })).toHaveAttribute('href', `/build/${listId}`);
  await expect(page.getByText('Necrons · Strike Force · 1,995 / 2,000 pts')).toBeVisible();
  await expect(page.getByRole('link', { name: 'You vs Opponent' })).toHaveAttribute('href', `/table/${gameId}`);
  await expect(page.getByRole('link', { name: /sign in/i })).toHaveCount(0);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});

test('home dashboard has no sideways scroll at 320px', async ({ page }) => {
  await signIn(page);
  await seed(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: `Play ${LONG_NAME}` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  // The long name is cut with an ellipsis rather than widening the row; Play stays a 44px target.
  const name = page.getByRole('link', { name: LONG_NAME, exact: true });
  expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const box = (await page.getByRole('link', { name: `Play ${LONG_NAME}` }).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  // On a narrow phone Play is the icon alone, centred in its square.
  expect(await page.getByRole('link', { name: `Play ${LONG_NAME}` }).evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('0px');
});

test('signed out, every feature card on the landing page opens its tab', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in to start' })).toBeVisible();
  for (const [name, href] of [
    ['Learn', '/learn'],
    ['Lists', '/build'],
    ['Practice', '/play'],
    ['Table', '/table'],
    ['Rules', '/rules'],
  ]) {
    await expect(page.locator('main').getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute('href', href);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
