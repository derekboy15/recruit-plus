/** The full offline audit, on the production build with its service worker. */
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { DISCLAIMER } from '../src/layout/Footer';
import { OFFLINE_NOTICE } from '../src/layout/OfflineNotice';
import { crowdedGame, necronsListNamed } from './data';
import { SESSION_KEY, sessionJson, type FakeRemote } from './fake-supabase';
import { expect, test } from './fixtures';
import { goOffline, goOnline, seedDoc, waitForServiceWorker } from './helpers';

test('shell data is precached', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  for (const url of ['/data/rules.json', '/data/missions.json', '/data/lessons.json', '/data/core-stratagems.json', '/data/index.json']) {
    expect(await page.evaluate((u) => caches.match(u, { ignoreSearch: true }).then((r) => r?.status ?? null), url), url).toBe(200);
  }
});

test("offline fallback page when the shell isn't cached", async ({ page, context }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  await page.evaluate(async () => {
    for (const name of await caches.keys()) if (name.includes('precache')) await caches.delete(name);
  });
  await goOffline(context);
  await page.goto('/learn');
  await expect(page.getByRole('heading', { name: 'Recruit+ needs one online visit' })).toBeVisible();
  await expect(page.getByText(DISCLAIMER)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

/** A table companion game of the seeded Necrons list against Necrons, just started (Arks of Omen, Cleanse the Land). */
function tableGame(listId: string) {
  const player = (name: string, extra: object) => ({
    name,
    catalogueSlug: 'necrons',
    secondaries: ['aoo-assassination', 'aoo-grind-them-down', 'aoo-behind-enemy-lines'],
    battleReady: false,
    startingCp: 6,
    ...extra,
  });
  return {
    mode: 'table',
    schema: 1,
    setup: {
      battleSize: 'incursion',
      pack: 'arks-of-omen',
      missionId: 'aoo-cleanse-the-land',
      players: { A: player('You', { listId }), B: player('Opponent', {}) },
      attacker: 'A',
      firstTurn: 'A',
    },
    events: [{ id: 'e2e-start', at: '2026-10-23T00:00:00.000Z', pos: null, t: 'start' }],
  };
}

interface Visited { listId: string; tableId: string; playId: string }

/**
 * One online visit, as a player would make it: the home page (the service worker installs), then the list, the rules,
 * a table game, a sandbox game and the Necrons pages. Then the connection drops and the page reloads.
 */
async function visitOnlineThenGoOffline(page: Page, context: BrowserContext, remote: FakeRemote): Promise<Visited> {
  const listId = seedDoc(remote, 'list', necronsListNamed('Offline list'));
  const tableId = seedDoc(remote, 'game', tableGame(listId));
  const playId = seedDoc(remote, 'game', crowdedGame());
  await page.goto('/');
  await waitForServiceWorker(page);
  const open = async (path: string, ready: Locator) => {
    await page.goto(path);
    await expect(ready).toBeVisible({ timeout: 20_000 });
  };
  await open(`/build/${listId}`, page.getByRole('meter', { name: 'Points' }));
  await open('/rules', page.getByRole('heading', { name: 'Rules', level: 1 }));
  await open(`/table/${tableId}`, page.locator('.scoreboard__pos'));
  await open(`/play/${playId}`, page.getByRole('application', { name: /Battlefield/ }));
  await open('/factions/necrons', page.getByRole('heading', { name: 'Necrons', level: 1 }));
  await open('/factions/necrons/units/necron-warriors', page.getByRole('heading', { name: 'Necron Warriors', level: 1 }));
  await goOffline(context);
  await page.reload();
  return { listId, tableId, playId };
}

test.describe('after one online visit', () => {
  test.beforeEach(({ signedIn }) => void signedIn);

  test('app shell offline', async ({ page, context, remote }) => {
    await visitOnlineThenGoOffline(page, context, remote);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Learn, build and play/);
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
  });

  test('rules reference offline', async ({ page, context, remote }) => {
    await visitOnlineThenGoOffline(page, context, remote);
    await page.goto('/rules');
    await expect(page.getByRole('heading', { name: 'Rules', level: 1 })).toBeVisible();
    await page.goto('/rules/glossary');
    await expect(page.getByText('Engagement Range').first()).toBeVisible();
    await page.goto('/rules/stratagems');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('lessons offline', async ({ page, context, remote }) => {
    await visitOnlineThenGoOffline(page, context, remote);
    await page.goto('/learn');
    await expect(page.getByRole('list', { name: 'Lessons' }).getByRole('listitem')).toHaveCount(15);
    await page.goto('/learn/what-is-40k');
    await expect(page.getByRole('heading', { name: 'What 40k is', level: 1 })).toBeVisible();
    await page.goto('/learn/what-is-40k/drill');
    await expect(page.getByRole('region', { name: 'Drill' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('application')).toBeVisible();
  });

  test('lists offline', async ({ page, context, remote }) => {
    const { listId } = await visitOnlineThenGoOffline(page, context, remote);
    await page.goto('/build');
    await expect(page.getByRole('link', { name: /Offline list/ })).toBeVisible();
    await page.goto(`/build/${listId}`);
    const points = page.getByRole('meter', { name: 'Points' });
    const before = (await points.getAttribute('aria-valuenow')) ?? '';
    await page.getByRole('button', { name: '+ Add unit' }).click();
    const picker = page.getByRole('dialog', { name: 'Add a unit' });
    await picker.getByRole('searchbox', { name: 'Search units' }).fill('warriors');
    await picker.getByRole('button', { name: /^Necron Warriors/ }).click();
    await page.getByRole('dialog', { name: 'Necron Warriors' }).getByRole('button', { name: 'Done' }).click();
    await expect(points).not.toHaveAttribute('aria-valuenow', before);
  });

  test('offline reload of a table game resumes it', async ({ page, context, remote }) => {
    const { tableId } = await visitOnlineThenGoOffline(page, context, remote);
    await page.goto(`/table/${tableId}`);
    const pos = page.locator('.scoreboard__pos');
    await expect(pos).toContainText('Round 1');
    await expect(pos).toContainText('Command');
    await page.getByRole('button', { name: 'Next phase' }).click();
    await expect(pos).toContainText('Movement');
    await page.reload();
    await expect(pos).toContainText('Movement');
  });

  test('offline reload of a sandbox game resumes it', async ({ page, context, remote }) => {
    const { playId } = await visitOnlineThenGoOffline(page, context, remote);
    await page.goto(`/play/${playId}`);
    await expect(page.getByRole('application', { name: /Battlefield/ })).toBeVisible();
    await expect(page.getByText('Round 1 · Command')).toBeVisible();
  });

  test('faction data used so far offline', async ({ page, context, remote }) => {
    await visitOnlineThenGoOffline(page, context, remote);
    await page.goto('/factions/necrons');
    await expect(page.getByRole('heading', { name: 'Necrons', level: 1 })).toBeVisible();
    await page.goto('/factions/necrons/units/necron-warriors');
    await expect(page.getByRole('heading', { name: 'Necron Warriors', level: 1 })).toBeVisible();
  });

  test('unvisited faction offline shows the offline notice', async ({ page, context, remote }) => {
    await visitOnlineThenGoOffline(page, context, remote);
    await page.goto('/factions/orks');
    await expect(page.getByRole('status')).toHaveText(OFFLINE_NOTICE);
  });

  test('sync resumes when back online', async ({ page, context, remote }) => {
    const { listId } = await visitOnlineThenGoOffline(page, context, remote);
    await page.goto(`/build/${listId}`);
    const name = page.getByRole('textbox', { name: 'List name' });
    await name.fill('Renamed offline');
    await name.blur();
    const pushedBefore = remote.pushes.length;
    await page.waitForTimeout(1000);
    expect(remote.pushes.length).toBe(pushedBefore);
    await goOnline(context);
    const renamed = () => remote.rows.some((r) => r.id === listId && (r.data as { roster: { name: string } }).roster.name === 'Renamed offline');
    await expect.poll(renamed, { timeout: 10_000 }).toBe(true);
  });
});

test('expired session offline still opens lists', async ({ page, context, remote }) => {
  await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [SESSION_KEY, sessionJson({ expired: true })] as const);
  seedDoc(remote, 'list', necronsListNamed('Expired session list'));
  await page.goto('/build');
  await expect(page.getByRole('link', { name: /Expired session list/ })).toBeVisible({ timeout: 20_000 });
  await waitForServiceWorker(page);
  await goOffline(context);
  await page.reload();
  await expect(page.getByRole('link', { name: /Expired session list/ })).toBeVisible();
  await expect(page).toHaveURL(/\/build$/);
});
