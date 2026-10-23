/** The non-affiliation disclaimer is on every page, and the data credits are on /legal. */
import { DISCLAIMER } from '../src/layout/Footer';
import { crowdedGame, necronsListNamed } from './data';
import { expect, test } from './fixtures';
import { seedDoc } from './helpers';
import { tableGame } from './seeds';

test('disclaimer on every page', async ({ page, remote, signedIn }) => {
  void signedIn;
  test.setTimeout(180_000);
  const listId = seedDoc(remote, 'list', necronsListNamed('Legal list'), { isPublic: true });
  const tableId = seedDoc(remote, 'game', tableGame(listId));
  const playId = seedDoc(remote, 'game', crowdedGame());
  const rules = await (await page.request.get('/data/rules.json')).json();
  const articleId: string = rules.articles[0].id;
  const paths = [
    '/', '/legal', '/privacy', '/terms',
    '/learn', '/learn/what-is-40k', '/learn/what-is-40k/drill', '/learn/first-game',
    '/build', '/build/new', `/build/${listId}`, `/share/${listId}`,
    '/play', '/play/new', `/play/${playId}`,
    '/table', '/table/new', `/table/${tableId}`,
    '/rules', '/rules/glossary', '/rules/stratagems', '/rules/factions', `/rules/${articleId}`, '/rules/reports',
    '/factions', '/factions/necrons', '/factions/necrons/guide', '/factions/necrons/stratagems', '/factions/necrons/units/necron-warriors',
    '/offline.html',
  ];
  const missing: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    // Wait for the page's own content (a heading, or the board on a game page) before looking for the footer.
    const content = page.locator('h1, h2, [role=application], .scoreboard__pos').filter({ visible: true }).first();
    await expect(content, `content of ${path}`).toBeVisible({ timeout: 20_000 });
    if ((await page.getByText(DISCLAIMER, { exact: true }).count()) === 0) missing.push(path);
  }
  expect(missing).toEqual([]);
});

test('sign-in page shows the disclaimer', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByText(DISCLAIMER, { exact: true })).toBeAttached();
});

test('credits are on /legal', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByText(/BSData/).first()).toBeVisible();
  await expect(page.getByText(/partly powered by Wahapedia/i).first()).toBeVisible();
});
